'use client';

import React, { useEffect, useState } from 'react';
import proxyWebSocketService from '../services/proxyWebSocketService';
import { Button } from './ui/button';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertCircle,
  Info
} from 'lucide-react';

/**
 * ProxyWebSocketStatus
 * 
 * A component to display the current status of the WebSocket proxy connection
 * and provide controls for reconnection.
 */
export default function ProxyWebSocketStatus() {
  const [status, setStatus] = useState<{ connected: boolean; timestamp: Date | null }>({
    connected: false,
    timestamp: null
  });
  
  const [stats, setStats] = useState<{
    messagesReceived: number;
    messagesByType: Record<string, number>;
    dataSentToFirebase: number;
    lastMessageTime: Date;
    errors: number;
  }>({
    messagesReceived: 0,
    messagesByType: {},
    dataSentToFirebase: 0,
    lastMessageTime: new Date(),
    errors: 0
  });
  
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  useEffect(() => {
    // Set up status change listener
    const onStatusChange = (statusData: { connected: boolean; timestamp: Date }) => {
      setStatus({
        connected: statusData.connected,
        timestamp: statusData.timestamp
      });
    };
    
    // Set up message listener to update stats
    const onMessage = () => {
      setStats(proxyWebSocketService.getStats());
    };
    
    // Register event listeners
    proxyWebSocketService.events.on('status-change', onStatusChange);
    proxyWebSocketService.events.on('message', onMessage);
    proxyWebSocketService.events.on('sent-to-data', onMessage);
    proxyWebSocketService.events.on('error', onMessage);
    
    // Get initial status and stats
    setStatus({
      connected: proxyWebSocketService.isConnected(),
      timestamp: new Date()
    });
    setStats(proxyWebSocketService.getStats());
    
    // Update stats periodically
    const interval = setInterval(() => {
      setStats(proxyWebSocketService.getStats());
    }, 5000);
    
    // Clean up on unmount
    return () => {
      proxyWebSocketService.events.off('status-change', onStatusChange);
      proxyWebSocketService.events.off('message', onMessage);
      proxyWebSocketService.events.off('sent-to-data', onMessage);
      proxyWebSocketService.events.off('error', onMessage);
      clearInterval(interval);
    };
  }, []);
  
  // Handle reconnect button click
  const handleReconnect = async () => {
    setIsReconnecting(true);
    
    try {
      // First try to reconnect to the proxy
      await proxyWebSocketService.connect();
      
      // Then request the proxy to reconnect to Husqvarna
      proxyWebSocketService.requestReconnect();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    } finally {
      setIsReconnecting(false);
    }
  };
  
  // Format timestamp as a readable string
  const formatTimestamp = (timestamp: Date | null) => {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    }).format(timestamp);
  };
  
  // Calculate time since last message
  const getTimeSinceLastMessage = () => {
    const now = new Date();
    const lastMessage = stats.lastMessageTime;
    const diff = now.getTime() - lastMessage.getTime();
    
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)} seconds ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    return `${Math.floor(diff / 3600000)} hours ago`;
  };
  
  return (
    <div className="p-4 border rounded-lg bg-background shadow-sm">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <Info className="mr-2" size={20} />
        WebSocket Proxy Status
      </h2>
      
      {/* Connection Status */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <h3 className="text-md font-semibold mr-2">Connection Status:</h3>
          <div className="flex items-center">
            {status.connected ? (
              <>
                <CheckCircle className="text-green-500 mr-1" size={18} />
                <span className="font-medium text-green-500">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="text-red-500 mr-1" size={18} />
                <span className="font-medium text-red-500">Disconnected</span>
              </>
            )}
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>Last status change: {formatTimestamp(status.timestamp)}</p>
          <p>Last message received: {getTimeSinceLastMessage()}</p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          className="mt-2"
          onClick={handleReconnect}
          disabled={isReconnecting}
        >
          {isReconnecting ? (
            <>
              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
              Reconnecting...
            </>
          ) : (
            <>
              <RefreshCw className="mr-1 h-4 w-4" />
              Reconnect
            </>
          )}
        </Button>
      </div>
      
      {/* Statistics */}
      <div className="mb-4">
        <h3 className="text-md font-semibold mb-2">Statistics:</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>Messages Received:</div>
          <div>{stats.messagesReceived}</div>
          
          <div>Data Updates:</div>
          <div>{stats.dataSentToFirebase}</div>
          
          <div>Errors:</div>
          <div>{stats.errors}</div>
        </div>
      </div>
      
      {/* Message Types */}
      {Object.keys(stats.messagesByType).length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-2">Message Types:</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(stats.messagesByType).map(([type, count]) => (
              <React.Fragment key={type}>
                <div className="col-span-1">{type}:</div>
                <div className="col-span-1">{count}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      
      {/* Warning for Disconnected State */}
      {!status.connected && (
        <div className="mt-4 flex items-start p-2 bg-amber-50 border border-amber-200 rounded text-amber-700">
          <AlertCircle className="mr-2 flex-shrink-0 h-5 w-5" />
          <div className="text-sm">
            <p className="font-medium">Connection unavailable</p>
            <p>The WebSocket proxy is not connected. Real-time updates and mower control may be unavailable.</p>
          </div>
        </div>
      )}
    </div>
  );
} 