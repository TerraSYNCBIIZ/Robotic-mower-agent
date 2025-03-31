import {
  MowerEvent,
  MowerWebSocketEventType,
  MowerStatusEvent,
  PositionEvent,
  BatteryEvent,
  MowerActivity,
  MowerState
} from '@/lib/husqvarna/websocket';
import { getMowerData, MowerData } from '@/lib/firestoreDB';

/**
 * Converts a WebSocket event to a MowerData object
 * @param event The WebSocket event to convert
 * @returns A MowerData object or null if the event can't be converted
 */
export async function convertWebSocketEventToMowerData(event: MowerEvent): Promise<MowerData | null> {
  try {
    // Try to get existing mower data from Firestore
    const mowerDataResult = await getMowerData(event.id);
    const existingMower = mowerDataResult.success && mowerDataResult.data ? 
      mowerDataResult.data as MowerData : null;
    
    // If no existing data, we need at least basic mower information
    if (!existingMower && event.type !== MowerWebSocketEventType.MOWER) {
      console.log(`No existing mower data found for ${event.id} and event isn't a MOWER event`);
      return null;
    }
    
    // Create base mower data object either from existing data or a new object
    let mowerData: MowerData = existingMower || {
      id: event.id,
      name: `Mower ${event.id.substring(0, 8)}`,
      model: 'Unknown Model',
      status: 'offline',
      batteryLevel: 0,
      lastUpdated: new Date()
    };
    
    // Update specific properties based on event type
    switch (event.type) {
      case MowerWebSocketEventType.BATTERY: {
        const batteryEvent = event as BatteryEvent;
        mowerData.batteryLevel = batteryEvent.attributes.battery.batteryPercent;
        break;
      }
      
      case MowerWebSocketEventType.POSITION: {
        const positionEvent = event as PositionEvent;
        mowerData.coordinates = {
          latitude: positionEvent.attributes.position.latitude,
          longitude: positionEvent.attributes.position.longitude
        };
        break;
      }
      
      case MowerWebSocketEventType.MOWER: {
        const mowerEvent = event as MowerStatusEvent;
        const mowerInfo = mowerEvent.attributes.mower;
        
        // Update status based on activity and state
        let status: MowerData['status'] = 'offline';
        
        // Map activity to status
        if (mowerInfo.state === MowerState.IN_OPERATION) {
          switch (mowerInfo.activity) {
            case MowerActivity.MOWING:
              status = 'mowing';
              break;
            case MowerActivity.CHARGING:
              status = 'charging';
              break;
            case MowerActivity.PARKED_IN_CS:
              status = 'parked';
              break;
            case MowerActivity.GOING_HOME:
              status = 'returning';
              break;
            case MowerActivity.LEAVING:
            case MowerActivity.STOPPED_IN_GARDEN:
              status = 'idle';
              break;
            default:
              status = 'idle';
          }
        } else if (mowerInfo.state === MowerState.ERROR || mowerInfo.state === MowerState.FATAL_ERROR) {
          status = 'error';
        }
        
        mowerData.status = status;
        mowerData.connected = true;
        mowerData.errorCode = mowerInfo.errorCode;
        mowerData.errorTimestamp = mowerInfo.errorCodeTimestamp;
        break;
      }
    }
    
    // Always update the last updated timestamp
    mowerData.lastUpdated = new Date();
    
    return mowerData;
  } catch (error) {
    console.error('Error converting WebSocket event to mower data:', error);
    return null;
  }
} 