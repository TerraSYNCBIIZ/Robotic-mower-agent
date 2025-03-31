import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WebSocketConnectionStatus } from '@/lib/husqvarna/websocket';

interface ConnectionStatusProps {
  websocketStatus: WebSocketConnectionStatus;
  sseConnected: boolean;
}

// Define the valid badge variants as per the component library
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export function ConnectionStatus({ websocketStatus, sseConnected }: ConnectionStatusProps) {
  // Determine WebSocket status
  const isWsConnected = websocketStatus === WebSocketConnectionStatus.CONNECTED;
  const wsStatusText = isWsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected';
  const wsColorVariant: BadgeVariant = isWsConnected ? 'secondary' : 'destructive';
  
  // Determine SSE status
  const sseStatusText = sseConnected ? 'Server Sync Connected' : 'Server Sync Disconnected';
  const sseColorVariant: BadgeVariant = sseConnected ? 'secondary' : 'destructive';
  
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={wsColorVariant} className={isWsConnected ? "bg-green-500 hover:bg-green-600" : ""}>
              WS
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{wsStatusText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={sseColorVariant} className={sseConnected ? "bg-green-500 hover:bg-green-600" : ""}>
              SYNC
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{sseStatusText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 