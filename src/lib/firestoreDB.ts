// Firebase utilities for storing and retrieving zone data with Firestore
import type { Zone } from '@/components/scheduler/MowerScheduler';
import { db } from './firebase/config';

// Define a minimal type for the Firestore module functions we need
interface FirestoreModule {
  doc: (db: any, collection: string, id: string) => any;
  getDoc: (docRef: any) => Promise<any>;
  setDoc: (docRef: any, data: any, options?: any) => Promise<void>;
  serverTimestamp: () => any;
  collection: (db: any, path: string) => any;
  query: (collectionRef: any, ...queryConstraints: any[]) => any;
  where: (field: string, opStr: string, value: any) => any;
  getDocs: (query: any) => Promise<any>;
  addDoc: (collectionRef: any, data: any) => Promise<any>;
}

// Import Firebase dynamically to avoid TypeScript errors
let firestoreModule: any;

// Function to ensure Firestore module is loaded
async function ensureFirestoreModule(): Promise<FirestoreModule> {
  if (!firestoreModule) {
    try {
      firestoreModule = await import('firebase/firestore');
    } catch (error) {
      console.error('Error importing Firestore module:', error);
      throw new Error('Failed to load Firestore module');
    }
  }
  return firestoreModule as FirestoreModule;
}

// Firestore collection name for zone data
const ZONES_COLLECTION = 'mowerZones';
// Firestore collection for mower data
const MOWERS_COLLECTION = 'mowers';
// Firestore collection for mower events/history
const MOWER_EVENTS_COLLECTION = 'mowerEvents';
// LocalStorage key for zone data (for fallback)
const LOCAL_STORAGE_KEY = 'robotic_mower_zone_data';

// Helper to safely access localStorage (avoiding SSR issues)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  }
};

// Save zone data for a specific mower using Firestore
export async function saveZoneData(mowerId: string, zones: Zone[]) {
  try {
    console.log('Saving zone data for mower ID to Firestore:', mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      // Fall back to localStorage if Firestore isn't available
      return saveToLocalStorage(mowerId, zones);
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mower's document in Firestore
    const mowerDocRef = firestore.doc(db, ZONES_COLLECTION, mowerId);
    
    // Prepare data to save
    const dataToSave = {
      zones,
      updatedAt: firestore.serverTimestamp(),
    };
    
    // Save to Firestore
    await firestore.setDoc(mowerDocRef, dataToSave, { merge: true });
    
    console.log('Zone data saved successfully to Firestore');
    return { success: true };
  } catch (error) {
    console.error('Error saving zone data to Firestore:', error);
    // Fall back to localStorage on error
    return saveToLocalStorage(mowerId, zones);
  }
}

// Get zone data for a specific mower from Firestore
export async function getZoneData(mowerId: string) {
  try {
    console.log('Getting zone data from Firestore for mower ID:', mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      // Fall back to localStorage if Firestore isn't available
      return getFromLocalStorage(mowerId);
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mower's document in Firestore
    const mowerDocRef = firestore.doc(db, ZONES_COLLECTION, mowerId);
    
    // Get the document
    const docSnap = await firestore.getDoc(mowerDocRef);
    
    if (docSnap.exists()) {
      const mowerData = docSnap.data();
      console.log('Found zone data in Firestore:', mowerData);
      return { success: true, data: mowerData };
    }
    
    console.log('No zone data found in Firestore for this mower');
    // Try localStorage as fallback
    return getFromLocalStorage(mowerId);
  } catch (error) {
    console.error('Error getting zone data from Firestore:', error);
    // Fall back to localStorage on error
    return getFromLocalStorage(mowerId);
  }
}

// LocalStorage fallback implementation for saving
function saveToLocalStorage(mowerId: string, zones: Zone[]) {
  try {
    console.log('Falling back to localStorage for saving zone data:', mowerId);
    
    // Get existing data or initialize empty object
    const existingDataString = safeLocalStorage.getItem(LOCAL_STORAGE_KEY) || '{}';
    const existingData = JSON.parse(existingDataString);
    
    // Update data for this mower
    existingData[mowerId] = { 
      zones,
      updatedAt: new Date().toISOString()
    };
    
    // Save back to localStorage
    const saved = safeLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingData));
    
    if (saved) {
      console.log('Successfully saved zone data to localStorage');
      return { success: true };
    }
    
    console.error('Failed to save to localStorage');
    return { success: false, error: 'Failed to save to localStorage' };
  } catch (error) {
    console.error('Error saving zone data to localStorage:', error);
    return { success: false, error: String(error) };
  }
}

