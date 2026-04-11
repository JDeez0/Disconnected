import json
import logging
import requests
from requests.adapters import HTTPAdapter, Retry
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction, models
from django.db.models import Exists, OuterRef, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from rest_framework import status, viewsets
from rest_framework.generics import ListCreateAPIView
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from .models import (
    Message, Room, RoomMember, Outbox, CDC, Friendship, FriendRequest, Block, UserStatus,
    Activity, ActivityPreset, ACTIVITY_COLORS
)
from .serializers import (
    MessageSerializer, RoomSearchSerializer, RoomSerializer, RoomMemberSerializer,
    UserWithStatusSerializer, FriendshipSerializer, FriendRequestSerializer,
    BlockSerializer, UserStatusSerializer, ActivitySerializer, ActivityPresetSerializer,
    ActivityCreateSerializer, ActivityPublicSerializer, UserActivitySerializer
)
from datetime import timedelta


class RoomListViewSet(ListModelMixin, GenericViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Room.objects.annotate(
            member_count=Count('memberships__id')
        ).filter(
            memberships__user_id=self.request.user.pk
        ).select_related('last_message', 'last_message__user').order_by('-bumped_at')


class RoomDetailViewSet(RetrieveModelMixin, GenericViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Room.objects.annotate(
            member_count=Count('memberships')
        ).filter(memberships__user_id=self.request.user.pk)


class RoomSearchViewSet(viewsets.ModelViewSet):
    serializer_class = RoomSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_membership = RoomMember.objects.filter(
            room=OuterRef('pk'),
            user=user
        )
        return Room.objects.annotate(
            is_member=Exists(user_membership)
        ).order_by('name')


class CentrifugoMixin:
    # A helper method to return the list of channels for all current members of specific room.
    # So that the change in the room may be broadcasted to all the members.
    def get_room_member_channels(self, room_id):
        members = RoomMember.objects.filter(room_id=room_id).values_list('user', flat=True)
        return [f'personal:{user_id}' for user_id in members]

    def broadcast_room(self, room, broadcast_payload):
        room_id = room.pk
        room_name = room.name

        # Using Centrifugo HTTP API is the simplest way to send real-time message, and usually
        # it provides the best latency. The trade-off here is that error here may result in
        # lost real-time event. Depending on the application requirements this may be fine or not.  
        def broadcast():
            session = requests.Session()
            retries = Retry(total=1, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
            session.mount('http://', HTTPAdapter(max_retries=retries))
            try:
                session.post(
                    settings.CENTRIFUGO_HTTP_API_ENDPOINT + '/api/broadcast',
                    data=json.dumps(broadcast_payload),
                    headers={
                        'Content-type': 'application/json', 
                        'X-API-Key': settings.CENTRIFUGO_HTTP_API_KEY,
                        'X-Centrifugo-Error-Mode': 'transport'
                    }
                )
            except requests.exceptions.RequestException as e:
                logging.error(e)

        if settings.CENTRIFUGO_BROADCAST_MODE == 'api':
            # We need to use on_commit here to not send notification to Centrifugo before
            # changes applied to the database. Since we are inside transaction.atomic block
            # broadcast will happen only after successful transaction commit.
            transaction.on_commit(broadcast)

        elif settings.CENTRIFUGO_BROADCAST_MODE == 'outbox':
            # In outbox case we can set partition for parallel processing, but
            # it must be in predefined range and match Centrifugo PostgreSQL
            # consumer configuration.
            partition = hash(room_id)%settings.CENTRIFUGO_OUTBOX_PARTITIONS
            # Creating outbox object inside transaction will guarantee that Centrifugo will
            # process the command at some point. In normal conditions – almost instantly.
            Outbox.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)

        elif settings.CENTRIFUGO_BROADCAST_MODE == 'cdc':
            # In cdc case Debezium will use this field for setting Kafka partition.
            # We should not prepare proper partition ourselves in this case.
            partition = hash(room_id)
            # Creating outbox object inside transaction will guarantee that Centrifugo will
            # process the command at some point. In normal conditions – almost instantly. In this
            # app Debezium will perform CDC and send outbox events to Kafka, event will be then
            # consumed by Centrifugo. The advantages here is that Debezium reads WAL changes and
            # has a negligible overhead on database performance. And most efficient partitioning.
            # The trade-off is that more hops add more real-time event delivery latency. May be
            # still instant enough though.
            CDC.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)

        elif settings.CENTRIFUGO_BROADCAST_MODE == 'api_cdc':
            if len(broadcast_payload['channels']) <= 1000000:
                # We only use low-latency broadcast over API for not too big rooms, it's possible
                # to adjust as required of course.
                transaction.on_commit(broadcast)

            partition = hash(room_id)
            CDC.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)

        else:
            raise ValueError(f'unknown CENTRIFUGO_BROADCAST_MODE: {settings.CENTRIFUGO_BROADCAST_MODE}')

        is_message_added = broadcast_payload.get('data', {}).get('type') == 'message_added'
        if is_message_added and settings.PUSH_NOTIFICATIONS_ENABLED and 'cdc' in settings.CENTRIFUGO_BROADCAST_MODE:
            partition = hash(room_id)
            payload = {
                "recipient": {
                    "filter": {
                        "topics": [f'chat:messages:{room_id}']
                    }
                },
                "notification": {
                    "fcm": {
                        "message": {
                            "notification": {
                                "title": room_name,
                                "body": broadcast_payload.get('data', {}).get('body', {}).get('content', '')
                            },
                            "webpush": {
                              "fcm_options": {
                                "link": f'http://localhost:9000/rooms/{room_id}'
                              }
                            }
                        }
                    }
                }
            }
            CDC.objects.create(method='send_push_notification', payload=payload, partition=partition)

    def update_user_room_topic(self, user_id, room_id, op):
        if not settings.PUSH_NOTIFICATIONS_ENABLED:
            return
        if 'cdc' not in settings.CENTRIFUGO_BROADCAST_MODE:
            return
        partition = hash(room_id)
        CDC.objects.create(method='user_topic_update', payload={
            'user': str(user_id),
            'topics': ['chat:messages:' + str(room_id)],
            'op': op
        }, partition=partition)


