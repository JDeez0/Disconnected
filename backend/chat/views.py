import json
import logging
import requests
from requests.adapters import HTTPAdapter, Retry
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction, models
from django.db.models import Exists, OuterRef, Count, Sum
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
    Activity, ActivityPreset, ACTIVITY_COLORS, BannedUser, DailyScreenTime
)
from .serializers import (
    MessageSerializer, RoomSearchSerializer, RoomSerializer, RoomMemberSerializer,
    UserWithStatusSerializer, FriendshipSerializer, FriendRequestSerializer,
    BlockSerializer, UserStatusSerializer, ActivitySerializer, ActivityPresetSerializer,
    ActivityCreateSerializer, ActivityPublicSerializer, UserActivitySerializer,
    DailyScreenTimeSerializer, LeaderboardEntrySerializer
)

class RoomListViewSet(ListModelMixin, GenericViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Room.objects.annotate(
            member_count=Count('members__id')
        ).filter(
            members__user_id=self.request.user.pk
        ).select_related('founder').order_by('-bumped_at')


class RoomDetailViewSet(RetrieveModelMixin, GenericViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Room.objects.annotate(
            member_count=Count('members')
        ).filter(members__user_id=self.request.user.pk)


class RoomSearchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RoomSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        query = self.request.GET.get('q', '').strip()
        if not query:
            return Room.objects.none()
            
        user_membership = RoomMember.objects.filter(
            room=OuterRef('pk'),
            user=user
        )
        return Room.objects.filter(name__icontains=query).annotate(
            is_member=Exists(user_membership)
        ).order_by('name')


class RoomCreateViewSet(viewsets.GenericViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def create(self, request):
        name = request.data.get('name')
        password = request.data.get('password', '')
        color = request.data.get('color', '#3280b4')
        timezone_str = request.data.get('timezone', 'UTC')

        if not name:
            return Response({"detail": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

        if Room.objects.filter(name=name).exists():
            return Response({"detail": "Group with this name already exists"}, status=status.HTTP_409_CONFLICT)

        room = Room.objects.create(
            name=name,
            password=password,
            color=color,
            founder=request.user,
            timezone=timezone_str
        )
        RoomMember.objects.create(user=request.user, room=room)
        
        # Annotate with member_count to avoid serializer crash
        room = Room.objects.annotate(
            member_count=Count('members__id')
        ).get(pk=room.pk)
        
        return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


class CentrifugoMixin:
    def get_room_member_channels(self, room_id):
        members = RoomMember.objects.filter(room_id=room_id).values_list('user', flat=True)
        return [f'personal:{user_id}' for user_id in members]

    def broadcast_room(self, room, broadcast_payload):
        room_id = room.pk
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
            transaction.on_commit(broadcast)

    def update_user_room_topic(self, user_id, room_id, op):
        pass


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
        room.version += 1
        channels = self.get_room_member_channels(room_id)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(room=room, user=request.user)
        room.bumped_at = timezone.now()
        room.save()
        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'message_added',
                'body': serializer.data
            },
            'idempotency_key': f'message_{obj.pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class JoinRoomView(APIView, CentrifugoMixin):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, room_id):
        password = request.data.get('password', '').strip()
        room = Room.objects.select_for_update().get(id=room_id)
        
        if BannedUser.objects.filter(user=request.user, room=room).exists():
            return Response({"detail": "You are banned from this group"}, status=status.HTTP_403_FORBIDDEN)

        if room.password and room.password != password:
            return Response({"detail": "Incorrect password"}, status=status.HTTP_401_UNAUTHORIZED)

        if RoomMember.objects.filter(user=request.user, room=room).exists():
            return Response({"message": "already a member"}, status=status.HTTP_409_CONFLICT)
        
        obj, _ = RoomMember.objects.get_or_create(user=request.user, room=room)
        channels = self.get_room_member_channels(room_id)
        body = RoomMemberSerializer(obj).data

        broadcast_payload = {
            'channels': channels,
            'data': { 'type': 'user_joined', 'body': body },
            'idempotency_key': f'user_joined_{obj.pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        return Response(body, status=status.HTTP_200_OK)


class LeaveRoomView(APIView, CentrifugoMixin):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, room_id):
        room = Room.objects.select_for_update().get(id=room_id)
        channels = self.get_room_member_channels(room_id)
        obj = get_object_or_404(RoomMember, user=request.user, room=room)
        pk = obj.pk
        obj.delete()
        body = RoomMemberSerializer(obj).data

        broadcast_payload = {
            'channels': channels,
            'data': { 'type': 'user_left', 'body': body },
            'idempotency_key': f'user_left_{pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        return Response(body, status=status.HTTP_200_OK)


class SearchUsersView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        query = request.GET.get('q', '').strip()
        if not query: return Response([], status=status.HTTP_200_OK)
        users = User.objects.filter(models.Q(username__icontains=query) | models.Q(email__icontains=query)).exclude(pk=request.user.pk).distinct()
        results = [UserWithStatusSerializer(user, context={'request': request}).data for user in users]
        return Response(results, status=status.HTTP_200_OK)

class FriendsListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        friendships = Friendship.objects.filter(models.Q(user1=request.user) | models.Q(user2=request.user))
        serializer = FriendshipSerializer(friendships, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class FriendRequestsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        queryset = FriendRequest.objects.filter(models.Q(from_user=request.user) | models.Q(to_user=request.user), status='pending')
        serializer = FriendRequestSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class SendFriendRequestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, user_id):
        to_user = get_object_or_404(User, pk=user_id)
        req, created = FriendRequest.objects.get_or_create(from_user=request.user, to_user=to_user, status='pending')
        return Response(FriendRequestSerializer(req).data, status=status.HTTP_201_CREATED)

class AcceptFriendRequestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, request_id):
        req = get_object_or_404(FriendRequest, pk=request_id, to_user=request.user, status='pending')
        with transaction.atomic():
            Friendship.objects.get_or_create(user1=req.from_user, user2=req.to_user)
            req.status = 'accepted'
            req.save()
        return Response({"status": "accepted"}, status=status.HTTP_200_OK)

class RejectFriendRequestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, request_id):
        req = get_object_or_404(FriendRequest, pk=request_id, to_user=request.user, status='pending')
        req.status = 'rejected'
        req.save()
        return Response({"status": "rejected"}, status=status.HTTP_200_OK)

class CancelFriendRequestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, request_id):
        req = get_object_or_404(FriendRequest, pk=request_id, from_user=request.user, status='pending')
        req.delete()
        return Response({"status": "cancelled"}, status=status.HTTP_200_OK)

class UnfriendView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, user_id):
        Friendship.objects.filter(models.Q(user1=request.user, user2_id=user_id) | models.Q(user1_id=user_id, user2=request.user)).delete()
        return Response({"status": "unfriended"}, status=status.HTTP_200_OK)

class BlockUserView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, user_id):
        blocked = get_object_or_404(User, pk=user_id)
        Block.objects.get_or_create(blocker=request.user, blocked=blocked)
        return Response({"status": "blocked"}, status=status.HTTP_201_CREATED)

