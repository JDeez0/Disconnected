import React, { useState, useContext } from 'react';
import logo from './assets/centrifugo.svg'
import CsrfContext from './CsrfContext';
import { login, register } from './AppApi';

interface ChatLoginProps {
  onSuccess: (userInfo: any) => void;
}

const ChatLogin: React.FC<ChatLoginProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const csrf = useContext(CsrfContext)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      let resp;
      if (isRegistering) {
        resp = await register(csrf, username, email, password)
      } else {
        resp = await login(csrf, username, password)
      }
      onSuccess(resp);
    } catch (err: any) {
      console.error(`${isRegistering ? 'Registration' : 'Login'} failed:`, err);
      setError(err.response?.data?.detail || `${isRegistering ? 'Registration' : 'Login'} failed. Please try again.`);
    }
    setLoading(false)
  };

  return (
    <form id="chat-login" onSubmit={(e) => {
      e.preventDefault()
      handleSubmit()
    }}>
      <div id="chat-login-logo-container">
        <img src={logo} width="100px" height="100px" />
      </div>
      <div className="input-container">
        <input 
          type="text" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder="Username" 
          autoComplete="username"
        />
      </div>
      {isRegistering && (
        <div className="input-container">
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="Email (optional)" 
            autoComplete="email"
          />
        </div>
      )}
      <div className="input-container">
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Password" 
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
        />
      </div>
      {error && (
        <div style={{ color: 'red', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>
          {error}
        </div>
      )}
      <div className='login-button-container'>
        <button 
          disabled={loading} 
          className={`${(loading) ? 'loading' : ''}`}
          type="submit"
        >
          {isRegistering ? 'Create Account' : 'Login'}
        </button>
      </div>
      <div style={{ 
        marginTop: '15px', 
        textAlign: 'center',
        fontSize: '14px',
        color: '#666' 
      }}>
        {isRegistering ? (
          <span>
            Already have an account?{' '}
            <button 
              type="button"
              onClick={() => {
                setIsRegistering(false)
                setError('')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#4a90e2',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontSize: '14px'
              }}
            >
              Login here
            </button>
          </span>
        ) : (
          <span>
            Don't have an account?{' '}
            <button 
              type="button"
              onClick={() => {
                setIsRegistering(true)
                setError('')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#4a90e2',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontSize: '14px'
              }}
            >
              Sign up
            </button>
          </span>
        )}
      </div>
    </form>
  );
};

export default ChatLogin;
