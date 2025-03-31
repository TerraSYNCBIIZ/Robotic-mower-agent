import { useState, useEffect, useCallback } from 'react';
import { useMowerData } from '@/contexts/MowerDataContext';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';

// Type definitions
interface UseMowerMonitoringProps {
  mowerId?: string;
  pollInterval?: number;
}

interface MowerMonitoringResult {
  mowerData: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  wsStatus: WebSocketStatus;
}

/**
 * Hook to monitor specific mower data
 * 
 * @param props Configuration object
 * @returns Mower monitoring data and utilities
 */
export function useMowerMonitoring({ 
  mowerId, 
  pollInterval = 5 * 60 * 1000 // 5 minutes default
}: UseMowerMonitoringProps = {}): MowerMonitoringResult {
  // Get data service from context
  const { dataService, isInitialized, isLoading: contextLoading } = useMowerData();
  
  // Local state
  const [mowerData, setMowerData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  
  // Function to fetch mower data
  const fetchMowerData = useCallback(async () => {
    if (!dataService || !isInitialized) return;
    
    try {
      if (mowerId) {
        // Fetch single mower
        setIsLoading(true);
        const data = await dataService.getMowerData(mowerId);
        setMowerData(data);
        setIsLoading(false);
      } else {
        // No specific mowerId provided - we'll just use the service without local state
        setMowerData(null);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching mower data:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }, [dataService, isInitialized, mowerId]);
  
  // Listen for WebSocket status changes
  useEffect(() => {
    if (!dataService) return;
    
    const handleWsStatusChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log(`🌐 WebSocket status changed to: ${detail.status}`);
      setWsStatus(detail.status);
    };
    
    // Add event listener
    window.addEventListener('websocket-status-change', handleWsStatusChange);
    
    // Clean up
    return () => {
      window.removeEventListener('websocket-status-change', handleWsStatusChange);
    };
  }, [dataService]);
  
  // Set up data monitoring
  useEffect(() => {
    if (!dataService || !isInitialized) return;

    // Initial fetch
    fetchMowerData();
    
    // Set up event listener for updates
    const handleMowerUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Only process events for this mower if mowerId is specified
      if (mowerId && detail.mowerId === mowerId) {
        console.log(`Received update for mower ${mowerId}`);
        fetchMowerData();
      }
    };
    
    // Start monitoring specific mower if provided
    if (mowerId) {
      console.log(`Starting monitoring for mower ${mowerId}`);
      dataService.startMonitoringMower(mowerId, pollInterval);
      
      // Add event listener for updates
      window.addEventListener('mower-data-updated', handleMowerUpdate);
    }
    
    // Clean up
    return () => {
      if (mowerId) {
        window.removeEventListener('mower-data-updated', handleMowerUpdate);
      }
    };
  }, [dataService, fetchMowerData, isInitialized, mowerId, pollInterval]);
  
  // Function to manually trigger a refresh
  const refetch = useCallback(async () => {
    await fetchMowerData();
  }, [fetchMowerData]);
  
  return {
    mowerData,
    isLoading: isLoading || contextLoading,
    error,
    refetch,
    wsStatus
  };
} 