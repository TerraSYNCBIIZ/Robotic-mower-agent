// Import Firebase functionality safely without TypeScript errors
// We'll dynamically import what we need at runtime
import { db } from "../firebase/config";
import { husqvarnaApi } from "./api-client";
import { HusqvarnaWebSocketManager, WebSocketStatus } from './websocket';

// Collection names
const MOWERS_COLLECTION = 'mowers';
const HISTORY_COLLECTION = 'history';
const ERRORS_COLLECTION = 'errors';
const DATA_COLLECTION = 'data';

// Fix for Firebase imports
// These variables are used instead of direct imports
let collection: any, doc: any, getDoc: any, setDoc: any, 
    addDoc: any, serverTimestamp: any, getDocs: any;

// Dynamic import for Firebase functions (called when needed)
async function initFirebase() {
  if (typeof window === 'undefined') return;
  
  try {
    // Import Firebase functions dynamically to avoid TypeScript errors
    const firestore = await import('firebase/firestore');
    collection = firestore.collection;
    doc = firestore.doc;
    getDoc = firestore.getDoc;
    setDoc = firestore.setDoc;
    addDoc = firestore.addDoc;
    serverTimestamp = firestore.serverTimestamp;
    getDocs = firestore.getDocs;
    
    console.log('Firebase functions imported successfully');
    return true;
  } catch (error) {
    console.error('Error importing Firebase functions:', error);
    return false;
  }
}

// Initialize Firebase as soon as possible
if (typeof window !== 'undefined') {
  initFirebase();
}

export class MowerDataService {
  private pollingIntervals: Record<string, NodeJS.Timeout> = {};
  webSocketManager: HusqvarnaWebSocketManager; // Exposed for monitoring
  private webSocketConnected: boolean = false;
  
