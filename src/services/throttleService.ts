import * as admin from 'firebase-admin';
import { getErrorDescription } from '../lib/errorCodes';

// Initialize Firebase if needed
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Throttling configuration (milliseconds)
const THROTTLE_CONFIG = {
  status: 5000,      // 5 seconds
  positions: 10000,  // 10 seconds
  statistics: 60000, // 1 minute
  settings: 60000,   // 1 minute
  calendar: 300000,  // 5 minutes
  default: 30000     // 30 seconds
};

// Last update timestamps by mower and category
const lastUpdates: Record<string, Record<string, number>> = {};

/**
 * Checks if an update should be processed based on throttling
 * 
 * @param category Data category
 * @param mowerId Mower ID
 * @returns Whether the update should be processed
 */
export function shouldUpdate(category: string, mowerId: string): boolean {
  const now = Date.now();
  
  // Initialize if not exists
  if (!lastUpdates[mowerId]) {
    lastUpdates[mowerId] = {};
  }
  
  const lastUpdate = lastUpdates[mowerId][category] || 0;
  const throttleTime = THROTTLE_CONFIG[category as keyof typeof THROTTLE_CONFIG] || THROTTLE_CONFIG.default;
  
  return (now - lastUpdate) >= throttleTime;
}

/**
 * Updates timestamp after successful update
 * 
 * @param category Data category
 * @param mowerId Mower ID
 */
export function updateTimestamp(category: string, mowerId: string): void {
  if (!lastUpdates[mowerId]) {
    lastUpdates[mowerId] = {};
  }
  
  lastUpdates[mowerId][category] = Date.now();
}

/**
 * Processes data with throttling and saves to Firebase
 * 
 * @param data Data to process
 * @param category Data category
 * @param mowerId Mower ID
 * @returns Whether the data was processed
 */
export async function throttleUpdates(
  data: any,
  category: string,
  mowerId: string
): Promise<boolean> {
  if (!shouldUpdate(category, mowerId)) {
    return false; // Throttled
  }
  
  try {
    await saveToFirebase(data, category, mowerId);
    updateTimestamp(category, mowerId);
    return true;
  } catch (error) {
    console.error(`Error saving ${category} data for mower ${mowerId}:`, error);
    return false;
  }
}

/**
 * Saves data to Firebase
 * 
 * @param data Data to save
 * @param category Data category
 * @param mowerId Mower ID
 */
async function saveToFirebase(data: any, category: string, mowerId: string): Promise<void> {
  const db = admin.firestore();
  const mowerRef = db.collection('mowers').doc(mowerId);
  
  // Get existing mower document
  const mowerDoc = await mowerRef.get();
  
  // Create mower document if it doesn't exist
  if (!mowerDoc.exists) {
    await mowerRef.set({
      id: mowerId,
      created: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Prepare update object that matches the API sync structure
  const updateData: Record<string, any> = {};
  
  switch (category) {
    case 'status':
      // Get error description if available
      let errorDescription = '';
      const errorCode = data.mower?.errorCode;
      if (errorCode !== undefined && errorCode !== null) {
        errorDescription = getErrorDescription(errorCode) || `Unknown error (${errorCode})`;
      }
      
      updateData['status'] = {
        battery: data.battery?.batteryPercent,
        mode: data.mower?.mode,
        activity: data.mower?.activity,
        state: data.mower?.state,
        errorCode: data.mower?.errorCode,
        errorDescription: errorDescription,
        errorTimestamp: data.mower?.errorCodeTimestamp,
        isErrorConfirmable: data.mower?.isErrorConfirmable,
        connected: data.metadata?.connected,
        lastStatusUpdate: data.metadata?.statusTimestamp,
        workAreaId: data.mower?.workAreaId
      };
      break;
      
    case 'positions':
      // Get existing positions array
      let positions = [];
      if (mowerDoc.exists) {
        const existingPositions = mowerDoc.data()?.positions || [];
        positions = existingPositions;
      }
      
      // Create new position object
      const newPosition = {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: Date.now()
      };
      
      // Add to beginning of array and limit to 100 entries
      updateData['positions'] = [newPosition, ...positions].slice(0, 100);
      break;
      
    case 'statistics':
      updateData['statistics'] = data;
      break;
      
    case 'settings':
      updateData['settings'] = data;
      break;
      
    case 'calendar':
      updateData['calendar'] = data;
      break;
      
    default:
      updateData[category] = data;
  }
  
  // Add timestamp in the format used by API sync
  updateData['lastUpdated'] = admin.firestore.FieldValue.serverTimestamp();
  
  // Update Firestore with merge to preserve other fields
  await mowerRef.set(updateData, { merge: true });
  console.log(`Updated ${category} for mower ${mowerId}`);
} 