class UnblockUserView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, user_id):
        Block.objects.filter(blocker=request.user, blocked_id=user_id).delete()
        return Response({"status": "unblocked"}, status=status.HTTP_200_OK)

class BlockedUsersView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        blocks = Block.objects.filter(blocker=request.user)
        return Response(BlockSerializer(blocks, many=True).data, status=status.HTTP_200_OK)

class SetUserStatusView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        status_choice = request.data.get('status', 'online')
        custom_status = request.data.get('custom_status', '')
        user_status, _ = UserStatus.objects.update_or_create(user=request.user, defaults={'status': status_choice, 'custom_status': custom_status})
        return Response(UserStatusSerializer(user_status).data, status=status.HTTP_200_OK)

class GetUserStatusView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        try: return Response(UserStatusSerializer(user.status).data, status=status.HTTP_200_OK)
        except UserStatus.DoesNotExist: return Response({'status': 'offline'}, status=status.HTTP_200_OK)

class GetAvailableColorsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response(ACTIVITY_COLORS, status=status.HTTP_200_OK)

class CurrentActivityView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try: return Response(ActivitySerializer(request.user.activity).data, status=status.HTTP_200_OK)
        except Activity.DoesNotExist: return Response(None, status=status.HTTP_200_OK)
    def post(self, request):
        serializer = ActivityCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        activity = serializer.save()
        return Response(ActivitySerializer(activity).data, status=status.HTTP_201_CREATED)
    def put(self, request):
        try:
            serializer = ActivityCreateSerializer(request.user.activity, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            activity = serializer.save()
            return Response(ActivitySerializer(activity).data, status=status.HTTP_200_OK)
        except Activity.DoesNotExist: return self.post(request)

class ClearActivityView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        Activity.objects.filter(user=request.user).delete()
        return Response({'message': 'Activity cleared'}, status=status.HTTP_200_OK)

class GetUserActivityView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        try:
            if user.activity.is_visible_to(request.user):
                return Response(ActivityPublicSerializer(user.activity).data, status=status.HTTP_200_OK)
        except Activity.DoesNotExist: pass
        return Response(None, status=status.HTTP_200_OK)

class ActivityPresetListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        presets = ActivityPreset.objects.filter(user=request.user)
        return Response(ActivityPresetSerializer(presets, many=True).data, status=status.HTTP_200_OK)
    def post(self, request):
        serializer = ActivityPresetSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class ActivityPresetDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def delete(self, request, preset_id):
        get_object_or_404(ActivityPreset, pk=preset_id, user=request.user).delete()
        return Response({'message': 'Preset deleted'}, status=status.HTTP_200_OK)

class ApplyActivityPresetView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, preset_id):
        preset = get_object_or_404(ActivityPreset, pk=preset_id, user=request.user)
        Activity.objects.filter(user=request.user).delete()
        activity = Activity.objects.create(user=request.user, name=preset.name, color=preset.color, visibility_type='all_friends', duration_type='indefinite')
        return Response(ActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

class GetUserRoomsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        rooms = RoomMember.objects.filter(user=request.user).select_related('room')
        return Response([{'id': rm.room.id, 'name': rm.room.name, 'color': rm.room.color} for rm in rooms], status=status.HTTP_200_OK)

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            activity = request.user.activity
            activity_data = {'name': activity.name, 'color': activity.color, 'is_expired': activity.is_expired()}
        except Activity.DoesNotExist: activity_data = None
        return Response({'id': request.user.id, 'username': request.user.username, 'email': request.user.email, 'date_joined': request.user.date_joined, 'activity': activity_data}, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        old_password, new_password = request.data.get('old_password'), request.data.get('new_password')
        if not request.user.check_password(old_password): return Response({'detail': 'Incorrect old password'}, status=400)
        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password changed successfully'}, status=200)

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        if not request.user.check_password(request.data.get('password')): return Response({'detail': 'Incorrect password'}, status=400)
        request.user.delete()
        return Response({'message': 'Account deleted'}, status=200)


class SubmitScreenTimeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        hours = request.data.get('hours', 0)
        minutes = request.data.get('minutes', 0)
        date = timezone.now().date()

        screen_time, created = DailyScreenTime.objects.update_or_create(
            user=request.user,
            date=date,
            defaults={'hours': hours, 'minutes': minutes}
        )
        
        return Response(DailyScreenTimeSerializer(screen_time).data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)


class GroupLeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        room = get_object_or_404(Room, pk=room_id)
        # Verify membership
        if not RoomMember.objects.filter(user=request.user, room=room).exists():
            return Response({'detail': 'Not a member of this group'}, status=status.HTTP_403_FORBIDDEN)

        date = timezone.now().date()
        start_date = date - timedelta(days=6)
        members = RoomMember.objects.filter(room=room).select_related('user')
        member_ids = [m.user.id for m in members]

        # Aggregate screen times for the last 7 days for all members
        aggregated_data = DailyScreenTime.objects.filter(
            user_id__in=member_ids, 
            date__gte=start_date,
            date__lte=date
        ).values('user_id').annotate(
            total_hours=Sum('hours'),
            total_mins=Sum('minutes')
        )
        
        time_map = {}
        for item in aggregated_data:
            t_min = (item['total_hours'] or 0) * 60 + (item['total_mins'] or 0)
            time_map[item['user_id']] = {
                'hours': t_min // 60,
                'minutes': t_min % 60,
                'total_minutes': t_min,
                'has_submitted': True
            }

        # Get current activities for all members
        activities = Activity.objects.filter(user_id__in=member_ids)
        activity_map = {}
        for act in activities:
            if not act.is_expired():
                activity_map[act.user_id] = {
                    'name': act.name,
                    'color': act.color
                }

        leaderboard = []
        for member in members:
            st = time_map.get(member.user.id, {
                'hours': 0, 'minutes': 0, 'total_minutes': 0, 'has_submitted': False
            })
            leaderboard.append({
                'user_id': member.user.id,
                'username': member.user.username,
                'hours': st['hours'],
                'minutes': st['minutes'],
                'total_minutes': st['total_minutes'],
                'has_submitted': st['has_submitted'],
                'activity': activity_map.get(member.user.id)
            })

        # Sort by total_minutes ascending (competition for lowest screen time)
        # Users who haven't submitted could be at the bottom for now.
        leaderboard.sort(key=lambda x: (not x['has_submitted'], x['total_minutes']))

        # Add rank
        for i, entry in enumerate(leaderboard):
            entry['rank'] = i + 1

        return Response(LeaderboardEntrySerializer(leaderboard, many=True, context={'request': request}).data, status=status.HTTP_200_OK)
