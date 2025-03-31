'use client';

import { useState, useEffect } from 'react';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMowerData } from '@/contexts/MowerDataContext';
import { getMowerDataService } from '@/lib/husqvarna/mower-data-service-provider';
import { Loader2 } from 'lucide-react';

export function WebSocketStatusPanel() {
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);
  const [isWebSocketDisabled, setIsWebSocketDisabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMetrics, setConnectionMetrics] = useState<any>(null);
  const { dataService } = useMowerData();
  
  useEffect(() => {
    // Check if WebSocket is disabled
    if (typeof window !== 'undefined') {
      const disabled = localStorage.getItem('websocket_failed') === 'true';
      setIsWebSocketDisabled(disabled);
      
      const lastAttemptTime = localStorage.getItem('websocket_last_attempt');
      if (lastAttemptTime) {
        const date = new Date(Number.parseInt(lastAttemptTime, 10));
        setLastAttempt(date.toLocaleString());
      }
    }
    
    // Listen for WebSocket status changes
    const handleWsStatusChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setWsStatus(detail.status);
      
      // If status is CONNECTING, update isConnecting state
      if (detail.status === WebSocketStatus.CONNECTING) {
        setIsConnecting(true);
      } else {
        setIsConnecting(false);
      }
    };
    
    // Add event listener
    window.addEventListener('websocket-status-change', handleWsStatusChange);
    
    // Check initial status if service exists
    const service = getMowerDataService();
    if (service?.webSocketManager) {
      setWsStatus(service.webSocketManager.getStatus());
      
      // Get initial metrics
      setConnectionMetrics(service.webSocketManager.getConnectionMetrics());
      
      // Set up interval to update metrics
      const metricsInterval = setInterval(() => {
        setConnectionMetrics(service.webSocketManager.getConnectionMetrics());
      }, 5000);
      
      // Clean up interval
      return () => {
        clearInterval(metricsInterval);
      };
    }
    
    // Clean up
    return () => {
      window.removeEventListener('websocket-status-change', handleWsStatusChange);
    };
  }, []);
  
  // Function to reset WebSocket disabled state
  const handleResetWebSocket = async () => {
    setIsConnecting(true);
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('websocket_failed');
        localStorage.removeItem('websocket_last_attempt');
        setIsWebSocketDisabled(false);
        setLastAttempt(null);
        
        // Try to reconnect WebSocket using the service
        const service = getMowerDataService();
        if (service?.webSocketManager) {
          const success = await service.webSocketManager.connect();
          if (!success) {
            console.log('WebSocket reconnection failed');
          }
        }
      }
    } catch (error) {
      console.error('Error reconnecting WebSocket:', error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Get status badge color
  const getStatusColor = (status: WebSocketStatus): string => {
    switch (status) {
      case WebSocketStatus.CONNECTED:
        return 'bg-green-500';
      case WebSocketStatus.CONNECTING:
        return 'bg-yellow-500';
      case WebSocketStatus.ERROR:
        return 'bg-red-500';
      case WebSocketStatus.DISCONNECTED:
      default:
        return 'bg-gray-500';
    }
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-md flex justify-between items-center">
          Real-Time Updates
          <Badge className={getStatusColor(wsStatus)}>
            {wsStatus}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {isWebSocketDisabled ? (
          <>
            <p className="mb-2">
              Real-time updates are currently disabled due to connection issues with the Husqvarna API.
              The app is using regular polling instead.
            </p>
            {lastAttempt && (
              <p className="mb-2 text-xs text-gray-500">
                Last connection attempt: {lastAttempt}
              </p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetWebSocket}
              className="w-full mt-2"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Try Real-Time Again'
              )}
            </Button>
          </>
        ) : wsStatus === WebSocketStatus.CONNECTED ? (
          <>
            <p className="mb-2">
              Real-time updates are active. You will receive immediate notifications when your mower status changes.
            </p>
            {connectionMetrics && connectionMetrics.lastMessageTime && (
              <p className="text-xs text-gray-500">
                Last message received: {new Date(connectionMetrics.lastMessageTime).toLocaleString()}
              </p>
            )}
          </>
        ) : wsStatus === WebSocketStatus.ERROR ? (
          <>
            <p className="mb-2">
              There was an error connecting to the real-time updates service.
              The app is using regular polling instead.
            </p>
            {connectionMetrics && connectionMetrics.lastError && (
              <p className="mb-2 text-xs text-red-500">
                Error: {connectionMetrics.lastError}
              </p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetWebSocket}
              className="w-full mt-2"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
          </>
        ) : wsStatus === WebSocketStatus.CONNECTING ? (
          <div className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <p>Connecting to real-time updates service...</p>
          </div>
        ) : (
          <>
            <p className="mb-2">
              Not connected to real-time updates. The app is using regular polling to fetch mower status.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleResetWebSocket}
              className="w-full mt-2"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect to Real-Time Updates'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
} 