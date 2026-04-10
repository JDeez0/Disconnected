from django.urls import path

from .views import (
    RoomListViewSet, RoomDetailViewSet, RoomSearchViewSet,
    MessageListCreateAPIView, JoinRoomView, LeaveRoomView,
    SearchUsersView, FriendsListView, FriendRequestsView,
    SendFriendRequestView, AcceptFriendRequestView, RejectFriendRequestView,
    CancelFriendRequestView, UnfriendView, BlockUserView, UnblockUserView,
    BlockedUsersView, SetUserStatusView, GetUserStatusView,
    GetAvailableColorsView, CurrentActivityView, ClearActivityView,
    GetUserActivityView, ActivityPresetListView, ActivityPresetDetailView,
    ApplyActivityPresetView, GetUserRoomsView
)


urlpatterns = [
    # Room-related endpoints
    path('rooms/', RoomListViewSet.as_view({'get': 'list'}), name='room-list'),
    path('rooms/<int:pk>/', RoomDetailViewSet.as_view({'get': 'retrieve'}), name='room-detail'),
    path('search/', RoomSearchViewSet.as_view({'get': 'list'}), name='room-search'),
    path('rooms/<int:room_id>/messages/', MessageListCreateAPIView.as_view(), name='room-messages'),
    path('rooms/<int:room_id>/join/', JoinRoomView.as_view(), name='join-room'),
    path('rooms/<int:room_id>/leave/', LeaveRoomView.as_view(), name='leave-room'),

    # Friend-related endpoints
    path('friends/search/', SearchUsersView.as_view(), name='friends-search'),
    path('friends/', FriendsListView.as_view(), name='friends-list'),
    path('friends/requests/', FriendRequestsView.as_view(), name='friend-requests'),
    path('friends/request/send/<int:user_id>/', SendFriendRequestView.as_view(), name='send-friend-request'),
    path('friends/request/accept/<int:request_id>/', AcceptFriendRequestView.as_view(), name='accept-friend-request'),
    path('friends/request/reject/<int:request_id>/', RejectFriendRequestView.as_view(), name='reject-friend-request'),
    path('friends/request/cancel/<int:request_id>/', CancelFriendRequestView.as_view(), name='cancel-friend-request'),
    path('friends/unfriend/<int:user_id>/', UnfriendView.as_view(), name='unfriend'),
    path('friends/block/<int:user_id>/', BlockUserView.as_view(), name='block-user'),
    path('friends/unblock/<int:user_id>/', UnblockUserView.as_view(), name='unblock-user'),
    path('friends/blocked/', BlockedUsersView.as_view(), name='blocked-users'),
    path('friends/status/set/', SetUserStatusView.as_view(), name='set-user-status'),
    path('friends/status/<int:user_id>/', GetUserStatusView.as_view(), name='get-user-status'),

    # Activity endpoints
    path('activity/colors/', GetAvailableColorsView.as_view(), name='activity-colors'),
    path('activity/current/', CurrentActivityView.as_view(), name='current-activity'),
    path('activity/clear/', ClearActivityView.as_view(), name='clear-activity'),
    path('activity/user/<int:user_id>/', GetUserActivityView.as_view(), name='get-user-activity'),
    path('activity/presets/', ActivityPresetListView.as_view(), name='activity-presets'),
    path('activity/presets/<int:preset_id>/', ActivityPresetDetailView.as_view(), name='activity-preset-detail'),
    path('activity/presets/<int:preset_id>/apply/', ApplyActivityPresetView.as_view(), name='apply-activity-preset'),
    path('activity/rooms/', GetUserRoomsView.as_view(), name='user-rooms'),
]
