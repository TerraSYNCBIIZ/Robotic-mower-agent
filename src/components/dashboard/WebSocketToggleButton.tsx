'use client';

import { useState, useEffect } from 'react';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { useMowerData } from '@/contexts/MowerDataContext';
import { getMowerDataService } from '@/lib/husqvarna/mower-data-service-provider';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, WifiOff } from 'lucide-react';
import { HusqvarnaWebSocketManager } from '@/lib/husqvarna/websocket';

export function WebSocketToggleButton() {
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [isWebSocketDisabled, setIsWebSocketDisabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { dataService } = useMowerData();
  
  useEffect(() => {
    // Get the singleton instance directly for status checks
    const wsManager = HusqvarnaWebSocketManager.getInstance();
    
    // Check if WebSocket is disabled
    if (typeof window !== 'undefined') {
      const disabled = localStorage.getItem('websocket_failed') === 'true';
      setIsWebSocketDisabled(disabled);
    }
    
    // Set initial status
    setWsStatus(wsManager.getStatus());
    
    // Listen for WebSocket status changes - using global events
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
    
    // Add listener for proxy connection status
    const handleProxyStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.active) {
        setWsStatus(WebSocketStatus.CONNECTED);
        setIsConnecting(false);
      }
    };
    
    // Add event listeners
    window.addEventListener('websocket-status-change', handleWsStatusChange);
    window.addEventListener('proxy-connection-active', handleProxyStatus);
    
    // Check proxy status immediately
    fetch('/api/proxy/websocket/status')
      .then(res => res.json())
      .then(data => {
        if (data.persistentConnection) {
          setWsStatus(WebSocketStatus.CONNECTED);
          setIsConnecting(false);
        }
      })
      .catch(err => console.error('Error checking proxy status:', err));
    
    // No need for polling since we're using the global event system
    // and singleton WebSocketManager
    
    // Clean up
    return () => {
      window.removeEventListener('websocket-status-change', handleWsStatusChange);
      window.removeEventListener('proxy-connection-active', handleProxyStatus);
    };
  }, []);
  
  // Function to toggle WebSocket connection
  const handleToggleWebSocket = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    
    try {
      // First check if proxy has persistent connection
      const response = await fetch('/api/proxy/websocket/status');
      const data = await response.json();
      
      if (data.persistentConnection) {
        console.log('Connecting to existing persistent connection');
        setWsStatus(WebSocketStatus.CONNECTED);
        setIsConnecting(false);
        return;
      }
      
      // Fall back to regular WebSocket connection if no persistent connection
      const wsManager = HusqvarnaWebSocketManager.getInstance();
      
      if (wsStatus === WebSocketStatus.CONNECTED) {
        // Disconnect WebSocket
        wsManager.disconnect();
        localStorage.setItem('websocket_failed', 'true');
        setIsWebSocketDisabled(true);
        setWsStatus(WebSocketStatus.DISCONNECTED);
      } else {
        // Try to connect WebSocket
        localStorage.removeItem('websocket_failed');
        localStorage.removeItem('websocket_last_attempt');
        setIsWebSocketDisabled(false);
        setWsStatus(WebSocketStatus.CONNECTING);
        
        const success = await wsManager.connect();
        if (!success) {
          console.log('WebSocket reconnection failed');
          setWsStatus(WebSocketStatus.ERROR);
        } else {
          setWsStatus(WebSocketStatus.CONNECTED);
        }
      }
    } catch (error) {
      console.error('Error toggling WebSocket:', error);
      setWsStatus(WebSocketStatus.ERROR);
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Get status badge classes
  const getStatusClasses = (): string => {
    switch (wsStatus) {
      case WebSocketStatus.CONNECTED:
        return 'bg-green-500 hover:bg-green-600';
      case WebSocketStatus.CONNECTING:
        return 'bg-yellow-500 hover:bg-yellow-600';
      case WebSocketStatus.ERROR:
        return 'bg-red-500 hover:bg-red-600';
      case WebSocketStatus.DISCONNECTED:
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };
  
  // Get tooltip text based on status
  const getTooltipText = (): string => {
    if (isConnecting) return 'Connecting to real-time updates...';
    
    switch (wsStatus) {
      case WebSocketStatus.CONNECTED:
        return 'Real-time updates enabled';
      case WebSocketStatus.CONNECTING:
        return 'Connecting to real-time updates...';
      case WebSocketStatus.ERROR:
        return 'Error connecting to real-time updates';
      case WebSocketStatus.DISCONNECTED:
      default:
        return 'Real-time updates disabled';
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={handleToggleWebSocket}
            className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 border bg-background hover:bg-accent hover:text-accent-foreground"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : wsStatus === WebSocketStatus.CONNECTED ? (
              <Badge className={`${getStatusClasses()} px-2 mr-1`}>WS</Badge>
            ) : (
              <WifiOff className="h-4 w-4 mr-1 text-muted-foreground" />
            )}
            <span>
              {wsStatus.charAt(0).toUpperCase() + wsStatus.slice(1)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 