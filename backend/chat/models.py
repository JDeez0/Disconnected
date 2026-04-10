from django.db import models
from django.contrib.auth.models import User


class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)
    version = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    bumped_at = models.DateTimeField(auto_now_add=True)
    last_message = models.ForeignKey(
        'Message', related_name='last_message_rooms',
        on_delete=models.SET_NULL, null=True, blank=True,
    )

    def increment_version(self):
        self.version += 1
        self.save()
        return self.version

    def __str__(self):
        return self.name


class RoomMember(models.Model):
    room = models.ForeignKey(Room, related_name='memberships', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='rooms', on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.room.name}"


class Message(models.Model):
    room = models.ForeignKey(Room, related_name='messages', on_delete=models.CASCADE)
    # Note, message may have null user – we consider such messages "system". These messages
    # initiated by the backend and have no user author. We are not using such messages in
    # the example currently, but leave the opportunity to extend.
    user = models.ForeignKey(User, related_name='messages', on_delete=models.CASCADE, null=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Outbox(models.Model):
    method = models.TextField(default="publish")
    payload = models.JSONField()
    partition = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


# While the CDC model here is the same as Outbox it has different partition field semantics,
# also in outbox case we remove processed messages from DB, while in CDC don't. So to not
# mess up with different semantics when switching between broadcast modes of the example app
# we created two separated models here. 
class CDC(models.Model):
    method = models.TextField(default="publish")
    payload = models.JSONField()
    partition = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class Friendship(models.Model):
    """Mutual friendship relationship between two users."""
    user1 = models.ForeignKey(User, related_name='friendships_initiated', on_delete=models.CASCADE)
    user2 = models.ForeignKey(User, related_name='friendships_received', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user1', 'user2')
        indexes = [
            models.Index(fields=['user1']),
            models.Index(fields=['user2']),
        ]

    def __str__(self):
        return f"{self.user1.username} <-> {self.user2.username}"


class FriendRequest(models.Model):
    """Pending friend request from one user to another."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    
    from_user = models.ForeignKey(User, related_name='sent_requests', on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name='received_requests', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('from_user', 'to_user')
        indexes = [
            models.Index(fields=['from_user', 'status']),
            models.Index(fields=['to_user', 'status']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.from_user.username} -> {self.to_user.username} ({self.status})"


class Block(models.Model):
    """Block relationship - one user blocking another."""
    blocker = models.ForeignKey(User, related_name='blocks_made', on_delete=models.CASCADE)
    blocked = models.ForeignKey(User, related_name='blocked_by', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')
        indexes = [
            models.Index(fields=['blocker']),
            models.Index(fields=['blocked']),
        ]

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"


class UserStatus(models.Model):
    """User online status and custom status message."""
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('away', 'Away'),
        ('busy', 'Busy'),
        ('offline', 'Offline'),
    ]
    
    user = models.OneToOneField(User, related_name='status', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline')
    custom_status = models.CharField(max_length=140, blank=True, null=True)
    last_seen = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}: {self.status} - {self.custom_status or 'No status'}"


# Predefined color palette for activities
ACTIVITY_COLORS = [
    '#4CAF50',  # Green
    '#2196F3',  # Blue
    '#9C27B0',  # Purple
    '#FF5722',  # Orange
    '#F44336',  # Red
    '#FFC107',  # Amber
    '#00BCD4',  # Cyan
    '#8BC34A',  # Light Green
    '#3F51B5',  # Indigo
    '#E91E63',  # Pink
    '#795548',  # Brown
    '#607D8B',  # Blue Grey
]


class Activity(models.Model):
    """User's current activity with visibility settings."""
    VISIBILITY_CHOICES = [
        ('all_friends', 'All Friends'),
        ('specific_rooms', 'Specific Rooms'),
    ]
    
    DURATION_CHOICES = [
        ('hour', '1 Hour'),
        ('day', '1 Day'),
        ('indefinite', 'Indefinite'),
    ]
    
    user = models.OneToOneField(User, related_name='activity', on_delete=models.CASCADE)
    name = models.CharField(max_length=35)
    color = models.CharField(max_length=7, choices=[(c, c) for c in ACTIVITY_COLORS])
    visibility_type = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='all_friends')
    rooms = models.ManyToManyField(Room, related_name='visible_activities', blank=True)
    duration_type = models.CharField(max_length=20, choices=DURATION_CHOICES, default='indefinite')
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'expires_at']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.name}"
    
    def is_expired(self):
        if self.expires_at is None:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at
    
    def is_visible_to(self, viewer_user):
        """Check if this activity is visible to the given viewer."""
        # Don't show to self
        if self.user == viewer_user:
            return True
        
        # Check if users are friends
        from django.db.models import Q
        are_friends = Friendship.objects.filter(
            Q(user1=self.user, user2=viewer_user) | 
            Q(user1=viewer_user, user2=self.user)
        ).exists()
        
        if not are_friends:
            return False
        
        # Check if blocked
        if Block.objects.filter(
            Q(blocker=self.user, blocked=viewer_user) |
            Q(blocker=viewer_user, blocked=self.user)
        ).exists():
            return False
        
        # Check visibility
        if self.visibility_type == 'all_friends':
            return True
        elif self.visibility_type == 'specific_rooms':
            # Check if viewer is in any of the rooms where this activity is visible
            return self.rooms.filter(
                memberships__user=viewer_user
            ).exists()
        
        return False


class ActivityPreset(models.Model):
    """Saved activity presets for quick reuse."""
    user = models.ForeignKey(User, related_name='activity_presets', on_delete=models.CASCADE)
    name = models.CharField(max_length=35)
    color = models.CharField(max_length=7, choices=[(c, c) for c in ACTIVITY_COLORS])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}: {self.name}"
