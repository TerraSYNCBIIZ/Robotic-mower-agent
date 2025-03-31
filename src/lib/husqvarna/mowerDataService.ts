import { collection, doc, getDoc, setDoc, addDoc, serverTimestamp, getFirestore } from "firebase/firestore";
import { db } from "../firebase/config";
import { husqvarnaApi } from "./api-client";
import { HusqvarnaWebSocketManager, WebSocketStatus } from './websocket';

// Collection names
const MOWERS_COLLECTION = 'mowers';
const HISTORY_COLLECTION = 'history';
const ERRORS_COLLECTION = 'errors';

export class MowerDataService {
  private pollingIntervals: Record<string, NodeJS.Timeout> = {};
  webSocketManager: HusqvarnaWebSocketManager; // Exposed for monitoring
  private webSocketConnected: boolean = false;
  
  constructor() {
    // Initialize WebSocket manager
    this.webSocketManager = new HusqvarnaWebSocketManager();
    
    // Set up WebSocket event listeners
    this.webSocketManager.on('status_change', this.handleWebSocketStatusChange.bind(this));
    this.webSocketManager.on('message', this.handleWebSocketMessage.bind(this));
    this.webSocketManager.on('error', this.handleWebSocketError.bind(this));
    
    // Initialize event listeners for UI updates
    if (typeof window !== 'undefined') {
      window.addEventListener('mower-data-updated', this.handleMowerDataUpdated.bind(this));
      
      // Register this instance globally for debugging purposes
      const anyWindow = window as any;
      anyWindow.mowerDataService = this;
    }
  }
  
  /**
   * Start monitoring all mowers - fetches initial data and sets up polling
   */
  async startMonitoringAllMowers(interval = 5 * 60 * 1000) { // 5 minutes default
    try {
      console.log("Starting to monitor all mowers");
      // Get all mowers
      const mowers = await husqvarnaApi.getMowers();
      
      if (!mowers || mowers.length === 0) {
        console.warn("No mowers found to monitor");
        return false;
      }
      
      console.log(`Found ${mowers.length} mowers to monitor`);
      
      // Set up monitoring for each mower
      for (const mower of mowers) {
        await this.startMonitoringMower(mower.id, interval);
      }
      
      // Check if WebSockets have failed recently
      const websocketFailed = typeof window !== 'undefined' ? 
        localStorage.getItem('websocket_failed') === 'true' : false;
      
      const lastAttempt = typeof window !== 'undefined' ? 
        parseInt(localStorage.getItem('websocket_last_attempt') || '0', 10) : 0;
        
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      // Only try WebSocket if it hasn't failed recently (within the last hour)
      if (!websocketFailed || lastAttempt < oneHourAgo) {
        // Try to connect WebSocket for real-time updates
        await this.startWebSocketConnection();
      } else {
        console.log("Skipping WebSocket connection due to previous failures");
        // Ensure we're using faster polling as fallback
        this.adjustPollingIntervals(60 * 1000); // 1 minute polling
      }
      
      return true;
    } catch (error) {
      console.error("Failed to start monitoring mowers:", error);
      return false;
    }
  }
  
  /**
   * Start WebSocket connection for real-time updates
   */
  private async startWebSocketConnection() {
    try {
      console.log("Starting WebSocket connection for real-time updates");
      
      // Reset the WebSocket manager before connecting
      if (typeof window !== 'undefined') {
        // Clear any persistent failure state if it's been more than 30 minutes
        const lastAttempt = parseInt(localStorage.getItem('websocket_last_attempt') || '0', 10);
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        
        if (lastAttempt < thirtyMinutesAgo) {
          localStorage.removeItem('websocket_failed');
          localStorage.removeItem('websocket_last_attempt');
        }
      }
      
      const connected = await this.webSocketManager.connect();
      
      if (connected) {
        console.log("WebSocket connected successfully");
        return connected;
      } else {
        console.warn("WebSocket connection failed, falling back to polling");
        
        // Store the failure status but with a slightly shorter timeout (30 minutes instead of 1 hour)
        if (typeof window !== 'undefined') {
          localStorage.setItem('websocket_failed', 'true');
          localStorage.setItem('websocket_last_attempt', Date.now().toString());
        }
        
        // Ensure polling is active with a shorter interval
        this.adjustPollingIntervals(60 * 1000); // 1 minute polling when WebSocket fails
        return false;
      }
    } catch (error) {
      console.error("Error starting WebSocket connection:", error);
      
      // Store the failure status so we don't keep trying
      if (typeof window !== 'undefined') {
        localStorage.setItem('websocket_failed', 'true');
        localStorage.setItem('websocket_last_attempt', Date.now().toString());
      }
      
      return false;
    }
  }
  
