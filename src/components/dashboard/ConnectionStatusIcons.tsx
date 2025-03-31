import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WebSocketStatus, HusqvarnaWebSocketManager } from '@/lib/husqvarna/websocket';
import { ServerIcon, WifiIcon } from 'lucide-react';
import { getMowerDataService } from '@/lib/husqvarna/mower-data-service-provider';

interface ConnectionStatusIconsProps {
  apiConnected: boolean;
  websocketStatus: WebSocketStatus;
}

function StatusDot({ color }: { color: string }) {
  return (
    <svg
      width="8"
      height="8"
      fill="currentColor"
      viewBox="0 0 8 8"
      xmlns="http://www.w3.org/2000/svg"
      className={color}
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="4" />
    </svg>
  );
}

export function ConnectionStatusIcons({ apiConnected, websocketStatus: propWebsocketStatus }: ConnectionStatusIconsProps) {
  // Use local state to ensure we have the most up-to-date status
  const [localWebsocketStatus, setLocalWebsocketStatus] = useState<WebSocketStatus>(propWebsocketStatus);
  
  useEffect(() => {
    // Get WebSocket status directly from the singleton instance
    const wsManager = HusqvarnaWebSocketManager.getInstance();
    const currentStatus = wsManager.getStatus();
    setLocalWebsocketStatus(currentStatus);
    
    // Setup event listener for status changes using global event system
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setLocalWebsocketStatus(detail.status);
    };
    
    // Add listener for proxy connection status
    const handleProxyStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.active) {
        setLocalWebsocketStatus(WebSocketStatus.CONNECTED);
      }
    };
    
    window.addEventListener('websocket-status-change', handleStatusChange);
    window.addEventListener('proxy-connection-active', handleProxyStatus);
    
    // Check proxy status immediately
    fetch('/api/proxy/websocket/status')
      .then(res => res.json())
      .then(data => {
        if (data.persistentConnection) {
          setLocalWebsocketStatus(WebSocketStatus.CONNECTED);
        }
      })
      .catch(err => console.error('Error checking proxy status:', err));
    
    return () => {
      window.removeEventListener('websocket-status-change', handleStatusChange);
      window.removeEventListener('proxy-connection-active', handleProxyStatus);
    };
  }, []);
  
  // Update local state when props change
  useEffect(() => {
    setLocalWebsocketStatus(propWebsocketStatus);
  }, [propWebsocketStatus]);
  
  const wsConnected = localWebsocketStatus === WebSocketStatus.CONNECTED;
  
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
              <ServerIcon className="h-3.5 w-3.5" />
              <span className="font-medium">API</span>
              <StatusDot color={apiConnected ? "text-emerald-500" : "text-red-500"} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{apiConnected ? "API Connected" : "API Disconnected"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
              <WifiIcon className="h-3.5 w-3.5" />
              <span className="font-medium">WS</span>
              <StatusDot 
                color={
                  wsConnected 
                    ? "text-emerald-500" 
                    : localWebsocketStatus === WebSocketStatus.CONNECTING 
                      ? "text-amber-500" 
                      : "text-red-500"
                }
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {wsConnected 
                ? "WebSocket Connected" 
                : localWebsocketStatus === WebSocketStatus.CONNECTING 
                  ? "WebSocket Connecting" 
                  : "WebSocket Disconnected"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 