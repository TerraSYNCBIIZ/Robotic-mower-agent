import { HUSQVARNA_API } from './config';

// Types for Husqvarna API responses and requests
export interface MowerData {
  id: string;
  attributes: {
    system: {
      name: string;
      model: string;
    };
    battery: {
      batteryPercent: number;
    };
    mower: {
      mode: string;
      activity: string;
      state: string;
      errorCode: number;
      errorCodeTimestamp: number;
    };
    positions: {
      latitude: number;
      longitude: number;
    }[];
    calendar?: {
      tasks?: Array<{
        start: number;
        duration: number;
        monday?: boolean;
        tuesday?: boolean;
        wednesday?: boolean;
        thursday?: boolean;
        friday?: boolean;
        saturday?: boolean;
        sunday?: boolean;
        zones?: Array<{
          name?: string;
          id?: number;
        }>;
        workAreaId?: number;
      }>;
    };
    zones?: {
      name: string;
      color?: string;
      id?: number;
    }[];
    workAreas?: WorkArea[];
  };
}

export interface WorkArea {
  id: number;
  attributes: {
    name: string;
    workAreaId: number;
    cuttingHeight?: number;
    enabled?: boolean;
  };
}

export interface HusqvarnaAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  provider: string;
  user_id: string;
  token_type: string;
}

// Zones interface
export interface ZoneData {
  name: string;
  color: string;
  workAreaId?: number;
  boundaries?: Array<{lat: number, lng: number}>;
}

// Define interface for work area data
interface WorkAreaData {
  type: string;
  id: string;
  attributes: {
    name?: string;
    workAreaId?: string;
    cuttingHeight?: number;
    enabled?: boolean;
    progress?: number;
    lastTimeCompleted?: number;
    // Add other properties as needed
  };
}

// Define interface for detailed work area attributes
interface WorkAreaAttributes {
  name?: string; 
  workAreaId?: string;
  cuttingHeight?: number;
  enabled?: boolean;
  progress?: number;
  lastTimeCompleted?: number;
  // Add other properties as needed
}

// Define interface for zone data with additional properties
interface EnhancedZoneData extends ZoneData {
  cuttingHeight?: number;
  enabled?: boolean;
  progress?: number;
  lastCompleted?: number;
  [key: string]: any; // Allow for additional properties
}

// Define a type for calendar tasks
interface CalendarTask {
  start: number;
  duration: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  workAreaId?: number;
  workAreaName?: string;
  [key: string]: any; // Allow additional properties
}

// Class to handle Husqvarna API requests
export class HusqvarnaClient {
  private appKey: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private authToken: string;
  private apiEndpoint = 'https://api.amc.husqvarna.dev/v1';

  constructor(authToken?: string) {
    // Ensure credentials are properly trimmed
    this.appKey = HUSQVARNA_API.APP_KEY.trim();
    this.clientSecret = HUSQVARNA_API.CLIENT_SECRET.trim();
    this.authToken = authToken || '';
    
    // Use the authToken as the initial accessToken if provided
    if (authToken) {
      this.accessToken = authToken;
    }
  }

  // Get the access token (for internal API use)
  getAccessToken(): string | null {
    return this.accessToken;
  }
  
  // Get the API key
  getApiKey(): string {
    return this.appKey;
  }
  
  // Set the access token (for initialization after login)
  setAccessToken(token: string): void {
    if (token) {
      console.log('Setting access token for API client');
      this.accessToken = token;
    }
  }
  
