import {
  MowersResponse,
  MowerResponse,
  WorkAreasResponse,
  MessagesResponse,
  StayOutZonesResponse,
  CommandResponse,
  MowerCommandType,
  TokenResponse,
  SettingsUpdate,
  CompleteMowerData,
  CalendarTask,
  ErrorResponse
} from './types';

/**
 * Husqvarna Automower Connect API Client
 * 
 * This client provides methods to interact with all aspects of the
 * Husqvarna Automower Connect API, including authentication, data retrieval,
 * and sending commands to mowers.
 */
export class HusqvarnaApi {
  private baseUrl = 'https://api.amc.husqvarna.dev/v1';
  private authBaseUrl = 'https://api.authentication.husqvarnagroup.dev/v1';
  private token: string;
  private apiKey: string;
  
  /**
   * Creates a new Husqvarna API client
   * 
   * @param config Configuration object with token and apiKey
   */
  constructor(config: { token: string; apiKey: string }) {
    this.token = config.token;
    this.apiKey = config.apiKey;
  }
  
  // ===== AUTHENTICATION METHODS =====
  
  /**
   * Sets the access token for API requests
   * 
   * @param token Access token
   */
  setToken(token: string): void {
    this.token = token;
  }
  
  /**
   * Gets the current access token
   * 
   * @returns The current access token
   */
  getToken(): string {
    return this.token;
  }
  
