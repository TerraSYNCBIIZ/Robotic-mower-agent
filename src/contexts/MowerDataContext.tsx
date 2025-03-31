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
        
        // Start monitoring all mowers
        const success = await dataService.startMonitoringAllMowers(pollInterval);
        
        if (mounted) {
          setIsInitialized(success);
          setError(success ? null : new Error('Failed to initialize mower monitoring'));
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