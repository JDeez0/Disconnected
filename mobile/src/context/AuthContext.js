import React, { createContext, useState, useContext, useEffect } from 'react';
import { getCSRFToken } from '../api/AppApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCsrf = async () => {
    try {
      const token = await getCSRFToken();
      setCsrf(token);
      return token;
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchCsrf();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      authenticated, setAuthenticated, 
      csrf, setCsrf, 
      loading, setLoading,
      fetchCsrf 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
