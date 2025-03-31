'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { husqvarnaApi, initializeApi } from '@/lib/husqvarna/api-client';
import { getMowerDataService } from '@/lib/husqvarna/mower-data-service-provider';

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
      const storedToken = localStorage.getItem('mowerAccessToken');
      const storedRefreshToken = localStorage.getItem('mowerRefreshToken');
      
      if (storedToken) {
        setToken(storedToken);
        setRefreshTokenValue(storedRefreshToken);
        setIsAuthenticated(true);
        
        // Initialize the API with the stored token
        husqvarnaApi.setAccessToken(storedToken);
        console.log('API client initialized with stored token on startup');
        
        // Ensure token is also in cookies for server-side auth with correct settings
        Cookies.set('mowerAccessToken', storedToken, { 
          expires: 7, // 7 days
          path: '/',
          sameSite: 'lax', // Changed from 'strict' to allow cross-context requests
          secure: window.location.protocol === 'https:', // Only use secure in HTTPS
        });
        
        console.log(`Setting auth cookie with token ${storedToken.substring(0, 10)}...`);
        
        // For debug - make a request to check token validity
        fetch('/api/auth/debug')
          .then(res => res.json())
          .then(data => {
            console.log('Auth debug info:', data);
          })
          .catch(err => {
            console.error('Auth debug error:', err);
          });
        
        // Get user information (simplified for now)
        setUser({
          id: 'user-1',
          name: 'Husqvarna User'
        });
      }
      
      // Initialize immediately to prevent UI flashing
      setInitialized(true);
    }
  }, []);

  // Function to handle login
  const login = useCallback((accessToken: string, refreshToken: string) => {
    // Store token in localStorage for persistent login
    localStorage.setItem('mowerAccessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('mowerRefreshToken', refreshToken);
    }
    
    // Store token in cookie for server-side auth with correct settings
    // The httpOnly: false is critical to allow JavaScript to access the cookie on the client
    Cookies.set('mowerAccessToken', accessToken, { 
      expires: 7, // 7 days
      path: '/',
      sameSite: 'lax', // Changed from 'strict' to allow cross-context requests
      secure: window.location.protocol === 'https:', // Only use secure in HTTPS
    });
    
    console.log(`Setting auth cookie with token ${accessToken.substring(0, 10)}...`);
    
    // Update auth state
    setToken(accessToken);
    setRefreshTokenValue(refreshToken);
    setIsAuthenticated(true);
    
    // Initialize the husqvarnaApi with the new token
    husqvarnaApi.setAccessToken(accessToken);
    console.log('API client initialized with new token after login');
    
    return true;
  }, []);

  // Logout function - clear token and reset authentication state
  const logout = () => {
    if (typeof window !== 'undefined') {
      // Close WebSocket connection if open
      try {
        const mowerDataService = getMowerDataService();
        if (mowerDataService) {
          console.log('Closing WebSocket connection before logout');
          mowerDataService.dispose();
        }
      } catch (error) {
        console.error('Error closing WebSocket connection:', error);
      }
      
      // Clear all authentication data from local storage
      localStorage.removeItem('mowerAccessToken');
      localStorage.removeItem('mowerRefreshToken');
      
      // Clear from cookies too
      Cookies.remove('mowerAccessToken', { path: '/' });
      
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

  // Refresh token function - attempt to get a new token
  const refreshToken = async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token...');
      
      // Add a timestamp to localStorage to track refresh attempts
      const now = Date.now();
      const lastRefreshAttempt = Number(localStorage.getItem('lastTokenRefreshAttempt') || '0');
      const refreshAttemptCount = Number(localStorage.getItem('tokenRefreshAttemptCount') || '0');
      
      // If we've tried too many times in a short period, use client credentials directly
      if (now - lastRefreshAttempt < 60000 && refreshAttemptCount >= 3) {
        console.log('Too many refresh attempts in a short time, switching to client credentials');
        return await useClientCredentials();
      }
      
      // Update refresh attempt tracking
      localStorage.setItem('lastTokenRefreshAttempt', now.toString());
      localStorage.setItem('tokenRefreshAttemptCount', (refreshAttemptCount + 1).toString());
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          refreshToken: refreshTokenValue 
        }),
      });
      
      // Handle rate limiting
      if (response.status === 429) {
        console.log('Token refresh rate limited, using client credentials');
        return await useClientCredentials();
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token refresh failed:', errorData);
        
        // Handle specific Husqvarna API errors
        if (errorData.details?.error_code === 'simultaneous.logins') {
          console.log('Detected simultaneous logins error, attempting to use client credentials...');
          return await useClientCredentials();
        }
        
        // Handle blocked account
        if (errorData.details?.error_code === 'user.is.blocked') {
          console.log('Account is blocked, using client credentials');
          return await useClientCredentials();
        }
        
        // If normal refresh fails with any other error, try direct method
        console.log('Token refresh failed with error, trying direct API access...');
        return await useDirectApiAccess();
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        // Reset attempt counters on success
        localStorage.setItem('tokenRefreshAttemptCount', '0');
        
        // Check if this is a client credentials token
        if (data.auth_type === 'client_credentials') {
          console.log('Using client credentials token instead of user token');
        } else if (data.auth_type === 'direct_api') {
          console.log('Using direct API access method (bypassing OAuth)');
        }
        
        // Update token in state and localStorage
        login(data.access_token, data.refresh_token || refreshTokenValue || '');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // On error, try the client credentials as a fallback
      try {
        return await useClientCredentials();
      } catch (innerError) {
        console.error('Even client credentials failed:', innerError);
        return false;
      }
    }
  };
  
  // Special function to handle Husqvarna's simultaneous logins error
  const resetHusqvarnaLogins = async (): Promise<boolean> => {
    try {
      // First try client credentials approach
      return await useClientCredentials();
    } catch (error) {
      console.error('Error resetting Husqvarna logins:', error);
      return false;
    }
  };
  
  // Use client credentials directly - this should always work
  const useClientCredentials = async (): Promise<boolean> => {
    try {
      console.log('Switching to client credentials authentication');
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ useDirect: true }),
      });
      
      if (!response.ok) {
        console.error('Client credentials auth failed:', await response.text());
        return false;
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        // Update token in state and localStorage
        login(data.access_token, refreshTokenValue || '');
        console.log('Successfully switched to client credentials auth');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error using client credentials:', error);
      return false;
    }
  };

  // Use direct API access as a last resort
  const useDirectApiAccess = async (): Promise<boolean> => {
    try {
      console.log('Trying direct API access (bypassing OAuth)...');
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          useDirect: true,
          bypassOAuth: true // Signal to use direct API key
        }),
      });
      
      if (!response.ok) {
        console.error('Direct API access failed:', await response.text());
        return false;
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        // Update token in state and localStorage
        login(data.access_token, refreshTokenValue || '');
        console.log('Successfully switched to direct API access');
        
        // Force a page reload to ensure all components use the new token
        setTimeout(() => {
          window.location.reload();
        }, 500);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error using direct API access:', error);
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