import React, { createContext, useContext, useState, useEffect } from 'react';
import { husqvarnaApi } from '@/lib/husqvarna/api-client';

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
        
        // Get a token from local storage - used by the new API client
        const localToken = localStorage.getItem('mowerAccessToken');
        
        if (localToken) {
          // Set the token in state
          setToken(localToken);
          
          // Also ensure the API client is using this token
          husqvarnaApi.setAccessToken(localToken);
          
          // For now, we don't have a real user, so create a placeholder
          setUser({
            id: 'default-user',
            authenticated: true
          });
          
          setError(null);
        } else {
          setError('No authentication token found');
          setToken(null);
          setUser(null);
        }
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
    
    // We don't need a refresh interval now as tokens are handled by the API client
    // and the user login flow
    
    return () => {
      // No cleanup needed
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