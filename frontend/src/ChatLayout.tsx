import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import { getCurrentActivity } from './AppApi';

const DEFAULT_ACTIVITY_COLOR = '#4DD0E1'; // Light turquoise

interface ChatLayoutProps {
  children: any
  realTimeStatus: string
  unrecoverableError: string
  onLogout: () => void
}

const ChatLayout: React.FC<ChatLayoutProps> = ({ children, realTimeStatus, unrecoverableError, onLogout }) => {
  const userInfo = useContext(AuthContext);
  const navigate = useNavigate();
  const [activityColor, setActivityColor] = useState(DEFAULT_ACTIVITY_COLOR);

  useEffect(() => {
    const loadActivityColor = async () => {
      try {
        const activity = await getCurrentActivity();
        if (activity && !activity.is_expired) {
          setActivityColor(activity.color);
        } else {
          setActivityColor(DEFAULT_ACTIVITY_COLOR);
        }
      } catch (err) {
        setActivityColor(DEFAULT_ACTIVITY_COLOR);
      }
    };

    loadActivityColor();
    // Refresh activity color every 30 seconds
    const interval = setInterval(loadActivityColor, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <div id='chat-layout'>
      <div id='chat-navbar'>
        <NavLink to={`/`} className={({ isActive }) => isActive ? "navbar-active-link" : ""}>My rooms</NavLink>
        <NavLink to={`/search`} className={({ isActive }) => isActive ? "navbar-active-link" : ""}>Discover</NavLink>
        <span id="profile-container" style={{ marginLeft: 'auto' }}>
          <button 
            id="profile-button"
            onClick={handleProfileClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            <div 
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                backgroundColor: activityColor
              }}
            />
            {userInfo.username}
          </button>
        </span>
      </div>
      {unrecoverableError != '' ? (
        <div id='chat-state-lost'>
          {unrecoverableError}
        </div>
      ) : (
        <div id='chat-content'>
          {children}
        </div>
      )}
    </div>
  );
}

export default ChatLayout;
