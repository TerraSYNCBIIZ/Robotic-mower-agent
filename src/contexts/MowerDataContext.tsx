"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';

// Context type definition
interface MowerDataContextType {
  dataService: MowerDataService | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
}

// Default context value
const defaultContextValue: MowerDataContextType = {
  dataService: null,
  isInitialized: false,
  isLoading: true,
  error: null
};

// Create the context
const MowerDataContext = createContext<MowerDataContextType>(defaultContextValue);

// Custom hook to use the mower data context
export function useMowerData() {
  return useContext(MowerDataContext);
}

// Provider props
interface MowerDataProviderProps {
  children: ReactNode;
  pollInterval?: number; // In milliseconds, default will be 5 minutes
}

// Provider component
export function MowerDataProvider({ 
  children, 
  pollInterval = 5 * 60 * 1000 // 5 minutes default
}: MowerDataProviderProps) {
  const [dataService] = useState(() => new MowerDataService());
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize data collection on component mount
  useEffect(() => {
    let mounted = true;
    
    const initializeDataCollection = async () => {
      try {
        setIsLoading(true);
        
        console.log('Initializing mower data collection...');
        
        // Step 1: First try to load data from Firebase (fastest)
        const cachedData = await dataService.loadCachedMowerData();
        
        if (cachedData && cachedData.length > 0) {
          console.log('Found cached mower data in Firebase:', cachedData.length, 'mowers');
          // Display the cached data immediately
          dataService.dispatchCachedMowerData(cachedData);
          setIsLoading(false);
        }
        
        // Step 2: Connect to WebSockets for real-time updates
        const wsConnected = await dataService.connectWebSockets();
        console.log('WebSocket connection attempt result:', wsConnected ? 'Connected' : 'Failed');
        
        // Step 3: If WebSocket fails or we have no cached data, fall back to API polling
        if (!cachedData || cachedData.length === 0 || !wsConnected) {
          console.log('Starting regular polling as fallback...');
          // Start monitoring all mowers
          const success = await dataService.startMonitoringAllMowers(pollInterval);
          
          if (mounted) {
            setIsInitialized(success);
            setError(success ? null : new Error('Failed to initialize mower monitoring'));
            setIsLoading(false);
          }
        } else {
          setIsInitialized(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error initializing mower data collection:", err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };
    
    // Start initialization
    initializeDataCollection();
    
    // Clean up on unmount
    return () => {
      mounted = false;
      dataService.dispose();
    };
  }, [dataService, pollInterval]);
  
  // Create the context value
  const contextValue: MowerDataContextType = {
    dataService,
    isInitialized,
    isLoading,
    error
  };
  
  return (
    <MowerDataContext.Provider value={contextValue}>
      {children}
    </MowerDataContext.Provider>
  );
} 