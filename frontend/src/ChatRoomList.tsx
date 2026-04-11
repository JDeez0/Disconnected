import { useContext } from 'react';
import { Link } from 'react-router-dom';
import ChatContext from './ChatContext'

const ChatRoomList = () => {
  const { state } = useContext(ChatContext);

  return (
    <div id="chat-rooms">
      <div style={{ padding: '20px' }}>
        <Link 
          to="/search" 
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Discover
        </Link>
      </div>
      {state.rooms.map((roomId: number) => {
        const room = state.roomsById[roomId]
        return <div className="chat-room-block" key={room.id}>
          <Link to={`/rooms/${room.id}`}>
            <div className="left-column">
              <span className="name">{room.name}</span>
              <span className="message-content">
                {room.last_message? (
                  <span>
                    <span className='message-content-author'>{room.last_message.user.username}:</span>
                    &nbsp;
                    {room.last_message.content}
                  </span>
                ) : (<></>)}
              </span>
            </div>
            <div className="right-column">
              <span className="chat-room-member-counter">{room.member_count}&nbsp;<span className="chat-room-member-counter-icon">🐈</span></span>
            </div>
          </Link>
        </div>
      })}
    </div>
  );
};

export default ChatRoomList;
