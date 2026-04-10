from rest_framework import serializers
from .models import Room, RoomMember, Message, Friendship, FriendRequest, Block, UserStatus
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404


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
    status = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    custom_status = serializers.SerializerMethodField()

    def get_status(self, obj):
        try:
            return obj.status.status
        except UserStatus.DoesNotExist:
            return 'offline'

    def get_is_online(self, obj):
        try:
            return obj.status.status != 'offline'
        except UserStatus.DoesNotExist:
            return False

    def get_custom_status(self, obj):
        try:
            return obj.status.custom_status
        except UserStatus.DoesNotExist:
            return None

    class Meta:
        model = User
        fields = ['id', 'username', 'status', 'is_online', 'custom_status']


class FriendshipSerializer(serializers.ModelSerializer):
    friend = serializers.SerializerMethodField()
    friend_status = serializers.SerializerMethodField()

    def get_friend(self, obj):
        # Return the other user in the friendship
        request = self.context.get('request')
        if request and request.user == obj.user1:
            return UserWithStatusSerializer(obj.user2).data
        return UserWithStatusSerializer(obj.user1).data

    def get_friend_status(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        friend = obj.user2 if request.user == obj.user1 else obj.user1
        try:
            status = friend.status
            return {
                'status': status.status,
                'is_online': status.status != 'offline',
                'custom_status': status.custom_status,
                'last_seen': status.last_seen
            }
        except UserStatus.DoesNotExist:
            return {'status': 'offline', 'is_online': False, 'custom_status': None, 'last_seen': None}

    class Meta:
        model = Friendship
        fields = ['id', 'friend', 'friend_status', 'created_at']
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
