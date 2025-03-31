import { useState, useEffect, useRef } from 'react';
import { HusqvarnaWebSocketManager, WebSocketStatus, ConnectionMetrics, MowerEvent } from '@/lib/husqvarna/websocket';

// Define the event with timestamp for display
export interface WebSocketEventWithTimestamp extends MowerEvent {
  timestamp: Date;
  mowerId?: string;
}

// Define the connection status event type from the proxy
interface ConnectionStatusEvent {
  type: 'connection_status';
  status: string;
  message?: string;
  error?: string;
}

export function useHusqvarnaWebSocket() {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [events, setEvents] = useState<WebSocketEventWithTimestamp[]>([]);
  const [metrics, setMetrics] = useState<ConnectionMetrics | null>(null);
  const webSocketRef = useRef<HusqvarnaWebSocketManager | null>(null);
  
  // Initialize WebSocket on component mount
  useEffect(() => {
    const webSocket = new HusqvarnaWebSocketManager();
    webSocketRef.current = webSocket;
    
    // Set up event listeners
    webSocket.on('message', (message: any) => {
      // Skip connection_status messages from the proxy
      if (message.type === 'connection_status') {
        console.log('WebSocket connection status:', message);
        return;
      }
      
      // Get mower ID if available
      let mowerId = '';
      if ('id' in message) {
        mowerId = message.id as string;
      }
      
      // Add message to events list with timestamp
      setEvents(prev => [{
        ...message,
        timestamp: new Date(),
        mowerId
      }, ...prev].slice(0, 100)); // Keep last 100 events
    });
    
    webSocket.on('status_change', (newStatus: WebSocketStatus) => {
      setStatus(newStatus);
    });
    
    // Start metrics update interval
    const interval = setInterval(() => {
      if (webSocket) {
        setMetrics(webSocket.getConnectionMetrics());
      }
    }, 1000);
    
    // Clean up when unmounting
    return () => {
      clearInterval(interval);
      webSocket.dispose();
    };
  }, []);
  
  // Connect to WebSocket
  const connect = async () => {
    if (webSocketRef.current) {
      try {
        const success = await webSocketRef.current.connect();
        return success;
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        return false;
      }
    }
    return false;
  };
  
  // Disconnect from WebSocket
  const disconnect = () => {
    if (webSocketRef.current) {
      webSocketRef.current.disconnect();
    }
  };
  
  return {
    status,
    events,
    metrics,
    connect,
    disconnect,
    isConnected: status === WebSocketStatus.CONNECTED
  };
} 