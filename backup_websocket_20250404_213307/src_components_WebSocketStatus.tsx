'use client';

import { useState, useEffect } from 'react';
// @ts-ignore - Firestore imports
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs, DocumentData } from 'firebase/firestore';
// @ts-ignore - Functions imports
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '@/contexts/FirebaseContext';
import mockWebSocketService from '@/services/mockWebSocketService';

interface WebSocketStatus {
  connected: boolean;
  lastUpdate: Date;
  reconnectAttempts: number;
}

interface LogEntry {
  type: string;
  error?: string;
  timestamp: Date;
  details?: string;
}

// Detect if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

export default function WebSocketStatus() {
  const [status, setStatus] = useState<WebSocketStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { db, functions } = useFirebase();

  // Initialize WebSocket connection manually if needed
  const initializeWebSocket = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (isDevelopment) {
        // In development, use mock service
        await mockWebSocketService.connect();
        console.log('Mock WebSocket reconnected successfully');
        
        // Update status manually since we're not using Firestore in dev mode
        setStatus({
          connected: true,
          lastUpdate: new Date(),
          reconnectAttempts: 0
        });
        setLoading(false);
        return;
      }
      
      if (!functions) {
        setError('Firebase functions not available');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/websocket/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('WebSocket reconnection response:', data);
    } catch (err) {
      console.error('Error initiating WebSocket connection:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      if (isDevelopment) {
        // Fallback to mock in dev mode
        try {
          await mockWebSocketService.connect();
          setStatus({
            connected: true,
            lastUpdate: new Date(),
            reconnectAttempts: 0
          });
        } catch (mockError) {
          console.error('Mock reconnection failed:', mockError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Get recent logs
  const fetchRecentLogs = async () => {
    if (!db) {
      console.error('Firestore not available');
      return;
    }
    
    try {
      const logsQuery = query(
        collection(db, 'logs'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(logsQuery);
      // @ts-ignore - Firestore document typing
      const logEntries = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as LogEntry;
      });
      
      setLogs(logEntries);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Subscribe to WebSocket status changes
  useEffect(() => {
    if (!db) {
      setError('Firestore not available');
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
        } else {
          console.log('No WebSocket status document found');
        }
      },
      // @ts-ignore - Firestore error typing
      (err) => {
        console.error('Error listening to WebSocket status:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Fetch logs initially
    fetchRecentLogs();
    
    // Set up interval to refresh logs
    const logsInterval = setInterval(fetchRecentLogs, 10000);

    // Cleanup on unmount
    return () => {
      unsubscribe();
      clearInterval(logsInterval);
    };
  }, [db]);

  // Format time ago
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return Math.floor(seconds) + ' seconds ago';
  };
  
  // Determine status color
  const getStatusColor = () => {
    if (!status) return 'bg-gray-500';
    if (status.connected) return 'bg-green-500';
    return 'bg-red-500';
  };

  // Check if last update is stale (more than 10 minutes)
  const isUpdateStale = () => {
    if (!status) return false;
    const diffMinutes = (new Date().getTime() - status.lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes > 10;
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 mt-4">
      <h2 className="text-xl font-semibold mb-4">WebSocket Connection Status</h2>
      
      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading status...</span>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded">
          Error: {error}
        </div>
      ) : (
        <div>
          <div className="flex items-center mb-4">
            <div className={`h-4 w-4 rounded-full ${getStatusColor()} mr-2`}></div>
            <span className="font-medium">
              {status?.connected ? 'Connected' : 'Disconnected'}
              {isUpdateStale() && ' (Stale)'}
            </span>
            
            <button 
              onClick={initializeWebSocket}
              className="ml-auto bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
              disabled={loading}
            >
              Reconnect
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p>{status?.lastUpdate.toLocaleString()}</p>
              <p className="text-xs text-gray-400">{timeAgo(status?.lastUpdate || new Date())}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Reconnect Attempts</p>
              <p>{status?.reconnectAttempts || 0}</p>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">Recent Logs</h3>
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs found</p>
            ) : (
              <div className="max-h-48 overflow-y-auto bg-gray-50 rounded p-2">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm border-b border-gray-200 py-2">
                    <div className="flex justify-between">
                      <span className={`font-medium ${log.type.includes('error') ? 'text-red-600' : 'text-gray-800'}`}>
                        {log.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {timeAgo(log.timestamp)}
                      </span>
                    </div>
                    {log.error && <p className="text-red-600">{log.error}</p>}
                    {log.details && (
                      <details>
                        <summary className="cursor-pointer text-xs text-blue-500">Details</summary>
                        <pre className="text-xs mt-1 p-1 bg-gray-100 rounded overflow-x-auto">
                          {log.details}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button 
              onClick={fetchRecentLogs} 
              className="text-sm text-blue-500 mt-2"
            >
              Refresh Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 