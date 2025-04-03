/**
 * Standardized hook for accessing mower data throughout the application
 * This provides real-time Firebase-first access to mower data with proper caching
 */
import { useState, useEffect } from 'react';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService'; 
import { db } from '@/lib/firebase/config';
import { 
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  DocumentSnapshot
} from 'firebase/firestore';

// Cache of mower data to prevent duplicate fetches
const mowerDataCache: Record<string, {
  data: any,
  timestamp: number
}> = {};

// Create a singleton instance of the service 
const mowerDataService = new MowerDataService();

interface UseMowerDataOptions {
  /**
   * Whether to subscribe to real-time updates - defaults to true
   */
  realtime?: boolean;
  /**
   * Whether to show debug information - defaults to false
   */
  debug?: boolean;
}

interface UseMowerDataState {
  /**
   * The current mower data
   */
  data: any;
  /**
   * Whether data is currently loading
   */
  isLoading: boolean;
  /**
   * Any error that occurred
   */
  error: Error | null;
  /**
   * When the data was last updated
   */
  lastUpdated: Date | null;
  /**
   * How the data was loaded
   */
  source: 'cache' | 'firebase' | 'api' | 'websocket' | 'command' | null;
  /**
   * Additional debug information if debug option is enabled
   */
  debug?: {
    cacheAge?: number;
    apiCalls?: number;
    refreshCount?: number;
  }
}

/**
 * Hook for accessing mower data with real-time updates
 * This is the preferred way to access mower data in UI components
 * @param mowerId The ID of the mower to get data for
 * @param options Optional configuration options
 * @returns The mower data state
 */
export function useMowerData(mowerId: string, options: UseMowerDataOptions = {}) {
  const { realtime = true, debug = false } = options;
  
  const [state, setState] = useState<UseMowerDataState>({
    data: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
    source: null,
    debug: debug ? { 
      cacheAge: 0,
      apiCalls: 0,
      refreshCount: 0 
    } : undefined
  });
  
  const apiCallCount = {
    count: 0
  };
  
  // Function to refresh data
  const refreshData = async (force = false) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));
      
      if (debug) {
        apiCallCount.count++;
      }
      
      // Call the service to fetch fresh data
      await mowerDataService.refreshMowerData(mowerId);
      
      // Data will be updated via the snapshot listener
      if (!realtime) {
        // If not using real-time, fetch the data immediately
        const freshData = await mowerDataService.getMowerData(mowerId);
        
        setState(prev => ({
          ...prev,
          data: freshData,
          isLoading: false,
          lastUpdated: new Date(),
          source: 'api',
          debug: debug ? {
            ...prev.debug,
            apiCalls: apiCallCount.count,
            refreshCount: (prev.debug?.refreshCount || 0) + 1
          } : undefined
        }));
      }
    } catch (error) {
      console.error(`Error refreshing data for mower ${mowerId}:`, error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false
      }));
    }
  };
  
  // Setup effect to load initial data and subscribe to updates
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    const loadData = async () => {
      if (!mowerId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: new Error('No mower ID provided')
        }));
        return;
      }
      
      try {
        // Check cache first
        const now = Date.now();
        const cachedData = mowerDataCache[mowerId];
        
        if (cachedData && now - cachedData.timestamp < 30000) { // 30 seconds cache
          // Use cached data first for instant display
          setState(prev => ({
            ...prev,
            data: cachedData.data,
            isLoading: false,
            lastUpdated: new Date(cachedData.timestamp),
            source: 'cache',
            debug: debug ? {
              ...prev.debug,
              cacheAge: now - cachedData.timestamp
            } : undefined
          }));
        }
        
        // Set up real-time listener for Firebase updates
        if (realtime && db) {
          const mowerDocRef = doc(db, 'mowers', mowerId);
          
          unsubscribe = onSnapshot(mowerDocRef, (docSnapshot: DocumentSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              
              // Update cache
              mowerDataCache[mowerId] = {
                data,
                timestamp: Date.now()
              };
              
              // Update state
              setState(prev => ({
                ...prev,
                data,
                isLoading: false,
                lastUpdated: new Date(),
                source: 'firebase',
                debug: debug ? {
                  ...prev.debug,
                  cacheAge: 0 // Fresh data
                } : undefined
              }));
            } else {
              // No data in Firebase yet, fetch from API
              if (!cachedData) {
                // Only if we don't have cached data
                refreshData(true);
              }
            }
          });
        } else if (!cachedData) {
          // Not using real-time and no cache, do a one-time fetch
          const docRef = doc(db, 'mowers', mowerId);
          const docSnapshot = await getDoc(docRef);
          
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            
            // Update cache
            mowerDataCache[mowerId] = {
              data,
              timestamp: Date.now()
            };
            
            // Update state
            setState(prev => ({
              ...prev,
              data,
              isLoading: false,
              lastUpdated: new Date(),
              source: 'firebase',
              debug: debug ? {
                ...prev.debug,
                cacheAge: 0
              } : undefined
            }));
          } else {
            // No data, fetch from API
            refreshData(true);
          }
        }
      } catch (error) {
        console.error(`Error in useMowerData hook for mower ${mowerId}:`, error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
          isLoading: false
        }));
      }
    };
    
    loadData();
    
    // Set up global refresh events listener
    const handleRefreshRequest = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === mowerId || !customEvent.detail?.mowerId) {
        // Refresh if the event is for this mower or for all mowers
        refreshData(true);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mower-refresh-requested', handleRefreshRequest);
    }
    
    // Cleanup
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('mower-refresh-requested', handleRefreshRequest);
      }
    };
  }, [mowerId, realtime, debug]);
  
  // Listen for WebSocket updates to improve real-time feel
  useEffect(() => {
    if (!mowerId) return;
    
    const handleWebSocketUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === mowerId) {
        // Update immediately with WebSocket data
        setState(prev => {
          if (!prev.data) return prev;
          
          // Create a new data object with the updated field
          const updatedData = {
            ...prev.data,
            lastWebSocketUpdate: {
              type: customEvent.detail.data.type,
              timestamp: new Date().toISOString()
            }
          };
          
          // Update cache
          mowerDataCache[mowerId] = {
            data: updatedData,
            timestamp: Date.now()
          };
          
          return {
            ...prev,
            data: updatedData,
            lastUpdated: new Date(),
            source: 'websocket' as const
          };
        });
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mower-data-updated', handleWebSocketUpdate);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mower-data-updated', handleWebSocketUpdate);
      }
    };
  }, [mowerId]);
  
  // Also listen for command-sent events
  useEffect(() => {
    if (!mowerId) return;
    
    const handleCommandSent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === mowerId) {
        // Update immediately with anticipated state
        setState(prev => {
          if (!prev.data) return prev;
          
          // Create a new data object with the anticipated state
          const updatedData = {
            ...prev.data,
            mower: {
              ...prev.data.mower,
              state: customEvent.detail.anticipated.state,
              activity: customEvent.detail.anticipated.activity,
              mode: customEvent.detail.anticipated.mode
            },
            lastCommand: {
              command: customEvent.detail.command,
              timestamp: new Date().toISOString(),
              anticipated: customEvent.detail.anticipated
            }
          };
          
          // Update cache
          mowerDataCache[mowerId] = {
            data: updatedData,
            timestamp: Date.now()
          };
          
          return {
            ...prev,
            data: updatedData,
            lastUpdated: new Date(),
            source: 'command' as const
          };
        });
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mower-command-sent', handleCommandSent);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mower-command-sent', handleCommandSent);
      }
    };
  }, [mowerId]);
  
  return {
    ...state,
    refresh: refreshData,
    
    // Derived data getters
    getBatteryLevel: () => state.data?.consolidated?.batteryPercent || state.data?.battery?.batteryPercent || 0,
    getErrorCode: () => state.data?.consolidated?.errorCode || state.data?.mower?.errorCode || 0,
    getActivity: () => state.data?.consolidated?.activity || state.data?.mower?.activity || 'UNKNOWN',
    getState: () => state.data?.consolidated?.state || state.data?.mower?.state || 'UNKNOWN',
    getName: () => state.data?.consolidated?.name || state.data?.system?.name || 'Unknown Mower',
    getModel: () => state.data?.consolidated?.model || state.data?.system?.model || 'Unknown Model',
    getPosition: () => {
      const positions = state.data?.consolidated?.positions || state.data?.positions;
      return positions && positions.length > 0 ? positions[0] : null;
    },
    getWorkAreas: () => state.data?.workAreas || [],
    getCalendar: () => state.data?.calendar || { tasks: [] },
    
    // Zone completion data getters
    getAreaComplete: () => state.data?.areaComplete || state.data?.consolidated?.areaComplete || 'N/A',
    getWorkAreaProgress: () => state.data?.workAreaProgress || state.data?.consolidated?.workAreaProgress || [],
    supportsAreaCompletion: () => !!state.data?.areaComplete || !!state.data?.consolidated?.areaComplete,
    
    // Service integration
    service: mowerDataService
  };
}

