import { collection, doc, getDoc, setDoc, addDoc, serverTimestamp, getFirestore, getDocs } from "firebase/firestore";
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
    // Initialize WebSocket manager using singleton
    this.webSocketManager = HusqvarnaWebSocketManager.getInstance();
    
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
      
      // IMPROVEMENT: First try to load from Firebase cache
      const cachedMowers = await this.loadCachedMowerData();
      let mowerList = [];

      // If we have cached data, use it first to render UI faster
      if (cachedMowers && cachedMowers.length > 0) {
        console.log(`Found ${cachedMowers.length} cached mowers to display initially`);
        mowerList = cachedMowers.map(mower => ({
          id: mower.id,
          attributes: mower.mowerData?.attributes || {}
        }));
        
        // Dispatch event with cached data for immediate UI update
        this.dispatchAllMowersDataLoaded(mowerList, true);
      }
      
      // Connect WebSocket first for real-time updates
      // Check if WebSockets have failed recently
      const websocketFailed = typeof window !== 'undefined' ? 
        localStorage.getItem('websocket_failed') === 'true' : false;
      
      const lastAttempt = typeof window !== 'undefined' ? 
        parseInt(localStorage.getItem('websocket_last_attempt') || '0', 10) : 0;
        
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      // Only try WebSocket if it hasn't failed recently (within the last hour)
      let websocketConnected = false;
      if (!websocketFailed || lastAttempt < oneHourAgo) {
        // Try to connect WebSocket for real-time updates
        websocketConnected = await this.startWebSocketConnection();
      } else {
        console.log("Skipping WebSocket connection due to previous failures");
      }
      
      // IMPROVEMENT: Only fetch fresh API data if:
      // 1. We don't have cached data, OR
      // 2. Cached data is older than 30 minutes, OR
      // 3. WebSocket connection failed
      const needsFreshData = !cachedMowers || cachedMowers.length === 0 || 
                            this.isCacheStale(cachedMowers) || 
                            !websocketConnected;
      
      if (needsFreshData) {
        console.log("Cache is stale or WebSocket unavailable, fetching fresh data from API");
        // Get all mowers from API
        const mowers = await husqvarnaApi.getMowers();
        
        if (!mowers || mowers.length === 0) {
          console.warn("No mowers found to monitor");
          return cachedMowers && cachedMowers.length > 0;
        }
        
        console.log(`Found ${mowers.length} mowers from API to monitor`);
        mowerList = mowers;
        
        // Set up monitoring for each mower
        for (const mower of mowers) {
          await this.startMonitoringMower(mower.id, interval, false); // false = don't fetch work areas yet
        }
        
        // Dispatch event with fresh data
        this.dispatchAllMowersDataLoaded(mowerList, false);
      } else {
        console.log("Using cached data with WebSocket updates, skipping initial API fetch");
        // Still set up monitoring for polling as backup
        for (const mower of cachedMowers) {
          // Set up lighter polling if WebSocket is connected
          const adjustedInterval = websocketConnected ? interval * 3 : interval; // 15 min vs 5 min
          this.setupPollingForMower(mower.id, adjustedInterval);
        }
      }
      
      // If WebSocket failed, use faster polling as fallback
      if (!websocketConnected) {
        this.adjustPollingIntervals(60 * 1000); // 1 minute polling
      }
      
      return true;
    } catch (error) {
      console.error("Failed to start monitoring mowers:", error);
      return false;
    }
  }
  
  /**
   * Check if cached mower data is stale (older than 30 minutes)
   */
  private isCacheStale(cachedMowers) {
    if (!cachedMowers || cachedMowers.length === 0) return true;
    
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    // Check the lastUpdated timestamp on the first mower
    // Assuming all mowers are updated around the same time
    const lastUpdated = cachedMowers[0].lastUpdated?.toMillis?.() || 0;
    
    return lastUpdated < thirtyMinutesAgo;
  }
  
  /**
   * Dispatch event for all mowers data loaded
   */
  private dispatchAllMowersDataLoaded(mowers, fromCache = false) {
    if (typeof window !== 'undefined') {
      // Create a custom event
      const event = new CustomEvent('all-mowers-data-loaded', {
        detail: {
          mowers,
          fromCache
        }
      });
      
      // Dispatch the event
      window.dispatchEvent(event);
    }
  }
  
  /**
   * Start monitoring a specific mower
   */
  async startMonitoringMower(mowerId: string, interval = 5 * 60 * 1000, fetchWorkAreas = true) {
    try {
      console.log(`Starting to monitor mower: ${mowerId}`);
      
      // Clear any existing interval
      this.stopMonitoringMower(mowerId);
      
      // Initial fetch and store
      await this.fetchAndStoreMowerData(mowerId, fetchWorkAreas);
      
      // Set up polling interval
      this.setupPollingForMower(mowerId, interval);
      
      return true;
    } catch (error) {
      console.error(`Error starting monitoring for mower ${mowerId}:`, error);
      return false;
    }
  }
  
  /**
   * Set up polling interval for a mower
   */
  private setupPollingForMower(mowerId: string, interval = 5 * 60 * 1000) {
    // Clear any existing interval first
    if (this.pollingIntervals[mowerId]) {
      clearInterval(this.pollingIntervals[mowerId]);
    }
    
    // Set up new polling interval
    this.pollingIntervals[mowerId] = setInterval(() => {
      // Only fetch work areas every third poll to reduce API load
      const shouldFetchWorkAreas = Math.random() < 0.3; // ~30% chance
      
      this.fetchAndStoreMowerData(mowerId, shouldFetchWorkAreas)
        .catch(error => console.error(`Error polling mower ${mowerId}:`, error));
    }, interval);
  }
  
  /**
   * Fetch data for a mower and store it in Firebase
   */
  async fetchAndStoreMowerData(mowerId: string, fetchWorkAreas = true) {
    try {
      console.log(`🔄 Fetching data for mower ${mowerId}...`);
      
      // Fetch mower data
      const mowerData = await husqvarnaApi.getMower(mowerId);
      console.log(`✅ Successfully retrieved mower data for ${mowerId}`);
      
      let workAreasData = [];
      // Only fetch work areas if specifically requested (to reduce API calls)
      if (fetchWorkAreas) {
        // Try to get work areas from cache first
        workAreasData = await this.getWorkAreasFromCache(mowerId);
        
        // If no cached work areas or cache is stale, fetch from API
        if (!workAreasData || workAreasData.length === 0 || this.isWorkAreasCacheStale(mowerId)) {
          workAreasData = await husqvarnaApi.getMowerWorkAreas(mowerId);
          console.log(`✅ Successfully retrieved ${workAreasData.length || 0} work areas for mower ${mowerId}`);
        } else {
          console.log(`📋 Using cached work areas for mower ${mowerId}`);
        }
      }
      
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
   * Get work areas from cache
   */
  private async getWorkAreasFromCache(mowerId: string) {
    if (!db) return null;
    
    try {
      const mowerDocRef = doc(db, MOWERS_COLLECTION, mowerId);
      const docSnap = await getDoc(mowerDocRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.workAreas || [];
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting cached work areas for mower ${mowerId}:`, error);
      return null;
    }
  }
  
  /**
   * Check if work areas cache is stale (older than 24 hours)
   * Since work areas change less frequently, we use a longer threshold
   */
  private isWorkAreasCacheStale(mowerId: string) {
    // In a real implementation, you would check the timestamp of the cached work areas
    // For simplicity, we'll assume work areas are stale after 24 hours
    return false; // Always use cache for work areas unless explicitly refreshed
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
      switch(message.type) {
        case 'battery-event-v2':
          // Handle battery updates
          await this.storeEventData(mowerId, 'battery', {
            batteryPercent: message.attributes.battery?.batteryPercent,
            lastUpdated: serverTimestamp()
          });
          break;
          
        case 'mower-event-v2':
          // Handle mower status updates (most important events)
          const mowerAttributes = message.attributes.mower || {};
          await this.storeEventData(mowerId, 'mower', {
            mode: mowerAttributes.mode,
            activity: mowerAttributes.activity,
            state: mowerAttributes.state,
            inactiveReason: mowerAttributes.inactiveReason,
            workAreaId: mowerAttributes.workAreaId,
            errorCode: mowerAttributes.errorCode || 0,
            errorTimestamp: mowerAttributes.errorTimestamp,
            isErrorConfirmable: mowerAttributes.isErrorConfirmable
          });
          
          // Check for errors in mower state
          if (mowerAttributes.errorCode > 0 || 
              mowerAttributes.state === 'ERROR' || 
              mowerAttributes.state === 'FATAL_ERROR') {
            await this.storeErrorEvent(mowerId, message);
          }
          break;
          
        case 'position-event-v2':
          // Handle position updates
          if (message.attributes.position) {
            await this.storePositionData(mowerId, {
              latitude: message.attributes.position.latitude,
              longitude: message.attributes.position.longitude,
              timestamp: serverTimestamp()
            });
          }
          break;
          
        case 'statistics-event-v2':
          // Handle statistics updates
          if (message.attributes.statistics) {
            await this.storeEventData(mowerId, 'statistics', {
              cuttingBladeUsageTime: message.attributes.statistics.cuttingBladeUsageTime,
              numberOfChargingCycles: message.attributes.statistics.numberOfChargingCycles,
              numberOfCollisions: message.attributes.statistics.numberOfCollisions,
              totalChargingTime: message.attributes.statistics.totalChargingTime,
              totalCuttingTime: message.attributes.statistics.totalCuttingTime,
              totalDriveDistance: message.attributes.statistics.totalDriveDistance,
              totalRunningTime: message.attributes.statistics.totalRunningTime,
              totalSearchingTime: message.attributes.statistics.totalSearchingTime,
              lastUpdated: serverTimestamp()
            });
          }
          break;
          
        case 'calendar-event-v2':
          console.log('📅 Calendar/schedule event received:', message.attributes?.calendar);
          await this.storeEventData(mowerId, 'calendar', {
            tasks: message.attributes.calendar?.tasks || [],
            lastUpdated: serverTimestamp()
          });
          
          // Immediately update the consolidated view
          await this.updateConsolidatedMowerData(mowerId);
          break;
          
        case 'planner-event-v2':
          // Handle planner updates
          if (message.attributes.planner) {
            await this.storeEventData(mowerId, 'planner', {
              nextStartTimestamp: message.attributes.planner.nextStartTimestamp,
              override: message.attributes.planner.override,
              restrictedReason: message.attributes.planner.restrictedReason,
              externalReason: message.attributes.planner.externalReason,
              lastUpdated: serverTimestamp()
            });
          }
          break;
        
        case 'work-area-event-v2':
          // Handle work area updates
          if (message.attributes.workAreas) {
            await this.storeEventData(mowerId, 'workAreas', {
              areas: message.attributes.workAreas,
              lastUpdated: serverTimestamp()
            });
          }
          break;
        
        case 'stay-out-zone-event-v2':
          // Handle stay-out zone updates
          if (message.attributes.stayOutZones) {
            await this.storeEventData(mowerId, 'stayOutZones', {
              dirty: message.attributes.stayOutZones.dirty,
              zones: message.attributes.stayOutZones.zones,
              lastUpdated: serverTimestamp()
            });
          }
          break;
        
        case 'settings-event-v2':
          // Handle settings updates
          if (message.attributes.settings) {
            await this.storeEventData(mowerId, 'settings', {
              ...message.attributes.settings,
              lastUpdated: serverTimestamp()
            });
          }
          break;
        
        case 'message-event-v2':
          // Handle system messages
          await this.storeEventData(mowerId, 'message', message.attributes);
          // Check for errors in messages
          if (message.attributes.code) {
            await this.notifyOnError(mowerId, message);
          }
          break;
        
        case 'system-event-v2':
          // Handle system information updates
          if (message.attributes.system) {
            await this.storeEventData(mowerId, 'system', {
              name: message.attributes.system.name,
              model: message.attributes.system.model,
              serialNumber: message.attributes.system.serialNumber,
              lastUpdated: serverTimestamp()
            });
          }
          break;
        
        case 'capabilities-event-v2':
          // Handle capabilities updates
          if (message.attributes.capabilities) {
            await this.storeEventData(mowerId, 'capabilities', {
              ...message.attributes.capabilities,
              lastUpdated: serverTimestamp()
            });
          }
          break;
        
        default:
          // Store other event types not explicitly handled
          console.log(`Storing unknown event type: ${message.type}`);
          await this.storeEventData(mowerId, `${message.type || 'unknown'}_update`, message.attributes);
      }
      
      // Create a consolidated data update for the UI
      // This combines all stored data for a unified view
      await this.updateConsolidatedMowerData(mowerId);
      
      // Dispatch event for UI updates
      this.dispatchMowerDataUpdated(mowerId, { 
        type: message.type, 
        data: message.attributes 
      });
      
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      // Don't try to log with mowerId if we don't have it
      const errorMowerId = message?.id || 'unknown';
      await this.logError(errorMowerId, "websocket_message_processing", error);
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
  
  /**
   * Store position data in Firebase with a separate method to handle history tracking
   */
  private async storePositionData(mowerId: string, positionData: any) {
    try {
      if (!db) return;
      
      const timestamp = serverTimestamp();
      
      // Update current position in the main mower document
      const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
      await setDoc(mowerRef, {
        lastUpdated: timestamp,
        'position_current': positionData
      }, { merge: true });
      
      // Also add to position history collection with a limit
      const positionsRef = collection(db, MOWERS_COLLECTION, mowerId, 'positions');
      await addDoc(positionsRef, {
        ...positionData,
        timestamp
      });
      
      console.log(`Stored position update for mower ${mowerId}`);
    } catch (error) {
      console.error(`Error storing position for mower ${mowerId}:`, error);
      this.logError(mowerId, `store_position`, error);
    }
  }
  
  /**
   * Update the consolidated mower data for easy access
   * This combines all the separate event data into a single document
   */
  private async updateConsolidatedMowerData(mowerId: string) {
    try {
      if (!db) return;
      
      // Get the mower document
      const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
      const mowerDoc = await getDoc(mowerRef);
      
      if (!mowerDoc.exists()) {
        console.log(`No data found for mower ${mowerId} to consolidate`);
        return;
      }
      
      const data = mowerDoc.data();
      
      // Create a consolidated view of the mower's current state
      const consolidated = {
        id: mowerId,
        lastUpdated: serverTimestamp(),
        system: data.system || data.system_update?.attributes?.system,
        battery: {
          batteryPercent: data.battery?.batteryPercent || 
                           data.battery_update?.attributes?.battery?.batteryPercent || 0
        },
        mower: {
          mode: data.mower?.mode || data.mower_update?.attributes?.mower?.mode,
          activity: data.mower?.activity || data.mower_update?.attributes?.mower?.activity,
          state: data.mower?.state || data.mower_update?.attributes?.mower?.state,
          inactiveReason: data.mower?.inactiveReason || data.mower_update?.attributes?.mower?.inactiveReason,
          errorCode: data.mower?.errorCode || data.mower_update?.attributes?.mower?.errorCode || 0,
          errorTimestamp: data.mower?.errorTimestamp || data.mower_update?.attributes?.mower?.errorTimestamp
        },
        position: data.position_current || {
          latitude: data.position_update?.attributes?.position?.latitude,
          longitude: data.position_update?.attributes?.position?.longitude
        },
        statistics: data.statistics || data.statistics_update?.attributes?.statistics,
        status: this.deriveStatus(data)
      };
      
      // Update the consolidated data
      await setDoc(mowerRef, {
        consolidated
      }, { merge: true });
      
      console.log(`Updated consolidated data for mower ${mowerId}`);
    } catch (error) {
      console.error(`Error updating consolidated data for mower ${mowerId}:`, error);
    }
  }
  
  /**
   * Derive a simplified status string from mower data
   */
  private deriveStatus(data: any): string {
    // Get the mower state and activity
    const state = data.mower?.state || data.mower_update?.attributes?.mower?.state;
    const activity = data.mower?.activity || data.mower_update?.attributes?.mower?.activity;
    
    // Check for errors first
    if (state === 'ERROR' || state === 'FATAL_ERROR') {
      return 'error';
    }
    
    // Check connected status from metadata
    const connected = data.metadata?.connected || 
                     data.metadata_update?.attributes?.metadata?.connected;
    if (connected === false) {
      return 'offline';
    }
    
    // Map activity to status
    switch (activity) {
      case 'MOWING':
        return 'mowing';
      case 'CHARGING':
        return 'charging';
      case 'PARKED_IN_CS':
        return 'parked';
      case 'GOING_HOME':
        return 'returning';
      case 'LEAVING':
      case 'STOPPED_IN_GARDEN':
        return 'idle';
      default:
        return 'idle';
    }
  }
  
  /**
   * Load cached mower data from Firebase
   */
  async loadCachedMowerData() {
    try {
      console.log('Loading cached mower data from Firebase...');
      
      if (!db) {
        console.error('❌ Firestore not initialized');
        return null;
      }
      
      const mowersCollectionRef = collection(db, MOWERS_COLLECTION);
      const querySnapshot = await getDocs(mowersCollectionRef);
      
      if (querySnapshot.empty) {
        console.log('No cached mower data found in Firebase');
        return [];
      }
      
      const mowers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`✅ Found ${mowers.length} mowers in Firebase cache`);
      return mowers;
    } catch (error) {
      console.error('Error loading cached mower data:', error);
      return null;
    }
  }
  
  /**
   * Connect to WebSockets for real-time updates
   * This is a public wrapper around the private startWebSocketConnection method
   */
  async connectWebSockets(): Promise<boolean> {
    try {
      console.log("Connecting to WebSockets for real-time updates (public method)");
      return await this.startWebSocketConnection();
    } catch (error) {
      console.error("Error in connectWebSockets:", error);
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
   * Dispatches cached mower data to UI
   */
  dispatchCachedMowerData(mowers: any[]): void {
    // Only proceed if we're in a browser context
    if (typeof window === 'undefined') return;
    
    // Dispatch each mower as an update event
    mowers.forEach(mower => {
      this.dispatchMowerDataUpdated(mower.id, {
        type: 'cached_data',
        data: mower
      });
    });
    
    // Also dispatch a consolidated update event
    window.dispatchEvent(new CustomEvent('mowers-data-updated', {
      detail: {
        mowers,
        source: 'cache'
      }
    }));
  }
} 