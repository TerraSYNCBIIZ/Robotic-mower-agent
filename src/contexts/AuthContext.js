import React, { createContext, useContext, useState, useEffect } from 'react';
import { getHusqvarnaToken } from '../lib/husqvarnaApi';

// Create the context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // Get a token from Husqvarna API
        const husqvarnaToken = await getHusqvarnaToken();
        
        // Set the token in state
        setToken(husqvarnaToken);
        
        // For now, we don't have a real user, so create a placeholder
        setUser({
          id: 'default-user',
          authenticated: true
        });
        
        setError(null);
      } catch (err) {
        console.error('Authentication error:', err);
        setError('Failed to authenticate with Husqvarna API');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
    
    // Set up token refresh interval (tokens expire after 60 minutes)
    const refreshInterval = setInterval(async () => {
      try {
        const newToken = await getHusqvarnaToken();
        setToken(newToken);
        console.log('Husqvarna token refreshed');
      } catch (err) {
        console.error('Token refresh error:', err);
        setError('Failed to refresh authentication token');
      }
    }, 45 * 60 * 1000); // Refresh every 45 minutes
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);
  
  // Expose the auth context
  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 