  /**
   * Start monitoring a specific mower
   */
  async startMonitoringMower(mowerId: string, interval = 5 * 60 * 1000) {
    try {
      console.log(`Starting to monitor mower: ${mowerId}`);
      
      // Clear any existing interval
      this.stopMonitoringMower(mowerId);
      
      // Initial fetch and store
      await this.fetchAndStoreMowerData(mowerId);
      
      // Set up polling interval
      this.pollingIntervals[mowerId] = setInterval(() => {
        this.fetchAndStoreMowerData(mowerId)
          .catch(error => console.error(`Error polling mower ${mowerId}:`, error));
      }, interval);
      
      return true;
    } catch (error) {
      console.error(`Error starting monitoring for mower ${mowerId}:`, error);
      return false;
    }
  }
  
  /**
   * Stop monitoring a specific mower
   */
  stopMonitoringMower(mowerId: string) {
    if (this.pollingIntervals[mowerId]) {
      clearInterval(this.pollingIntervals[mowerId]);
      delete this.pollingIntervals[mowerId];
      console.log(`Stopped monitoring mower: ${mowerId}`);
    }
  }
  
  /**
   * Fetch data for a mower and store it in Firebase
   */
  async fetchAndStoreMowerData(mowerId: string) {
    try {
      console.log(`🔄 Fetching data for mower ${mowerId}...`);
      
      // Fetch mower data
      const mowerData = await husqvarnaApi.getMower(mowerId);
      console.log(`✅ Successfully retrieved mower data for ${mowerId}`);
      
      // Fetch work areas data
      const workAreasData = await husqvarnaApi.getMowerWorkAreas(mowerId);
      console.log(`✅ Successfully retrieved ${workAreasData.length || 0} work areas for mower ${mowerId}`);
      
      // Store in Firebase
      await this.storeMowerData(mowerId, mowerData, workAreasData);
      
      // Check for errors
      this.checkForErrorsAndNotify(mowerId, mowerData);
      
      // Dispatch event for UI updates
      this.dispatchMowerDataUpdated(mowerId, {
        type: 'api_update',
        mowerData,
        workAreas: workAreasData
      });
      
      return { mowerData, workAreasData };
    } catch (error) {
      console.error(`❌ Error fetching data for mower ${mowerId}:`, error);
      await this.logError(mowerId, "fetch_error", error);
      throw error;
    }
  }
  
  /**
   * Get mower data from Firebase
   */
  async getMowerData(mowerId: string) {
    try {
      console.log(`🔍 Retrieving stored data for mower ${mowerId} from Firebase...`);
      
      if (!db) {
        console.error('❌ Firestore not initialized');
        return null;
      }
      
      const mowerDocRef = doc(db, MOWERS_COLLECTION, mowerId);
      const docSnap = await getDoc(mowerDocRef);
      
      if (docSnap.exists()) {
        console.log(`✅ Found stored data for mower ${mowerId}`);
        return docSnap.data();
      }
      
      console.log(`⚠️ No stored data found for mower ${mowerId}`);
      return null;
    } catch (error) {
      console.error(`❌ Error getting mower data for ${mowerId}:`, error);
      return null;
    }
  }
  
