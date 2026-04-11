import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProfile, changePassword, deleteAccount,
  getAvailableColors, getCurrentActivity, setCurrentActivity,
  updateCurrentActivity, clearActivity, getActivityPresets,
  createActivityPreset, deleteActivityPreset, getUserRooms
} from './AppApi';
import CsrfContext from './CsrfContext';

interface ProfileData {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  activity: {
    name: string;
    color: string;
    is_expired: boolean;
  } | null;
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

const DEFAULT_ACTIVITY_COLOR = '#4DD0E1'; // Light turquoise

const ChatProfile: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const csrf = useContext(CsrfContext);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Delete account state
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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

  useEffect(() => {
    loadProfile();
    loadActivityData();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load profile');
    } finally {
      setLoading(false);
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
      
      if (colors.length > 0 && !activityColor) {
        setActivityColor(colors[0]);
      }
    } catch (err) {
      console.error('Failed to load activity data:', err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setError('');
    try {
      await changePassword(csrf, oldPassword, newPassword);
      setShowPasswordForm(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password');
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setError('');
    try {
      await deleteAccount(csrf, deletePassword);
      onLogout();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete account');
      setShowDeleteConfirm(false);
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
      await loadProfile();
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
      await loadProfile();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear activity');
    }
  };

  const handleApplyPreset = async (preset: ActivityPreset) => {
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
    setActivityColor(availableColors[0] || DEFAULT_ACTIVITY_COLOR);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getActivityColor = () => {
    if (currentActivity && !currentActivity.is_expired) {
      return currentActivity.color;
    }
    return DEFAULT_ACTIVITY_COLOR;
  };

  if (loading) {
    return <div className="profile-page loading">Loading...</div>;
  }

  if (!profile) {
    return <div className="profile-page error">Failed to load profile</div>;
  }

  return (
    <div className="profile-page">
      <style>{`
        .profile-page {
          max-width: 700px;
          margin: 0 auto;
          padding: 30px 20px;
        }
        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
        }
        .profile-title {
          font-size: 28px;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 5px;
          line-height: 1;
        }
        .close-button:hover {
          color: #333;
        }
        .profile-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 25px;
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 15px 0;
          color: #333;
        }
        .profile-info {
          display: grid;
          gap: 15px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 500;
          color: #666;
        }
        .info-value {
          color: #333;
        }
        .activity-display {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 6px;
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
        .activity-actions {
          display: flex;
          gap: 10px;
          margin-left: auto;
        }
        .activity-actions button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        .btn-edit {
          background: #4CAF50;
          color: white;
        }
        .btn-clear {
          background: #F44336;
          color: white;
        }
        .activity-editor {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .form-row {
          display: flex;
          gap: 12px;
        }
        .form-row .form-group {
          flex: 1;
        }
        .color-palette {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 15px;
        }
        .color-option {
          width: 36px;
          height: 36px;
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
          margin-bottom: 15px;
        }
        .room-option {
          display: flex;
          align-items: center;
          padding: 8px 10px;
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
          gap: 8px;
          margin-bottom: 15px;
        }
        .checkbox-group input {
          width: auto;
        }
        .checkbox-group label {
          font-size: 14px;
          margin: 0;
        }
        .activity-actions-bottom {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .activity-actions-bottom button {
          padding: 12px 24px;
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
          gap: 10px;
          flex-wrap: wrap;
        }
        .preset-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
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
        .password-form, .delete-form {
          margin-top: 15px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 6px;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .form-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-primary {
          background: #4CAF50;
          color: white;
        }
        .btn-secondary {
          background: #9E9E9E;
          color: white;
        }
        .btn-danger {
          background: #F44336;
          color: white;
        }
        .btn-danger-outline {
          background: transparent;
          color: #F44336;
          border: 1px solid #F44336;
        }
        .logout-section {
          background: #ffebee;
          border: 1px solid #ef9a9a;
          border-radius: 8px;
          padding: 20px;
        }
        .logout-section h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #c62828;
        }
        .logout-section p {
          margin: 0 0 15px 0;
          color: #666;
          font-size: 14px;
        }
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .success-message {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .loading, .error {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 100px 20px;
          font-size: 16px;
          color: #666;
        }
        .error {
          color: #F44336;
        }
      `}</style>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px'}}>✕</button>
        </div>
      )}

      <div className="profile-header">
        <div>
          <h1 className="profile-title">Profile</h1>
        </div>
        <button className="close-button" onClick={() => navigate('/')}>
          ✕
        </button>
      </div>

      {/* Profile Information */}
      <div className="profile-section">
        <h2 className="section-title">Account Information</h2>
        <div className="profile-info">
          <div className="info-row">
            <span className="info-label">Username</span>
            <span className="info-value">{profile.username}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Email</span>
            <span className="info-value">{profile.email || 'Not set'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Member Since</span>
            <span className="info-value">{formatDate(profile.date_joined)}</span>
          </div>
        </div>
        
        <button
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {showPasswordForm ? 'Cancel' : 'Change Password'}
        </button>

        <button
          onClick={() => navigate('/friends')}
          style={{
            marginTop: '15px',
            padding: '10px 20px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Go to Friends
        </button>

        {showPasswordForm && (
          <form className="password-form" onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>New Password (min 6 characters)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Change Password</button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowPasswordForm(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Activity Section */}
      <div className="profile-section">
        <h2 className="section-title">Current Activity</h2>
        {!showActivityEditor ? (
          <div className="activity-display">
            <div
              className="activity-indicator"
              style={{ backgroundColor: getActivityColor() }}
            />
            <span className="activity-text">
              {currentActivity && !currentActivity.is_expired
                ? currentActivity.name
                : 'No activity set'
              }
            </span>
            <div className="activity-actions">
              {currentActivity && !currentActivity.is_expired && (
                <button className="btn-clear" onClick={handleClearActivity}>Clear</button>
              )}
              <button className="btn-edit" onClick={() => setShowActivityEditor(true)}>
                {currentActivity && !currentActivity.is_expired ? 'Edit' : 'Add Activity'}
              </button>
            </div>
          </div>
        ) : (
          <div className="activity-editor">
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
              {currentActivity && !currentActivity.is_expired ? 'Edit Activity' : 'Add Activity'}
            </h3>
            
            <div className="form-group">
              <label>Activity Name (max 35 characters)</label>
              <input
                type="text"
                placeholder="What are you doing?"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value.slice(0, 35))}
                maxLength={35}
              />
            </div>

            <div className="form-group">
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
              <div className="form-group">
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

            <div className="activity-actions-bottom">
              <button className="btn-save" onClick={handleSetActivity}>
                {currentActivity && !currentActivity.is_expired ? 'Update Activity' : 'Set Activity'}
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

      {/* Logout Section */}
      <div className="profile-section logout-section">
        <h3>Logout</h3>
        <p>Sign out of your account and return to the login screen.</p>
        <button
          className="btn-danger"
          onClick={onLogout}
          style={{
            padding: '12px 24px',
            fontSize: '14px'
          }}
        >
          Logout
        </button>
      </div>

      {/* Delete Account Section */}
      <div className="profile-section">
        <h2 className="section-title" style={{ color: '#F44336' }}>Delete Account</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        
        {!showDeleteForm ? (
          <button
            className="btn-danger-outline"
            onClick={() => setShowDeleteForm(true)}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Delete Account
          </button>
        ) : (
          <div className="delete-form">
            {showDeleteConfirm && (
              <p style={{ color: '#F44336', marginBottom: '15px', fontWeight: 500 }}>
                ⚠️ This will permanently delete your account. Are you sure?
              </p>
            )}
            <div className="form-group">
              <label>Enter your password to confirm</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-danger"
                onClick={handleDeleteAccount}
                style={{ flex: 1 }}
              >
                {showDeleteConfirm ? 'Yes, Delete My Account' : 'Delete Account'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowDeleteForm(false);
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatProfile;