class MessageListCreateAPIView(ListCreateAPIView, CentrifugoMixin):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs['room_id']
        get_object_or_404(RoomMember, user=self.request.user, room_id=room_id)
        return Message.objects.filter(
            room_id=room_id).prefetch_related('user', 'room').order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        room_id = self.kwargs['room_id']
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        channels = self.get_room_member_channels(room_id)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(room=room, user=request.user)
        room.last_message = obj
        room.bumped_at = timezone.now()
        room.save()
        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'message_added',
                'body': serializer.data
            },
            'idempotency_key': f'message_{serializer.data["id"]}'
        }
        self.broadcast_room(room, broadcast_payload)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class JoinRoomView(APIView, CentrifugoMixin):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, room_id):
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        if RoomMember.objects.filter(user=request.user, room=room).exists():
            return Response({"message": "already a member"}, status=status.HTTP_409_CONFLICT)
        obj, _ = RoomMember.objects.get_or_create(user=request.user, room=room)
        channels = self.get_room_member_channels(room_id)
        obj.room.member_count = len(channels)
        body = RoomMemberSerializer(obj).data

        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'user_joined',
                'body': body
            },
            'idempotency_key': f'user_joined_{obj.pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        self.update_user_room_topic(request.user.pk, room_id, 'add')
        return Response(body, status=status.HTTP_200_OK)


class LeaveRoomView(APIView, CentrifugoMixin):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, room_id):
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        channels = self.get_room_member_channels(room_id)
        obj = get_object_or_404(RoomMember, user=request.user, room=room)
        obj.room.member_count = len(channels) - 1
        pk = obj.pk
        obj.delete()
        body = RoomMemberSerializer(obj).data

        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'user_left',
                'body': body
            },
            'idempotency_key': f'user_left_{pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        self.update_user_room_topic(request.user.pk, room_id, 'remove')
        return Response(body, status=status.HTTP_200_OK)


# ============ FRIENDSHIP VIEWS ============

