'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';

interface MowerAreaCompletionProps {
  mowerId: string;
  initialValue?: string;
  className?: string;
}

// Create a singleton instance of the MowerDataService
const mowerDataService = new MowerDataService();

export function MowerAreaCompletion({
  mowerId,
  initialValue = 'N/A',
  className
}: MowerAreaCompletionProps) {
  const [areaComplete, setAreaComplete] = useState<string>(initialValue);
  
  // Effect to trigger one-time fetch when component mounts
  useEffect(() => {
    if (!mowerId) return;
    
    // Trigger getData once when component mounts
    const fetchMowerData = async () => {
      console.log(`MowerAreaCompletion: Fetching data for mower ${mowerId}`);
      try {
        const data = await mowerDataService.getMowerData(mowerId);
        
        // Check all possible paths for area completion data
        let completionValue: string | undefined;
        
        if (data?.areaComplete) {
          completionValue = data.areaComplete;
          console.log(`MowerAreaCompletion: Found direct areaComplete: ${completionValue}`);
        } else if (data?.workAreaProgress?.areaComplete) {
          completionValue = data.workAreaProgress.areaComplete;
          console.log(`MowerAreaCompletion: Found workAreaProgress.areaComplete: ${completionValue}`);
        } else if (data?.consolidated?.areaComplete) {
          completionValue = data.consolidated.areaComplete;
          console.log(`MowerAreaCompletion: Found consolidated.areaComplete: ${completionValue}`);
        }
        
        // Update state if we found a value
        if (completionValue) {
          setAreaComplete(completionValue);
        }
      } catch (error) {
        console.error(`MowerAreaCompletion: Error fetching data for mower ${mowerId}:`, error);
      }
    };
    
    fetchMowerData();
    
    // Start listening for updates
    mowerDataService.startListening(mowerId);
    
    return () => {
      // Stop listening when component unmounts
      mowerDataService.stopListening(mowerId);
    };
  }, [mowerId]);
  
  // Listen for area completion update events
  useEffect(() => {
    if (!mowerId) return;
    
    const handleAreaCompletionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === mowerId && customEvent.detail?.areaComplete) {
        console.log(`MowerAreaCompletion: Received update for mower ${mowerId}: ${customEvent.detail.areaComplete}`);
        setAreaComplete(customEvent.detail.areaComplete);
      }
    };
    
    const handleMowerDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === mowerId) {
        const data = customEvent.detail.data;
        
        // Check all possible paths
        if (data?.areaComplete) {
          console.log(`MowerAreaCompletion: Received direct area completion from data update for mower ${mowerId}: ${data.areaComplete}`);
          setAreaComplete(data.areaComplete);
        } else if (data?.workAreaProgress?.areaComplete) {
          console.log(`MowerAreaCompletion: Received workAreaProgress.areaComplete for mower ${mowerId}: ${data.workAreaProgress.areaComplete}`);
          setAreaComplete(data.workAreaProgress.areaComplete);
        } else if (data?.consolidated?.areaComplete) {
          console.log(`MowerAreaCompletion: Received area completion from consolidated data for mower ${mowerId}: ${data.consolidated.areaComplete}`);
          setAreaComplete(data.consolidated.areaComplete);
        }
      }
    };
    
    // Handle WebSocket messages
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Listen for special area completion update broadcasts
        if (data.type === 'area-completion-update' && data.mowerId === mowerId) {
          console.log(`MowerAreaCompletion: Received WebSocket area completion update for mower ${mowerId}: ${data.areaComplete}`);
          setAreaComplete(data.areaComplete);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };
    
    if (typeof window !== 'undefined') {
      // Listen for custom events
      window.addEventListener('mower-area-completion-updated', handleAreaCompletionUpdate);
      window.addEventListener('mower-data-updated', handleMowerDataUpdate);
      
      // Connect to WebSocket if available
      const webSocket = (window as any).husqvarnaWebSocket;
      if (webSocket) {
        webSocket.addEventListener('message', handleWebSocketMessage);
      }
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mower-area-completion-updated', handleAreaCompletionUpdate);
        window.removeEventListener('mower-data-updated', handleMowerDataUpdate);
        
        // Disconnect from WebSocket
        const webSocket = (window as any).husqvarnaWebSocket;
        if (webSocket) {
          webSocket.removeEventListener('message', handleWebSocketMessage);
        }
      }
    };
  }, [mowerId]);
  
  // Update local state when prop changes
  useEffect(() => {
    if (initialValue && initialValue !== 'N/A') {
      setAreaComplete(initialValue);
    }
  }, [initialValue]);
  
  // Parse percentage value, default to 0 if areaComplete is not provided or is N/A
  const percentage = (areaComplete && areaComplete !== 'N/A')
    ? Math.min(Math.max(parseInt(areaComplete.replace('%', '').trim()) || 0, 1), 100)
    : 0;
  
  const hasData = areaComplete && areaComplete !== 'N/A';
  
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Area Complete</span>
        <span className="text-muted-foreground">{hasData ? areaComplete : 'N/A'}</span>
      </div>
      
      {hasData ? (
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-emerald-500/20">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-600/20">
          <div className="h-full bg-gray-300 dark:bg-gray-500/20 rounded-full w-full text-[8px] flex items-center justify-center overflow-hidden">
            <span className="text-muted-foreground truncate px-1">Waiting for data...</span>
          </div>
        </div>
      )}
    </div>
  );
} 