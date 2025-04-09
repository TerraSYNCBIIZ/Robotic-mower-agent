'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, Cloud, Database } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Define status enum for backward compatibility
export enum WebSocketStatus {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

interface ConnectionStatusIconsProps {
  apiConnected: boolean;
  websocketStatus: WebSocketStatus;
  databaseConnected?: boolean;
}

/**
 * ConnectionStatusIcons
 * 
 * Shows API and WebSocket connection status with icons and tooltips
 */
export function ConnectionStatusIcons({
  apiConnected,
  websocketStatus,
  databaseConnected = true
}: ConnectionStatusIconsProps) {
  // Define styles for different states
  const getIconColorClasses = (isConnected: boolean) => {
    return isConnected
      ? 'text-green-500 bg-green-500/10 border-green-500/20'
      : 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  const getWebsocketClasses = (status: WebSocketStatus) => {
    switch (status) {
      case WebSocketStatus.CONNECTED:
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case WebSocketStatus.CONNECTING:
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case WebSocketStatus.ERROR:
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case WebSocketStatus.DISCONNECTED:
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getWebsocketTooltip = (status: WebSocketStatus) => {
    switch (status) {
      case WebSocketStatus.CONNECTED:
        return 'WebSocket connected - real-time updates active';
      case WebSocketStatus.CONNECTING:
        return 'WebSocket connecting...';
      case WebSocketStatus.ERROR:
        return 'WebSocket error - check server logs';
      case WebSocketStatus.DISCONNECTED:
      default:
        return 'WebSocket disconnected - no real-time updates';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`py-1 ${getIconColorClasses(apiConnected)}`}>
              <Cloud className="h-3.5 w-3.5 mr-1" />
              API
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {apiConnected
                ? 'API connected - can send commands to mowers'
                : 'API disconnected - unable to control mowers'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`py-1 ${getWebsocketClasses(websocketStatus)}`}>
              <Wifi className="h-3.5 w-3.5 mr-1" />
              {websocketStatus === WebSocketStatus.CONNECTING ? 'Connecting...' : 'WebSocket'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getWebsocketTooltip(websocketStatus)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`py-1 ${getIconColorClasses(databaseConnected)}`}>
              <Database className="h-3.5 w-3.5 mr-1" />
              Firebase
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {databaseConnected
                ? 'Firebase connected - data storage available'
                : 'Firebase disconnected - data storage unavailable'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 