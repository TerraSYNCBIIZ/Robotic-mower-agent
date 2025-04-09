'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

// Create authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
  user: { id: string; name: string } | null;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  token: null,
  login: () => {},
  logout: () => {},
  user: null,
  refreshToken: async () => false
});

export const useAuth = () => useContext(AuthContext);

// Authentication Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Initialize authentication state from localStorage and cookies
  useEffect(() => {
    // Check for token in localStorage (only in browser)
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('userAccessToken');
      const storedRefreshToken = localStorage.getItem('userRefreshToken');
      
      if (storedToken) {
        setToken(storedToken);
        setRefreshTokenValue(storedRefreshToken);
        setIsAuthenticated(true);
        
        // Ensure token is also in cookies for server-side auth with correct settings
        Cookies.set('userAccessToken', storedToken, { 
          expires: 7, // 7 days
          path: '/',
          sameSite: 'lax',
          secure: window.location.protocol === 'https:', // Only use secure in HTTPS
        });
        
        console.log('Authentication initialized from stored token');
        
        // Set sample user data
        setUser({
          id: 'user-1',
          name: 'Mower User'
        });
      }
      
      // Initialize immediately to prevent UI flashing
      setInitialized(true);
    }
  }, []);

  // Function to handle login
  const login = useCallback((accessToken: string, refreshToken: string) => {
    // Store token in localStorage for persistent login
    localStorage.setItem('userAccessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('userRefreshToken', refreshToken);
    }
    
    // Store token in cookie for server-side auth
    Cookies.set('userAccessToken', accessToken, { 
      expires: 7, // 7 days
      path: '/',
      sameSite: 'lax',
      secure: window.location.protocol === 'https:',
    });
    
    console.log('Authentication token set successfully');
    
    // Update auth state
    setToken(accessToken);
    setRefreshTokenValue(refreshToken);
    setIsAuthenticated(true);
    
    // Set sample user data
    setUser({
      id: 'user-1',
      name: 'Mower User'
    });
    
    return true;
  }, []);

  // Logout function - clear token and reset authentication state
  const logout = () => {
    if (typeof window !== 'undefined') {
      // Clear all authentication data from local storage
      localStorage.removeItem('userAccessToken');
      localStorage.removeItem('userRefreshToken');
      
      // Clear from cookies too
      Cookies.remove('userAccessToken', { path: '/' });
      
      // Clear any other app state data
      localStorage.removeItem('lastViewedMower');
      localStorage.removeItem('mowerSettings');
      localStorage.removeItem('dashboardPreferences');
      
      // Clear any session storage items too
      sessionStorage.clear();
    }
    
    // Reset authentication state
    setToken(null);
    setRefreshTokenValue(null);
    setIsAuthenticated(false);
    setUser(null);
    
    // Redirect to login page
    router.push('/login');
  };

  // Simplified refresh token function (in a real app, this would call an API)
  const refreshToken = async (): Promise<boolean> => {
    try {
      console.log('Token refresh function called (simulation)');
      
      // In a real app, this would make an API call to refresh the token
      // For now, we'll just simulate a successful refresh
      
      // Simulate a new token
      const newToken = `refreshed_token_${Date.now()}`;
      
      // Update token in state and localStorage
      login(newToken, refreshTokenValue || '');
      
      console.log('Token refreshed successfully (simulation)');
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  };

  // Add simple mounting effect
  useEffect(() => {
    // Set mounted to true after initial render
    setMounted(true);
  }, []);

  // Modify the render logic
  if (!mounted) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        login,
        logout,
        user,
        refreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 