  /**
   * Get schedule data formatted according to Husqvarna API schema
   * @param mowerId The ID of the mower to get schedule data for
   * @returns The schedule data or an empty schedule object
   */
  getScheduleForMower(mowerId: string): any {
    try {
      // Check for test schedule data first
      const self = this as any;
      if (self.testSchedules && self.testSchedules.has(mowerId)) {
        const testSchedule = self.testSchedules.get(mowerId);
        console.log(`[MowerDataService] Using test schedule data for mower ${mowerId} with ${testSchedule.tasks.length} tasks`);
        return testSchedule;
      }
      
      // Continue with the original implementation...
      // Rest of the getScheduleForMower method follows...
      
      // Get the mower data from the stored data
      if (!mowerId) {
        console.error('[MowerDataService] Cannot get schedule: No mower ID provided');
        return { tasks: [] };
      }
      
      console.log(`[MowerDataService] Getting schedule data for mower ${mowerId}`);
      
      // Try using getMowerData directly even though it's async
      // In this context, we'll likely get cached data which would be synchronous
      const mowerPromise = this.getMowerData(mowerId);
      
      // If it's a real promise, we can't wait for it in a sync function
      // So in that case, just return empty data
      if (mowerPromise instanceof Promise) {
        console.log(`[MowerDataService] getMowerData returned a Promise, using empty data`);
        return { tasks: [] };
      }
      
      // At this point, we should have synchronously obtained data
      const mowerData = mowerPromise;
      
      // DEBUG: Print out the structure of mowerData to see what we're actually getting
      console.log(`[MowerDataService] DUMP OF ALL MOWER DATA FOR ${mowerId}:`, JSON.stringify(mowerData, null, 2));
      
      if (!mowerData) {
        // As a backup, try checking directly in internal data stores
        const self = this as any;
        let backupData = null;
        
        // Try currentData map
        if (self.currentData && typeof self.currentData.get === 'function') {
          backupData = self.currentData.get(mowerId);
        }
        
        // Try cachedMowerData map
        if (!backupData && self.cachedMowerData && typeof self.cachedMowerData.get === 'function') {
          backupData = self.cachedMowerData.get(mowerId);
          console.log('[MowerDataService] Using backup data from cachedMowerData map');
        }
        
        // Try mowerData map
        if (!backupData && self.mowerData && typeof self.mowerData.get === 'function') {
          backupData = self.mowerData.get(mowerId);
          console.log('[MowerDataService] Using backup data from mowerData map');
        }
        
        // If we still have no data, return empty
        if (!backupData) {
          console.log(`[MowerDataService] No data found for mower ${mowerId}`);
          return { tasks: [] };
        }
        
        // Debug: Log backup data structure
        console.log('[MowerDataService] Using backup data for schedule:', JSON.stringify(backupData, null, 2));
        
        const calendar = backupData.calendar || backupData.mowerData?.calendar;
        if (calendar && calendar.tasks) {
          console.log('[MowerDataService] Found tasks in backup data calendar:', calendar.tasks.length);
          return { tasks: calendar.tasks };
        }
        
        return { tasks: [] };
      }
      
      console.log(`[MowerDataService] Found mower data, extracting schedule`);
      
      // Check the model to help with debugging
      const modelName = mowerData.system?.model || 
                      mowerData.attributes?.system?.model || 
                      mowerData.mowerData?.attributes?.system?.model || 
                      'unknown';
      
      console.log(`[MowerDataService] Mower model: ${modelName}`);
      
      // VERBOSE DEBUGGING: Check for schedule data in every possible location
      console.log('[MowerDataService] DEBUG - checking for schedule data in all possible locations');
      
      // Direct property checks
      console.log('[MowerDataService] calendar property exists:', mowerData.calendar ? 'YES' : 'NO');
      console.log('[MowerDataService] calendar.tasks exists:', mowerData.calendar?.tasks ? 'YES' : 'NO');
      console.log('[MowerDataService] attributes exists:', mowerData.attributes ? 'YES' : 'NO');
      console.log('[MowerDataService] attributes.calendar exists:', mowerData.attributes?.calendar ? 'YES' : 'NO');
      console.log('[MowerDataService] attributes.calendar.tasks exists:', mowerData.attributes?.calendar?.tasks ? 'YES' : 'NO');
      console.log('[MowerDataService] mowerData property exists:', mowerData.mowerData ? 'YES' : 'NO');
      console.log('[MowerDataService] workAreas exists:', mowerData.workAreas ? 'YES' : 'NO');
      console.log('[MowerDataService] workAreas is array:', Array.isArray(mowerData.workAreas) ? 'YES' : 'NO');
      console.log('[MowerDataService] workAreas length:', mowerData.workAreas?.length || 0);
      
      if (mowerData.workAreas && mowerData.workAreas.length > 0) {
        // Check each work area for calendar data
        mowerData.workAreas.forEach((area, index) => {
          console.log(`[MowerDataService] Work area ${index} has attributes:`, area.attributes ? 'YES' : 'NO');
          console.log(`[MowerDataService] Work area ${index} has calendar:`, area.attributes?.calendar ? 'YES' : 'NO');
          console.log(`[MowerDataService] Work area ${index} has tasks:`, area.attributes?.calendar?.tasks ? 'YES' : 'NO');
          console.log(`[MowerDataService] Work area ${index} tasks length:`, area.attributes?.calendar?.tasks?.length || 0);
        });
      }
      
      // Check if data property exists (common in API responses)
      console.log('[MowerDataService] data property exists:', mowerData.data ? 'YES' : 'NO');
      if (mowerData.data) {
        console.log('[MowerDataService] data is array:', Array.isArray(mowerData.data) ? 'YES' : 'NO');
        console.log('[MowerDataService] data.attributes exists:', mowerData.data.attributes ? 'YES' : 'NO');
        console.log('[MowerDataService] data.attributes.calendar exists:', mowerData.data.attributes?.calendar ? 'YES' : 'NO');
        console.log('[MowerDataService] data.attributes.calendar.tasks exists:', mowerData.data.attributes?.calendar?.tasks ? 'YES' : 'NO');
      }
      
      // Also check if data is an array (some endpoints return array)
      if (Array.isArray(mowerData.data)) {
        console.log('[MowerDataService] data array length:', mowerData.data.length);
        mowerData.data.forEach((item, index) => {
          console.log(`[MowerDataService] data[${index}].attributes exists:`, item.attributes ? 'YES' : 'NO');
          console.log(`[MowerDataService] data[${index}].attributes.calendar exists:`, item.attributes?.calendar ? 'YES' : 'NO');
          console.log(`[MowerDataService] data[${index}].attributes.calendar.tasks exists:`, item.attributes?.calendar?.tasks ? 'YES' : 'NO');
        });
      }
      
      // Collect all tasks from different sources
      let allTasks: any[] = [];
      
      // IMPORTANT: For older models like 315X, check for direct calendar property first
      // 1. Check for top-level calendar (typical for older models)
      if ((mowerData as any).calendar?.tasks && Array.isArray((mowerData as any).calendar.tasks)) {
        const tasks = (mowerData as any).calendar.tasks;
        console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in top-level calendar property (typical for older models like 315X)`);
        allTasks = [...tasks];
      }
      // Also check in data.attributes.calendar which is common for older models
      else if ((mowerData as any).attributes?.calendar?.tasks && Array.isArray((mowerData as any).attributes.calendar.tasks)) {
        const tasks = (mowerData as any).attributes.calendar.tasks;
        console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in attributes.calendar (typical for older models)`);
        allTasks = [...tasks];
      }
      // Also check in data.mowerData.calendar
      else if ((mowerData as any).mowerData?.calendar?.tasks && Array.isArray((mowerData as any).mowerData.calendar.tasks)) {
        const tasks = (mowerData as any).mowerData.calendar.tasks;
        console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in mowerData.calendar`);
        allTasks = [...tasks];
      }
      // Also check in data.mowerData.attributes.calendar
      else if ((mowerData as any).mowerData?.attributes?.calendar?.tasks && Array.isArray((mowerData as any).mowerData.attributes.calendar.tasks)) {
        const tasks = (mowerData as any).mowerData.attributes.calendar.tasks;
        console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in mowerData.attributes.calendar`);
        allTasks = [...tasks];
      }
      // Check data.data.attributes if that structure exists
      else if ((mowerData as any).data?.attributes?.calendar?.tasks && Array.isArray((mowerData as any).data.attributes.calendar.tasks)) {
        const tasks = (mowerData as any).data.attributes.calendar.tasks;
        console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in data.attributes.calendar`);
        allTasks = [...tasks];
      }
      // Check data array if it exists
      else if (Array.isArray((mowerData as any).data)) {
        for (const item of (mowerData as any).data) {
          if (item?.attributes?.calendar?.tasks && Array.isArray(item.attributes.calendar.tasks)) {
            const tasks = item.attributes.calendar.tasks;
            console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in data[].attributes.calendar`);
            allTasks = [...tasks];
            break; // Use the first one we find
          }
        }
      }
      
      // If we found any tasks already, return them 
      if (allTasks.length > 0) {
        console.log(`[MowerDataService] Found ${allTasks.length} calendar tasks in top-level properties`);
        return { tasks: allTasks };
      }
      
      // 2. EPOS models: check for work areas with calendar tasks
      if ((mowerData as any).workAreas && Array.isArray((mowerData as any).workAreas) && (mowerData as any).workAreas.length > 0) {
        console.log(`[MowerDataService] Mower has ${(mowerData as any).workAreas.length} work areas, checking for calendar tasks (typical for EPOS models)`);
        
        for (const workArea of (mowerData as any).workAreas) {
          // Check if the work area has calendar tasks
          if (workArea && workArea.attributes && workArea.attributes.calendar && 
              workArea.attributes.calendar.tasks && Array.isArray(workArea.attributes.calendar.tasks)) {
            
            const workAreaName = workArea.attributes.name || `Work Area ${workArea.attributes.workAreaId || workArea.id}`;
            const taskCount = workArea.attributes.calendar.tasks.length;
            
            console.log(`[MowerDataService] Found ${taskCount} calendar tasks in work area "${workAreaName}"`);
            
            // Add work area ID to each task if not already present
            const tasksWithWorkAreaId = workArea.attributes.calendar.tasks.map((task: any) => {
              // Add workAreaId if not present in the task
              if (task.workAreaId === undefined) {
                return {
                  ...task,
                  workAreaId: workArea.attributes.workAreaId || workArea.id
                };
              }
              return task;
            });
            
            // Add these tasks to our collection
            allTasks = [...allTasks, ...tasksWithWorkAreaId];
          }
        }
      }
      
      // Also check in mowerData.mowerData.workAreas
      if (!allTasks.length && (mowerData as any).mowerData?.workAreas && 
          Array.isArray((mowerData as any).mowerData.workAreas) && (mowerData as any).mowerData.workAreas.length > 0) {
        console.log(`[MowerDataService] Found ${(mowerData as any).mowerData.workAreas.length} work areas in mowerData`);
        
        for (const workArea of (mowerData as any).mowerData.workAreas) {
          if (workArea && workArea.attributes && workArea.attributes.calendar && 
              workArea.attributes.calendar.tasks && Array.isArray(workArea.attributes.calendar.tasks)) {
            
            const workAreaName = workArea.attributes.name || `Work Area ${workArea.attributes.workAreaId || workArea.id}`;
            console.log(`[MowerDataService] Found ${workArea.attributes.calendar.tasks.length} calendar tasks in mowerData work area "${workAreaName}"`);
            
            const tasksWithWorkAreaId = workArea.attributes.calendar.tasks.map((task: any) => {
              if (task.workAreaId === undefined) {
                return {
                  ...task,
                  workAreaId: workArea.attributes.workAreaId || workArea.id
                };
              }
              return task;
            });
            
            allTasks = [...allTasks, ...tasksWithWorkAreaId];
          }
        }
      }
      
      // 3. If we have tasks from any source, return them
      if (allTasks.length > 0) {
        console.log(`[MowerDataService] Found ${allTasks.length} total calendar tasks`);
        return { tasks: allTasks };
      }
      
      // 4. Look for calendar tasks under data[].attributes.workAreas[].attributes.calendar.tasks
      // This structure has been seen in some API responses
      if ((mowerData as any).data && Array.isArray((mowerData as any).data)) {
        for (const dataItem of (mowerData as any).data) {
          if (dataItem.attributes?.workAreas && Array.isArray(dataItem.attributes.workAreas)) {
            console.log(`[MowerDataService] Found workAreas under data[].attributes, checking ${dataItem.attributes.workAreas.length} areas`);
            
            for (const workArea of dataItem.attributes.workAreas) {
              if (workArea.attributes?.calendar?.tasks && Array.isArray(workArea.attributes.calendar.tasks)) {
                const workAreaName = workArea.attributes.name || `Work Area ${workArea.attributes.workAreaId || workArea.id}`;
                console.log(`[MowerDataService] Found ${workArea.attributes.calendar.tasks.length} calendar tasks in data[].attributes.workAreas[].attributes.calendar.tasks for area "${workAreaName}"`);
                
                const tasksWithWorkAreaId = workArea.attributes.calendar.tasks.map((task: any) => {
                  if (task.workAreaId === undefined) {
                    return {
                      ...task,
                      workAreaId: workArea.attributes.workAreaId || workArea.id
                    };
                  }
                  return task;
                });
                
                allTasks = [...allTasks, ...tasksWithWorkAreaId];
              }
            }
          }
        }
      }
      
      // 5. Last resort - check for calendar tasks in potentially nested structures
      if (!allTasks.length) {
        console.log(`[MowerDataService] No calendar tasks found in standard locations, trying to find them in nested structures`);
        
        // Traverse the object looking for a 'tasks' array inside a 'calendar' object
        function findCalendarTasks(obj: any, path = ''): any[] | null {
          if (!obj || typeof obj !== 'object') return null;
          
          // Check if this object is a calendar with tasks
          if (obj.calendar && obj.calendar.tasks && Array.isArray(obj.calendar.tasks)) {
            console.log(`[MowerDataService] Found calendar tasks at path: ${path}.calendar.tasks`);
            return obj.calendar.tasks;
          }
          
          // Check if this object itself has tasks as an array
          if (obj.tasks && Array.isArray(obj.tasks)) {
            const isSuspectedCalendar = obj.tasks.some((task: any) => 
              task && (
                task.monday !== undefined || 
                task.tuesday !== undefined || 
                task.start !== undefined || 
                task.duration !== undefined
              )
            );
            
            if (isSuspectedCalendar) {
              console.log(`[MowerDataService] Found suspected calendar tasks at path: ${path}.tasks`);
              return obj.tasks;
            }
          }
          
          // Recursively check properties
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key] === 'object') {
              const result = findCalendarTasks(obj[key], `${path}.${key}`);
              if (result) return result;
            }
          }
          
          return null;
        }
        
        const tasks = findCalendarTasks(mowerData, 'mowerData');
        if (tasks) {
          console.log(`[MowerDataService] Found ${tasks.length} calendar tasks in nested structure`);
          allTasks = [...tasks];
        }
      }
      
      // 6. If we have tasks from any source (including nested discovery), return them
      if (allTasks.length > 0) {
        console.log(`[MowerDataService] Found ${allTasks.length} total calendar tasks after nested search`);
        return { tasks: allTasks };
      }
      
      // No calendar found anywhere
      console.log(`[MowerDataService] No schedule found for mower ${mowerId} with model ${modelName}`);
      return { tasks: [] };
    } catch (error) {
      console.error(`[MowerDataService] Error getting schedule:`, error);
      return { tasks: [] };
    }
  }
  
  /**
   * Get work areas for a mower formatted for schedule display
   * @param mowerId The ID of the mower to get work areas for
   * @returns An array of work areas or an empty array
   */
  getWorkAreasForSchedule(mowerId: string): any[] {
    // This method is preserved as a stub for future implementation
    console.log(`[MowerDataService] Work areas retrieval is disabled`);
    return [];
  }
  
  /**
   * Get mower data directly from Firebase
   * This method is preserved as a stub for future implementation
   */
  async getMowerFromFirebase(mowerId: string): Promise<any> {
    console.log(`[MowerDataService] Direct Firebase access disabled`);
    return null;
  }
  
  /**
   * Format work areas to a consistent format
   */
  private formatWorkAreas(areas: any[]): any[] {
    if (!areas || !Array.isArray(areas)) return this.createDefaultWorkArea();
    
    const colorPalette = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#f59e0b', // amber
      '#10b981', // emerald
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#ec4899'  // pink
    ];
    
    return areas.map((area: any, index: number) => {
      // If the area is already in the correct format, just return it
      if (area.id !== undefined && area.attributes !== undefined) {
        // Make sure it has a color
        if (!area.attributes.color) {
          area.attributes.color = colorPalette[index % colorPalette.length];
        }
        return area;
      }
      
      // Otherwise format it correctly
      return {
        id: area.workAreaId || area.id || index,
        attributes: {
          name: area.name || `Work Area ${area.workAreaId || index}`,
          workAreaId: area.workAreaId || index,
          color: area.color || colorPalette[index % colorPalette.length]
        }
      };
    });
  }
  
  /**
   * Create default work area when no data is available
   */
  private createDefaultWorkArea(): any[] {
    return [
      {
        id: '0',
        attributes: {
          name: 'Main Yard',
          workAreaId: 0,
          color: this.getColorForWorkArea(0)
        }
      }
    ];
  }
  
  /**
   * Get mower data synchronously (for internal use in non-async methods)
   * This is a simplified version that accesses the in-memory cache directly
   */
  private getMowerDataSync(mowerId: string): any {
    try {
      if (!mowerId) return null;
      
      // We'll use the existing method if possible, but handle it differently
      // since it's declared async but we need a sync version
      
      // First try Firebase data through the API we already have
      const firebaseData = this.getMowerFromCache?.(mowerId);
      if (firebaseData) {
        return firebaseData;
      }
      
      // If we have access to raw stored data, try using that
      if (this.rawMowerData && typeof this.rawMowerData === 'function') {
        return this.rawMowerData(mowerId);
      }
      
      // Last resort - try direct API call
      const apiData = husqvarnaApi.getMowerDirectly?.(mowerId);
      if (apiData) {
        return apiData;
      }
      
      // Nothing worked, return null
      return null;
    } catch (error) {
      console.error(`[MowerDataService] Error in getMowerDataSync: ${error}`);
      return null;
    }
  }
  
  /**
   * Helper method to access in-memory mower data
   * Private implementation detail that shouldn't be used directly
   */
  private rawMowerData(mowerId: string): any {
    // Attempt to access data directly from various caches
    
    try {
      // Check various possible data stores that might exist in this service
      // Use type assertion to avoid TypeScript indexing errors
      const self = this as any;
      
      for (const propName of ['mowerData', 'currentData', 'mowers', 'mowerCache', 'cachedData']) {
        // Try map-style collections first (most common)
        const mapData = self[propName];
        if (mapData && typeof mapData.get === 'function') {
          const data = mapData.get(mowerId);
          if (data) return data;
        }
        
        // Try object with properties next
        const objData = self[propName];
        if (objData && objData[mowerId]) {
          return objData[mowerId];
        }
      }
      
      // Try localStorage as a fallback
      if (typeof window !== 'undefined') {
        const localData = localStorage.getItem(`mower_data_${mowerId}`);
        if (localData) {
          return JSON.parse(localData);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error accessing mower data:', error);
      return null;
    }
  }
  
  /**
   * Get mower data from Firebase cache
   * This is a specialized method for the Husqvarna client
   */
  private getMowerFromCache(mowerId: string): any {
    try {
      if (!db) return null;
      
      // Since we can't use await here, we'll return null
      // The method is included for future compatibility
      return null;
    } catch (error) {
      console.error(`Error getting mower from cache: ${error}`);
      return null;
    }
  }
  
  /**
   * Dispatch a schedule update event to notify UI components
   */
  private dispatchScheduleUpdate(mowerId: string): void {
    // This method is preserved as a stub for future implementation
    console.log(`[MowerDataService] Schedule update event dispatching disabled`);
  }
  
  /**
   * Force inject test schedule data for testing purposes
   * This is preserved as a stub for future implementation
   */
  injectTestScheduleData(mowerId: string): void {
    console.log(`[MowerDataService] Test schedule data injection disabled`);
  }
  
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
      console.log("Starting to monitor all mowers with OPTIMIZED ARCHITECTURE (cache-first)");
      
      // STEP 1: Always try to load from Firebase/database cache first
      const cachedMowers = await this.loadCachedMowerData();
      let mowerList = [];

      // If we have cached data, use it first to render UI faster
      if (cachedMowers && cachedMowers.length > 0) {
        console.log(`Found ${cachedMowers.length} cached mowers to display immediately`);
        mowerList = cachedMowers.map(mower => ({
          id: mower.id,
          attributes: mower.mowerData?.attributes || mower.consolidated || {}
        }));
        
        // Dispatch event with cached data for immediate UI update
        this.dispatchAllMowersDataLoaded(mowerList, true);
        
        // Also ensure cached data is dispatched for individual mowers
        this.dispatchCachedMowerData(cachedMowers);
      }
      
      // STEP 2: Determine if we need to refresh the data from API
      // Check if the cache is stale or if it's been more than 30 minutes since last full refresh
      const needsFreshData = !cachedMowers || cachedMowers.length === 0 || this.isCacheStale(cachedMowers);
      const lastFullRefresh = typeof window !== 'undefined' ? 
        parseInt(localStorage.getItem('last_full_refresh') || '0', 10) : 0;
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      const refreshLimitExceeded = lastFullRefresh < thirtyMinutesAgo;
      
      // Connect WebSocket for real-time updates if possible
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
      
      // STEP 3: If needed, fetch fresh data, but only if refresh limit isn't exceeded
      if ((needsFreshData || !websocketConnected) && refreshLimitExceeded) {
        console.log("Cache is stale or WebSocket unavailable, fetching fresh data from API");
        
        // Store the timestamp of this full refresh attempt
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_full_refresh', Date.now().toString());
        }
        
        try {
          // Get all mowers from API
          const mowers = await husqvarnaApi.getMowers();
          
          if (mowers && mowers.length > 0) {
            console.log(`Found ${mowers.length} mowers from API to monitor`);
            mowerList = mowers;
            
            // For each mower, fetch comprehensive data in parallel with a slight delay between requests
            for (let i = 0; i < mowers.length; i++) {
              const mower = mowers[i];
              
              // Stagger requests to avoid throttling
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between mowers
              }
              
              console.log(`Fetching comprehensive data for mower ${i+1}/${mowers.length}: ${mower.id}`);
              
              try {
                // Use our new method to fetch all data at once
                await this.fetchComprehensiveMowerData(mower.id);
                
                // Set up lighter polling
                const adjustedInterval = websocketConnected ? interval * 3 : interval; // 15 min vs 5 min
                this.setupPollingForMower(mower.id, adjustedInterval);
              } catch (error) {
                console.error(`Error fetching comprehensive data for mower ${mower.id}:`, error);
                // Continue with next mower
              }
            }
            
            // Dispatch event with fresh data
            this.dispatchAllMowersDataLoaded(mowerList, false);
          } else {
            console.warn("No mowers found to monitor");
          }
        } catch (apiError) {
          console.error("Error fetching mowers from API:", apiError);
          // Continue with cached data if available
        }
      } else {
        console.log("Using cached data with WebSocket updates, skipping initial API fetch");
        
        // If using cached data, still set up polling for each mower
        if (cachedMowers && cachedMowers.length > 0) {
          for (const mower of cachedMowers) {
            // Set up lighter polling if WebSocket is connected
            const adjustedInterval = websocketConnected ? interval * 3 : interval; // 15 min vs 5 min
            this.setupPollingForMower(mower.id, adjustedInterval);
          }
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
      
      // Fetch calendar data directly using the specialized endpoint
      let calendarData = { tasks: [] };
      try {
        // Get model name for optimized calendar fetching
        const modelName = mowerData.attributes?.system?.model || '';
        calendarData = await husqvarnaApi.getMowerCalendar(mowerId, modelName);
        console.log(`✅ Successfully retrieved calendar data with ${calendarData.tasks?.length || 0} tasks for mower ${mowerId}`);
      } catch (calendarError) {
        console.warn(`⚠️ Could not fetch calendar data: ${calendarError}`);
      }
      
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
      await this.storeMowerData(mowerId, mowerData, workAreasData, calendarData);
      
      // Check for errors
      this.checkForErrorsAndNotify(mowerId, mowerData);
      
      // Dispatch event for UI updates
      this.dispatchMowerDataUpdated(mowerId, {
        type: 'api_update',
        mowerData,
        workAreas: workAreasData,
        calendar: calendarData
      });
      
      return { mowerData, workAreasData, calendarData };
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
  private async storeMowerData(mowerId: string, mowerData: any, workAreasData: any, calendarData: any = null) {
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
        calendar: calendarData || (mowerData?.attributes?.calendar || null),
      }, { merge: true });
      
      // Store in history collection
      await addDoc(collection(db, MOWERS_COLLECTION, mowerId, HISTORY_COLLECTION), {
        timestamp,
        type: "api_update",
        mowerData,
        workAreas: workAreasData,
        calendar: calendarData || (mowerData?.attributes?.calendar || null),
      });
      
      console.log(`✅ Successfully stored data for mower ${mowerId} in Firebase with ${workAreasData?.length || 0} work areas and ${calendarData?.tasks?.length || 0} schedule tasks`);
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
  private async handleWebSocketMessage(message: any): Promise<void> {
    try {
      // Skip ping messages
      if (message.type === 'ping') return;
      
      console.log(`[MowerDataService] Received WebSocket message: ${message.type}`);
      
      // Extract mower ID
      const mowerId = message.id;
      
      // Skip messages without mower ID
      if (!mowerId) {
        console.error(`[MowerDataService] Message has no mower ID:`, message);
        return;
      }
      
      // Use our dedicated handler to ensure consistent processing
      // This centralizes all the handling logic in one place
      await this.handleWebSocketEvent(mowerId, message);
      
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
      
      // If this is a calendar update, explicitly dispatch a schedule update
      if (eventType === 'calendar' || eventType === 'calendar-event-v2') {
        console.log(`[MowerDataService] Calendar data updated for mower ${mowerId}, dispatching schedule update`);
        this.dispatchScheduleUpdate(mowerId);
      }
      
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
        status: this.deriveStatus(data),

        // Add work area progress information to the consolidated data
        areaComplete: data.workAreaProgress?.areaComplete || data.areaComplete,
        workAreaProgress: data.workAreaProgress?.areas || data.workAreaProgress
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
    
    console.log(`Dispatching cached data for ${mowers.length} mowers`);
    
    // Dispatch each mower as an update event
    mowers.forEach(mower => {
      // Get consolidated data if available, otherwise use mowerData
      const mowerData = mower.consolidated || mower.mowerData || mower;
      
      this.dispatchMowerDataUpdated(mower.id, {
        type: 'cached_data',
        data: mowerData,
        isSignificantChange: false,
        fromCache: true
      });
      
      // Also check if we have the workAreas in cache
      const workAreasCache = localStorage.getItem(`work_areas_${mower.id}`);
      if (workAreasCache) {
        try {
          const parsedCache = JSON.parse(workAreasCache);
          console.log(`Found cached work areas for mower ${mower.id}:`, parsedCache.data?.length || 0);
          
          // Dispatch work areas specific update
          this.dispatchMowerDataUpdated(mower.id, {
            type: 'work_areas_update',
            data: { workAreas: parsedCache.data },
            isSignificantChange: false,
            fromCache: true
          });
        } catch (e) {
          console.error(`Error parsing cached work areas for mower ${mower.id}:`, e);
        }
      }
    });
    
    // Also dispatch a consolidated update event
    window.dispatchEvent(new CustomEvent('mowers-data-updated', {
      detail: {
        mowers,
        source: 'cache'
      }
    }));
  }

  /**
   * Check if calendar data has changed
   */
  private hasCalendarChanged(previousData: any, newData: any): boolean {
    if (!previousData || !newData) return true;
    
    // Check direct calendar property
    if (previousData.calendar?.tasks && newData.calendar?.tasks) {
      if (JSON.stringify(previousData.calendar.tasks) !== JSON.stringify(newData.calendar.tasks)) {
        return true;
      }
    }
    
    // Check calendar in attributes
    if (previousData.attributes?.calendar?.tasks && newData.attributes?.calendar?.tasks) {
      if (JSON.stringify(previousData.attributes.calendar.tasks) !== 
          JSON.stringify(newData.attributes.calendar.tasks)) {
        return true;
      }
    }
    
    // Check calendar in mowerData
    if (previousData.mowerData?.calendar?.tasks && newData.mowerData?.calendar?.tasks) {
      if (JSON.stringify(previousData.mowerData.calendar.tasks) !== 
          JSON.stringify(newData.mowerData.calendar.tasks)) {
        return true;
      }
    }
    
    // No calendar changes detected
    return false;
  }

  /**
   * Get the last change timestamp for a mower
   * Returns the timestamp of the last significant change for the mower
   * @param mowerId The ID of the mower
   * @returns The timestamp in milliseconds or null if not available
   */
  getLastChangeTimestamp(mowerId: string): number | null {
    try {
      // Try to get the timestamp from our internal map
      const self = this as any;
      
      // Check if we have a lastChangeTimestamps map
      if (self.lastChangeTimestamps && typeof self.lastChangeTimestamps.get === 'function') {
        const timestamp = self.lastChangeTimestamps.get(mowerId);
        
        if (timestamp) {
          return timestamp;
        }
      }
      
      // If we don't have a lastChangeTimestamps map, check other places
      // Try to get the timestamp from the stored data
      const mowerData = this.getMowerDataSync(mowerId);
      if (mowerData && mowerData.lastChangeTimestamp) {
        return mowerData.lastChangeTimestamp;
      }
      
      // If we have a lastUpdated property, use that as a fallback
      if (mowerData && mowerData.lastUpdated) {
        // Convert to number if it's a Date object
        if (mowerData.lastUpdated instanceof Date) {
          return mowerData.lastUpdated.getTime();
        }
        // If it's a Firestore timestamp, it might have a toMillis method
        if (mowerData.lastUpdated.toMillis && typeof mowerData.lastUpdated.toMillis === 'function') {
          return mowerData.lastUpdated.toMillis();
        }
        // If it's a number, return it directly
        if (typeof mowerData.lastUpdated === 'number') {
          return mowerData.lastUpdated;
        }
      }
      
      // No timestamp found
      return null;
    } catch (error) {
      console.error(`[MowerDataService] Error getting last change timestamp for mower ${mowerId}:`, error);
      return null;
    }
  }

  /**
   * Start listening for updates for a specific mower
   * @param mowerId The ID of the mower to listen for
   */
  startListening(mowerId: string): void {
    console.log(`[MowerDataService] Starting to listen for updates for mower: ${mowerId}`);
    
    // Add this mower to the active listeners set
    const self = this as any;
    
    if (!self.activeListeners) {
      self.activeListeners = new Set();
    }
    
    self.activeListeners.add(mowerId);
    
    // Start polling for this mower if we're not already
    if (self.pollingIntervals && !self.pollingIntervals[mowerId]) {
      this.setupPollingForMower?.(mowerId);
    }
  }
  
  /**
   * Stop listening for updates for a specific mower
   * @param mowerId The ID of the mower to stop listening for
   */
  stopListening(mowerId: string): void {
    console.log(`[MowerDataService] Stopping listener for mower: ${mowerId}`);
    
    // Remove this mower from the active listeners set
    const self = this as any;
    
    if (self.activeListeners) {
      self.activeListeners.delete(mowerId);
    }
    
    // Stop polling for this mower
    if (self.pollingIntervals && self.pollingIntervals[mowerId]) {
      clearInterval(self.pollingIntervals[mowerId]);
      delete self.pollingIntervals[mowerId];
    }
  }
  
  /**
   * Get the next start time from planner data
   * @param data The mower data object
   * @returns An object with the next start timestamp and formatted time
   */
  getNextStartTime(data: any): { timestamp: number, formatted: string } {
    if (!data || !data.planner || data.planner.nextStartTimestamp === undefined) {
      return { timestamp: 0, formatted: 'Unknown' };
    }
    
    // Get the timestamp
    const timestamp = data.planner.nextStartTimestamp;
    
    // Format the timestamp for display
    let formatted = 'Unknown';
    
    try {
      // Convert to Date
      const date = new Date(timestamp);
      
      // Determine if it's today, tomorrow, or a future date
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Same day
      if (date.toDateString() === today.toDateString()) {
        formatted = `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } 
      // Tomorrow
      else if (date.toDateString() === tomorrow.toDateString()) {
        formatted = `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } 
      // Future date
      else {
        formatted = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    } catch (error) {
      console.error(`[MowerDataService] Error formatting next start time:`, error);
    }
    
    return { timestamp, formatted };
  }
  
  /**
   * Update the UI status of a mower based on its data
   * @param mowerId The ID of the mower
   * @param data The mower data
   * @returns An object with the UI status and charging indicator
   */
  updateMowerUIStatus(mowerId: string, data: any): { uiStatus: string, isChargingWhileParked: boolean } {
    if (!data) {
      return { uiStatus: 'offline', isChargingWhileParked: false };
    }
    
    // Extract activity and state from data
    const activity = data.mower?.activity;
    const state = data.mower?.state;
    const batteryLevel = data.battery?.batteryPercent || 0;
    
    // Map the state to a UI status
    const uiStatus = this.mapMowerStateToUIState(activity, state, batteryLevel);
    
    // Check if the mower is parked but also charging
    const isChargingWhileParked = activity === 'PARKED_IN_CS' && batteryLevel < 100;
    
    return { uiStatus, isChargingWhileParked };
  }
  
  /**
   * Map the mower state to a UI status
   * @param activity The mower activity
   * @param state The mower state
   * @param batteryLevel The battery level
   * @returns A string representing the UI status
   */
  mapMowerStateToUIState(activity?: string, state?: string, batteryLevel: number = 100): string {
    // Handle offline case
    if (!activity || !state || activity === 'UNKNOWN' || state === 'UNKNOWN') {
      return 'offline';
    }
    
    // Handle error cases
    if (state === 'ERROR' || state === 'FATAL_ERROR' || state === 'ERROR_AT_POWER_UP' || state === 'STOPPED') {
      return 'error';
    }
    
    // Handle main activity states
    switch (activity) {
      case 'MOWING':
        return 'mowing';
      case 'GOING_HOME':
        return 'returning';
      case 'CHARGING':
        return 'charging';
      case 'PARKED_IN_CS':
        // Only show as charging if the battery isn't full
        return batteryLevel < 100 ? 'charging' : 'parked';
      case 'STOPPED_IN_GARDEN':
        return state === 'PAUSED' ? 'paused' : 'idle';
      case 'LEAVING':
        return 'leaving';
      case 'NOT_APPLICABLE':
        return 'offline';
      default:
        // For any other state, map based on the state value
        if (state === 'PAUSED') {
          return 'paused';
        }
        if (state === 'IN_OPERATION') {
          return 'online';
        }
        return 'idle';
    }
  }
  
  /**
   * Update mower data in storage
   * @param mowerId The ID of the mower to update
   * @param updateData The data to update
   */
  async updateMowerData(mowerId: string, updateData: any): Promise<boolean> {
    try {
      console.log(`[MowerDataService] Updating mower data for ${mowerId}:`, updateData);
      
      // Update in-memory data
      const self = this as any;
      
      // Check if we have a currentData map
      if (self.currentData && typeof self.currentData.get === 'function') {
        const currentData = self.currentData.get(mowerId) || {};
        self.currentData.set(mowerId, { ...currentData, ...updateData });
      }
      
      // If db is available, update in Firebase too
      if (db) {
        try {
          // Ensure Firebase functions are available
          if (!doc || !setDoc) {
            await initFirebase();
          }
          
          // Update the mower data in Firebase
          if (doc && setDoc) {
            const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
            await setDoc(mowerRef, {
              ...updateData,
              lastUpdated: serverTimestamp ? serverTimestamp() : new Date()
            }, { merge: true });
          }
        } catch (firebaseError) {
          console.error(`[MowerDataService] Firebase update error:`, firebaseError);
          // Continue with in-memory update even if Firebase fails
        }
      }
      
      // Dispatch an event about this update
      this.dispatchMowerDataUpdated?.(mowerId, updateData, true);
      
      return true;
    } catch (error) {
      console.error(`[MowerDataService] Error updating mower data:`, error);
      return false;
    }
  }
  
  /**
   * Refresh the data for a specific mower
   * @param mowerId The ID of the mower to refresh
   */
  async refreshMowerData(mowerId: string): Promise<boolean> {
    try {
      console.log(`[MowerDataService] Manually refreshing data for mower ${mowerId}`);
      
      // Use our comprehensive data fetching method
      // This fetches ALL data at once for maximum efficiency
      const comprehensiveData = await this.fetchComprehensiveMowerData(mowerId);
      
      // Additional dispatch to ensure UI components are notified of the refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mower-refresh-complete', {
          detail: {
            mowerId,
            timestamp: Date.now(),
            source: 'manual-refresh',
            data: comprehensiveData
          }
        }));
      }
      
      console.log(`[MowerDataService] Manual refresh completed for mower ${mowerId}`);
      return true;
    } catch (error) {
      console.error(`[MowerDataService] Error refreshing mower data:`, error);
      return false;
    }
  }
  
  /**
   * Dispatch a mower data updated event
   * @param mowerId The ID of the mower
   * @param data The updated data
   * @param isSignificantChange Whether this is a significant change
   */
  private dispatchMowerDataUpdated(mowerId: string, data: any, isSignificantChange = false): void {
    if (typeof window === 'undefined') return;
    
    // Get the last change timestamp
    const lastChangeTimestamp = isSignificantChange ? Date.now() : this.getLastChangeTimestamp(mowerId);
    
    // Create and dispatch a custom event
    window.dispatchEvent(new CustomEvent('mower-data-updated', {
      detail: {
        mowerId,
        data,
        isSignificantChange,
        lastChangeTimestamp
      }
    }));
    
    // Also dispatch a mower-specific event
    window.dispatchEvent(new CustomEvent(`mower-${mowerId}-updated`, {
      detail: {
        mowerId,
        data,
        isSignificantChange,
        lastChangeTimestamp
      }
    }));
  }
  
  /**
   * Get mower schedule data directly from Firebase
   * This method is preserved as a stub for future implementation
   */
  async getScheduleFromFirebase(mowerId: string): Promise<any> {
    console.log(`[MowerDataService] Schedule data retrieval disabled`);
    return { tasks: [] };
  }

  /**
   * Asynchronous version of getScheduleForMower that will fetch from API if needed
   * @param mowerId The ID of the mower
   * @returns A promise that resolves to the schedule data
   */
  async getScheduleForMowerAsync(mowerId: string): Promise<any> {
    try {
      console.log(`[MowerDataService] Getting schedule data for mower ${mowerId} (async version)`);
      
      // First try to get the data from cache using the synchronous method
      const cachedSchedule = this.getScheduleForMower(mowerId);
      
      // If we have tasks in cache, use them
      if (cachedSchedule.tasks && cachedSchedule.tasks.length > 0) {
        console.log(`[MowerDataService] Using cached schedule with ${cachedSchedule.tasks.length} tasks`);
        return cachedSchedule;
      }
      
      // No cached data, fetch directly from API
      console.log(`[MowerDataService] No cached schedule found, fetching from API for mower ${mowerId}`);
      
      // Try to get the mower data to determine model
      let modelName = '';
      const mowerData = await this.getMowerData(mowerId);
      if (mowerData?.mowerData?.attributes?.system?.model) {
        modelName = mowerData.mowerData.attributes.system.model;
      }
      
      // Fetch schedule from API
      const apiSchedule = await husqvarnaApi.getMowerCalendar(mowerId, modelName);
      
      // Store the fetched schedule data
      if (apiSchedule.tasks && apiSchedule.tasks.length > 0) {
        // Save in Firebase/cache for future use
        await this.updateMowerData(mowerId, { calendar: apiSchedule });
        console.log(`[MowerDataService] Fetched and stored ${apiSchedule.tasks.length} tasks from API`);
      } else {
        console.log(`[MowerDataService] No tasks found in API response`);
      }
      
      return apiSchedule;
    } catch (error) {
      console.error(`[MowerDataService] Error getting schedule for mower ${mowerId}:`, error);
      return { tasks: [] };
    }
  }

  /**
   * Fetch comprehensive data for a mower - ALL data points in one operation
   * This fetches everything available from the Husqvarna API and stores it in Firebase
   */
  async fetchComprehensiveMowerData(mowerId: string): Promise<any> {
    console.log(`🔄 Fetching ALL available data for mower ${mowerId}`);
    
    try {
      // Create an object to store all the data
      const comprehensiveData: any = {
        id: mowerId,
        lastUpdated: new Date(),
        fetchedAt: new Date()
      };
      
      // STEP 1: Get basic mower data
      const mowerData = await husqvarnaApi.getMower(mowerId);
      comprehensiveData.mowerData = mowerData;
      console.log(`✅ Basic mower data retrieved for ${mowerId}`);
      
      // Get model name for use in subsequent requests
      const modelName = mowerData?.attributes?.system?.model || '';
      comprehensiveData.modelName = modelName;
      
      // Create set of promises to fetch all data in parallel
      // We'll await them together to complete faster but avoid hammering a single endpoint
      const promises = [];
      
      // STEP 2: Get calendar data (schedule)
      promises.push(
        (async () => {
          try {
            const calendarData = await husqvarnaApi.getMowerCalendar(mowerId, modelName);
            comprehensiveData.calendar = calendarData;
            console.log(`✅ Calendar data retrieved with ${calendarData?.tasks?.length || 0} tasks`);
          } catch (error) {
            console.warn(`⚠️ Could not fetch calendar data: ${error}`);
          }
        })()
      );
      
      // STEP 3: Get work areas data
      promises.push(
        (async () => {
          try {
            const workAreasData = await husqvarnaApi.getMowerWorkAreas(mowerId);
            comprehensiveData.workAreas = this.formatWorkAreas(workAreasData);
            console.log(`✅ Retrieved ${workAreasData?.length || 0} work areas`);
            
            // Extract work area progress data if available
            const workAreasWithProgress = workAreasData.filter((area: any) => 
              area && area.attributes && typeof area.attributes.progress === 'number'
            );
            
            if (workAreasWithProgress.length > 0) {
              console.log(`✅ Found ${workAreasWithProgress.length} work areas with progress information`);
              
              // Calculate average progress percentage
              const totalProgress = workAreasWithProgress.reduce(
                (sum: number, area: any) => sum + (area.attributes.progress || 0), 
                0
              );
              
              const avgProgress = Math.round(totalProgress / workAreasWithProgress.length);
              
              // Add progress information to comprehensive data
              comprehensiveData.areaComplete = `${avgProgress}%`;
              comprehensiveData.workAreaProgress = workAreasWithProgress.map((area: any) => ({
                workAreaId: area.attributes.workAreaId || parseInt(area.id, 10),
                name: area.attributes.name || `Work Area ${area.attributes.workAreaId || area.id}`,
                progress: area.attributes.progress || 0,
                lastCompleted: area.attributes.lastTimeCompleted
              }));
              
              console.log(`✅ Average work area completion: ${avgProgress}%`);
            }
            
            // Cache in localStorage for quicker access
            if (typeof window !== 'undefined') {
              localStorage.setItem(`work_areas_${mowerId}`, JSON.stringify({
                data: comprehensiveData.workAreas,
                timestamp: Date.now()
              }));
            }
          } catch (error) {
            console.warn(`⚠️ Could not fetch work areas: ${error}`);
            
            // Try to create work areas from calendar data as fallback
            const createWorkAreasFromCalendar = async () => {
              try {
                // Wait for calendar data to be available (if running in parallel)
                if (!comprehensiveData.calendar && comprehensiveData.mowerData?.attributes?.calendar) {
                  comprehensiveData.calendar = comprehensiveData.mowerData.attributes.calendar;
                }
                
                if (comprehensiveData.calendar?.tasks) {
                  const workAreaIds = new Set<number>();
                  comprehensiveData.calendar.tasks.forEach(task => {
                    if (task.workAreaId !== undefined) {
                      workAreaIds.add(task.workAreaId);
                    }
                  });
                  
                  if (workAreaIds.size > 0) {
                    comprehensiveData.workAreas = this.createWorkAreasFromIds(Array.from(workAreaIds));
                    console.log(`✅ Created ${comprehensiveData.workAreas.length} work areas from calendar data`);
                  }
                }
              } catch (e) {
                console.warn(`⚠️ Error creating work areas from calendar: ${e}`);
              }
            };
            
            promises.push(createWorkAreasFromCalendar());
          }
        })()
      );
      
      // STEP 4: Get error messages data
      promises.push(
        (async () => {
          try {
            const messagesData = await husqvarnaApi.getMowerMessages(mowerId);
            comprehensiveData.messages = messagesData;
            console.log(`✅ Retrieved messages data with ${messagesData?.messages?.length || 0} messages`);
          } catch (error) {
            console.warn(`⚠️ Could not fetch messages data: ${error}`);
          }
        })()
      );
      
      // STEP 5: Get statistics data
      promises.push(
        (async () => {
          try {
            const statisticsData = await husqvarnaApi.getMowerStatistics(mowerId);
            comprehensiveData.statistics = statisticsData;
            console.log(`✅ Retrieved statistics data`);
          } catch (error) {
            console.warn(`⚠️ Could not fetch statistics data: ${error}`);
          }
        })()
      );
      
      // STEP 6: Get settings data
      promises.push(
        (async () => {
          try {
            const settingsData = await husqvarnaApi.getMowerSettings(mowerId);
            comprehensiveData.settings = settingsData;
            console.log(`✅ Retrieved settings data`);
          } catch (error) {
            console.warn(`⚠️ Could not fetch settings data: ${error}`);
          }
        })()
      );
      
      // STEP 7: Get stay out zones data (if model supports it)
      if (mowerData?.attributes?.capabilities?.stayOutZones) {
        promises.push(
          (async () => {
            try {
              const stayOutZonesData = await husqvarnaApi.getMowerStayOutZones(mowerId);
              comprehensiveData.stayOutZones = stayOutZonesData;
              console.log(`✅ Retrieved stay out zones data with ${stayOutZonesData?.zones?.length || 0} zones`);
            } catch (error) {
              console.warn(`⚠️ Could not fetch stay out zones data: ${error}`);
            }
          })()
        );
      }
      
      // Wait for all promises to complete
      await Promise.allSettled(promises);
      console.log(`✅ All data fetch operations completed for mower ${mowerId}`);
      
      // STEP 8: Store everything in Firebase
      await this.storeComprehensiveMowerData(mowerId, comprehensiveData);
      
      // Dispatch events to update UI
      this.dispatchMowerDataUpdated(mowerId, { 
        type: 'comprehensive_update',
        data: comprehensiveData,
        isSignificantChange: true
      });
      
      return comprehensiveData;
    } catch (error) {
      console.error(`❌ Error fetching comprehensive data for mower ${mowerId}:`, error);
      await this.logError(mowerId, "comprehensive_fetch_error", error);
      throw error;
    }
  }

  /**
   * Store comprehensive mower data in Firebase
   * Store everything in the main document with additional collections for time-series data
   */
  async storeComprehensiveMowerData(mowerId: string, data: any): Promise<void> {
    try {
      console.log(`💾 Storing comprehensive data for mower ${mowerId} in Firebase...`);
      
      if (!db) {
        console.error('❌ Firestore not initialized');
        return;
      }
      
      // Get current time
      const timestamp = serverTimestamp();
      
      // Preserve existing area completion data if new data doesn't have it
      if (!data.areaComplete || !data.workAreaProgress) {
        try {
          const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
          const mowerDoc = await getDoc(mowerRef);
          
          if (mowerDoc.exists()) {
            const existingData = mowerDoc.data();
            if (!data.areaComplete && existingData.areaComplete) {
              data.areaComplete = existingData.areaComplete;
            }
            if (!data.workAreaProgress && existingData.workAreaProgress) {
              data.workAreaProgress = existingData.workAreaProgress;
            }
            console.log(`✅ Preserved existing area completion data for mower ${mowerId}`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not retrieve existing area completion data: ${error}`);
        }
      }
      
      // Construct the document to store
      const docData = {
        lastUpdated: timestamp,
        id: mowerId,
        mowerData: data.mowerData || null,
        calendar: data.calendar || null,
        workAreas: data.workAreas || [],
        statistics: data.statistics || null,
        settings: data.settings || null,
        messages: data.messages || null,
        stayOutZones: data.stayOutZones || null,
        
        // Include work area progress data if available
        areaComplete: data.areaComplete || null,
        workAreaProgress: data.workAreaProgress || null,
        
        // Create a consolidated view of the most important data
        consolidated: {
          id: mowerId,
          name: data.mowerData?.attributes?.system?.name || 'Unknown Mower',
          model: data.mowerData?.attributes?.system?.model || 'Unknown Model',
          serialNumber: data.mowerData?.attributes?.system?.serialNumber,
          batteryPercent: data.mowerData?.attributes?.battery?.batteryPercent,
          state: data.mowerData?.attributes?.mower?.state,
          activity: data.mowerData?.attributes?.mower?.activity,
          mode: data.mowerData?.attributes?.mower?.mode,
          errorCode: data.mowerData?.attributes?.mower?.errorCode || 0,
          isConnected: data.mowerData?.attributes?.metadata?.connected,
          statusTimestamp: data.mowerData?.attributes?.metadata?.statusTimestamp,
          positions: data.mowerData?.attributes?.positions || [],
          nextStartTimestamp: data.mowerData?.attributes?.planner?.nextStartTimestamp,
          restrictedReason: data.mowerData?.attributes?.planner?.restrictedReason,
          
          // Include area completion data in consolidated view
          areaComplete: data.areaComplete || null,
          workAreaProgress: data.workAreaProgress || null
        }
      };
      
      // Reference to the mower document
      const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
      
      // Update the main document
      await setDoc(mowerRef, docData, { merge: true });
      
      // Also store in history collection for time-series data
      await addDoc(collection(db, MOWERS_COLLECTION, mowerId, HISTORY_COLLECTION), {
        timestamp,
        type: "api_refresh",
        ...docData
      });
      
      // For each data type, store it separately for efficient access
      const storeSeparately = async (dataType, dataValue) => {
        if (!dataValue) return;
        
        try {
          await setDoc(doc(db, MOWERS_COLLECTION, mowerId, DATA_COLLECTION, dataType), {
            value: dataValue,
            lastUpdated: timestamp
          });
        } catch (e) {
          console.warn(`Failed to store ${dataType} separately: ${e}`);
        }
      };
      
      // Store important data separately for quicker access
      await storeSeparately('mowerData', data.mowerData);
      await storeSeparately('calendar', data.calendar);
      await storeSeparately('workAreas', data.workAreas);
      await storeSeparately('statistics', data.statistics);
      await storeSeparately('settings', data.settings);
      await storeSeparately('messages', data.messages);
      await storeSeparately('stayOutZones', data.stayOutZones);
      await storeSeparately('consolidated', docData.consolidated);
      
      console.log(`✅ Successfully stored comprehensive data for mower ${mowerId} in Firebase`);
    } catch (error) {
      console.error(`❌ Error storing comprehensive mower data for ${mowerId}:`, error);
      
      // Still try to store the data that was successfully fetched
      try {
        const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
        await setDoc(mowerRef, {
          lastUpdated: serverTimestamp(),
          lastError: {
            timestamp: new Date(),
            message: error.toString(),
            type: 'store_comprehensive_error'
          }
        }, { merge: true });
      } catch (e) {
        console.error(`❌ Failed to store error information: ${e}`);
      }
    }
  }

  /**
   * Create work areas with meaningful names from ID list
   */
  private createWorkAreasFromIds(workAreaIds: number[]): any[] {
    const workAreaNames = [
      'Main Yard',
      'Front Yard',
      'Back Yard',
      'Side Area',
      'Garden',
      'Patio Area',
      'Driveway'
    ];
    
    return workAreaIds.map((id, index) => ({
      id: id.toString(),
      attributes: {
        name: workAreaNames[index % workAreaNames.length],
        workAreaId: id,
        color: this.getColorForWorkArea(id)
      }
    }));
  }

  /**
   * Enhanced method to get mower work areas with improved caching
   * This method provides friendly names even when API data is unavailable
   */
  async getEnhancedWorkAreas(mowerId: string): Promise<any[]> {
    try {
      console.log(`[MowerDataService] Getting enhanced work areas for mower ${mowerId}`);
      
      // First try to get from localStorage cache
      const cachedData = typeof window !== 'undefined' ? 
        localStorage.getItem(`work_areas_${mowerId}`) : null;
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // Use cache if less than 24 hours old (work areas change rarely)
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          console.log(`[MowerDataService] Using cached work areas for mower ${mowerId}`);
          return data;
        }
      }
      
      // Try to get from API
      try {
        const workAreas = await husqvarnaApi.getMowerWorkAreas(mowerId);
        
        if (workAreas && workAreas.length > 0) {
          console.log(`[MowerDataService] Got ${workAreas.length} work areas from API for mower ${mowerId}`);
          
          // Format and cache the data
          const formattedAreas = this.formatWorkAreas(workAreas);
          
          if (typeof window !== 'undefined') {
            localStorage.setItem(`work_areas_${mowerId}`, JSON.stringify({
              data: formattedAreas,
              timestamp: Date.now()
            }));
          }
          
          return formattedAreas;
        }
      } catch (apiError) {
        console.warn(`[MowerDataService] Error getting work areas from API: ${apiError}`);
        // Continue to fallback methods
      }
      
      // Fallback to schedule data if available
      try {
        const scheduleData = await this.getScheduleForMowerAsync(mowerId);
        if (scheduleData && scheduleData.tasks) {
          // Extract work area IDs from schedule
          const workAreaIds = new Set<number>();
          
          scheduleData.tasks.forEach(task => {
            if (task.workAreaId !== undefined) {
              workAreaIds.add(task.workAreaId);
            }
          });
          
          if (workAreaIds.size > 0) {
            console.log(`[MowerDataService] Creating work areas from schedule for mower ${mowerId}`);
            
            // Create descriptive names based on location
            const areas = this.createWorkAreasFromIds(Array.from(workAreaIds));
            
            // Cache these areas too
            if (typeof window !== 'undefined') {
              localStorage.setItem(`work_areas_${mowerId}`, JSON.stringify({
                data: areas,
                timestamp: Date.now()
              }));
            }
            
            return areas;
          }
        }
      } catch (scheduleError) {
        console.warn(`[MowerDataService] Error creating work areas from schedule: ${scheduleError}`);
      }
      
      // Final fallback - create default areas with meaningful names
      console.log(`[MowerDataService] Creating default work areas for mower ${mowerId}`);
      const defaultAreas = [
        {
          id: '0',
          attributes: {
            name: 'Main Yard',
            workAreaId: 0,
            color: this.getColorForWorkArea(0)
          }
        },
        {
          id: '1',
          attributes: {
            name: 'Front Yard',
            workAreaId: 1,
            color: this.getColorForWorkArea(1)
          }
        },
        {
          id: '2',
          attributes: {
            name: 'Back Yard',
            workAreaId: 2,
            color: this.getColorForWorkArea(2)
          }
        }
      ];
      
      // Cache these default areas too
      if (typeof window !== 'undefined') {
        localStorage.setItem(`work_areas_${mowerId}`, JSON.stringify({
          data: defaultAreas,
          timestamp: Date.now()
        }));
      }
      
      return defaultAreas;
    } catch (error) {
      console.error(`[MowerDataService] Error in getEnhancedWorkAreas: ${error}`);
      return this.createDefaultWorkArea();
    }
  }

  /**
   * Get a consistent color for a work area based on its ID
   */
  private getColorForWorkArea(workAreaId: number): string {
    const colorPalette = [
      '#10b981', // emerald
      '#3b82f6', // blue
      '#8b5cf6', // violet
      '#f59e0b', // amber
      '#ef4444', // red
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#84cc16', // lime
      '#a855f7', // purple
      '#14b8a6', // teal
      '#f97316', // orange
      '#06aed4', // sky
      '#dc2626'  // rose
    ];
    
    return colorPalette[workAreaId % colorPalette.length];
  }

  /**
   * Dispatch area completion update event
   * This is specifically for zone completion progress updates
   */
  dispatchAreaCompletionUpdate(mowerId: string, areaComplete: string, workAreaProgress?: any[]): void {
    if (typeof window !== 'undefined') {
      console.log(`[MowerDataService] Dispatching area completion update for mower ${mowerId}: ${areaComplete}`);
      
      window.dispatchEvent(new CustomEvent('mower-area-completion-updated', { 
        detail: { 
          mowerId, 
          areaComplete,
          workAreaProgress,
          timestamp: Date.now()
        } 
      }));
    }
  }

  /**
   * Handle a WebSocket event from the Husqvarna WebSocket API
   */
  async handleWebSocketEvent(mowerId: string, message: any): Promise<void> {
    try {
      console.log(`[MowerDataService] Handling WebSocket event for mower ${mowerId}: ${message.type}`);
      
      // Skip ping events
      if (message.type === 'ping') return;
      
      // Process different event types
      switch (message.type) {
        case 'position-event-v2':
        case 'position': 
          // Store the position data in Firebase
          await this.storeEventData(mowerId, 'position', message.attributes.position);
          break;
        
        case 'battery-event-v2':
        case 'battery':
          await this.storeEventData(mowerId, 'battery', message.attributes.battery);
          break;
        
        case 'mower-event-v2':
        case 'mower':
          await this.storeEventData(mowerId, 'mower', message.attributes.mower);
          break;
        
        case 'work-area-event-v2':
          // Handle work area updates
          if (message.attributes.workAreas) {
            // Store the full work areas data
            await this.storeEventData(mowerId, 'workAreas', {
              areas: message.attributes.workAreas,
              lastUpdated: serverTimestamp()
            });
            
            // Extract and handle work area progress data
            try {
              // Find areas with progress information
              const workAreasWithProgress = message.attributes.workAreas.filter((area: any) => 
                area && area.attributes && typeof area.attributes.progress === 'number'
              );
              
              if (workAreasWithProgress.length > 0) {
                console.log(`Found ${workAreasWithProgress.length} work areas with progress data for mower ${mowerId}`);
                
                // Calculate overall area completion percentage
                const totalProgress = workAreasWithProgress.reduce(
                  (sum: number, area: any) => sum + (area.attributes.progress || 0), 
                  0
                );
                
                const avgProgress = Math.round(totalProgress / workAreasWithProgress.length);
                
                // Format the work area progress data
                const formattedWorkAreaProgress = workAreasWithProgress.map((area: any) => ({
                  workAreaId: area.attributes.workAreaId || parseInt(area.id, 10),
                  name: area.attributes.name || `Work Area ${area.attributes.workAreaId || area.id}`,
                  progress: area.attributes.progress || 0,
                  lastCompleted: area.attributes.lastTimeCompleted
                }));
                
                // Store area progress information
                await this.storeEventData(mowerId, 'workAreaProgress', {
                  areaComplete: `${avgProgress}%`,
                  areas: formattedWorkAreaProgress,
                  lastUpdated: serverTimestamp()
                });
                
                // Also update the top-level document with this data for easier access
                await this.updateMowerData(mowerId, {
                  areaComplete: `${avgProgress}%`,
                  workAreaProgress: formattedWorkAreaProgress
                });
                
                // Update the consolidated data
                await this.updateConsolidatedMowerData(mowerId);
                
                // Dispatch a dedicated event for area completion updates
                this.dispatchAreaCompletionUpdate(
                  mowerId, 
                  `${avgProgress}%`, 
                  formattedWorkAreaProgress
                );
                
                console.log(`Updated area completion for mower ${mowerId}: ${avgProgress}%`);
              }
            } catch (progressError) {
              console.error(`Error processing work area progress for mower ${mowerId}:`, progressError);
            }
          }
          break;
      }
    } catch (error) {
      console.error(`Error handling WebSocket event for mower ${mowerId}:`, error);
    }
  }
} 