'use client';

import { useState, useEffect } from 'react';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HusqvarnaWebSocketManager } from '@/lib/husqvarna/websocket';

export default function TestWebSocketPage() {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [messages, setMessages] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [websocket, setWebsocket] = useState<HusqvarnaWebSocketManager | null>(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new HusqvarnaWebSocketManager();
    
    // Set up event listeners
    ws.on('message', (message) => {
      console.log('Received message:', message);
      setMessages((prev) => [`${new Date().toISOString()} - ${JSON.stringify(message)}`, ...prev]);
    });
    
    ws.on('status_change', (newStatus) => {
      console.log('WebSocket status changed:', newStatus);
      setStatus(newStatus);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Save the websocket instance
    setWebsocket(ws);
    
    // Start metrics update interval
    const interval = setInterval(() => {
      if (ws) {
        setMetrics(ws.getConnectionMetrics());
      }
    }, 1000);
    
    // Clean up when unmounting
    return () => {
      clearInterval(interval);
      ws.dispose();
    };
  }, []);
  
  // Handle connect button click
  const handleConnect = async () => {
    if (websocket) {
      try {
        // Clear any previous WebSocket failure flags
        if (typeof window !== 'undefined') {
          localStorage.removeItem('websocket_failed');
          localStorage.removeItem('websocket_last_attempt');
        }
        
        const success = await websocket.connect();
        console.log('Connection result:', success);
      } catch (error) {
        console.error('Error connecting:', error);
      }
    }
  };
  
  // Handle debug reset click - thoroughly clean up and try again
  const handleDebugReset = async () => {
    try {
      // Clear all WebSocket-related localStorage items
      if (typeof window !== 'undefined') {
        // Clear WebSocket failure flags
        localStorage.removeItem('websocket_failed');
        localStorage.removeItem('websocket_last_attempt');
        
        // Clear other potential flags that might interfere
        localStorage.removeItem('websocket_status');
        localStorage.removeItem('websocket_metrics');
        
        // Force page reload to clear any stale connections
        console.log('Resetting WebSocket state and reloading page...');
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      console.error('Error during debug reset:', error);
    }
  };
  
  // Handle disconnect button click
  const handleDisconnect = () => {
    if (websocket) {
      websocket.disconnect();
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">WebSocket Testing</h1>
      
      <div className="p-4 bg-blue-50 rounded-md mb-4">
        <h2 className="text-lg font-semibold mb-2">How to test the WebSocket connection:</h2>
        <ol className="list-decimal ml-4 space-y-1">
          <li>Click the <strong>Connect</strong> button to establish a WebSocket connection.</li>
          <li>If successful, the status will change to <strong>CONNECTED</strong> (green) and messages will appear in the right panel.</li>
          <li>If connection fails, try the <strong>Debug Reset</strong> button to clear any cached state and reload.</li>
          <li>The connection should establish quickly. If it stays in <strong>CONNECTING</strong> state for more than 10 seconds, it likely won't connect.</li>
        </ol>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              WebSocket Status
              <span 
                className={`px-2 py-1 rounded text-white ${
                  status === WebSocketStatus.CONNECTED 
                    ? 'bg-green-500' 
                    : status === WebSocketStatus.CONNECTING 
                      ? 'bg-yellow-500' 
                      : status === WebSocketStatus.ERROR 
                        ? 'bg-red-500' 
                        : 'bg-gray-500'
                }`}
              >
                {status}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2 mb-4">
              <Button onClick={handleConnect} disabled={status === WebSocketStatus.CONNECTED}>
                Connect
              </Button>
              <Button onClick={handleDisconnect} disabled={status !== WebSocketStatus.CONNECTED} variant="destructive">
                Disconnect
              </Button>
              <Button onClick={handleDebugReset} variant="outline" className="ml-auto">
                Debug Reset
              </Button>
            </div>
            
            {metrics && (
              <div className="text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-semibold">Connection URL:</span>
                  <span className="truncate">{metrics.wsUrl}</span>
                  
                  <span className="font-semibold">Connection Attempts:</span>
                  <span>{metrics.connectionAttempts}</span>
                  
                  <span className="font-semibold">Messages Received:</span>
                  <span>{metrics.totalMessagesReceived}</span>
                  
                  <span className="font-semibold">Last Message:</span>
                  <span>{metrics.lastMessageTime ? new Date(metrics.lastMessageTime).toLocaleTimeString() : 'None'}</span>
                  
                  <span className="font-semibold">Connected Since:</span>
                  <span>{metrics.connectedSince ? new Date(metrics.connectedSince).toLocaleTimeString() : 'Not connected'}</span>
                  
                  {metrics.lastError && (
                    <>
                      <span className="font-semibold text-red-500">Last Error:</span>
                      <span className="text-red-500 break-words" title={metrics.lastError}>
                        {metrics.lastError}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Received Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 overflow-y-auto border rounded p-2">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center mt-4">No messages received yet</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className="text-xs mb-2 border-b pb-1">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 