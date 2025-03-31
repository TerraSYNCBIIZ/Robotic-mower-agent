'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHusqvarnaWebSocket } from '@/hooks/useHusqvarnaWebSocket';

// Define the props with proper types for event data
interface WebSocketEvent {
  type: string;
  timestamp: Date;
  mowerId?: string;
  attributes?: Record<string, any>;
}

export default function WebSocketEventsPanel() {
  const { 
    status, 
    events, 
    connect, 
    disconnect,
    isConnected,
    metrics
  } = useHusqvarnaWebSocket();
  
  // Get the last 20 events to display
  const recentEvents = events.slice(0, 20);
  
  // Format timestamp to a readable time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Real-time Events
        </CardTitle>
        <Badge
          variant={
            status === WebSocketStatus.CONNECTED 
              ? "default" 
              : status === WebSocketStatus.CONNECTING 
                ? "secondary" 
                : "destructive"
          }
          className={`ml-auto ${status === WebSocketStatus.CONNECTED ? 'bg-green-500' : ''}`}
        >
          {status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Button 
              size="sm" 
              onClick={connect} 
              disabled={isConnected}
              variant="outline"
            >
              Connect
            </Button>
            <Button 
              size="sm" 
              onClick={disconnect} 
              disabled={!isConnected}
              variant="outline"
              className="ml-2"
            >
              Disconnect
            </Button>
            
            {metrics && (
              <div className="text-xs text-muted-foreground ml-auto">
                {metrics.totalMessagesReceived} events
              </div>
            )}
          </div>
          
          <ScrollArea className="h-[300px] rounded-md border">
            {recentEvents.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No events received yet. Connect to see live updates.
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {recentEvents.map((event, idx) => (
                  <div key={`event-${idx}`} className="text-xs border-b pb-2 last:border-0">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {event.type}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Mower: {event.mowerId?.slice(0, 8)}...
                      {event.attributes?.state && (
                        <span className="ml-2">
                          State: <Badge variant="outline" className="ml-1">{event.attributes.state}</Badge>
                        </span>
                      )}
                      {event.attributes?.activity && (
                        <span className="ml-2">
                          Activity: <Badge variant="outline" className="ml-1">{event.attributes.activity}</Badge>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
} 