import React, { useState, useEffect } from 'react';
import {
  searchUsers, getFriends, getFriendRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, cancelFriendRequest,
  unfriend, blockUser, unblockUser, setUserStatus, getBlockedUsers
} from './AppApi';
import CsrfContext from './CsrfContext';

interface User {
  id: number;
  username: string;
  status: string;
  custom_status: string | null;
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
  friend_status: {
    status: string;
    is_online: boolean;
    custom_status: string | null;
    last_seen: string | null;
  };
  created_at: string;
}

interface BlockedUser {
  id: number;
  blocked_user: User;
  created_at: string;
}

const ChatFriends: React.FC = () => {
  const csrf = React.useContext(CsrfContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [myStatus, setMyStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('online');
  const [customStatus, setCustomStatus] = useState('');
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [error, setError] = useState('');

  // Load initial data
  useEffect(() => {
    loadFriends();
    loadFriendRequests();
    loadBlockedUsers();
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

  const handleStatusUpdate = async () => {
    try {
      await setUserStatus(myStatus, customStatus);
      setShowStatusEditor(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'away': return '#FFC107';
      case 'busy': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const receivedRequests = friendRequests.filter(r => r.request_received);
  const sentRequests = friendRequests.filter(r => r.request_sent_by_me);

  return (
    <div className="friends-page">
      <style>{`
        .friends-page {
          max-width: 800px;
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
        .status-section {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .status-display {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .status-text {
          font-weight: 500;
        }
        .custom-status {
          color: #666;
          font-style: italic;
        }
        .status-editor {
          margin-top: 10px;
        }
        .status-editor select,
        .status-editor input {
          padding: 8px;
          margin-right: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .status-editor button {
          padding: 8px 16px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
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
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .search-button {
          padding: 10px 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
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
        }
        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
        }
        .user-details {
          display: flex;
          flex-direction: column;
        }
        .user-name {
          font-weight: 500;
          font-size: 16px;
        }
        .user-status {
          font-size: 12px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .user-status .status-dot {
          width: 8px;
          height: 8px;
        }
        .user-custom-status {
          font-size: 12px;
          color: #888;
          font-style: italic;
        }
        .user-actions {
          display: flex;
          gap: 8px;
        }
        .action-button {
          padding: 6px 12px;
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
          padding: 20px;
        }
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .pending-badge {
          background: #FFC107;
          color: #333;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          margin-left: 5px;
        }
      `}</style>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer'}}>✕</button>
        </div>
      )}

      <div className="friends-header">
        <h1 className="friends-title">Friends</h1>
      </div>

      {/* Status Section */}
      <div className="status-section">
        {!showStatusEditor ? (
          <div className="status-display" onClick={() => setShowStatusEditor(true)}>
            <div
              className="status-dot"
              style={{ backgroundColor: getStatusColor(myStatus) }}
            />
            <span className="status-text">{myStatus.charAt(0).toUpperCase() + myStatus.slice(1)}</span>
            {customStatus && <span className="custom-status">- {customStatus}</span>}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>✎ Edit</span>
          </div>
        ) : (
          <div className="status-editor">
            <select
              value={myStatus}
              onChange={(e) => setMyStatus(e.target.value as any)}
            >
              <option value="online">🟢 Online</option>
              <option value="away">🟡 Away</option>
              <option value="busy">🔴 Busy</option>
              <option value="offline">⚫ Offline</option>
            </select>
            <input
              type="text"
              placeholder="Custom status (optional)"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              maxLength={140}
            />
            <button onClick={handleStatusUpdate}>Save</button>
            <button
              onClick={() => setShowStatusEditor(false)}
              style={{ background: '#9E9E9E' }}
            >
              Cancel
            </button>
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
                  <div className="user-status">
                    <div
                      className="status-dot"
                      style={{ backgroundColor: getStatusColor(user.status) }}
                    />
                    {user.is_online ? 'Online' : 'Offline'}
                  </div>
                  {user.custom_status && (
                    <div className="user-custom-status">"{user.custom_status}"</div>
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
                  <div className="user-status">
                    <div
                      className="status-dot"
                      style={{ backgroundColor: getStatusColor(request.from_user.status) }}
                    />
                    {request.from_user.is_online ? 'Online' : 'Offline'}
                  </div>
                  {request.from_user.custom_status && (
                    <div className="user-custom-status">"{request.from_user.custom_status}"</div>
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
                  <div className="user-status">
                    <div
                      className="status-dot"
                      style={{ backgroundColor: getStatusColor(friend.friend_status.status) }}
                    />
                    {friend.friend_status.is_online ? 'Online' : 'Offline'}
                  </div>
                  {friend.friend_status.custom_status && (
                    <div className="user-custom-status">"{friend.friend_status.custom_status}"</div>
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
