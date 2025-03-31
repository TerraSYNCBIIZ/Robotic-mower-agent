import { useState, useEffect } from 'react';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';

/**
 * Hook to monitor WebSocket connection status
 * 
 * @returns Current WebSocket status
 */
export function useWebSocketStatus(): WebSocketStatus {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  
  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setStatus(detail.status);
    };
    
    // Add event listener
    window.addEventListener('websocket-status-change', handleStatusChange);
    
    // Clean up
    return () => {
      window.removeEventListener('websocket-status-change', handleStatusChange);
    };
  }, []);
  
  return status;
} 