  /**
   * Store mower data in Firebase
   */
  private async storeMowerData(mowerId: string, mowerData: any, workAreasData: any) {
    try {
      console.log(`💾 Storing data for mower ${mowerId} in Firebase...`);
      
      if (!db) {
        console.error('❌ Firestore not initialized');
        return false;
      }
      
      const timestamp = serverTimestamp();
      const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
      
      // Store current state
      await setDoc(mowerRef, {
        lastUpdated: timestamp,
        mowerData,
        workAreas: workAreasData,
      }, { merge: true });
      
      // Store in history collection
      await addDoc(collection(db, MOWERS_COLLECTION, mowerId, HISTORY_COLLECTION), {
        timestamp,
        type: "api_update",
        mowerData,
        workAreas: workAreasData,
      });
      
      console.log(`✅ Successfully stored data for mower ${mowerId} in Firebase with ${workAreasData?.length || 0} work areas`);
      return true;
    } catch (error) {
      console.error(`❌ Error storing mower data for ${mowerId}:`, error);
      return false;
    }
  }
  
  /**
   * Handle WebSocket status changes
   */
  private handleWebSocketStatusChange(status: WebSocketStatus) {
    console.log(`WebSocket status changed to: ${status}`);
    
    if (status === WebSocketStatus.CONNECTED) {
      this.webSocketConnected = true;
      // Reset failure flag if we successfully connect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('websocket_failed');
      }
      // Can reduce polling frequency when WebSocket is connected
      this.adjustPollingIntervals(15 * 60 * 1000); // 15 minutes when WebSocket is active
    } else if (status === WebSocketStatus.DISCONNECTED || status === WebSocketStatus.ERROR) {
      this.webSocketConnected = false;
      // Restore normal polling frequency when WebSocket is disconnected
      this.adjustPollingIntervals(5 * 60 * 1000); // 5 minutes when WebSocket is inactive
      
      // If we get a 401 error, mark WebSockets as failed so we don't keep trying
      if (status === WebSocketStatus.ERROR && typeof window !== 'undefined') {
        localStorage.setItem('websocket_failed', 'true');
        localStorage.setItem('websocket_last_attempt', Date.now().toString());
      }
    }
  }
  
  /**
   * Adjust polling intervals for all mowers
   */
  private adjustPollingIntervals(interval: number) {
    // Update all polling intervals
    for (const mowerId in this.pollingIntervals) {
      clearInterval(this.pollingIntervals[mowerId]);
      this.pollingIntervals[mowerId] = setInterval(() => {
        this.fetchAndStoreMowerData(mowerId)
          .catch(error => console.error(`Error polling mower ${mowerId}:`, error));
      }, interval);
    }
  }
  
  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(message: any) {
    try {
      console.log(`WebSocket message received: ${message.type || 'unknown type'}`);
      
      // Only process messages with attributes
      if (!message.attributes) return;
      
      // Get mower ID
      const mowerId = message.id;
      if (!mowerId) return;
      
      // Store the event in Firebase based on message type
      if (message.type === 'battery-event-v2') {
        await this.storeEventData(mowerId, 'battery_update', message);
      } else if (message.type === 'mower-event-v2') {
        await this.storeEventData(mowerId, 'mower_update', message);
        // Check for errors in mower state
        this.checkForErrorsAndNotify(mowerId, message);
      } else if (message.type === 'position-event-v2') {
        await this.storeEventData(mowerId, 'position_update', message);
      } else if (message.type === 'calendar-event-v2') {
        await this.storeEventData(mowerId, 'calendar_update', message);
      } else if (message.type === 'message-event-v2') {
        await this.storeEventData(mowerId, 'message_update', message);
        // Check for errors in messages
        if (message.attributes.code) {
          this.notifyOnError(mowerId, message);
        }
      } else {
        // Store other event types
        await this.storeEventData(mowerId, `${message.type || 'unknown'}_update`, message);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: any) {
    console.error('WebSocket error:', error);
    this.webSocketConnected = false;
    
    // Log the error
    this.logError('websocket', 'websocket_error', error);
    
    // Restore normal polling frequency
    this.adjustPollingIntervals(5 * 60 * 1000);
  }
  
  /**
   * Check for errors in mower data and notify if found
   */
  private checkForErrorsAndNotify(mowerId: string, mowerData: any) {
    try {
      // Check for error conditions
      const hasError = 
        mowerData.attributes?.mower?.state === 'ERROR' || 
        mowerData.attributes?.mower?.state === 'FATAL_ERROR' ||
        (mowerData.attributes?.mower?.errorCode && mowerData.attributes?.mower?.errorCode > 0);
      
      if (hasError) {
        console.warn(`Error detected for mower ${mowerId}:`, 
          mowerData.attributes?.mower?.state,
          mowerData.attributes?.mower?.errorCode
        );
        
        // Log error to Firebase
        this.storeErrorEvent(mowerId, mowerData);
        
        // Dispatch event for UI
        this.dispatchMowerError(mowerId, mowerData);
      }
    } catch (error) {
      console.error(`Error checking for errors in mower ${mowerId}:`, error);
    }
  }
  
  /**
   * Store an event in Firebase
   */
  private async storeEventData(mowerId: string, eventType: string, data: any) {
    try {
      if (!db) return;
      
      const timestamp = serverTimestamp();
      
      // Update current state
      const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
      await setDoc(mowerRef, {
        lastUpdated: timestamp,
        [eventType]: data,
      }, { merge: true });
      
      // Add to history
      await addDoc(collection(db, MOWERS_COLLECTION, mowerId, HISTORY_COLLECTION), {
        timestamp,
        type: eventType,
        data
      });
      
      // Dispatch event for UI updates
      this.dispatchMowerDataUpdated(mowerId, { type: eventType, data });
      
      console.log(`Stored ${eventType} event for mower ${mowerId}`);
    } catch (error) {
      console.error(`Error storing event ${eventType} for mower ${mowerId}:`, error);
      this.logError(mowerId, `store_${eventType}`, error);
    }
  }
  
  /**
   * Store error event in Firebase
   */
  private async storeErrorEvent(mowerId: string, data: any) {
    try {
      if (!db) return;
      
      await addDoc(collection(db, MOWERS_COLLECTION, mowerId, ERRORS_COLLECTION), {
        timestamp: serverTimestamp(),
        errorState: data.attributes?.mower?.state,
        errorCode: data.attributes?.mower?.errorCode,
        errorData: data
      });
      
      console.log(`Stored error event for mower ${mowerId}`);
    } catch (error) {
      console.error(`Failed to store error event for mower ${mowerId}:`, error);
    }
  }
  
  /**
   * Log an error in Firebase
   */
  private async logError(mowerId: string, operation: string, error: any) {
    try {
      if (!db) return;
      
      await addDoc(collection(db, ERRORS_COLLECTION), {
        timestamp: serverTimestamp(),
        mowerId,
        operation,
        message: error.message || String(error),
        stack: error.stack,
      });
      
      console.log(`Logged error for operation ${operation} on mower ${mowerId}`);
    } catch (e) {
      console.error("Failed to log error to Firebase:", e);
    }
  }
  
  /**
   * Notify on error
   */
  private notifyOnError(mowerId: string, errorData: any) {
    console.error(`Error reported for mower ${mowerId}:`, errorData);
    this.dispatchMowerError(mowerId, errorData);
  }
  
  /**
   * Dispatch mower data updated event
   */
  private dispatchMowerDataUpdated(mowerId: string, data: any) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mower-data-updated', { 
        detail: { mowerId, data } 
      }));
    }
  }
  
  /**
   * Dispatch mower error event
   */
  private dispatchMowerError(mowerId: string, errorData: any) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mower-error', { 
        detail: { mowerId, errorData } 
      }));
    }
  }
  
  /**
   * Handle mower data updated event
   */
  private handleMowerDataUpdated(event: Event) {
    // This can be expanded to handle real-time updates if needed
    console.log('Mower data updated event received', (event as CustomEvent).detail);
  }
  
  /**
   * Clean up when component unmounts
   */
  dispose() {
    // Close WebSocket connection
    this.webSocketManager.dispose();
    
    // Clear all polling intervals
    for (const mowerId in this.pollingIntervals) {
      clearInterval(this.pollingIntervals[mowerId]);
    }
    this.pollingIntervals = {};
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('mower-data-updated', this.handleMowerDataUpdated.bind(this));
    }
    
    console.log('MowerDataService disposed');
  }
  
  /**
   * Get WebSocket status
   */
  getWebSocketStatus(): WebSocketStatus {
    return this.webSocketManager.getStatus();
  }
  
  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.webSocketManager.isConnected();
  }
} 