/**
 * Hook for accessing a list of all mowers with real-time updates
 * @param options Optional configuration options
 * @returns A list of all mowers and refresh function
 */
export function useAllMowerData(options: UseMowerDataOptions = {}) {
  const { realtime = true, debug = false } = options;
  
  const [mowers, setMowers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Function to refresh all mowers
  const refreshAllMowers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the service to get mowers data
      await mowerDataService.startMonitoringAllMowers();
      
      // Data will be updated via the snapshot listener if realtime is true
      if (!realtime) {
        // Load all mowers from Firebase
        const mowersData = await mowerDataService.loadCachedMowerData();
        setMowers(mowersData || []);
        setLastUpdated(new Date());
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error refreshing all mowers:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      setIsLoading(false);
    }
  };
  
  // Setup effect to load initial data and subscribe to updates
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    const loadMowers = async () => {
      try {
        // First try to load from cache
        const cachedMowers = await mowerDataService.loadCachedMowerData();
        
        if (cachedMowers && cachedMowers.length > 0) {
          setMowers(cachedMowers);
          setLastUpdated(new Date());
          setIsLoading(false);
        }
        
        // Set up real-time listener if requested
        if (realtime && db) {
          const mowersQuery = query(
            collection(db, 'mowers'),
            orderBy('lastUpdated', 'desc')
          );
          
          unsubscribe = onSnapshot(mowersQuery, (snapshot) => {
            const updatedMowers = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            setMowers(updatedMowers);
            setLastUpdated(new Date());
            setIsLoading(false);
          });
        } else if (!cachedMowers || cachedMowers.length === 0) {
          // Not using real-time and no cache, refresh
          await refreshAllMowers();
        }
      } catch (error) {
        console.error('Error in useAllMowerData hook:', error);
        setError(error instanceof Error ? error : new Error(String(error)));
        setIsLoading(false);
      }
    };
    
    loadMowers();
    
    // Set up event listener for refresh-all events
    const handleRefreshAll = () => {
      refreshAllMowers();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('refresh-all-mowers', handleRefreshAll);
    }
    
    // Cleanup
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('refresh-all-mowers', handleRefreshAll);
      }
    };
  }, [realtime, debug]);
  
  return {
    mowers,
    isLoading,
    error,
    lastUpdated,
    refresh: refreshAllMowers,
    service: mowerDataService
  };
} 