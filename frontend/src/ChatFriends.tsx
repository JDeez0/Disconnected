import React, { useState, useEffect, useContext } from 'react';
import {
  searchUsers, getFriends, getFriendRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
  unfriend, blockUser, unblockUser, getBlockedUsers,
  getAvailableColors, getCurrentActivity, setCurrentActivity,
  updateCurrentActivity, clearActivity, getActivityPresets,
  createActivityPreset, deleteActivityPreset, applyActivityPreset,
  getUserRooms
} from './AppApi';
import CsrfContext from './CsrfContext';

interface User {
  id: number;
  username: string;
  activity: {
    name: string;
    color: string;
  } | null;
  is_online: boolean;
  is_friend: boolean;
  has_pending_request: boolean;
  request_sent_by_me: boolean;
  request_received: boolean;
}

interface FriendRequest {
  id: number;
  from_user: User;
  to_user: User;
  status: string;
}

interface Friend {
  id: number;
  friend: User;
  created_at: string;
}

interface BlockedUser {
  id: number;
  blocked_user: User;
  created_at: string;
}

interface Activity {
  id: number;
  name: string;
  color: string;
  visibility_type: 'all_friends' | 'specific_rooms';
  visible_room_ids: number[];
  room_names: string[];
  duration_type: 'hour' | 'day' | 'indefinite';
  expires_at: string | null;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

interface ActivityPreset {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

interface UserRoom {
  id: number;
  name: string;
}

const ChatFriends: React.FC = () => {
  const csrf = useContext(CsrfContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Activity state
  const [currentActivity, setCurrentActivityState] = useState<Activity | null>(null);
  const [showActivityEditor, setShowActivityEditor] = useState(false);
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [activityPresets, setActivityPresets] = useState<ActivityPreset[]>([]);
  const [userRooms, setUserRooms] = useState<UserRoom[]>([]);
  
  // Activity form state
  const [activityName, setActivityName] = useState('');
  const [activityColor, setActivityColor] = useState('');
  const [activityVisibility, setActivityVisibility] = useState<'all_friends' | 'specific_rooms'>('all_friends');
  const [activityRooms, setActivityRooms] = useState<number[]>([]);
  const [activityDuration, setActivityDuration] = useState<'hour' | 'day' | 'indefinite'>('indefinite');
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  // Load initial data
  useEffect(() => {
    loadFriends();
    loadFriendRequests();
    loadBlockedUsers();
    loadActivityData();
  }, []);

  const loadFriends = async () => {
    try {
      const data = await getFriends();
      setFriends(data);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const data = await getFriendRequests();
      setFriendRequests(data);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const data = await getBlockedUsers();
      setBlockedUsers(data);
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    }
  };

  const loadActivityData = async () => {
    try {
      const [colors, activity, presets, rooms] = await Promise.all([
        getAvailableColors(),
        getCurrentActivity(),
        getActivityPresets(),
        getUserRooms()
      ]);
      setAvailableColors(colors);
      setCurrentActivityState(activity);
      setActivityPresets(presets);
      setUserRooms(rooms);
      
      // Set default color if available
      if (colors.length > 0 && !activityColor) {
        setActivityColor(colors[0]);
      }
    } catch (err) {
      console.error('Failed to load activity data:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: number) => {
    try {
      await sendFriendRequest(userId);
      setSearchResults(prev =>
        prev.map(user =>
          user.id === userId
            ? { ...user, has_pending_request: true, request_sent_by_me: true }
            : user
        )
      );
      loadFriendRequests();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    try {
      await acceptFriendRequest(requestId);
      loadFriendRequests();
      loadFriends();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      await rejectFriendRequest(requestId);
      loadFriendRequests();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reject request');
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      await cancelFriendRequest(requestId);
      loadFriendRequests();
      setSearchResults(prev =>
        prev.map(user =>
          user.has_pending_request && user.request_sent_by_me
            ? { ...user, has_pending_request: false, request_sent_by_me: false }
            : user
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel request');
    }
  };

  const handleUnfriend = async (userId: number) => {
    if (!confirm('Are you sure you want to unfriend this user?')) return;
    try {
      await unfriend(userId);
      loadFriends();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to unfriend');
    }
  };

  const handleBlock = async (userId: number) => {
    if (!confirm('Are you sure you want to block this user?')) return;
    try {
      await blockUser(userId);
      loadBlockedUsers();
      loadFriends();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to block user');
    }
  };

  const handleUnblock = async (userId: number) => {
    try {
      await unblockUser(userId);
      loadBlockedUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to unblock user');
    }
  };

  const handleSetActivity = async () => {
    if (!activityName.trim()) {
      setError('Activity name is required');
      return;
    }

    setError('');
    try {
      const activityData: any = {
        name: activityName.trim(),
        color: activityColor,
        visibility_type: activityVisibility,
        duration_type: activityDuration,
        save_as_preset: saveAsPreset
      };

      if (activityVisibility === 'specific_rooms') {
        activityData.room_ids = activityRooms;
      }

      if (currentActivity) {
        await updateCurrentActivity(csrf, activityData);
      } else {
        await setCurrentActivity(csrf, activityData);
      }

      await loadActivityData();
      await loadFriends(); // Refresh to show updated activity
      setShowActivityEditor(false);
      resetActivityForm();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to set activity');
    }
  };

  const handleClearActivity = async () => {
    try {
      await clearActivity(csrf);
      setCurrentActivityState(null);
      await loadFriends();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear activity');
    }
  };

  const handleApplyPreset = async (preset: ActivityPreset) => {
    // Pre-fill form with preset data
    setActivityName(preset.name);
    setActivityColor(preset.color);
    setShowActivityEditor(true);
  };

  const handleDeletePreset = async (presetId: number) => {
    if (!confirm('Delete this preset?')) return;
    try {
      await deleteActivityPreset(presetId);
      await loadActivityData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete preset');
    }
  };

  const resetActivityForm = () => {
    setActivityName('');
    setActivityColor(availableColors[0] || '');
    setActivityVisibility('all_friends');
    setActivityRooms([]);
    setActivityDuration('indefinite');
    setSaveAsPreset(false);
  };

  const toggleRoomSelection = (roomId: number) => {
    setActivityRooms(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const receivedRequests = friendRequests.filter(r => r.request_received);
  const sentRequests = friendRequests.filter(r => r.request_sent_by_me);

  return (
    <div className="friends-page">
      <style>{`
        .friends-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }
        .friends-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .friends-title {
          font-size: 24px;
          font-weight: bold;
          margin: 0;
        }
        .activity-section {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .activity-display {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .activity-indicator {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }
        .activity-text {
          font-weight: 500;
          font-size: 15px;
        }
        .activity-display button {
          margin-left: auto;
          padding: 6px 12px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        .activity-display button.clear-btn {
          background: #F44336;
        }
        .activity-editor {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
        }
        .form-row {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
        }
        .form-group {
          flex: 1;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          color: #666;
          margin-bottom: 5px;
        }
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .color-palette {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .color-option {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          cursor: pointer;
          border: 3px solid transparent;
          transition: transform 0.15s;
        }
        .color-option:hover {
          transform: scale(1.1);
        }
        .color-option.selected {
          border-color: #333;
        }
        .room-selector {
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 12px;
        }
        .room-option {
          display: flex;
          align-items: center;
          padding: 6px 8px;
          cursor: pointer;
          border-radius: 4px;
        }
        .room-option:hover {
          background: #f0f0f0;
        }
        .room-option input {
          margin-right: 10px;
        }
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 12px;
        }
        .checkbox-group input {
          width: auto;
        }
        .checkbox-group label {
          font-size: 14px;
        }
        .activity-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .activity-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-save {
          background: #4CAF50;
          color: white;
          flex: 1;
        }
        .btn-cancel {
          background: #9E9E9E;
          color: white;
        }
        .presets-section {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
        }
        .presets-title {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 10px;
        }
        .presets-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .preset-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: white;
          border-radius: 20px;
          font-size: 13px;
          border: 1px solid #e0e0e0;
        }
        .preset-color {
          width: 16px;
          height: 16px;
          border-radius: 3px;
        }
        .preset-apply {
          background: none;
          border: none;
          color: #4CAF50;
          cursor: pointer;
          font-size: 11px;
          padding: 0;
        }
        .preset-delete {
          background: none;
          border: none;
          color: #F44336;
          cursor: pointer;
          font-size: 11px;
          padding: 0;
        }
        .search-section {
          margin-bottom: 20px;
        }
        .search-form {
          display: flex;
          gap: 10px;
        }
        .search-input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }
        .search-button {
          padding: 12px 24px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .search-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .view-toggle {
          font-size: 14px;
          color: #4CAF50;
          cursor: pointer;
          text-decoration: underline;
        }
        .user-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }
        .user-avatar {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
          color: #666;
        }
        .user-details {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .user-name {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 4px;
        }
        .user-activity {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }
        .activity-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        .activity-badge .color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .user-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .action-button {
          padding: 8px 14px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        .btn-add {
          background: #4CAF50;
          color: white;
        }
        .btn-accept {
          background: #4CAF50;
          color: white;
        }
        .btn-reject {
          background: #F44336;
          color: white;
        }
        .btn-cancel {
          background: #FFC107;
          color: #333;
        }
        .btn-unfriend {
          background: #F44336;
          color: white;
        }
        .btn-block {
          background: #9E9E9E;
          color: white;
        }
        .btn-unblock {
          background: #4CAF50;
          color: white;
        }
        .no-results {
          text-align: center;
          color: #666;
          padding: 30px;
          font-size: 15px;
        }
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .pending-badge {
          background: #FFC107;
          color: #333;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          margin-left: 5px;
        }
      `}</style>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px'}}>✕</button>
        </div>
      )}

      <div className="friends-header">
        <h1 className="friends-title">Friends</h1>
      </div>

      {/* Activity Section */}
      <div className="activity-section">
        {!showActivityEditor ? (
          <div className="activity-display">
            {currentActivity ? (
              <>
                <div
                  className="activity-indicator"
                  style={{ backgroundColor: currentActivity.color }}
                />
                <span className="activity-text">{currentActivity.name}</span>
                <button className="clear-btn" onClick={handleClearActivity}>Clear</button>
                <button onClick={() => setShowActivityEditor(true)}>Edit</button>
              </>
            ) : (
              <>
                <div className="activity-indicator" style={{ backgroundColor: '#e0e0e0' }} />
                <span className="activity-text" style={{ color: '#999' }}>No activity set</span>
                <button onClick={() => setShowActivityEditor(true)}>Add Activity</button>
              </>
            )}
          </div>
        ) : (
          <div className="activity-editor">
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
              {currentActivity ? 'Edit Activity' : 'Add Activity'}
            </h3>
            
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Activity Name (max 35 characters)</label>
              <input
                type="text"
                placeholder="What are you doing?"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value.slice(0, 35))}
                maxLength={35}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Color</label>
              <div className="color-palette">
                {availableColors.map(color => (
                  <div
                    key={color}
                    className={`color-option ${activityColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setActivityColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Visibility</label>
                <select
                  value={activityVisibility}
                  onChange={(e) => setActivityVisibility(e.target.value as any)}
                >
                  <option value="all_friends">All Friends</option>
                  <option value="specific_rooms">Specific Rooms</option>
                </select>
              </div>
              <div className="form-group">
                <label>Duration</label>
                <select
                  value={activityDuration}
                  onChange={(e) => setActivityDuration(e.target.value as any)}
                >
                  <option value="indefinite">Indefinite</option>
                  <option value="hour">1 Hour</option>
                  <option value="day">1 Day</option>
                </select>
              </div>
            </div>

            {activityVisibility === 'specific_rooms' && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Select Rooms (members of these rooms can see your activity)</label>
                <div className="room-selector">
                  {userRooms.length === 0 ? (
                    <div style={{ color: '#999', padding: '10px' }}>
                      You are not a member of any rooms. Choose "All Friends" to share with all your friends.
                    </div>
                  ) : (
                    userRooms.map(room => (
                      <div
                        key={room.id}
                        className="room-option"
                        onClick={() => toggleRoomSelection(room.id)}
                      >
                        <input
                          type="checkbox"
                          checked={activityRooms.includes(room.id)}
                          onChange={() => {}}
                        />
                        {room.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="checkbox-group">
              <input
                type="checkbox"
                id="savePreset"
                checked={saveAsPreset}
                onChange={(e) => setSaveAsPreset(e.target.checked)}
              />
              <label htmlFor="savePreset">Save as preset for quick reuse</label>
            </div>

            <div className="activity-actions">
              <button className="btn-save" onClick={handleSetActivity}>
                {currentActivity ? 'Update Activity' : 'Set Activity'}
              </button>
              <button className="btn-cancel" onClick={() => {
                setShowActivityEditor(false);
                resetActivityForm();
              }}>
                Cancel
              </button>
            </div>

            {activityPresets.length > 0 && (
              <div className="presets-section">
                <div className="presets-title">Presets</div>
                <div className="presets-list">
                  {activityPresets.map(preset => (
                    <div key={preset.id} className="preset-item">
                      <div className="preset-color" style={{ backgroundColor: preset.color }} />
                      {preset.name}
                      <button className="preset-apply" onClick={() => handleApplyPreset(preset)}>
                        Use
                      </button>
                      <button className="preset-delete" onClick={() => handleDeletePreset(preset.id)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Section */}
      <div className="section search-section">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search users by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="section">
          <h2 className="section-title">Search Results</h2>
          {searchResults.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <div className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <div className="user-name">{user.username}</div>
                  {user.activity && (
                    <div className="user-activity">
                      <div
                        className="activity-badge"
                        style={{ backgroundColor: user.activity.color + '20', color: user.activity.color }}
                      >
                        <div className="color-dot" style={{ backgroundColor: user.activity.color }} />
                        {user.activity.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="user-actions">
                {user.is_friend ? (
                  <>
                    <button
                      className="action-button btn-unfriend"
                      onClick={() => handleUnfriend(user.id)}
                    >
                      Unfriend
                    </button>
                    <button
                      className="action-button btn-block"
                      onClick={() => handleBlock(user.id)}
                    >
                      Block
                    </button>
                  </>
                ) : user.has_pending_request ? (
                  user.request_sent_by_me ? (
                    <button
                      className="action-button btn-cancel"
                      onClick={() => handleCancelRequest(user.id)}
                    >
                      Cancel Request
                    </button>
                  ) : (
                    <span style={{ color: '#666', fontSize: '13px' }}>
                      Pending <span className="pending-badge">You received</span>
                    </span>
                  )
                ) : (
                  <button
                    className="action-button btn-add"
                    onClick={() => handleSendRequest(user.id)}
                  >
                    Add Friend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Requests */}
      {receivedRequests.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            Pending Requests ({receivedRequests.length})
          </h2>
          {receivedRequests.map((request) => (
            <div key={request.id} className="user-card">
              <div className="user-info">
                <div className="user-avatar">
                  {request.from_user.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <div className="user-name">{request.from_user.username}</div>
                  {request.from_user.activity && (
                    <div className="user-activity">
                      <div
                        className="activity-badge"
                        style={{ backgroundColor: request.from_user.activity.color + '20', color: request.from_user.activity.color }}
                      >
                        <div className="color-dot" style={{ backgroundColor: request.from_user.activity.color }} />
                        {request.from_user.activity.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="user-actions">
                <button
                  className="action-button btn-accept"
                  onClick={() => handleAcceptRequest(request.id)}
                >
                  Accept
                </button>
                <button
                  className="action-button btn-reject"
                  onClick={() => handleRejectRequest(request.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div className="section">
        <h2 className="section-title">
          Friends ({friends.length})
          {blockedUsers.length > 0 && (
            <span
              className="view-toggle"
              onClick={() => setShowBlocked(!showBlocked)}
            >
              {showBlocked ? 'Hide' : 'View'} Blocked ({blockedUsers.length})
            </span>
          )}
        </h2>
        {showBlocked && blockedUsers.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '10px', background: '#ffebee', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Blocked Users</h3>
            {blockedUsers.map((block) => (
              <div key={block.id} className="user-card">
                <div className="user-info">
                  <div className="user-avatar">
                    {block.blocked_user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <div className="user-name">{block.blocked_user.username}</div>
                  </div>
                </div>
                <button
                  className="action-button btn-unblock"
                  onClick={() => handleUnblock(block.blocked_user.id)}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
        {friends.length === 0 ? (
          <div className="no-results">
            No friends yet. Search for users to add them as friends!
          </div>
        ) : (
          friends.map((friend) => (
            <div key={friend.id} className="user-card">
              <div className="user-info">
                <div className="user-avatar">
                  {friend.friend.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <div className="user-name">{friend.friend.username}</div>
                  {friend.friend.activity && (
                    <div className="user-activity">
                      <div
                        className="activity-badge"
                        style={{ backgroundColor: friend.friend.activity.color + '20', color: friend.friend.activity.color }}
                      >
                        <div className="color-dot" style={{ backgroundColor: friend.friend.activity.color }} />
                        {friend.friend.activity.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="user-actions">
                <button
                  className="action-button btn-unfriend"
                  onClick={() => handleUnfriend(friend.friend.id)}
                >
                  Unfriend
                </button>
                <button
                  className="action-button btn-block"
                  onClick={() => handleBlock(friend.friend.id)}
                >
                  Block
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatFriends;
