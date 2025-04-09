'use client';

import { useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ConnectionStatus } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff } from 'lucide-react';

/**
 * WebSocketToggleButton
 * 
 * A button component to toggle WebSocket connection on/off
 */
export function WebSocketToggleButton() {
  const { status, connect, disconnect } = useWebSocket();
  const [loading, setLoading] = useState(false);
  
  const isConnected = status === ConnectionStatus.CONNECTED;
  const isConnecting = status === ConnectionStatus.CONNECTING;
  
  const handleToggle = async () => {
    setLoading(true);
    
    try {
      if (isConnected) {
        disconnect();
      } else {
        await connect();
      }
    } catch (error) {
      console.error('Error toggling WebSocket connection:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isConnecting || loading}
      title={isConnected ? 'Disconnect WebSocket' : 'Connect WebSocket'}
      className="gap-1 text-muted-foreground hover:text-foreground"
    >
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="hidden md:inline-block">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className={`h-4 w-4 ${isConnecting || loading ? 'animate-pulse' : ''}`} />
          <span className="hidden md:inline-block">
            {isConnecting || loading ? 'Connecting...' : 'Disconnected'}
          </span>
        </>
      )}
    </Button>
  );
} 