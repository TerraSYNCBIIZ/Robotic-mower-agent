import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
// @ts-ignore - Firestore imports
import { 
  collection, 
  doc,
  getDoc, 
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  type DocumentData 
} from 'firebase/firestore';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';

const MOWERS_COLLECTION = 'mowers';

export interface FirebaseMowerData {
  id: string;
  name: string;
  model: string;
  batteryLevel: number;
  status: string;
  activity: string;
  mode: string;
  errorCode: number;
  lastUpdated: Date;
  connected: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  workAreas?: any[];
  calendar?: any;
  statistics?: any;
  messages?: any;
  nextStart?: number;
  areaComplete?: string;
  capabilities?: {
    workAreas?: boolean;
    [key: string]: any;
  };
  zones?: Array<{
    name: string;
    workAreaId?: number;
    color?: string;
    [key: string]: any;
  }>;
}

export function useFirebaseMowers() {
  const [mowers, setMowers] = useState<FirebaseMowerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Set up a MowerDataService instance for helper functions
  const mowerDataService = new MowerDataService();

  // Function to map raw Firebase data to the format we need
  const mapMowerData = (id: string, data: any): FirebaseMowerData => {
    // Use consolidated view if available (our optimized format)
    if (data.consolidated) {
      // Extract the first position if any exists
      const position = data.consolidated.positions && data.consolidated.positions.length > 0 
        ? data.consolidated.positions[0] 
        : null;

      // Map activity and state to UI status
      const { uiStatus } = mowerDataService.updateMowerUIStatus(id, {
        mower: {
          activity: data.consolidated.activity,
          state: data.consolidated.state,
          mode: data.consolidated.mode,
          errorCode: data.consolidated.errorCode || 0
        },
        battery: {
          batteryPercent: data.consolidated.batteryPercent
        },
        metadata: {
          connected: data.consolidated.isConnected
        }
      });

      // Process work areas into zones
      const zones = data.workAreas ? data.workAreas.map((area: any, index: number) => {
        // Generate color palette
        const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#84cc16', '#14b8a6'];
        return {
          name: area.attributes?.name || `Area ${area.attributes?.workAreaId || index}`,
          workAreaId: area.attributes?.workAreaId,
          color: area.attributes?.color || colors[index % colors.length]
        };
      }) : [];

      return {
        id,
        name: data.consolidated.name || 'Unknown',
        model: data.consolidated.model || 'Unknown',
        batteryLevel: data.consolidated.batteryPercent || 0,
        status: uiStatus,
        activity: data.consolidated.activity || 'UNKNOWN',
        mode: data.consolidated.mode || 'UNKNOWN',
        errorCode: data.consolidated.errorCode || 0,
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        connected: data.consolidated.isConnected !== false,
        coordinates: position ? {
          latitude: position.latitude,
          longitude: position.longitude
        } : undefined,
        workAreas: data.workAreas || [],
        calendar: data.calendar || null,
        statistics: data.statistics || null,
        messages: data.messages || null,
        nextStart: data.consolidated.nextStartTimestamp,
        zones,
        areaComplete: data.consolidated.areaComplete || 'N/A',
        capabilities: {
          workAreas: Boolean(data.workAreas && data.workAreas.length > 0)
        }
      };
    }

    // Fallback to using raw mower data if consolidated isn't available
    const mowerData = data.mowerData?.attributes;
    if (!mowerData) {
      return {
        id,
        name: 'Unknown Mower',
        model: 'Unknown',
        batteryLevel: 0,
        status: 'offline',
        activity: 'UNKNOWN',
        mode: 'UNKNOWN',
        errorCode: 0,
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        connected: false,
        zones: [],
        areaComplete: 'N/A',
        capabilities: {
          workAreas: false
        }
      };
    }

    // Extract the first position if any exists
    const position = mowerData.positions && mowerData.positions.length > 0 
      ? mowerData.positions[0] 
      : null;

    // Process work areas into zones
    const zones = data.workAreas ? data.workAreas.map((area: any, index: number) => {
      // Generate color palette
      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#84cc16', '#14b8a6'];
      return {
        name: area.attributes?.name || `Area ${area.attributes?.workAreaId || index}`,
        workAreaId: area.attributes?.workAreaId,
        color: area.attributes?.color || colors[index % colors.length]
      };
    }) : [];

    // Map activity and state to UI status
    const { uiStatus } = mowerDataService.updateMowerUIStatus(id, {
      mower: mowerData.mower,
      battery: mowerData.battery,
      metadata: mowerData.metadata
    });

    return {
      id,
      name: mowerData.system?.name || 'Unknown',
      model: mowerData.system?.model || 'Unknown',
      batteryLevel: mowerData.battery?.batteryPercent || 0,
      status: uiStatus,
      activity: mowerData.mower?.activity || 'UNKNOWN',
      mode: mowerData.mower?.mode || 'UNKNOWN',
      errorCode: mowerData.mower?.errorCode || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
      connected: mowerData.metadata?.connected !== false,
      coordinates: position ? {
        latitude: position.latitude,
        longitude: position.longitude
      } : undefined,
      workAreas: data.workAreas || [],
      calendar: mowerData.calendar || null,
      statistics: mowerData.statistics || null,
      messages: data.messages || null,
      nextStart: mowerData.planner?.nextStartTimestamp,
      zones,
      areaComplete: 'N/A',
      capabilities: {
        workAreas: Boolean(data.workAreas && data.workAreas.length > 0),
        ...mowerData.capabilities
      }
    };
  };

  // Fetch all mowers from Firebase
  const fetchMowers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all mower documents
      const mowersRef = collection(db, MOWERS_COLLECTION);
      const mowersSnapshot = await getDocs(mowersRef);

      const mowerDataPromises = mowersSnapshot.docs.map(async (mowerDoc: DocumentData) => {
        const id = mowerDoc.id;
        const data = mowerDoc.data();
        return mapMowerData(id, data);
      });

      // Wait for all promises to resolve
      const mowerData = await Promise.all(mowerDataPromises);
      setMowers(mowerData);
      setLastUpdated(new Date());
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching mowers from Firebase:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  };

  // Set up realtime listeners for mower updates
  useEffect(() => {
    setIsLoading(true);

    // First, do an initial fetch to get all mowers
    fetchMowers();

    // Set up listeners for each mower
    const unsubscribe = onSnapshot(
      collection(db, MOWERS_COLLECTION),
      (snapshot: any) => {
        const updatedMowers: FirebaseMowerData[] = [];
        
        snapshot.forEach((doc: DocumentData) => {
          const id = doc.id;
          const data = doc.data();
          updatedMowers.push(mapMowerData(id, data));
        });
        
        setMowers(updatedMowers);
        setLastUpdated(new Date());
        setIsLoading(false);
      },
      (err: any) => {
        console.error('Error in Firebase snapshot listener:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    );

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, []);

  return {
    mowers,
    setMowers,
    isLoading,
    error,
    lastUpdated,
    fetchMowers
  };
} 