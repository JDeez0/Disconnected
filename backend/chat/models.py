from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

ACTIVITY_COLORS = [
    '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', 
    '#F44336', '#FFC107', '#00BCD4', '#8BC34A', 
    '#3F51B5', '#E91E63', '#795548', '#607D8B',
]

class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=10, default='')
    color = models.CharField(max_length=7, default='#3280b4') # Hex color
    founder = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='founded_rooms')
    timezone = models.CharField(max_length=50, default='UTC')
    
    version = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    bumped_at = models.DateTimeField(auto_now_add=True)

    @property
    def last_message(self):
        return self.messages.order_by('-created_at').first()

    class Meta:
        ordering = ['-bumped_at']

    def __str__(self):
        return self.name

class RoomMember(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='members')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'room')

class BannedUser(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='banned_users')
    banned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'room')

class Message(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages', null=True, blank=True)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='messages')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

# Friend-related models
class Friendship(models.Model):
    user1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships1')
    user2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships2')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user1', 'user2')

class FriendRequest(models.Model):
    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_requests')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=10, choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected')], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

class Block(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocking')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

# Vestigial models required for existing views
class Outbox(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, null=True, blank=True)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

class CDC(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, null=True, blank=True)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

class UserStatus(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='status')
    status = models.CharField(max_length=10, choices=[('online', 'Online'), ('away', 'Away'), ('busy', 'Busy'), ('offline', 'Offline')], default='offline')
    custom_status = models.CharField(max_length=100, blank=True, null=True)
    last_seen = models.DateTimeField(auto_now=True)

class Activity(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='activity')
    name = models.CharField(max_length=35)
    color = models.CharField(max_length=7)
    duration_type = models.CharField(max_length=20)
    visibility_type = models.CharField(max_length=20)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

class ActivityPreset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_presets')
    name = models.CharField(max_length=35)
    color = models.CharField(max_length=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')

class DailyScreenTime(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='screen_times')
    hours = models.PositiveIntegerField(default=0)
    minutes = models.PositiveIntegerField(default=0)
    date = models.DateField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username} - {self.date}: {self.hours}h {self.minutes}m"

    @property
    def total_minutes(self):
        return (self.hours * 60) + self.minutes
