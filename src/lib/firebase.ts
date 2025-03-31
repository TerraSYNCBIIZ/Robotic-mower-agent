// Firebase utilities for storing and retrieving zone data
import type { Zone } from '@/components/scheduler/MowerScheduler';
// @ts-ignore - Firestore imports
import { db } from './firebase/config';
// @ts-ignore - Firestore imports
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// Firestore collection name for zone data
const ZONES_COLLECTION = 'mowerZones';

// Save zone data for a specific mower using Firestore
export async function saveZoneData(mowerId: string, zones: Zone[]) {
  try {
    console.log('Saving zone data for mower ID to Firestore:', mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Reference to the mower's document in Firestore
    // @ts-ignore - Firestore typing
    const mowerDocRef = doc(db, ZONES_COLLECTION, mowerId);
    
    // Prepare data to save
    const dataToSave = {
      zones,
      updatedAt: serverTimestamp(),
    };
    
    // Save to Firestore
    // @ts-ignore - Firestore typing
    await setDoc(mowerDocRef, dataToSave, { merge: true });
    
    console.log('Zone data saved successfully to Firestore');
    return { success: true };
  } catch (error) {
    console.error('Error saving zone data to Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Get zone data for a specific mower from Firestore
export async function getZoneData(mowerId: string) {
  try {
    console.log('Getting zone data from Firestore for mower ID:', mowerId);
    
    if (!db) {
      console.error('Firestore not initialized');
      return { success: false, error: 'Firestore not initialized' };
    }
    
    // Reference to the mower's document in Firestore
    // @ts-ignore - Firestore typing
    const mowerDocRef = doc(db, ZONES_COLLECTION, mowerId);
    
    // Get the document
    // @ts-ignore - Firestore typing
    const docSnap = await getDoc(mowerDocRef);
    
    if (docSnap.exists()) {
      const mowerData = docSnap.data();
      console.log('Found zone data in Firestore:', mowerData);
      return { success: true, data: mowerData };
    }
    
    console.log('No zone data found in Firestore for this mower');
    return { success: false, error: 'No zone data found for this mower' };
  } catch (error) {
    console.error('Error getting zone data from Firestore:', error);
    return { 
      success: false, 
      error: String(error)
    };
  }
}

// Get Google Maps API key
export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

// Fallback to localStorage for offline or testing scenarios
// Only uncomment if you need a local fallback
/*
// LocalStorage keys
const MOWER_DATA_KEY = 'mower_zone_data';

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

// LocalStorage fallback implementations
export async function saveZoneDataLocal(mowerId: string, zones: Zone[]) {
  try {
    // Get existing data
    const existingDataString = safeLocalStorage.getItem(MOWER_DATA_KEY) || '{}';
    const existingData = JSON.parse(existingDataString);
    
    // Update data for this mower
    existingData[mowerId] = { zones };
    
    // Save back to localStorage
    safeLocalStorage.setItem(MOWER_DATA_KEY, JSON.stringify(existingData));
    
    return { success: true };
  } catch (error) {
    console.error('Error saving zone data to localStorage:', error);
    return { success: false, error };
  }
}

export async function getZoneDataLocal(mowerId: string) {
  try {
    // Get existing data
    const existingDataString = safeLocalStorage.getItem(MOWER_DATA_KEY) || '{}';
    const existingData = JSON.parse(existingDataString);
    
    // Get data for this mower
    const mowerData = existingData[mowerId];
    
    if (mowerData) {
      return { success: true, data: mowerData };
    }
    
    return { success: false, error: 'No zone data found for this mower' };
  } catch (error) {
    console.error('Error getting zone data from localStorage:', error);
    return { success: false, error };
  }
}
*/ 