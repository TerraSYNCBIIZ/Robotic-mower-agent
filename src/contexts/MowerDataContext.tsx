'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useFirebaseMowers, FirebaseMowerData } from '@/hooks/useFirebaseMowers';

// Basic mower data interface
export interface MowerData {
  id: string;
  name: string;
  batteryLevel: number;
  status: string;
  lastSeen?: Date;
  activity?: string;
  mode?: string;
  errorCode?: number;
  connected?: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  areaComplete?: string;
  nextStartTime?: string | null;
  model?: string;
}

// Context interface
interface MowerDataContextType {
  mowers: MowerData[];
  isLoading: boolean;
  error: string | null;
  refreshMowerData: () => Promise<void>;
  lastUpdateTime: Date | null;
  dataSource: 'firebase' | 'api' | 'sample';
}

// Default context value
const defaultContextValue: MowerDataContextType = {
  mowers: [],
  isLoading: false,
  error: null,
  refreshMowerData: async () => {},
  lastUpdateTime: null,
  dataSource: 'sample'
};

// Create context
const MowerDataContext = createContext<MowerDataContextType>(defaultContextValue);

// Provider component
export function MowerDataProvider({ children }: { children: ReactNode }) {
  // Use the Firebase hook to get real data
  const { 
    mowers: firebaseMowers, 
    isLoading: fbLoading, 
    error: fbError,
    lastUpdated: fbLastUpdated,
    fetchMowers 
  } = useFirebaseMowers();
  
  const [isLoading, setIsLoading] = useState<boolean>(fbLoading);
  const [error, setError] = useState<string | null>(fbError ? fbError.message : null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<'firebase' | 'api' | 'sample'>('firebase');

  // Map the Firebase mower data to our MowerData interface
  const mapFirebaseMowersToMowerData = (fbMowers: FirebaseMowerData[]): MowerData[] => {
    return fbMowers.map(fbMower => ({
      id: fbMower.id,
      name: fbMower.name,
      batteryLevel: fbMower.batteryLevel,
      status: fbMower.status,
      lastSeen: fbMower.lastUpdated,
      activity: fbMower.activity,
      mode: fbMower.mode,
      errorCode: fbMower.errorCode,
      connected: fbMower.connected,
      coordinates: fbMower.coordinates,
      areaComplete: fbMower.areaComplete,
      nextStartTime: fbMower.nextStart ? new Date(fbMower.nextStart).toLocaleString() : null,
      model: fbMower.model
    }));
  };

  // Refreshed mower data function now uses Firebase
  const refreshMowerData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await fetchMowers();
      setLastUpdateTime(new Date());
      setDataSource('firebase');
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch mower data from Firebase');
      setIsLoading(false);
    }
  };

  // Update our state when Firebase data changes
  useEffect(() => {
    setIsLoading(fbLoading);
    if (fbError) {
      setError(fbError.message);
    }
    if (fbLastUpdated) {
      setLastUpdateTime(fbLastUpdated);
    }
  }, [fbLoading, fbError, fbLastUpdated]);

  // Set up periodic check for stale data
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (lastUpdateTime) {
        const now = new Date();
        // If last update was more than 15 minutes ago, refresh
        if (now.getTime() - lastUpdateTime.getTime() > 15 * 60 * 1000) {
          refreshMowerData();
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(intervalId);
  }, [lastUpdateTime]);

  // Initialize data on component mount
  useEffect(() => {
    refreshMowerData();
  }, []);

  const mowers = mapFirebaseMowersToMowerData(firebaseMowers);

  const value = {
    mowers,
    isLoading,
    error,
    refreshMowerData,
    lastUpdateTime,
    dataSource
  };

  return (
    <MowerDataContext.Provider value={value}>
      {children}
    </MowerDataContext.Provider>
  );
}

// Hook for using the context
export function useMowerData() {
  const context = useContext(MowerDataContext);
  if (context === undefined) {
    throw new Error('useMowerData must be used within a MowerDataProvider');
  }
  return context;
}

export default MowerDataContext; 