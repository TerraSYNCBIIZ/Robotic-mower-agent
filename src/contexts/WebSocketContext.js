'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import proxyWebSocketService from '@/services/proxyWebSocketService';

// Define status enum
export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// Create context
const WebSocketContext = createContext({
  status: ConnectionStatus.DISCONNECTED,
  lastMessage: null,
  connect: () => {},
  disconnect: () => {},
  sendCommand: () => {},
  error: null,
  isConnected: false
});

// Provider component
export function WebSocketProvider({ children }) {
  const [status, setStatus] = useState(ConnectionStatus.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  
  // Connect to the WebSocket proxy
  const connect = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      await proxyWebSocketService.connect();
      setStatus(ConnectionStatus.CONNECTED);
      setError(null);
    } catch (err) {
      setStatus(ConnectionStatus.ERROR);
      setError(err.message || 'Failed to connect to WebSocket proxy');
      console.error('WebSocket connection error:', err);
    }
  };
  
  // Disconnect from the WebSocket proxy
  const disconnect = () => {
    proxyWebSocketService.disconnect();
    setStatus(ConnectionStatus.DISCONNECTED);
  };
  
  // Send a command to a mower through the WebSocket proxy
  const sendCommand = (mowerId, action, parameters) => {
    if (status !== ConnectionStatus.CONNECTED) {
      console.warn('Cannot send command: WebSocket is not connected');
      return;
    }
    
    proxyWebSocketService.sendCommand(mowerId, action, parameters);
  };
  
  // Set up event listeners
  useEffect(() => {
    // Handle status changes
    const onStatusChange = (statusData) => {
      setStatus(statusData.connected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED);
    };
    
    // Handle messages
    const onMessage = (message) => {
      setLastMessage(message);
    };
    
    // Handle errors
    const onError = (err) => {
      setError(err.message || 'WebSocket error');
      setStatus(ConnectionStatus.ERROR);
    };
    
    // Register event listeners
    proxyWebSocketService.events.on('status-change', onStatusChange);
    proxyWebSocketService.events.on('message', onMessage);
    proxyWebSocketService.events.on('error', onError);
    
    // Update initial status
    setStatus(proxyWebSocketService.isConnected() ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED);
    
    // Cleanup on unmount
    return () => {
      proxyWebSocketService.events.off('status-change', onStatusChange);
      proxyWebSocketService.events.off('message', onMessage);
      proxyWebSocketService.events.off('error', onError);
    };
  }, []);
  
  // Calculate isConnected based on status
  const isConnected = status === ConnectionStatus.CONNECTED;
  
  // Context value
  const value = {
    status,
    lastMessage,
    connect,
    disconnect,
    sendCommand,
    error,
    isConnected
  };
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook for using the context
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export default WebSocketContext; 