  // Check if the client is authenticated
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Generate the login URL for the user to authorize the application
  getAuthorizationUrl(redirectUri: string): string {
    // Trim the appKey to remove any potential whitespace
    const trimmedAppKey = this.appKey.trim();
    return `${HUSQVARNA_API.OAUTH_AUTHORIZE_URL}?client_id=${trimmedAppKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('iam:read amc:api')}`;
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code: string, redirectUri: string): Promise<HusqvarnaAuthResponse> {
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    // Trim credentials to remove any whitespace
    params.set('client_id', this.appKey.trim());
    params.set('client_secret', this.clientSecret.trim());
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
    // Add the amc:api scope which is required for WebSocket connections
    params.set('scope', 'iam:read amc:api');

    try {
      // Log params for debugging (excluding client_secret)
      const codeParam = params.get('code');
      console.log('Token request params:', {
        grant_type: params.get('grant_type'),
        client_id: params.get('client_id'),
        code: codeParam ? codeParam.substring(0, 10) + '...' : 'N/A',
        redirect_uri: params.get('redirect_uri'),
        scope: params.get('scope'),
      });
      
      const response = await fetch(HUSQVARNA_API.OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString(),
        cache: 'no-store'
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        let errorDetails = '';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorDetails = JSON.stringify(errorData);
          } else {
            errorDetails = await response.text();
          }
        } catch (e) {
          errorDetails = 'Could not parse error response';
        }
        
        throw new Error(`Failed to get tokens: ${response.statusText}, details: ${errorDetails}`);
      }

      const data = await response.json() as HusqvarnaAuthResponse;
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || null;
      
