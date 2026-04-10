from rest_framework import serializers
from .models import (
    Room, RoomMember, Message, Friendship, FriendRequest, Block, UserStatus,
    Activity, ActivityPreset, ACTIVITY_COLORS
)
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class LastMessageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'content', 'user', 'created_at']


class RoomSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    last_message = LastMessageSerializer(read_only=True)

    def get_member_count(self, obj):
        return obj.member_count

    class Meta:
        model = Room
        fields = ['id', 'name', 'version', 'bumped_at', 'member_count', 'last_message']


class MessageRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'version', 'bumped_at']


class RoomSearchSerializer(serializers.ModelSerializer):

    is_member = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Room
        fields = ['id', 'name', 'created_at', 'is_member']


class RoomMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    room = RoomSerializer(read_only=True)
    
    class Meta:
        model = RoomMember
        fields = ['room', 'user']


class MessageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    room = MessageRoomSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'content', 'user', 'room', 'created_at']


class UserStatusSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    is_online = serializers.SerializerMethodField()

    def get_is_online(self, obj):
        return obj.status != 'offline'

    class Meta:
        model = UserStatus
        fields = ['username', 'status', 'custom_status', 'is_online', 'last_seen']


class UserWithStatusSerializer(serializers.ModelSerializer):
    activity = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    def get_activity(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        try:
            activity = obj.activity
            if activity.is_visible_to(request.user) and not activity.is_expired():
                return {
                    'name': activity.name,
                    'color': activity.color,
                }
        except Activity.DoesNotExist:
            pass
        return None

    def get_is_online(self, obj):
        # We're not tracking online status anymore, but keeping this for compatibility
        try:
            return obj.status.status != 'offline'
        except UserStatus.DoesNotExist:
            return False

    class Meta:
        model = User
        fields = ['id', 'username', 'activity', 'is_online']


class FriendshipSerializer(serializers.ModelSerializer):
    friend = serializers.SerializerMethodField()

    def get_friend(self, obj):
        # Return the other user in the friendship
        request = self.context.get('request')
        if request and request.user == obj.user1:
            return UserWithStatusSerializer(obj.user2, context={'request': request}).data
        return UserWithStatusSerializer(obj.user1, context={'request': request}).data

    class Meta:
        model = Friendship
        fields = ['id', 'friend', 'created_at']
        read_only_fields = ['created_at']


class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = UserWithStatusSerializer(read_only=True)
    to_user = UserWithStatusSerializer(read_only=True)

    class Meta:
        model = FriendRequest
        fields = ['id', 'from_user', 'to_user', 'status', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class BlockSerializer(serializers.ModelSerializer):
    blocked_user = UserWithStatusSerializer(source='blocked', read_only=True)

    class Meta:
        model = Block
        fields = ['id', 'blocked_user', 'created_at']
        read_only_fields = ['created_at']


class ActivitySerializer(serializers.ModelSerializer):
    visible_room_ids = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    room_names = serializers.SerializerMethodField()

    def get_visible_room_ids(self, obj):
        return list(obj.rooms.values_list('id', flat=True))

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_room_names(self, obj):
        return list(obj.rooms.values_list('name', flat=True))

    class Meta:
        model = Activity
        fields = [
            'id', 'name', 'color', 'visibility_type', 'visible_room_ids',
            'room_names', 'duration_type', 'expires_at', 'is_expired',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ActivityPresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityPreset
        fields = ['id', 'name', 'color', 'created_at']
        read_only_fields = ['created_at']


class UserActivitySerializer(serializers.ModelSerializer):
    """Serializer for viewing another user's activity (if visible)."""
    activity = serializers.SerializerMethodField()

    def get_activity(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        try:
            activity = obj.activity
            if activity.is_visible_to(request.user) and not activity.is_expired():
                return {
                    'name': activity.name,
                    'color': activity.color,
                }
        except Activity.DoesNotExist:
            pass
        return None

    class Meta:
        model = User
        fields = ['id', 'username', 'activity']


class ActivityCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating an activity."""
    room_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    save_as_preset = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = Activity
        fields = [
            'name', 'color', 'visibility_type', 'room_ids',
            'duration_type', 'save_as_preset'
        ]

    def validate_name(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Activity name cannot be empty.")
        if len(value) > 35:
            raise serializers.ValidationError("Activity name cannot exceed 35 characters.")
        return value.strip()

    def validate(self, data):
        request = self.context.get('request')
        visibility_type = data.get('visibility_type', 'all_friends')
        room_ids = data.get('room_ids', [])

        if visibility_type == 'specific_rooms' and not room_ids:
            raise serializers.ValidationError(
                "Room IDs must be provided when visibility type is 'specific_rooms'"
            )

        # Validate that user is a member of the specified rooms
        if room_ids:
            user_room_ids = set(
                RoomMember.objects.filter(
                    user=request.user,
                    room_id__in=room_ids
                ).values_list('room_id', flat=True)
            )
            invalid_room_ids = set(room_ids) - user_room_ids
            if invalid_room_ids:
                raise serializers.ValidationError(
                    f"User is not a member of rooms: {list(invalid_room_ids)}"
                )

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        room_ids = validated_data.pop('room_ids', [])
        save_as_preset = validated_data.pop('save_as_preset', False)
        duration_type = validated_data.get('duration_type', 'indefinite')

        # Calculate expiration
        expires_at = None
        if duration_type == 'hour':
            expires_at = timezone.now() + timedelta(hours=1)
        elif duration_type == 'day':
            expires_at = timezone.now() + timedelta(days=1)

        validated_data['expires_at'] = expires_at

        # Delete existing activity for this user
        Activity.objects.filter(user=request.user).delete()

        # Create new activity
        activity = Activity.objects.create(user=request.user, **validated_data)

        # Add rooms if specified
        if room_ids:
            activity.rooms.set(room_ids)

        # Save as preset if requested
        if save_as_preset:
            ActivityPreset.objects.get_or_create(
                user=request.user,
                name=validated_data['name'],
                defaults={'color': validated_data['color']}
            )

        return activity

    def update(self, instance, validated_data):
        request = self.context.get('request')
        room_ids = validated_data.pop('room_ids', None)
        save_as_preset = validated_data.pop('save_as_preset', False)
        duration_type = validated_data.get('duration_type', instance.duration_type)

        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Recalculate expiration if duration changed
        if 'duration_type' in validated_data:
            if duration_type == 'hour':
                instance.expires_at = timezone.now() + timedelta(hours=1)
            elif duration_type == 'day':
                instance.expires_at = timezone.now() + timedelta(days=1)
            else:
                instance.expires_at = None

        instance.save()

        # Update rooms if provided
        if room_ids is not None:
            instance.rooms.set(room_ids)

        # Save as preset if requested
        if save_as_preset:
            ActivityPreset.objects.get_or_create(
                user=request.user,
                name=instance.name,
                defaults={'color': instance.color}
            )

        return instance


class ActivityPublicSerializer(serializers.Serializer):
    """Minimal serializer for public view of activity."""
    name = serializers.CharField(max_length=35)
    color = serializers.CharField(max_length=7)
