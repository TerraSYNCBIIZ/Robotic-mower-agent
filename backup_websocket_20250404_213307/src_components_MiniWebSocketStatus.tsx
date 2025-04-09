'use client';

import { useState, useEffect } from 'react';
// @ts-ignore - Firestore imports
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/contexts/FirebaseContext';
import Link from 'next/link';
import mockWebSocketService from '@/services/mockWebSocketService';

interface WebSocketStatus {
  connected: boolean;
  lastUpdate: Date;
  reconnectAttempts: number;
}

// Detect if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

export default function MiniWebSocketStatus() {
  const [status, setStatus] = useState<WebSocketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const { db } = useFirebase();

  // Try to reconnect to WebSocket
  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      if (isDevelopment) {
        // In development, use mock service
        await mockWebSocketService.connect();
        // Update status manually in dev mode
        setStatus({
          connected: true,
          lastUpdate: new Date(),
          reconnectAttempts: 0
        });
      } else {
        // In production, use real API
        await fetch('/api/websocket/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        // Success will be reflected in the Firestore status
      }
    } catch (error) {
      console.error('Error reconnecting to WebSocket:', error);
    } finally {
      setTimeout(() => setReconnecting(false), 1000);
    }
  };

  // Subscribe to WebSocket status changes
  useEffect(() => {
    if (isDevelopment) {
      // In development, use the mock service directly
      setLoading(false);
      
      // Get initial status
      const initialStatus = mockWebSocketService.getStatus();
      setStatus(initialStatus);
      
      // Subscribe to status updates
      const unsubscribe = mockWebSocketService.onStatusUpdate((connected) => {
        setStatus({
          connected,
          lastUpdate: new Date(),
          reconnectAttempts: 0
        });
      });
      
      return unsubscribe;
    }
    
    if (!db) {
      setLoading(false);
      return () => {};
    }
    
    const unsubscribe = onSnapshot(
      doc(db, 'system', 'websocket'),
      // @ts-ignore - Firestore document snapshot typing
      (docSnapshot) => {
        setLoading(false);
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setStatus({
            connected: data.connected || false,
            lastUpdate: data.lastUpdate?.toDate() || new Date(0),
            reconnectAttempts: data.reconnectAttempts || 0
          });
        }
      },
      // @ts-ignore - Firestore error typing
      (err) => {
        console.error('Error listening to WebSocket status:', err);
        setLoading(false);
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [db]);

  // Determine status color
  const getStatusColor = () => {
    if (!status) return 'bg-gray-500';
    if (status.connected) return 'bg-green-500';
    return 'bg-red-500';
  };

  // Check if last update is stale (more than 5 minutes)
  const isUpdateStale = () => {
    if (!status) return false;
    const diffMinutes = (new Date().getTime() - status.lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes > 5;
  };

  // Determine the color and icon based on status
  const getStatusIndicator = () => {
    if (loading) {
      return {
        color: 'bg-gray-400',
        title: 'Loading WebSocket status...'
      };
    }
    
    if (!status) {
      return {
        color: 'bg-gray-500',
        title: 'WebSocket status unknown'
      };
    }
    
    if (!status.connected) {
      return {
        color: 'bg-red-500',
        title: 'WebSocket disconnected'
      };
    }
    
    if (isUpdateStale()) {
      return {
        color: 'bg-yellow-500',
        title: 'WebSocket connection stale'
      };
    }
    
    return {
      color: 'bg-green-500',
      title: 'WebSocket connected'
    };
  };

  const indicator = getStatusIndicator();

  return (
    <Link href="/websocket" className="flex items-center" title={indicator.title}>
      <div className={`h-3 w-3 rounded-full ${getStatusColor()} ${loading ? 'animate-pulse' : ''}`}></div>
      <span className="text-xs text-gray-600 hidden sm:inline">WebSocket</span>
      {!status?.connected && !loading && (
        <button 
          onClick={handleReconnect}
          disabled={reconnecting}
          className="text-xs text-blue-500 hover:text-blue-700 ml-1 disabled:opacity-50"
        >
          {reconnecting ? 'Reconnecting...' : 'Reconnect'}
        </button>
      )}
    </Link>
  );
} 