// LocalStorage fallback implementation for getting data
function getFromLocalStorage(mowerId: string) {
  try {
    console.log('Falling back to localStorage for getting zone data:', mowerId);
    
    // Get existing data or initialize empty object
    const existingDataString = safeLocalStorage.getItem(LOCAL_STORAGE_KEY) || '{}';
    const existingData = JSON.parse(existingDataString);
    
    // Get data for this mower
    const mowerData = existingData[mowerId];
    
    if (mowerData) {
      console.log('Found zone data in localStorage:', mowerData);
      return { success: true, data: mowerData };
    }
    
    console.log('No zone data found in localStorage for this mower');
    return { success: false, error: 'No zone data found for this mower' };
  } catch (error) {
    console.error('Error getting zone data from localStorage:', error);
    return { success: false, error: String(error) };
  }
}

// Get Google Maps API key
export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

// Interface for mower data
export interface MowerData {
  id: string;
  name: string;
  model: string;
  status: 'mowing' | 'charging' | 'idle' | 'error' | 'offline' | 'returning' | 'parked';
  batteryLevel: number;
  areaComplete?: string;
  lastSeen?: string;
  connected?: boolean;
  errorCode?: number;
  errorTimestamp?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  zones?: any[];
  lastUpdated: any; // Firestore timestamp
}

// Interface for mower event history
export interface MowerEvent {
  id?: string;
  mowerId: string;
  eventType: 'status_change' | 'command' | 'error' | 'battery' | 'location' | 'maintenance' | 'other';
  timestamp: any; // Firestore timestamp
  details: {
    [key: string]: any;
  };
  source: 'api' | 'user' | 'mower' | 'system';
}

// Save complete mower data to Firestore
export async function saveMowerData(mowerData: MowerData) {
  try {
    console.log('Saving mower data to Firestore for ID:', mowerData.id);
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mower's document in Firestore
    const mowerDocRef = firestore.doc(db, MOWERS_COLLECTION, mowerData.id);
    
    // Prepare data to save with a timestamp
    const dataToSave = {
      ...mowerData,
      lastUpdated: firestore.serverTimestamp()
    };
    
    // Save to Firestore
    await firestore.setDoc(mowerDocRef, dataToSave, { merge: true });
    
    console.log('Mower data saved successfully to Firestore');
    return { success: true };
  } catch (error) {
    console.error('Error saving mower data to Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Get mower data from Firestore
export async function getMowerData(mowerId: string) {
  try {
    console.log('Getting mower data from Firestore for ID:', mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mower's document in Firestore
    const mowerDocRef = firestore.doc(db, MOWERS_COLLECTION, mowerId);
    
    // Get the document
    const docSnap = await firestore.getDoc(mowerDocRef);
    
    if (docSnap.exists()) {
      const mowerData = docSnap.data();
      console.log('Found mower data in Firestore:', mowerData);
      return { success: true, data: mowerData };
    }
    
    console.log('No mower data found in Firestore for this ID');
    return { success: false, error: 'No mower data found for this ID' };
  } catch (error) {
    console.error('Error getting mower data from Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Get all mowers from Firestore
export async function getAllMowers() {
  try {
    console.log('Getting all mowers from Firestore');
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mowers collection
    const mowersCollection = firestore.collection(db, MOWERS_COLLECTION);
    
    // Get all documents
    const querySnapshot = await firestore.getDocs(mowersCollection);
    
    // Extract data
    const mowers: MowerData[] = [];
    querySnapshot.forEach((doc: any) => {
      mowers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${mowers.length} mowers in Firestore`);
    return { success: true, data: mowers };
  } catch (error) {
    console.error('Error getting all mowers from Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Add a mower event to history
export async function addMowerEvent(event: MowerEvent) {
  try {
    console.log('Adding mower event to Firestore for mower ID:', event.mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mower events collection
    const eventsCollection = firestore.collection(db, MOWER_EVENTS_COLLECTION);
    
    // Prepare event data with timestamp
    const eventData = {
      ...event,
      timestamp: event.timestamp || firestore.serverTimestamp()
    };
    
    // Add event to Firestore
    const docRef = await firestore.addDoc(eventsCollection, eventData);
    
    console.log('Mower event added successfully to Firestore with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding mower event to Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Get mower events for a specific mower
export async function getMowerEvents(mowerId: string, limit = 50) {
  try {
    console.log('Getting events for mower ID from Firestore:', mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Ensure Firestore module is loaded
    const firestore = await ensureFirestoreModule();
    
    // Reference to the mower events collection
    const eventsCollection = firestore.collection(db, MOWER_EVENTS_COLLECTION);
    
    // Create query for this mower's events
    const q = firestore.query(
      eventsCollection,
      firestore.where('mowerId', '==', mowerId)
      // Add more query constraints as needed (limit, order, etc.)
    );
    
    // Get the documents
    const querySnapshot = await firestore.getDocs(q);
    
    // Extract data
    const events: MowerEvent[] = [];
    querySnapshot.forEach((doc: any) => {
      events.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${events.length} events for mower ID:`, mowerId);
    return { success: true, data: events };
  } catch (error) {
    console.error('Error getting mower events from Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
} 