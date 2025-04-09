'use client';

import { useEffect, useState } from 'react';
import proxyWebSocketService from '../services/proxyWebSocketService';

/**
 * ProxyWebSocketInitializer
 * 
 * React component that initializes the WebSocket proxy connection
 * and monitors its status.
 * 
 * This component should be included near the top of the app's component tree
 * to ensure the WebSocket connection is established early.
 */
export default function ProxyWebSocketInitializer() {
  const [status, setStatus] = useState<{ connected: boolean; timestamp: Date | null }>({
    connected: false,
    timestamp: null
  });
  
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  useEffect(() => {
    // Set up status change listener
    const onStatusChange = (statusData: { connected: boolean; timestamp: Date }) => {
      setStatus({
        connected: statusData.connected,
        timestamp: statusData.timestamp
      });
      
      // Log status change
      console.log(`WebSocket proxy connection status changed: ${statusData.connected ? 'connected' : 'disconnected'}`);
    };
    
    // Register event listener
    proxyWebSocketService.events.on('status-change', onStatusChange);
    
    // Initial connection attempt
    connectToWebSocketProxy();
    
    // Clean up on unmount
    return () => {
      proxyWebSocketService.events.off('status-change', onStatusChange);
    };
  }, []);
  
  // Reconnect if needed when reconnectAttempt changes
  useEffect(() => {
    if (reconnectAttempt > 0) {
      connectToWebSocketProxy();
    }
  }, [reconnectAttempt]);
  
  // Connect to WebSocket proxy
  const connectToWebSocketProxy = async () => {
    try {
      await proxyWebSocketService.connect();
    } catch (error) {
      console.error('Failed to connect to WebSocket proxy:', error);
    }
  };
  
  // Manual reconnect button handler
  const handleReconnect = () => {
    setReconnectAttempt(prev => prev + 1);
  };
  
  // Don't render anything visible
  return null;
} 