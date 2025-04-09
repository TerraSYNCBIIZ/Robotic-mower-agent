'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ConnectionStatus } from '@/contexts/WebSocketContext';

/**
 * MiniProxyWebSocketStatus
 * 
 * A compact component to display WebSocket proxy connection status
 * in the navigation bar or other constrained spaces.
 */
export default function MiniProxyWebSocketStatus() {
  const { status, connect, error } = useWebSocket();
  const [connecting, setConnecting] = useState(false);
  
  // Handle reconnect button click
  const handleReconnect = async () => {
    setConnecting(true);
    try {
      await connect();
    } catch (err) {
      console.error('Reconnection failed:', err);
    } finally {
      setConnecting(false);
    }
  };
  
  // Status mapping
  const statusConfig = {
    [ConnectionStatus.CONNECTED]: {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      label: 'Connected',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700'
    },
    [ConnectionStatus.CONNECTING]: {
      icon: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
      label: 'Connecting',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700'
    },
    [ConnectionStatus.DISCONNECTED]: {
      icon: <XCircle className="h-4 w-4 text-orange-500" />,
      label: 'Disconnected',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700'
    },
    [ConnectionStatus.ERROR]: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      label: 'Error',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700'
    }
  };
  
  const currentStatus = statusConfig[status];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 py-1 px-2 rounded-md text-xs ${currentStatus.bgColor} ${currentStatus.borderColor} border ${currentStatus.textColor}`}>
            {currentStatus.icon}
            <span className="font-medium">{currentStatus.label}</span>
            {status !== ConnectionStatus.CONNECTED && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 ml-1 hover:bg-transparent"
                onClick={handleReconnect} 
                disabled={status === ConnectionStatus.CONNECTING || connecting}
              >
                <RefreshCw 
                  className={`h-3 w-3 ${connecting ? 'animate-spin' : ''}`} 
                  aria-hidden="true" 
                />
                <span className="sr-only">Reconnect</span>
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-sm">
            <p className="font-semibold">WebSocket Status: {currentStatus.label}</p>
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
            <p className="text-xs mt-1">
              {status === ConnectionStatus.CONNECTED
                ? 'Real-time updates are active'
                : 'Click to reconnect for real-time updates'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 