      // Set token expiry
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + data.expires_in);
      this.tokenExpiry = expiryDate;
      
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Refresh the access token using the refresh token
  async refreshAccessToken(): Promise<HusqvarnaAuthResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('client_id', this.appKey);
    params.set('refresh_token', this.refreshToken);
    // Add the amc:api scope which is required for WebSocket connections
    params.set('scope', 'iam:read amc:api');

    const response = await fetch(HUSQVARNA_API.OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json() as HusqvarnaAuthResponse;
    this.accessToken = data.access_token;
    
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    
    // Set token expiry
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + data.expires_in);
    this.tokenExpiry = expiryDate;
    
    return data;
  }

  // Get all mowers connected to the user's account
  async getMowers(): Promise<MowerData[]> {
    try {
      console.log('🔄 Fetching mowers from Husqvarna API...');
      console.log('🔑 Using token:', this.accessToken ? 'Token available' : 'No token');
      
      // Use proxy API to avoid CORS issues with absolute URL
      // This works in both browser and server environments
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:3000';
        
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.api+json',
        'X-Api-Key': this.appKey,
        'Authorization-Provider': 'husqvarna'
      };
      
      // Add authorization header if token is available
      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        console.log('🔐 Added token to request headers');
      } else {
        console.warn('⚠️ No token available for API request');
      }
      
      console.log('📤 Sending request to API proxy with headers:', 
        Object.keys(headers).join(', '));
        
      const response = await fetch(`${baseUrl}/api/proxy/mowers`, {
        method: 'GET',
        headers,
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        let errorBody: any;
        try {
          // Try to get JSON error response
          errorBody = await response.json();
        } catch (e) {
          // Fall back to text if not JSON
          errorBody = await response.text();
        }
        
        console.error(`🚫 Failed to fetch mowers: ${response.status} ${response.statusText}`, errorBody);
        
        // Log detailed error for missing authorization header
        if (errorBody && errorBody.errors && errorBody.errors[0]?.code === 'missing.authorization.header') {
          console.error('🔑 Missing Authorization header error. Token:', 
            this.accessToken ? this.accessToken.substring(0, 10) + '...' : 'None',
            'Headers sent:', Object.keys(headers));
        }
        
        // Special handling for 401/403 errors - likely auth issue
        if (response.status === 401 || response.status === 403) {
          console.error('🔑 Authentication error - token may be invalid or expired');
          // Return empty array instead of throwing to prevent cascading errors
          return [];
        }
        
        throw new Error(`Failed to fetch mowers: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Successfully retrieved mowers data:', 
        responseData.data ? `Found ${responseData.data.length} mowers` : 'No mowers in response');
      return responseData.data || [];
    } catch (error) {
      console.error('❌ Error fetching mowers:', error);
      // Return empty array instead of throwing to prevent UI errors
      return [];
    }
  }
  
  // Helper method to get the base URL for API calls
  private getBaseUrl(): string {
    return typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:3000';
  }
  
  // Helper to create headers with authorization
  private getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'X-Api-Key': this.appKey,
      'Authorization-Provider': 'husqvarna'
    };
    
    // Add authorization header if token is available
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    console.log('API Request Headers:', Object.keys(headers).join(', '));
    
    return headers;
  }

  /**
   * Helper method to determine if a mower is EPOS or Ceora model
   * These models use a different endpoint for calendar data
   */
  private isEPOSorCeora(model: string): boolean {
    if (!model) return false;
    return model.includes('550') || 
           model.toUpperCase().includes('EPOS') || 
           model.toUpperCase().includes('CEORA');
  }

  // Get details for a specific mower
  async getMower(mowerId: string): Promise<MowerData> {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Use proxy API to avoid CORS issues
      // Explicitly include calendar parameter to ensure we get schedule data
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}?include=calendar`, {
        method: 'GET',
        headers: this.getRequestHeaders(),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`🚫 Failed to fetch mower data: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to fetch mower data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Log calendar data specifically to debug schedule issues
      if (data.data?.attributes?.calendar) {
        console.log(`[API] Calendar data for mower ${mowerId}:`, 
          JSON.stringify(data.data.attributes.calendar, null, 2));
      } else {
        console.log(`[API] No calendar data found for mower ${mowerId}`);
      }
      
      return data.data;
    } catch (error) {
      console.error(`❌ Error fetching mower ${mowerId}:`, error);
      throw error;
    }
  }

  /**
   * Get calendar data for a mower, specifically designed to handle both EPOS and standard models
   * @param mowerId The ID of the mower
   * @param model The mower model string (used to determine if it's an EPOS model)
   * @param workAreaId Optional work area ID for EPOS models
   * @returns Promise resolving to calendar data structure
   */
  async getMowerCalendar(mowerId: string, model?: string, workAreaId?: number): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Check if it's an EPOS/NERA/550/520/CEORA model
      const isEposMower = model && (
        model.includes('EPOS') || 
        model.includes('NERA') || 
        model.includes('550') || 
        model.includes('520') ||
        model.includes('CEORA')
      );
      
      // ENHANCED APPROACH FOR EPOS MODELS:
      // 1. Get all work areas first to identify which areas exist and their names
      // 2. Fetch individual work area calendars for each area
      // 3. Combine into a single calendar with proper area identification
      if (isEposMower) {
        console.log(`[API] EPOS model detected (${model}), using enhanced approach for calendar`);
        
        try {
          // Step 1: Get all work areas for the mower
          const workAreasUrl = `${baseUrl}/api/proxy/mowers/${mowerId}/workAreas`;
          console.log(`[API] Fetching all work areas from: ${workAreasUrl}`);
          
          const workAreasResponse = await fetch(workAreasUrl, {
            method: 'GET',
            headers: this.getRequestHeaders(),
            credentials: 'include',
          });
          
          if (!workAreasResponse.ok) {
            console.log(`[API] Failed to get work areas, status: ${workAreasResponse.status}`);
            // Will continue with fallback approaches
          } else {
            const workAreasData = await workAreasResponse.json();
            const workAreas = workAreasData?.data || [];
            
            if (Array.isArray(workAreas) && workAreas.length > 0) {
              console.log(`[API] Found ${workAreas.length} work areas for EPOS mower`);
              console.log(`[API] Raw work areas response:`, JSON.stringify(workAreas, null, 2));
              
              // Collect all tasks from all work areas
              const allTasks: any[] = [];
              
              // Step 2: Fetch calendar for each work area separately using our dedicated method
              // This ensures we preserve exact scheduling information
              for (const area of workAreas) {
                const areaId = area.attributes?.workAreaId;
                if (areaId === undefined) continue;
                
                // Use our dedicated method to get accurate calendar data for this work area
                const workAreaCalendar = await this.getMowerWorkAreaCalendar(mowerId, areaId);
                
                if (workAreaCalendar.tasks && workAreaCalendar.tasks.length > 0) {
                  console.log(`[API] Adding ${workAreaCalendar.tasks.length} tasks from work area "${workAreaCalendar.workAreaName}"`);
                  
                  // Log the day settings for each task to ensure they're correct
                  workAreaCalendar.tasks.forEach((task: any, i: number) => {
                    console.log(`[API] Task ${i} from work area ${areaId} day settings:`, {
                      monday: task.monday,
                      tuesday: task.tuesday,
                      wednesday: task.wednesday,
                      thursday: task.thursday,
                      friday: task.friday,
                      saturday: task.saturday,
                      sunday: task.sunday
                    });
                    
                    // Count enabled days
                    const enabledDays = [
                      task.monday === true,
                      task.tuesday === true,
                      task.wednesday === true,
                      task.thursday === true,
                      task.friday === true,
                      task.saturday === true,
                      task.sunday === true
                    ].filter(Boolean).length;
                    
                    console.log(`[API] Task ${i} from work area ${areaId} has ${enabledDays} enabled days`);
                    
                    // Explicitly validate that we have boolean values for each day
                    const nonBooleanDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                      .filter(day => typeof task[day] !== 'boolean');
                    
                    if (nonBooleanDays.length > 0) {
                      console.warn(`[API] Task ${i} from work area ${areaId} has non-boolean values for days: ${nonBooleanDays.join(', ')}`);
                      
                      // Ensure days are properly set as boolean
                      const fixedTask = {...task};
                      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                        if (typeof fixedTask[day] !== 'boolean') {
                          // Only set to true if the value is explicity true (string 'true' or number 1)
                          const value = fixedTask[day];
                          fixedTask[day] = value === true || value === 'true' || value === 1;
                          console.log(`[API] Fixed day ${day} from ${value} to ${fixedTask[day]}`);
                        }
                      });
                      
                      // Replace the task in the array
                      workAreaCalendar.tasks[i] = fixedTask;
                    }
                  });
                  
                  // Add tasks to our collection, preserving all original properties
                  allTasks.push(...workAreaCalendar.tasks);
                } else {
                  console.log(`[API] No tasks found for work area ${areaId}`);
                }
              }
              
              // If we found tasks from any work area, return them
              if (allTasks.length > 0) {
                console.log(`[API] Successfully retrieved ${allTasks.length} tasks from ${workAreas.length} work areas`);
                console.log(`[API] Sample task data:`, allTasks.length > 0 ? JSON.stringify(allTasks[0], null, 2) : 'No tasks');
                return { tasks: allTasks };
              }
              
              console.log(`[API] No tasks found in any work areas, falling back to standard endpoints`);
            } else {
              console.log(`[API] No work areas found for EPOS mower, falling back to standard endpoints`);
            }
          }
        } catch (eposError) {
          console.log(`[API] Error in EPOS enhanced approach:`, eposError);
          // Will continue with fallback approaches
        }
      }
      
      // For specific work areas, if requested
      if (isEposMower && workAreaId !== undefined) {
        try {
          // First get the work area name if we can
          let workAreaName = `Area ${workAreaId}`;
          try {
            const areaResponse = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas/${workAreaId}`, {
              method: 'GET',
              headers: this.getRequestHeaders(),
              credentials: 'include',
            });
            
            if (areaResponse.ok) {
              const areaData = await areaResponse.json();
              if (areaData?.data?.attributes?.name) {
                workAreaName = areaData.data.attributes.name;
                console.log(`[API] Found name "${workAreaName}" for work area ${workAreaId}`);
              }
            }
          } catch (nameError) {
            console.log(`[API] Error getting name for work area ${workAreaId}:`, nameError);
          }
          
          const workAreaUrl = `${baseUrl}/api/proxy/mowers/${mowerId}/workAreas/${workAreaId}/calendar`;
          console.log(`[API] Fetching from work area calendar endpoint: ${workAreaUrl}`);
          
          const workAreaResponse = await fetch(workAreaUrl, {
            method: 'GET',
            headers: this.getRequestHeaders(),
            credentials: 'include',
          });
          
          if (workAreaResponse.ok) {
            const data = await workAreaResponse.json();
            console.log(`[API] Work area calendar response:`, JSON.stringify(data, null, 2));
            
            // EPOS response format check
            if (data?.data?.attributes?.tasks && data.data.attributes.tasks.length > 0) {
              console.log(`[API] Successfully retrieved ${data.data.attributes.tasks.length} calendar tasks for work area ${workAreaId}`);
              
              // Add workAreaId to each task if not already present
              const enhancedTasks = data.data.attributes.tasks.map((task: CalendarTask) => ({
                ...task,
                workAreaId: task.workAreaId !== undefined ? task.workAreaId : workAreaId,
                workAreaName: workAreaName
              }));
              
              return { tasks: enhancedTasks };
            }
          }
        } catch (eposError) {
          console.log(`[API] Error fetching work area calendar: ${eposError}`);
        }
      }
      
      // Step 2: Try the standard calendar endpoint for all models
      try {
        const standardUrl = `${baseUrl}/api/proxy/mowers/${mowerId}/calendar`;
        console.log(`[API] Fetching from standard calendar endpoint: ${standardUrl}`);
        
        const standardResponse = await fetch(standardUrl, {
          method: 'GET',
          headers: this.getRequestHeaders(),
          credentials: 'include',
        });
        
        if (standardResponse.ok) {
          const data = await standardResponse.json();
          console.log(`[API] Standard calendar response:`, JSON.stringify(data, null, 2));
          
          // Many models return data in this format
          if (data?.data?.attributes?.tasks && data.data.attributes.tasks.length > 0) {
            const tasks = data.data.attributes.tasks;
            console.log(`[API] Successfully retrieved ${tasks.length} standard calendar tasks`);
            
            // For EPOS models, try to enhance tasks with work area information
            if (isEposMower) {
              // Get work area names and add them to the tasks
              try {
                const workAreasResponse = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas`, {
                  method: 'GET',
                  headers: this.getRequestHeaders(),
                  credentials: 'include',
                });
                
                if (workAreasResponse.ok) {
                  const workAreasData = await workAreasResponse.json();
                  const workAreas = workAreasData?.data || [];
                  
                  // Create a map of work area IDs to names
                  const workAreaNames: Record<string, string> = {};
                  if (Array.isArray(workAreas)) {
                    workAreas.forEach(area => {
                      if (area.attributes?.workAreaId !== undefined) {
                        workAreaNames[area.attributes.workAreaId] = area.attributes?.name || `Area ${area.attributes.workAreaId}`;
                      }
                    });
                  }
                  
                  // Enhance tasks with work area names
                  const enhancedTasks = tasks.map((task: CalendarTask) => {
                    if (task.workAreaId !== undefined && workAreaNames[task.workAreaId]) {
                      return {
                        ...task,
                        workAreaName: workAreaNames[task.workAreaId]
                      };
                    }
                    return task;
                  });
                  
                  return { tasks: enhancedTasks };
                }
              } catch (enhanceError) {
                console.log(`[API] Error enhancing tasks with work area names:`, enhanceError);
              }
            }
            
            return data.data.attributes;
          }
        }
      } catch (standardError) {
        console.log(`[API] Error fetching standard calendar: ${standardError}`);
      }
      
      // Step 3: For older models (like 315X), try to get calendar data directly from mower endpoint
      try {
        console.log(`[API] Trying to extract calendar from mower data as final fallback`);
        const mowerUrl = `${baseUrl}/api/proxy/mowers/${mowerId}?include=calendar`;
        
        const mowerResponse = await fetch(mowerUrl, {
          method: 'GET',
          headers: this.getRequestHeaders(),
          credentials: 'include',
        });
        
        if (mowerResponse.ok) {
          const data = await mowerResponse.json();
          console.log(`[API] Mower data calendar section:`, 
                     JSON.stringify(data?.data?.attributes?.calendar, null, 2));
          
          // Standard format for older models like the 315X
          if (data?.data?.attributes?.calendar?.tasks) {
            const tasks = data.data.attributes.calendar.tasks;
            console.log(`[API] Successfully retrieved ${tasks.length} calendar tasks from mower data`);
            
            // Even for older models, try to enhance with work area names if possible
            try {
              // Get work area names for any tasks with workAreaId
              const tasksWithWorkAreaIds = tasks.filter((t: any) => t.workAreaId !== undefined);
              if (tasksWithWorkAreaIds.length > 0) {
                const workAreasResponse = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas`, {
          method: 'GET',
          headers: this.getRequestHeaders(),
          credentials: 'include',
        });
        
                if (workAreasResponse.ok) {
                  const workAreasData = await workAreasResponse.json();
                  const workAreas = workAreasData?.data || [];
                  
                  // Create a map of work area IDs to names
                  const workAreaNames: Record<string, string> = {};
                  if (Array.isArray(workAreas)) {
                    workAreas.forEach((area: any) => {
                      if (area.attributes?.workAreaId !== undefined) {
                        workAreaNames[area.attributes.workAreaId] = area.attributes?.name || 
                          `Area ${area.attributes.workAreaId}`;
                      }
                    });
                  }
                  
                  // Enhance tasks with work area names
                  const enhancedTasks = tasks.map((task: any) => {
                    if (task.workAreaId !== undefined && workAreaNames[task.workAreaId]) {
                      return {
                        ...task,
                        workAreaName: workAreaNames[task.workAreaId]
                      };
                    }
                    return task;
                  });
                  
                  return { tasks: enhancedTasks };
                }
              }
            } catch (err) {
              console.log(`[API] Error enhancing older model tasks with work area names:`, err);
            }
            
            return { tasks };
          }
        }
      } catch (mowerError) {
        console.log(`[API] Error fetching mower data for calendar: ${mowerError}`);
      }
      
      // Return empty tasks array if all methods failed
      console.log(`[API] No calendar tasks found for mower ${mowerId} after trying all methods`);
      return { tasks: [] };
    } catch (error) {
      console.error(`[API] Error in getMowerCalendar: ${error}`);
      return { tasks: [] };
    }
  }

  // Send a command to the mower (e.g., start, pause, park)
  async sendCommand(mowerId: string, command: string, attributes?: Record<string, any>): Promise<void> {
    let requestBody;
    
    // Handle legacy command strings and convert to proper Husqvarna API format
    if (command === 'start' || command === 'pause' || command === 'park' || 
        command === 'parkUntilNext' || command === 'resume') {
      // Legacy string command conversion
      switch (command) {
        case 'start':
          requestBody = {
            data: {
              type: 'Start',
              attributes: {
                duration: attributes?.duration || 240
              }
            }
          };
          break;
        case 'pause':
          requestBody = {
            data: {
              type: 'Pause'
            }
          };
          break;
        case 'park':
          requestBody = {
            data: {
              type: 'ParkUntilFurtherNotice'
            }
          };
          break;
        case 'parkUntilNext':
          requestBody = {
            data: {
              type: 'ParkUntilNextSchedule'
            }
          };
          break;
        case 'resume':
          requestBody = {
            data: {
              type: 'ResumeSchedule'
            }
          };
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } else {
      // Direct API command format (new approach)
      requestBody = {
        data: {
          type: command,
          ...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {})
        }
      };
    }

    try {
      const baseUrl = this.getBaseUrl();
      
      console.log(`📤 Sending ${command} command to mower ${mowerId}:`, JSON.stringify(requestBody, null, 2));
      
      // Use proxy API to avoid CORS issues
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/actions`, {
        method: 'POST',
        headers: this.getRequestHeaders(),
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`🚫 Failed to send command: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to send command: ${response.status} ${response.statusText}`);
      }
      
      console.log(`✅ Command ${command} successfully sent to mower ${mowerId}`);
      
      // Try to parse the response
      try {
        const responseData = await response.json();
        console.log('Command response:', responseData);
      } catch (parseError) {
        // If the response is not JSON, just log that we received a response
        console.log('Command successful - response body not JSON or empty');
      }
    } catch (error) {
      console.error(`❌ Error sending command to mower ${mowerId}:`, error);
      throw error;
    }
  }

  // Add this method to the HusqvarnaClient class
  async getZonesForMower(mowerId: string): Promise<EnhancedZoneData[]> {
    try {
      const workAreasData = await this.getWorkAreas(mowerId);
      
      // Map work areas to zone objects with enhanced information
      const workPromises = workAreasData.data.map(async (workArea: WorkAreaData) => {
        const workAreaId = workArea.id;
        const name = workArea.attributes?.name || `Area ${workAreaId}`;
        
        // Get more detailed information for each work area
        const additionalInfo: Partial<EnhancedZoneData> = {};
        
        try {
          // For work areas with actual IDs (not just '0'), get detailed info
          if (workAreaId !== '0') {
            const detailedData = await this.getWorkArea(mowerId, workAreaId);
            
            // Extract size/acreage information if available
            // The API doesn't have a direct acreage field but might have related information
            additionalInfo.cuttingHeight = detailedData.cuttingHeight;
            additionalInfo.enabled = detailedData.enabled;
            additionalInfo.progress = detailedData.progress;
            additionalInfo.lastCompleted = detailedData.lastTimeCompleted;
            // You can add any other relevant attributes here
          }
        } catch (error) {
          // Silently handle errors for individual work areas
        }
        
        // Assign a color based on work area ID for consistency
        const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#84cc16', '#14b8a6'];
        const colorIndex = Number.parseInt(workAreaId, 10) % colors.length;
        const color = colors[Math.max(0, colorIndex)];

        return {
          name,
          color,
          workAreaId,
          ...additionalInfo
        };
      });
      
      const zones = await Promise.all(workPromises);
      return zones;
      
    } catch (error) {
      return [];
    }
  }

  async getWorkAreas(mowerId: string) {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Use proxy API to avoid CORS issues
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas`, {
        method: 'GET',
        headers: this.getRequestHeaders(),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`🚫 Failed to fetch work areas: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to fetch work areas: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Error fetching work areas for mower ${mowerId}:`, error);
      throw error;
    }
  }

  // Gets detailed information for a specific work area
  async getWorkArea(mowerId: string, workAreaId: string) {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Use proxy API to avoid CORS issues
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas/${workAreaId}`, {
        method: 'GET',
        headers: this.getRequestHeaders(),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`🚫 Failed to fetch work area details: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to fetch work area details: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.attributes;
    } catch (error) {
      console.error(`❌ Error fetching work area details for mower ${mowerId}, work area ${workAreaId}:`, error);
      throw error;
    }
  }

  // Add this method to get detailed work area schedules
  async getMowerWorkAreas(mowerId: string): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Use proxy API to avoid CORS issues
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas`, {
        method: 'GET',
        headers: this.getRequestHeaders(),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`🚫 Failed to fetch work areas: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to fetch work areas: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Work areas data for mower ${mowerId}:`, JSON.stringify(data, null, 2));
      return data.data || [];
    } catch (error) {
      console.error("Error fetching work areas:", error);
      return [];
    }
  }
  
  /**
   * Get WebSocket authentication token directly from Husqvarna API
   * This is needed to connect to the WebSocket API for real-time updates
   */
  async getWebSocketAuthToken(additionalHeaders?: HeadersInit): Promise<{ token: string; wsProxyUrl?: string; apiKey?: string }> {
    try {
      console.log('Fetching WebSocket authentication token...');
      const baseUrl = this.getBaseUrl();
      
      // Use proxy API to avoid CORS issues - use main websocket endpoint
      const headers = {
        ...this.getRequestHeaders(),
        ...(additionalHeaders || {})
      };
      
      const response = await fetch(`${baseUrl}/api/proxy/websocket`, {
        method: 'GET',
        headers,
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Failed to get WebSocket token: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to get WebSocket token: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.token) {
        throw new Error('Invalid WebSocket auth response: missing token');
      }
      
      console.log('Successfully obtained WebSocket token');
      return { token: data.token, wsProxyUrl: data.wsProxyUrl, apiKey: this.appKey };
    } catch (error) {
      console.error('Error getting WebSocket auth token:', error);
      throw error;
    }
  }

  /**
   * Update a mower's schedule
   * @param mowerId The ID of the mower to update
   * @param scheduleData Array of schedule tasks
   */
  async updateMowerSchedule(mowerId: string, scheduleData: any[]): Promise<void> {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Prepare the schedule update payload in the format the API expects
      const requestBody = {
        data: {
          type: 'UpdateCalendar',
          attributes: {
            tasks: scheduleData
          }
        }
      };
      
      console.log(`Sending schedule update for mower ${mowerId}:`, JSON.stringify(requestBody, null, 2));
      
      // Use proxy API to avoid CORS issues
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/calendar`, {
        method: 'PUT',
        headers: this.getRequestHeaders(),
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`🚫 Failed to update schedule: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to update schedule: ${response.status} ${response.statusText}`);
      }
      
      console.log('✅ Successfully updated mower schedule');
    } catch (error) {
      console.error(`❌ Error updating schedule for mower ${mowerId}:`, error);
      throw error;
    }
  }

  /**
   * Get calendar data for a specific work area of a mower
   * This method directly accesses the specific work area calendar endpoint
   * @param mowerId The ID of the mower
   * @param workAreaId The ID of the work area
   * @returns Promise resolving to calendar data for the specific work area
   */
  async getMowerWorkAreaCalendar(mowerId: string, workAreaId: number): Promise<any> {
    try {
      const baseUrl = this.getBaseUrl();
      
      // First get the work area name if we can
      let workAreaName = `Area ${workAreaId}`;
      try {
        const areaResponse = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}/workAreas/${workAreaId}`, {
          method: 'GET',
          headers: this.getRequestHeaders(),
          credentials: 'include',
        });
        
        if (areaResponse.ok) {
          const areaData = await areaResponse.json();
          // Log the raw response for debugging
          console.log(`[API] Raw work area data for ${workAreaId}:`, JSON.stringify(areaData, null, 2));
          
          if (areaData?.data?.attributes?.name) {
            workAreaName = areaData.data.attributes.name;
            console.log(`[API] Found name "${workAreaName}" for work area ${workAreaId}`);
          }
        }
      } catch (nameError) {
        console.log(`[API] Error getting name for work area ${workAreaId}:`, nameError);
      }
      
      // Now fetch the calendar for this specific work area
      const workAreaUrl = `${baseUrl}/api/proxy/mowers/${mowerId}/workAreas/${workAreaId}/calendar`;
      console.log(`[API] Fetching from specific work area calendar endpoint: ${workAreaUrl}`);
      
      const workAreaResponse = await fetch(workAreaUrl, {
        method: 'GET',
        headers: this.getRequestHeaders(),
        credentials: 'include',
      });
      
      if (workAreaResponse.ok) {
        const data = await workAreaResponse.json();
        // Log the raw calendar response for debugging
        console.log(`[API] Work area calendar raw response:`, JSON.stringify(data, null, 2));
        
        // EPOS response format check
        if (data?.data?.attributes?.tasks && Array.isArray(data.data.attributes.tasks)) {
          const tasks = data.data.attributes.tasks;
          console.log(`[API] Successfully retrieved ${tasks.length} calendar tasks for work area ${workAreaId}`);
          
          // Log the original task day settings before any modifications
          if (tasks.length > 0) {
            const sampleTask = tasks[0];
            console.log(`[API] Original sample task day settings for ${workAreaId}:`, {
              monday: sampleTask.monday,
              tuesday: sampleTask.tuesday,
              wednesday: sampleTask.wednesday,
              thursday: sampleTask.thursday,
              friday: sampleTask.friday,
              saturday: sampleTask.saturday,
              sunday: sampleTask.sunday
            });
          }
          
          // IMPORTANT: Do not modify the day settings - preserve exactly which days are scheduled
          const enhancedTasks = tasks.map((task: any) => {
            const enhancedTask = {
              ...task,
              workAreaId: task.workAreaId !== undefined ? task.workAreaId : workAreaId,
              workAreaName: workAreaName
            };
            
            return enhancedTask;
          });
          
          // Log the enhanced task day settings to verify they're unchanged
          if (enhancedTasks.length > 0) {
            const sampleTask = enhancedTasks[0];
            console.log(`[API] Enhanced sample task day settings for ${workAreaId}:`, {
              monday: sampleTask.monday,
              tuesday: sampleTask.tuesday,
              wednesday: sampleTask.wednesday,
              thursday: sampleTask.thursday,
              friday: sampleTask.friday,
              saturday: sampleTask.saturday,
              sunday: sampleTask.sunday
            });
          }
          
          return { 
            workAreaId,
            workAreaName,
            tasks: enhancedTasks 
          };
        }
      }
      
      // Return empty tasks if no calendar found
      return { 
        workAreaId,
        workAreaName,
        tasks: [] 
      };
      
    } catch (error) {
      console.error(`[API] Error fetching work area calendar for ${workAreaId}:`, error);
      return { 
        workAreaId,
        workAreaName: `Area ${workAreaId}`,
        tasks: [] 
      };
    }
  }
} 