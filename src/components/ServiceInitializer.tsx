'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import proxyWebSocketService from '@/services/proxyWebSocketService';

// Detect if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * ServiceInitializer component for initializing the WebSocket proxy connection
 * This component is responsible for ensuring the WebSocket proxy connection
 * is established when the application loads
 */
export function ServiceInitializer() {
  const { isAuthenticated } = useAuth();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Only try to initialize once
    if (hasInitialized) return;
    
    // Initialize WebSocket proxy connection when component mounts
    const initializeWebSocketProxy = async () => {
      try {
        console.log('Initializing WebSocket proxy connection...');
        
        // In production, require authentication
        if (!isDevelopment && !isAuthenticated) {
          console.log('User not authenticated, skipping WebSocket proxy initialization');
          return;
        }
        
        // Connect to WebSocket proxy with a timeout
        const connectionTimeout = setTimeout(() => {
          console.log('WebSocket proxy connection timed out');
        }, 5000);
        
        // Connect to WebSocket proxy
        await proxyWebSocketService.connect();
        clearTimeout(connectionTimeout);
        
        console.log('WebSocket proxy connection initiated successfully');
        setHasInitialized(true);
      } catch (err) {
        console.error('Error connecting to WebSocket proxy:', err);
      }
    };

    // Execute the initialization with a slight delay to prevent race conditions
    setTimeout(() => {
      initializeWebSocketProxy();
    }, 1000);
    
    // Clean up function for unmount
    return () => {
      // Note: We don't disconnect on unmount to keep the connection alive
      // If you need to disconnect, uncomment the line below
      // proxyWebSocketService.disconnect();
    };
  }, [isAuthenticated, hasInitialized]);
  
  return null;
} 