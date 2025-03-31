import { useWebSocketStatus } from '@/hooks/useWebSocketStatus';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { cn } from '@/lib/utils';

interface WebSocketStatusIndicatorProps {
  className?: string;
}

export function WebSocketStatusIndicator({ className }: WebSocketStatusIndicatorProps) {
  const status = useWebSocketStatus();
  
  let statusColor = '';
  let statusText = '';
  
  switch (status) {
    case WebSocketStatus.CONNECTED:
      statusColor = 'bg-green-500';
      statusText = 'Connected';
      break;
    case WebSocketStatus.CONNECTING:
      statusColor = 'bg-yellow-500';
      statusText = 'Connecting';
      break;
    case WebSocketStatus.ERROR:
      statusColor = 'bg-red-500';
      statusText = 'Error';
      break;
    case WebSocketStatus.DISCONNECTED:
    default:
      statusColor = 'bg-gray-500';
      statusText = 'Disconnected';
      break;
  }
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-2 h-2 rounded-full', statusColor)} />
      <span className="text-xs font-medium">WebSocket: {statusText}</span>
    </div>
  );
} 