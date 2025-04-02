import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';

// Create a global singleton WebSocket instance outside of React's lifecycle
// This will persist even when components remount
let globalWsInstance = null;
let globalConnectionStatus = 'disconnected';
let globalLastMessage = null;
let globalConnectionError = null;
let globalListeners = [];
let wsConfig = {
  token: null,
  apiKey: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  pingInterval: null,
  isConnecting: false
};

// Function to notify all listeners of state changes
const notifyListeners = () => {
  globalListeners.forEach(listener => {
    try {
      listener({
        isConnected: globalWsInstance && globalWsInstance.readyState === WebSocket.OPEN,
        connectionStatus: globalConnectionStatus,
        connectionError: globalConnectionError,
        lastMessage: globalLastMessage
      });
    } catch (error) {
      console.error('Error notifying WebSocket listener:', error);
    }
  });
};

// Global connect function
const connectToWebSocketServer = (token, force = false) => {
  // Don't try to connect if already connecting unless forced
  if (wsConfig.isConnecting && !force) {
    console.log('Already attempting to connect to WebSocket, ignoring duplicate request');
    return;
  }
  
  // Don't connect if no token
  if (!token) {
    globalConnectionError = 'Authentication token is required';
    globalConnectionStatus = 'error';
    notifyListeners();
    return;
  }
  
  // If we have too many reconnect attempts, limit the frequency
  if (wsConfig.reconnectAttempts > 5 && !force) {
    const backoffTime = Math.min(30000, 1000 * Math.pow(2, wsConfig.reconnectAttempts - 5));
    console.log(`Throttling WebSocket reconnection attempts. Waiting ${backoffTime/1000} seconds before next attempt.`);
    
    if (wsConfig.reconnectTimer) {
      clearTimeout(wsConfig.reconnectTimer);
    }
    
    wsConfig.reconnectTimer = setTimeout(() => {
      connectToWebSocketServer(token, true);
    }, backoffTime);
    
    return;
  }
  
  // Close existing socket if any
  if (globalWsInstance && globalWsInstance.readyState < 2) {
    try {
      wsConfig.isConnecting = false;
      globalWsInstance.close(1000, 'User initiated disconnect');
    } catch (e) {
      console.error('Error closing existing WebSocket:', e);
    }
  }
  
  // Clear any existing ping interval
  if (wsConfig.pingInterval) {
    clearInterval(wsConfig.pingInterval);
    wsConfig.pingInterval = null;
  }
  
  try {
    wsConfig.isConnecting = true;
    wsConfig.token = token;
    wsConfig.apiKey = process.env.NEXT_PUBLIC_HUSQVARNA_APP_KEY;
    
    // Get WebSocket proxy URL from environment
    const wsURL = process.env.NEXT_PUBLIC_WEBSOCKET_PROXY_URL || 'ws://localhost:8000';
    
    console.log(`[SINGLETON] Connecting to WebSocket with token: ${token?.substring(0, 10)}...`);
    globalConnectionStatus = 'connecting';
    notifyListeners();
    
    // Connect using the user's authentication token
    const newSocket = new WebSocket(`${wsURL}?token=${token}&apiKey=${wsConfig.apiKey}`);
    
    newSocket.onopen = () => {
      console.log('[SINGLETON] WebSocket connected');
      globalConnectionStatus = 'connected';
      globalConnectionError = null;
      wsConfig.reconnectAttempts = 0;
      wsConfig.isConnecting = false;
      notifyListeners();
      
      // Setup ping interval to keep connection alive
      wsConfig.pingInterval = setInterval(() => {
        if (newSocket.readyState === WebSocket.OPEN) {
          newSocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 30000);
    };
    
    newSocket.onclose = (event) => {
      console.log(`[SINGLETON] WebSocket closed: ${event.code} ${event.reason}`);
      globalConnectionStatus = 'disconnected';
      wsConfig.isConnecting = false;
      
      // Clear ping interval
      if (wsConfig.pingInterval) {
        clearInterval(wsConfig.pingInterval);
        wsConfig.pingInterval = null;
      }
      
      notifyListeners();
      
      // Only attempt to reconnect on abnormal closures and if we have a token
      if (event.code !== 1000 && wsConfig.token) {
        wsConfig.reconnectAttempts++;
        
        // Attempt to reconnect with exponential backoff
        const delay = Math.min(5000, Math.pow(2, wsConfig.reconnectAttempts) * 1000);
        console.log(`[SINGLETON] Will attempt to reconnect in ${delay/1000} seconds (attempt ${wsConfig.reconnectAttempts})`);
        
        if (wsConfig.reconnectTimer) {
          clearTimeout(wsConfig.reconnectTimer);
        }
        
        wsConfig.reconnectTimer = setTimeout(() => {
          connectToWebSocketServer(wsConfig.token, true);
        }, delay);
      }
    };
    
    newSocket.onerror = (error) => {
      console.error('[SINGLETON] WebSocket error:', error);
      globalConnectionError = 'Connection error';
      wsConfig.isConnecting = false;
      notifyListeners();
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle connection status messages
        if (data.type === 'connection_status') {
          globalConnectionStatus = data.status;
          
          if (data.status === 'error') {
            globalConnectionError = data.message || 'Connection error';
            
            // Handle authentication errors
            if (data.error === 'authentication_failed') {
              console.error('[SINGLETON] Authentication failed with Husqvarna API');
            }
          }
        } else {
          // Handle other messages (mower events, etc)
          globalLastMessage = data;
          
          // Emit custom event for components to listen
          const customEvent = new CustomEvent('websocket-message', { detail: data });
          window.dispatchEvent(customEvent);
        }
        
        notifyListeners();
      } catch (error) {
        console.error('[SINGLETON] Error parsing WebSocket message:', error);
      }
    };
    
    // Store the socket globally
    globalWsInstance = newSocket;
    
  } catch (error) {
    console.error('[SINGLETON] WebSocket connection error:', error);
    globalConnectionError = error.message;
    globalConnectionStatus = 'error';
    wsConfig.isConnecting = false;
    wsConfig.reconnectAttempts++;
    notifyListeners();
  }
};

// Global disconnect function
const disconnectFromWebSocketServer = () => {
  if (globalWsInstance) {
    if (wsConfig.pingInterval) {
      clearInterval(wsConfig.pingInterval);
      wsConfig.pingInterval = null;
    }
    
    if (wsConfig.reconnectTimer) {
      clearTimeout(wsConfig.reconnectTimer);
      wsConfig.reconnectTimer = null;
    }
    
    if (globalWsInstance.readyState < 2) {
      globalWsInstance.close(1000, 'User initiated disconnect');
    }
    
    globalWsInstance = null;
    globalConnectionStatus = 'disconnected';
    wsConfig.isConnecting = false;
    notifyListeners();
  }
};

// Create the WebSocket context
const WebSocketContext = createContext();

// Hook to use the WebSocket context
export const useWebSocket = () => useContext(WebSocketContext);

// Provider component
export const WebSocketProvider = ({ children }) => {
  const [state, setState] = useState({
    isConnected: globalWsInstance && globalWsInstance.readyState === WebSocket.OPEN,
    connectionStatus: globalConnectionStatus,
    connectionError: globalConnectionError,
    lastMessage: globalLastMessage
  });
  
  // Get authentication token
  const auth = useAuth();
  const token = auth?.token;
  const componentMountedRef = useRef(true);
  
  // Register this component as a listener for WebSocket state changes
  useEffect(() => {
    const listenerCallback = (newState) => {
      if (componentMountedRef.current) {
        setState(newState);
      }
    };
    
    // Add listener
    globalListeners.push(listenerCallback);
    
    // Set mounted flag
    componentMountedRef.current = true;
    
    // Remove listener on unmount
    return () => {
      componentMountedRef.current = false;
      const index = globalListeners.indexOf(listenerCallback);
      if (index !== -1) {
        globalListeners.splice(index, 1);
      }
    };
  }, []);
  
  // Connect when token becomes available and different from current token
  useEffect(() => {
    if (token && token !== wsConfig.token) {
      console.log('[SINGLETON] Token changed or became available, connecting WebSocket');
      connectToWebSocketServer(token);
    }
  }, [token]);
  
  // Clean up global WebSocket on page unload to prevent memory leaks
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnectFromWebSocketServer();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  // Create value object with methods for the context
  const value = {
    ...state,
    connect: useCallback(() => {
      if (token) {
        connectToWebSocketServer(token, true);
      } else {
        console.warn('[SINGLETON] Cannot connect: No token available');
      }
    }, [token]),
    
    disconnect: useCallback(() => {
      disconnectFromWebSocketServer();
    }, []),
    
    send: useCallback((data) => {
      if (globalWsInstance && globalWsInstance.readyState === WebSocket.OPEN) {
        globalWsInstance.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      }
      return false;
    }, [])
  };
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}; 