class SearchUsersView(APIView):
    """Search for users by username or email."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.GET.get('q', '').strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        # Get IDs of current friends, blocked users, and pending requests
        friend_ids = set()
        blocked_ids = set()
        pending_request_ids = set()

        # Get friendships
        friendships = Friendship.objects.filter(
            models.Q(user1=request.user) | models.Q(user2=request.user)
        )
        for f in friendships:
            friend_id = f.user2.pk if f.user1 == request.user else f.user1.pk
            friend_ids.add(friend_id)

        # Get blocked users
        blocks = Block.objects.filter(blocker=request.user)
        blocked_ids = set(blocks.values_list('blocked_id', flat=True))

        # Get pending requests
        sent_requests = FriendRequest.objects.filter(
            from_user=request.user, status='pending'
        ).values_list('to_user_id', flat=True)
        pending_request_ids.update(sent_requests)

        received_requests = FriendRequest.objects.filter(
            to_user=request.user, status='pending'
        ).values_list('from_user_id', flat=True)
        pending_request_ids.update(received_requests)

        # Search users
        users = User.objects.filter(
            models.Q(username__icontains=query) | models.Q(email__icontains=query)
        ).exclude(
            pk=request.user.pk
        ).select_related('status').distinct()

        # Serialize results with additional info
        results = []
        for user in users:
            is_friend = user.pk in friend_ids
            is_blocked = user.pk in blocked_ids
            has_pending_request = user.pk in pending_request_ids
            is_blocked_by = Block.objects.filter(
                blocker=user, blocked=request.user
            ).exists()

            # Skip if blocked by other user or current user blocked them
            if is_blocked or is_blocked_by:
                continue

            user_data = UserWithStatusSerializer(user).data
            user_data['is_friend'] = is_friend
            user_data['has_pending_request'] = has_pending_request
            user_data['request_sent_by_me'] = user.pk in sent_requests
            user_data['request_received'] = user.pk in received_requests
            results.append(user_data)

        return Response(results, status=status.HTTP_200_OK)


class FriendsListView(APIView):
    """Get list of friends with their status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        friendships = Friendship.objects.filter(
            models.Q(user1=request.user) | models.Q(user2=request.user)
        ).select_related('user1__status', 'user2__status')

        serializer = FriendshipSerializer(friendships, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class FriendRequestsView(APIView):
    """Get pending friend requests (both sent and received)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        type_filter = request.GET.get('type', 'all')  # 'sent', 'received', or 'all'

        queryset = FriendRequest.objects.filter(status='pending')

        if type_filter == 'sent':
            queryset = queryset.filter(from_user=request.user)
        elif type_filter == 'received':
            queryset = queryset.filter(to_user=request.user)
        else:
            queryset = queryset.filter(
                models.Q(from_user=request.user) | models.Q(to_user=request.user)
            )

        queryset = queryset.select_related('from_user__status', 'to_user__status')
        serializer = FriendRequestSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SendFriendRequestView(APIView):
    """Send a friend request to another user."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        # Check if blocking exists
        if Block.objects.filter(
            models.Q(blocker=request.user, blocked_id=user_id) |
            models.Q(blocker_id=user_id, blocked=request.user)
        ).exists():
            return Response(
                {'detail': 'Cannot send friend request due to block'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if already friends
        if Friendship.objects.filter(
            models.Q(user1=request.user, user2_id=user_id) |
            models.Q(user1_id=user_id, user2=request.user)
        ).exists():
            return Response(
                {'detail': 'Already friends with this user'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if request already exists
        if FriendRequest.objects.filter(
            models.Q(from_user=request.user, to_user_id=user_id) |
            models.Q(from_user_id=user_id, to_user=request.user),
            status='pending'
        ).exists():
            return Response(
                {'detail': 'Friend request already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            to_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create friend request
        friend_request = FriendRequest.objects.create(
            from_user=request.user,
            to_user=to_user,
            status='pending'
        )

        serializer = FriendRequestSerializer(friend_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AcceptFriendRequestView(APIView):
    """Accept a friend request."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        try:
            friend_request = FriendRequest.objects.get(
                pk=request_id,
                to_user=request.user,
                status='pending'
            )
        except FriendRequest.DoesNotExist:
            return Response(
                {'detail': 'Friend request not found or already processed'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create friendship
        with transaction.atomic():
            friendship, _ = Friendship.objects.get_or_create(
                user1=friend_request.from_user,
                user2=friend_request.to_user
            )
            friend_request.status = 'accepted'
            friend_request.save()

        serializer = FriendshipSerializer(friendship, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class RejectFriendRequestView(APIView):
    """Reject a friend request."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        try:
            friend_request = FriendRequest.objects.get(
                pk=request_id,
                to_user=request.user,
                status='pending'
            )
        except FriendRequest.DoesNotExist:
            return Response(
                {'detail': 'Friend request not found or already processed'},
                status=status.HTTP_404_NOT_FOUND
            )

        friend_request.status = 'rejected'
        friend_request.save()

        return Response({'message': 'Friend request rejected'}, status=status.HTTP_200_OK)


class CancelFriendRequestView(APIView):
    """Cancel a pending friend request."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        try:
            friend_request = FriendRequest.objects.get(
                pk=request_id,
                from_user=request.user,
                status='pending'
            )
        except FriendRequest.DoesNotExist:
            return Response(
                {'detail': 'Friend request not found or already processed'},
                status=status.HTTP_404_NOT_FOUND
            )

        friend_request.status = 'cancelled'
        friend_request.save()

        return Response({'message': 'Friend request cancelled'}, status=status.HTTP_200_OK)


class UnfriendView(APIView):
    """Remove a friend."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        try:
            friendship = Friendship.objects.get(
                models.Q(user1=request.user, user2_id=user_id) |
                models.Q(user1_id=user_id, user2=request.user)
            )
        except Friendship.DoesNotExist:
            return Response(
                {'detail': 'Friendship not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        friendship.delete()
        return Response({'message': 'Unfriended successfully'}, status=status.HTTP_200_OK)


class BlockUserView(APIView):
    """Block a user."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if user_id == request.user.pk:
            return Response(
                {'detail': 'Cannot block yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Remove friendship if exists
        Friendship.objects.filter(
            models.Q(user1=request.user, user2_id=user_id) |
            models.Q(user1_id=user_id, user2=request.user)
        ).delete()

        # Cancel any pending requests
        FriendRequest.objects.filter(
            models.Q(from_user=request.user, to_user_id=user_id) |
            models.Q(from_user_id=user_id, to_user=request.user),
            status='pending'
        ).update(status='cancelled')

        # Create block
        block, created = Block.objects.get_or_create(
            blocker=request.user,
            blocked_id=user_id
        )

        serializer = BlockSerializer(block)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class UnblockUserView(APIView):
    """Unblock a user."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        try:
            block = Block.objects.get(
                blocker=request.user,
                blocked_id=user_id
            )
            block.delete()
            return Response({'message': 'Unblocked successfully'}, status=status.HTTP_200_OK)
        except Block.DoesNotExist:
            return Response(
                {'detail': 'Block not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class BlockedUsersView(APIView):
    """Get list of blocked users."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        blocks = Block.objects.filter(
            blocker=request.user
        ).select_related('blocked__status')

        serializer = BlockSerializer(blocks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SetUserStatusView(APIView):
    """Set user's online status and custom status."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        status_choice = request.data.get('status', 'online')
        custom_status = request.data.get('custom_status', '')

        # Validate status choice
        valid_statuses = ['online', 'away', 'busy', 'offline']
        if status_choice not in valid_statuses:
            return Response(
                {'detail': f'Invalid status. Must be one of: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate custom status length
        if custom_status and len(custom_status) > 140:
            return Response(
                {'detail': 'Custom status must be 140 characters or less'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_status, created = UserStatus.objects.update_or_create(
            user=request.user,
            defaults={
                'status': status_choice,
                'custom_status': custom_status if custom_status else None
            }
        )

        serializer = UserStatusSerializer(user_status)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GetUserStatusView(APIView):
    """Get a user's status (deprecated, use GetUserActivityView)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if blocked
        if Block.objects.filter(
            models.Q(blocker=request.user, blocked=user) |
            models.Q(blocker=user, blocked=request.user)
        ).exists():
            return Response(
                {'detail': 'Cannot view status of blocked user'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            user_status = user.status
            serializer = UserStatusSerializer(user_status)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except UserStatus.DoesNotExist:
            # Return default offline status
            return Response({
                'username': user.username,
                'status': 'offline',
                'custom_status': None,
                'is_online': False,
                'last_seen': None
            }, status=status.HTTP_200_OK)


# ============ ACTIVITY VIEWS ============

class GetAvailableColorsView(APIView):
    """Get available colors for activities."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ACTIVITY_COLORS, status=status.HTTP_200_OK)


class CurrentActivityView(APIView):
    """Get or set the current user's activity."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            activity = request.user.activity
            serializer = ActivitySerializer(activity)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Activity.DoesNotExist:
            return Response(None, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ActivityCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        activity = serializer.save()
        response_serializer = ActivitySerializer(activity)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def put(self, request):
        try:
            activity = request.user.activity
            serializer = ActivityCreateSerializer(activity, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            activity = serializer.save()
            response_serializer = ActivitySerializer(activity)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Activity.DoesNotExist:
            # Create new activity if none exists
            serializer = ActivityCreateSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            activity = serializer.save()
            response_serializer = ActivitySerializer(activity)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class ClearActivityView(APIView):
    """Clear the current user's activity."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Activity.objects.filter(user=request.user).delete()
        return Response({'message': 'Activity cleared'}, status=status.HTTP_200_OK)


class GetUserActivityView(APIView):
    """Get a user's visible activity."""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if blocked
        if Block.objects.filter(
            models.Q(blocker=request.user, blocked=user) |
            models.Q(blocker=user, blocked=request.user)
        ).exists():
            return Response(None, status=status.HTTP_403_FORBIDDEN)

        # Check if friends
        are_friends = Friendship.objects.filter(
            models.Q(user1=request.user, user2=user) |
            models.Q(user1=user, user2=request.user)
        ).exists()

        if not are_friends:
            return Response(None, status=status.HTTP_200_OK)

        # Get visible activity
        try:
            activity = user.activity
            if activity.is_visible_to(request.user) and not activity.is_expired():
                serializer = ActivityPublicSerializer({
                    'name': activity.name,
                    'color': activity.color
                })
                return Response(serializer.data, status=status.HTTP_200_OK)
        except Activity.DoesNotExist:
            pass

        return Response(None, status=status.HTTP_200_OK)


class ActivityPresetListView(APIView):
    """List and create activity presets for the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        presets = ActivityPreset.objects.filter(user=request.user)
        serializer = ActivityPresetSerializer(presets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ActivityPresetSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ActivityPresetDetailView(APIView):
    """Get, update, or delete an activity preset."""
    permission_classes = [IsAuthenticated]

    def get_object(self, request, preset_id):
        try:
            return ActivityPreset.objects.get(pk=preset_id, user=request.user)
        except ActivityPreset.DoesNotExist:
            return None

    def get(self, request, preset_id):
        preset = self.get_object(request, preset_id)
        if not preset:
            return Response(
                {'detail': 'Preset not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ActivityPresetSerializer(preset)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, preset_id):
        preset = self.get_object(request, preset_id)
        if not preset:
            return Response(
                {'detail': 'Preset not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ActivityPresetSerializer(preset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, preset_id):
        preset = self.get_object(request, preset_id)
        if not preset:
            return Response(
                {'detail': 'Preset not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        preset.delete()
        return Response({'message': 'Preset deleted'}, status=status.HTTP_200_OK)


class ApplyActivityPresetView(APIView):
    """Apply a preset as the current activity."""
    permission_classes = [IsAuthenticated]

    def post(self, request, preset_id):
        try:
            preset = ActivityPreset.objects.get(pk=preset_id, user=request.user)
        except ActivityPreset.DoesNotExist:
            return Response(
                {'detail': 'Preset not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete existing activity
        Activity.objects.filter(user=request.user).delete()

        # Create new activity from preset
        activity_data = request.data.get('activity', {})
        visibility_type = activity_data.get('visibility_type', 'all_friends')
        room_ids = activity_data.get('room_ids', [])
        duration_type = activity_data.get('duration_type', 'indefinite')

        # Calculate expiration
        expires_at = None
        if duration_type == 'hour':
            expires_at = timezone.now() + timedelta(hours=1)
        elif duration_type == 'day':
            expires_at = timezone.now() + timedelta(days=1)

        activity = Activity.objects.create(
            user=request.user,
            name=preset.name,
            color=preset.color,
            visibility_type=visibility_type,
            duration_type=duration_type,
            expires_at=expires_at
        )

        if room_ids:
            activity.rooms.set(room_ids)

        serializer = ActivitySerializer(activity)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GetUserRoomsView(APIView):
    """Get list of rooms the current user is a member of (for activity visibility)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rooms = RoomMember.objects.filter(
            user=request.user
        ).select_related('room').order_by('room__name')

        room_list = [
            {
                'id': rm.room.id,
                'name': rm.room.name
            }
            for rm in rooms
        ]

        return Response(room_list, status=status.HTTP_200_OK)


# ============ PROFILE VIEWS ============

class ProfileView(APIView):
    """Get current user's profile information."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            activity = user.activity
            activity_data = {
                'name': activity.name,
                'color': activity.color,
                'is_expired': activity.is_expired()
            }
        except Activity.DoesNotExist:
            activity_data = None

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'date_joined': user.date_joined,
            'activity': activity_data
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """Change current user's password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response(
                {'detail': 'Old password and new password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 6:
            return Response(
                {'detail': 'New password must be at least 6 characters'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        if not user.check_password(old_password):
            return Response(
                {'detail': 'Incorrect old password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)


class DeleteAccountView(APIView):
    """Delete current user's account."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        password = request.data.get('password')

        if not password:
            return Response(
                {'detail': 'Password is required to delete account'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        if not user.check_password(password):
            return Response(
                {'detail': 'Incorrect password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = user.username
        user.delete()

        return Response(
            {'message': f'Account {username} has been deleted'},
            status=status.HTTP_200_OK
        )
