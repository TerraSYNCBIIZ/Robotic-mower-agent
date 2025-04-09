import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { HusqvarnaApi } from '../api/husqvarnaApi';
import { CompleteMowerData, MowerCommandType } from '../api/types';
import { getApiInstance } from '../api/createHusqvarnaApi';

// Make sure Firebase is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Helper to create error code mapping
function getErrorCodeMap(): Record<number, string> {
  return {
    0: 'No error',
    1: 'Unexpected error',
    2: 'Outside working area',
    3: 'No loop signal',
    4: 'Wrong loop signal',
    5: 'Charging station blocked',
    6: 'Trapped',
    7: 'Upside down',
    8: 'Empty battery',
    9: 'Wrong PIN code',
    10: 'Mower switched off',
    11: 'Outside geofence',
    12: 'Mower theft protection locked',
    13: 'Mower tilted',
    14: 'Charging station power issue',
    15: 'Mower lifted',
    16: 'Stuck in charging station',
    17: 'Charging station problem',
    18: 'Collision sensor problem',
    19: 'Battery problem',
    20: 'Wheel motor blocked right',
    21: 'Wheel motor blocked left',
    22: 'Wheel drive problem right',
    23: 'Wheel drive problem left',
    24: 'Cutting system blocked',
    25: 'Cutting system blockage',
    26: 'Invalid combination',
    27: 'Settings restored',
    28: 'Memory circuit problem',
    29: 'Slope too steep',
    30: 'Charging system problem',
    31: 'Stop button problem',
    32: 'Tilt sensor problem',
    33: 'Mower tilted',
    34: 'Cutting stopped - slope too steep',
    35: 'Wheel motor overloaded right',
    36: 'Wheel motor overloaded left',
    37: 'Charging current too high',
    38: 'Electronic problem',
    39: 'Cutting motor problem',
    40: 'Limited cutting height range',
    41: 'Unexpected cutting height adj',
    42: 'Limited cutting height range',
    43: 'Cutting height problem',
    44: 'Cutting height problem',
    45: 'Cutting height problem',
    46: 'Cutting height problem',
    47: 'Cutting height problem',
    48: 'No response from charger',
    49: 'Ultrasonic problem',
    50: 'Guide 1 not found',
    51: 'Guide 2 not found',
    52: 'Guide 3 not found',
    53: 'GPS navigation problem',
    54: 'Weak GPS signal',
    55: 'Difficult finding home',
    56: 'Guide calibration accomplished',
    57: 'Guide calibration failed',
    58: 'Temporary battery problem',
    59: 'Temporary battery problem',
    60: 'Temporary battery problem',
    61: 'Temporary battery problem',
    62: 'Temporary battery problem',
    63: 'Temporary battery problem',
    64: 'Temporary battery problem',
    65: 'Temporary battery problem',
    66: 'Battery problem',
    67: 'Battery problem',
    68: 'Temporary battery problem',
    69: 'Alarm! Mower switched off',
    70: 'Alarm! Mower stopped',
    71: 'Alarm! Mower lifted',
    72: 'Alarm! Mower tilted',
    73: 'Alarm! Mower in motion',
    74: 'Alarm! Outside geofence',
    75: 'Connection changed',
    76: 'Connection NOT changed',
    77: 'Com board not available',
    78: 'Slipped - Mower has Slipped',
    79: 'Invalid battery combination',
    80: 'Cutting system imbalance',
    81: 'Safety function faulty',
    82: 'Wheel motor blocked rear right',
    83: 'Wheel motor blocked rear left',
    84: 'Wheel drive problem rear right',
    85: 'Wheel drive problem rear left',
    86: 'Wheel motor overloaded rear right',
    87: 'Wheel motor overloaded rear left',
    88: 'Angular sensor problem',
    89: 'Invalid system configuration',
    90: 'No power in charging station',
    91: 'Switch cord problem',
    92: 'Work area not valid',
    93: 'No accurate position',
    94: 'Reference station communication problem',
    95: 'Temporary reference station problem',
    96: 'Reference station communication problem',
    97: 'GPS assisted navigation problem',
    98: 'GPS assisted navigation problem',
    99: 'Gyro sensor problem',
    100: 'Temporary gyro sensor problem',
    // Add more error codes as needed
  };
}

/**
 * Transforms raw Husqvarna API data into a cleaner structure for Firebase
 * 
 * @param data Complete mower data from API
 * @returns Transformed data for Firebase
 */