  /**
   * Gets the OAuth authorization URL for user login
   * 
   * @param redirectUri Redirect URI registered in Husqvarna Developer Portal
   * @param state Optional state parameter for security
   * @returns Authorization URL to redirect the user to
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    const authUrl = new URL(`${this.authBaseUrl}/oauth2/authorize`);
    authUrl.searchParams.append('client_id', this.apiKey);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'iam:read amc:api');
    
    if (state) {
      authUrl.searchParams.append('state', state);
    }
    
    return authUrl.toString();
  }
  
  /**
   * Exchanges an authorization code for an access token
   * 
   * @param code Authorization code from OAuth callback
   * @param redirectUri Same redirect URI used in authorization request
   * @param clientSecret Client secret from Husqvarna Developer Portal
   * @returns Token response with access token and refresh token
   */
  async exchangeCodeForToken(
    code: string, 
    redirectUri: string, 
    clientSecret: string
  ): Promise<TokenResponse> {
    const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.apiKey,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        scope: 'iam:read amc:api'
      }).toString()
    });
    
    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      throw new HusqvarnaApiError(
        response.status, 
        error.errors?.[0]?.detail || 'Failed to exchange code for token'
      );
    }
    
    return response.json() as Promise<TokenResponse>;
  }
  
  /**
   * Refreshes an access token using a refresh token
   * 
   * @param refreshToken Refresh token
   * @param clientSecret Client secret from Husqvarna Developer Portal
   * @returns New token response
   */
  async refreshToken(refreshToken: string, clientSecret: string): Promise<TokenResponse> {
    const response = await fetch(`${this.authBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.apiKey,
        client_secret: clientSecret,
        refresh_token: refreshToken
      }).toString()
    });
    
    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      throw new HusqvarnaApiError(
        response.status, 
        error.errors?.[0]?.detail || 'Failed to refresh token'
      );
    }
    
    return response.json() as Promise<TokenResponse>;
  }
  
  // ===== MOWER DATA METHODS =====
  
  /**
   * Gets all mowers linked to the user
   * 
   * @returns List of mowers with basic data
   */
  async getAllMowers(): Promise<MowersResponse> {
    return this.request<MowersResponse>('/mowers');
  }
  
  /**
   * Gets detailed data for a specific mower
   * 
   * @param mowerId Mower ID
   * @returns Detailed mower data
   */
  async getMower(mowerId: string): Promise<MowerResponse> {
    return this.request<MowerResponse>(`/mowers/${mowerId}`);
  }
  
  /**
   * Gets work areas for a mower
   * 
   * @param mowerId Mower ID
   * @returns Work areas data
   */
  async getMowerWorkAreas(mowerId: string): Promise<WorkAreasResponse> {
    return this.request<WorkAreasResponse>(`/mowers/${mowerId}/workAreas`);
  }
  
  /**
   * Gets error and warning messages for a mower
   * 
   * @param mowerId Mower ID
   * @returns Message history
   */
  async getMowerMessages(mowerId: string): Promise<MessagesResponse> {
    return this.request<MessagesResponse>(`/mowers/${mowerId}/messages`);
  }
  
  /**
   * Gets stay-out zones for a mower
   * 
   * @param mowerId Mower ID
   * @returns Stay-out zones data
   */
  async getMowerStayOutZones(mowerId: string): Promise<StayOutZonesResponse> {
    return this.request<StayOutZonesResponse>(`/mowers/${mowerId}/stayOutZones`);
  }
  
  /**
   * Gets all data for a specific mower by combining multiple API calls
   * 
   * @param mowerId Mower ID
   * @returns Complete mower data including all optional fields
   */
  async getMowerComplete(mowerId: string): Promise<CompleteMowerData> {
    // Get basic mower data
    const mower = await this.getMower(mowerId);
    
    // Get additional data in parallel if supported by mower
    const capabilities = mower.data.attributes.capabilities;
    
    const [workAreas, messages, stayOutZones] = await Promise.all([
      // Get work areas if supported
      capabilities.workAreas 
        ? this.getMowerWorkAreas(mowerId).catch(() => undefined)
        : Promise.resolve(undefined),
      
      // Get messages
      this.getMowerMessages(mowerId).catch(() => undefined),
      
      // Get stay-out zones if supported
      capabilities.stayOutZones
        ? this.getMowerStayOutZones(mowerId).catch(() => undefined)
        : Promise.resolve(undefined)
    ]);
    
    // Combine into complete mower data
    return {
      mower,
      workAreas,
      messages,
      stayOutZones
    };
  }
  
  /**
   * Gets complete data for all mowers
   * 
   * @returns Map of mower IDs to complete mower data
   */
  async getAllMowersComplete(): Promise<Record<string, CompleteMowerData>> {
    // Get all mowers
    const mowersResponse = await this.getAllMowers();
    
    // Get complete data for each mower in parallel
    const completeDataPromises = mowersResponse.data.map(
      mower => this.getMowerComplete(mower.id)
    );
    
    const completeDataList = await Promise.all(completeDataPromises);
    
    // Convert to record keyed by mower ID
    return completeDataList.reduce((acc, data) => {
      acc[data.mower.data.id] = data;
      return acc;
    }, {} as Record<string, CompleteMowerData>);
  }
  
  // ===== MOWER COMMAND METHODS =====
  
  /**
   * Sends a command to a mower
   * 
   * @param mowerId Mower ID
   * @param command Command type
   * @param attributes Command attributes
   * @returns Command result
   */
  async sendMowerCommand(
    mowerId: string,
    command: MowerCommandType,
    attributes: Record<string, any> = {}
  ): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: command,
            attributes
          }
        })
      }
    );
  }
  
  /**
   * Starts the mower for a specific duration
   * 
   * @param mowerId Mower ID
   * @param duration Duration in minutes
   * @returns Command result
   */
  async startMower(mowerId: string, duration: number): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'Start', { duration });
  }
  
  /**
   * Starts the mower in a specific work area
   * 
   * @param mowerId Mower ID
   * @param workAreaId Work area ID
   * @param duration Duration in minutes
   * @returns Command result
   */
  async startMowerInWorkArea(
    mowerId: string,
    workAreaId: number,
    duration: number
  ): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'StartInWorkArea', {
      workAreaId,
      duration
    });
  }
  
  /**
   * Parks the mower for a specific duration
   * 
   * @param mowerId Mower ID
   * @param duration Duration in minutes
   * @returns Command result
   */
  async parkMower(mowerId: string, duration: number): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'Park', { duration });
  }
  
  /**
   * Parks the mower until the next scheduled task
   * 
   * @param mowerId Mower ID
   * @returns Command result
   */
  async parkUntilNextSchedule(mowerId: string): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'ParkUntilNextSchedule');
  }
  
  /**
   * Parks the mower indefinitely
   * 
   * @param mowerId Mower ID
   * @returns Command result
   */
  async parkUntilFurtherNotice(mowerId: string): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'ParkUntilFurtherNotice');
  }
  
  /**
   * Pauses the mower
   * 
   * @param mowerId Mower ID
   * @returns Command result
   */
  async pauseMower(mowerId: string): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'Pause');
  }
  
  /**
   * Resumes the mower's schedule
   * 
   * @param mowerId Mower ID
   * @returns Command result
   */
  async resumeSchedule(mowerId: string): Promise<CommandResponse> {
    return this.sendMowerCommand(mowerId, 'ResumeSchedule');
  }
  
  // ===== SETTINGS METHODS =====
  
  /**
   * Updates mower settings
   * 
   * @param mowerId Mower ID
   * @param settings Settings to update
   * @returns Command result
   */
  async updateMowerSettings(
    mowerId: string,
    settings: SettingsUpdate
  ): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/settings`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'settings',
            attributes: settings
          }
        })
      }
    );
  }
  
  /**
   * Updates mower calendar/schedule
   * 
   * @param mowerId Mower ID
   * @param tasks Calendar tasks
   * @returns Command result
   */
  async updateMowerCalendar(
    mowerId: string,
    tasks: CalendarTask[]
  ): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/calendar`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'calendar',
            attributes: {
              tasks
            }
          }
        })
      }
    );
  }
  
  /**
   * Updates work area calendar/schedule
   * 
   * @param mowerId Mower ID
   * @param workAreaId Work area ID
   * @param tasks Calendar tasks
   * @returns Command result
   */
  async updateWorkAreaCalendar(
    mowerId: string,
    workAreaId: number,
    tasks: CalendarTask[]
  ): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/workAreas/${workAreaId}/calendar`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'calendar',
            attributes: {
              tasks
            }
          }
        })
      }
    );
  }
  
  /**
   * Updates a work area
   * 
   * @param mowerId Mower ID
   * @param workAreaId Work area ID
   * @param cuttingHeight Cutting height (0-100)
   * @param enable Whether to enable the work area
   * @returns Command result
   */
  async updateWorkArea(
    mowerId: string,
    workAreaId: number,
    cuttingHeight?: number,
    enable?: boolean
  ): Promise<CommandResponse> {
    const attributes: Record<string, any> = {};
    
    if (cuttingHeight !== undefined) {
      attributes.cuttingHeight = cuttingHeight;
    }
    
    if (enable !== undefined) {
      attributes.enable = enable;
    }
    
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/workAreas/${workAreaId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'workArea',
            id: workAreaId,
            attributes
          }
        })
      }
    );
  }
  
  /**
   * Enables or disables a stay-out zone
   * 
   * @param mowerId Mower ID
   * @param stayOutId Stay-out zone ID
   * @param enable Whether to enable the zone
   * @returns Command result
   */
  async updateStayOutZone(
    mowerId: string,
    stayOutId: string,
    enable: boolean
  ): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/stayOutZones/${stayOutId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'stayOutZone',
            id: stayOutId,
            attributes: {
              enable
            }
          }
        })
      }
    );
  }
  
  /**
   * Confirms the current error on the mower
   * 
   * @param mowerId Mower ID
   * @returns Command result
   */
  async confirmError(mowerId: string): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/errors/confirm`,
      {
        method: 'POST'
      }
    );
  }
  
  /**
   * Resets the cutting blade usage time counter
   * 
   * @param mowerId Mower ID
   * @returns Command result
   */
  async resetCuttingBladeUsageTime(mowerId: string): Promise<CommandResponse> {
    return this.request<CommandResponse>(
      `/mowers/${mowerId}/statistics/resetCuttingBladeUsageTime`,
      {
        method: 'POST'
      }
    );
  }
  
  // ===== WEBSOCKET METHODS =====
  
  /**
   * Gets WebSocket connection details
   * 
   * @returns WebSocket connection URL and other details
   */
  async getWebSocketConnection(): Promise<any> {
    return this.request<any>('/websocket');
  }
  
  // ===== HELPER METHODS =====
  
  /**
   * Makes a request to the Husqvarna API
   * 
   * @param endpoint API endpoint
   * @param options Request options
   * @returns Response data
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & { headers?: Record<string, string> } = {}
  ): Promise<T> {
    // Prepare URL
    const url = `${this.baseUrl}${endpoint}`;
    
    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'X-Api-Key': this.apiKey,
      'Authorization-Provider': 'husqvarna',
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      ...(options.headers || {})
    };
    
    // Make request
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle errors
    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json() as ErrorResponse;
        if (errorData.errors?.[0]) {
          errorMessage = errorData.errors[0].detail || errorMessage;
        }
      } catch (e) {
        // Use default error message if response is not JSON
      }
      
      throw new HusqvarnaApiError(response.status, errorMessage);
    }
    
    // Parse response
    return response.json() as Promise<T>;
  }
}

/**
 * Husqvarna API Error
 */
export class HusqvarnaApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HusqvarnaApiError';
  }
} 