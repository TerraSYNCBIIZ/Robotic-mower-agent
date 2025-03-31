"use client";

import React, { useEffect, useState } from 'react';
import { useWebSocketStatus } from '@/hooks/useWebSocketStatus';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Updated ConnectionMetrics interface to match our new implementation
interface ConnectionMetrics {
  wsUrl: string;
  status: WebSocketStatus;
  lastMessageTime: Date | null;
  connectionAttempts: number;
  totalMessagesReceived: number;
  lastError: string | null;
  connectedSince: Date | null;
  disconnectedSince: Date | null;
}

// Define an interface for the window with the mowerDataService property
interface ExtendedWindow extends Window {
  mowerDataService?: {
    webSocketManager?: {
      getConnectionMetrics: () => ConnectionMetrics;
    };
  };
}

export function WebSocketStatusMonitor() {
  const status = useWebSocketStatus();
  const [metrics, setMetrics] = useState<ConnectionMetrics | null>(null);

  useEffect(() => {
    // Function to get WebSocket metrics from any global instances
    const getMetrics = () => {
      if (typeof window !== 'undefined') {
        // Try to access metrics from global MowerDataService instance if available
        const extendedWindow = window as ExtendedWindow;
        if (extendedWindow.mowerDataService?.webSocketManager?.getConnectionMetrics) {
          setMetrics(extendedWindow.mowerDataService.webSocketManager.getConnectionMetrics());
        }
      }
    };

    // Get metrics immediately
    getMetrics();

    // Then update metrics every 5 seconds
    const interval = setInterval(getMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: WebSocketStatus) => {
    switch (status) {
      case WebSocketStatus.CONNECTED:
        return 'bg-green-500';
      case WebSocketStatus.CONNECTING:
        return 'bg-yellow-500';
      case WebSocketStatus.ERROR:
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: Date | null) => {
    if (!timestamp) return 'N/A';
    return timestamp.toLocaleTimeString();
  };

  const formatDuration = (startTime: Date | null) => {
    if (!startTime) return 'N/A';
    
    const ms = Date.now() - startTime.getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          WebSocket Connection
          <Badge 
            className={`${getStatusColor(status)} text-white px-2 py-0.5 text-xs rounded-full`}
          >
            {status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm">
        {metrics ? (
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Messages:</span>
              <span>{metrics.totalMessagesReceived}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last Message:</span>
              <span>{formatTime(metrics.lastMessageTime)}</span>
            </div>
            {metrics.connectedSince && (
              <div className="flex justify-between">
                <span className="text-gray-500">Connected For:</span>
                <span>{formatDuration(metrics.connectedSince)}</span>
              </div>
            )}
            {metrics.lastError && (
              <div className="flex justify-between">
                <span className="text-gray-500">Error:</span>
                <span className="text-red-500 truncate" title={metrics.lastError}>
                  {metrics.lastError.length > 30 
                    ? metrics.lastError.substring(0, 30) + '...' 
                    : metrics.lastError}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-2">
            No metrics available
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