function transformMowerData(data: CompleteMowerData) {
  const errorCodes = getErrorCodeMap();
  const mower = data.mower.data;
  const attributes = mower.attributes;
  
  // Get error description if available
  const errorCode = attributes.mower.errorCode;
  const errorDescription = errorCodes[errorCode] || `Unknown error (${errorCode})`;
  
  // Transform to a cleaner structure
  return {
    id: mower.id,
    system: attributes.system,
    status: {
      battery: attributes.battery.batteryPercent,
      mode: attributes.mower.mode,
      activity: attributes.mower.activity,
      state: attributes.mower.state,
      errorCode,
      errorDescription,
      errorTimestamp: attributes.mower.errorCodeTimestamp,
      isErrorConfirmable: attributes.mower.isErrorConfirmable,
      connected: attributes.metadata.connected,
      lastStatusUpdate: attributes.metadata.statusTimestamp,
      workAreaId: attributes.mower.workAreaId,
    },
    capabilities: attributes.capabilities,
    calendar: attributes.calendar,
    planner: attributes.planner,
    positions: attributes.positions,
    settings: attributes.settings,
    statistics: attributes.statistics || {},
    workAreas: data.workAreas?.data.map(wa => ({
      id: wa.id,
      ...wa.attributes
    })) || [],
    stayOutZones: data.stayOutZones?.data.attributes.zones || [],
    messages: data.messages?.data.attributes.messages || [],
    lastUpdated: Date.now()
  };
}

/**
 * Firebase function that syncs mower data from Husqvarna API to Firestore
 * Runs 4 times a day (every 6 hours) to conserve API usage
 */
export const syncHusqvarnaMowers = functions
  .runWith({
    timeoutSeconds: 300, // 5 minutes
    memory: '1GB'
  })
  .pubsub.schedule('every 6 hours')
  .onRun(async (context) => {
    const db = admin.firestore();
    const api = getApiInstance();
    
    console.log('Starting Husqvarna mower sync...');
    
    try {
      // Get all mowers with complete data
      const allMowers = await api.getAllMowersComplete();
      
      // Create a batch write
      const batch = db.batch();
      
      // Process each mower
      for (const [mowerId, mowerData] of Object.entries(allMowers)) {
        // Transform the data for Firebase
        const transformedData = transformMowerData(mowerData);
        
        // Add to batch
        const mowerRef = db.collection('mowers').doc(mowerId);
        batch.set(mowerRef, transformedData);
        
        // Log progress
        console.log(`Processed mower: ${transformedData.system.name} (${mowerId})`);
      }
      
      // Commit the batch
      await batch.commit();
      
      console.log(`Successfully synced ${Object.keys(allMowers).length} mowers to Firestore`);
      return null;
    } catch (error) {
      console.error('Error syncing mowers:', error);
      throw error;
    }
  });

/**
 * Firebase function to manually trigger a sync for testing
 */
export const manualSyncMowers = functions.https.onCall(async (data, context) => {
  // Check authentication if needed
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to trigger manual sync'
    );
  }
  
  try {
    const db = admin.firestore();
    const api = getApiInstance();
    
    // Specific mower or all mowers
    if (data?.mowerId) {
      // Sync a single mower
      console.log(`Manual sync requested for mower: ${data.mowerId}`);
      
      const mowerData = await api.getMowerComplete(data.mowerId);
      const transformedData = transformMowerData(mowerData);
      
      await db.collection('mowers').doc(data.mowerId).set(transformedData);
      
      return {
        success: true,
        message: `Synced mower: ${transformedData.system.name}`
      };
    } else {
      // Sync all mowers
      console.log('Manual sync requested for all mowers');
      
      const allMowers = await api.getAllMowersComplete();
      const batch = db.batch();
      
      for (const [mowerId, mowerData] of Object.entries(allMowers)) {
        const transformedData = transformMowerData(mowerData);
        batch.set(db.collection('mowers').doc(mowerId), transformedData);
      }
      
      await batch.commit();
      
      return {
        success: true,
        message: `Synced ${Object.keys(allMowers).length} mowers`
      };
    }
  } catch (error) {
    console.error('Error in manual sync:', error);
    throw new functions.https.HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

/**
 * Firebase function to send a command to a mower
 */
export const sendMowerCommand = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to send commands'
    );
  }
  
  const { mowerId, command, attributes } = data;
  
  if (!mowerId || !command) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameters: mowerId and command'
    );
  }
  
  try {
    const api = getApiInstance();
    
    console.log(`Sending command to mower ${mowerId}: ${command}`, attributes);
    
    // Send the command
    const result = await api.sendMowerCommand(mowerId, command as MowerCommandType, attributes || {});
    
    // Get updated mower data after command
    const updatedMower = await api.getMowerComplete(mowerId);
    const transformedData = transformMowerData(updatedMower);
    
    // Update in Firestore
    await admin.firestore().collection('mowers').doc(mowerId).set(transformedData);
    
    return {
      success: true,
      commandId: result.data.id,
      message: `Command ${command} sent successfully to mower ${mowerId}`
    };
  } catch (error) {
    console.error('Error sending command:', error);
    throw new functions.https.HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}); 