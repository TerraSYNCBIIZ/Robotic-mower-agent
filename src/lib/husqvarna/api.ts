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
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.api+json',
      'X-Api-Key': this.appKey,
      'Authorization-Provider': 'husqvarna'
    };
    
    // Add authorization header if token is available
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    return headers;
  }

  // Get details for a specific mower
  async getMower(mowerId: string): Promise<MowerData> {
    try {
      const baseUrl = this.getBaseUrl();
      
      // Use proxy API to avoid CORS issues
      const response = await fetch(`${baseUrl}/api/proxy/mowers/${mowerId}`, {
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
      return data.data;
    } catch (error) {
      console.error(`❌ Error fetching mower ${mowerId}:`, error);
      throw error;
    }
  }

  // Send a command to the mower (e.g., start, pause, park)
  async sendCommand(mowerId: string, command: string, duration?: number): Promise<void> {
    let requestBody;
    
    switch (command) {
      case 'start':
        requestBody = {
          data: {
            type: 'Start',
            attributes: {
              duration: duration || 240
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

    try {
      const baseUrl = this.getBaseUrl();
      
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
} 