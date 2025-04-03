import { EventEmitter } from 'events';
import { husqvarnaApi } from './api-client';

// WebSocket status enum
export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

// WebSocket event types
export enum MowerWebSocketEventType {
  MOWER = 'mower-event-v2',
  BATTERY = 'battery-event-v2',
  POSITION = 'position-event-v2',
  CALENDAR = 'calendar-event-v2',
  MESSAGE = 'message-event-v2'
}

// Mower activity types from WebSocket events
export enum MowerActivity {
  UNKNOWN = 'UNKNOWN',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  MOWING = 'MOWING',
  GOING_HOME = 'GOING_HOME',
  CHARGING = 'CHARGING',
  LEAVING = 'LEAVING',
  PARKED_IN_CS = 'PARKED_IN_CS',
  STOPPED_IN_GARDEN = 'STOPPED_IN_GARDEN'
}

// Mower state from WebSocket events
export enum MowerState {
  UNKNOWN = 'UNKNOWN',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  RESTRICTED = 'RESTRICTED',
  PAUSED = 'PAUSED',
  IN_OPERATION = 'IN_OPERATION',
  WAIT_UPDATING = 'WAIT_UPDATING',
  WAIT_POWER_UP = 'WAIT_POWER_UP',
  OFF = 'OFF',
  ERROR = 'ERROR',
  FATAL_ERROR = 'FATAL_ERROR',
  ERROR_AT_POWER_UP = 'ERROR_AT_POWER_UP'
}

// Connection metrics interface for monitoring
export interface ConnectionMetrics {
  wsUrl: string;
  status: WebSocketStatus;
  lastMessageTime: Date | null;
  connectionAttempts: number;
  totalMessagesReceived: number;
  lastError: string | null;
  connectedSince: Date | null;
  disconnectedSince: Date | null;
  lastActivity: number | null;
}

// Web Socket event interfaces
export interface MowerEvent {
  id: string; // Mower ID
  type: MowerWebSocketEventType;
  attributes: Record<string, unknown>;
}

export interface MowerStatusEvent extends MowerEvent {
  type: MowerWebSocketEventType.MOWER;
  attributes: {
    state: MowerState;
    activity: MowerActivity;
    mode: string;
    errorCode?: number;
    errorTimestamp?: number;
  };
}

export interface BatteryEvent extends MowerEvent {
  type: MowerWebSocketEventType.BATTERY;
  attributes: {
    batteryPercent: number;
  };
}

export interface PositionEvent extends MowerEvent {
  type: MowerWebSocketEventType.POSITION;
  attributes: {
    latitude: number;
    longitude: number;
    };
  }
  
// Singleton instance
let wsManagerInstance: HusqvarnaWebSocketManager | null = null;
// Event dispatcher for global events
const globalEventDispatcher = typeof window !== 'undefined' ? window : new EventEmitter();

/**
 * Husqvarna WebSocket Manager - Singleton pattern
 * Manages the WebSocket connection to Husqvarna API via our proxy server
 */
export class HusqvarnaWebSocketManager extends EventEmitter {
  private socket: WebSocket | null = null;
  private status: WebSocketStatus = WebSocketStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private lastMessageTime = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private connectionMetrics: ConnectionMetrics = {
    wsUrl: '',
    status: WebSocketStatus.DISCONNECTED,
    lastMessageTime: null,
    connectionAttempts: 0,
    totalMessagesReceived: 0,
    lastError: null,
    connectedSince: null,
    disconnectedSince: new Date(),
    lastActivity: null
  };
  
  // Last connection check time to throttle status checks
  private lastConnectionCheck = 0;
  private connectionCheckThrottle = 5000; // 5 seconds
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();
    // Initialize with no listeners
    
    // Set up global event listener for status changes
    if (typeof window !== 'undefined') {
      window.addEventListener('websocket-status-requested', () => {
        // Respond with current status without causing a new connection
        this.broadcastStatus();
      });
    }
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): HusqvarnaWebSocketManager {
    if (!wsManagerInstance) {
      wsManagerInstance = new HusqvarnaWebSocketManager();
      
      // Check for existing connection in session storage
      if (typeof window !== 'undefined') {
        // Clear disconnected status if it was stored from a previous session
        // We'll check the actual proxy status instead
        sessionStorage.removeItem('websocket_status');
        
        // Check if proxy has active connection
        wsManagerInstance.checkProxyStatus();
      }
    }
    return wsManagerInstance;
  }
  
  /**
   * Check if the proxy server has an active persistent connection
   */
  private async checkProxyStatus(): Promise<void> {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/proxy/websocket/status`);
      
      if (response.ok) {
        const data = await response.json();
        
        // If proxy has a persistent connection, update our status
        if (data.persistentConnection) {
          console.log('Proxy server has active persistent connection');
          this.setStatus(WebSocketStatus.CONNECTED);
          
          // Also broadcast an event to tell components to update
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('proxy-connection-active', {
              detail: { active: true }
            }));
          }
        } else {
          console.log('Proxy server has no active persistent connection');
        }
      }
    } catch (error) {
      console.error('Error checking proxy status:', error);
    }
  }
  
  /**
   * Connect to the WebSocket server
   * @returns Promise that resolves to true if connection is successful, false otherwise
   */
  async connect(): Promise<boolean> {
    try {
      // First, check if we need to connect
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return true;
      }
      
      // Get auth token
      const token = getAuthToken();
      
      if (!token) {
        this.errorCallback?.('No authentication token available');
        return false;
      }
      
      // Create WebSocket URL with token as query parameter
      const wsUrl = `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}?token=${token}`;
      
      console.log('Connecting to WebSocket proxy...');
      
      // Create WebSocket
      this.socket = new WebSocket(wsUrl);
      
      // Expose the WebSocket instance globally for direct event handling
      if (typeof window !== 'undefined') {
        (window as any).husqvarnaWebSocket = this.socket;
      }
      
      // Setup event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      
      // Wait for connection to be established
      return new Promise((resolve) => {
        // Resolve immediately if already connected
        if (this.socket?.readyState === WebSocket.OPEN) {
          resolve(true);
          return;
        }
        
        // Setup temporary event handlers for promise resolution
        const tempOpenHandler = () => {
          console.log('WebSocket connected');
          this.connected = true;
          resolve(true);
          
          // Remove these temporary handlers
          if (this.socket) {
            this.socket.removeEventListener('open', tempOpenHandler);
            this.socket.removeEventListener('error', tempErrorHandler);
            this.socket.removeEventListener('close', tempCloseHandler);
          }
        };
        
        const tempErrorHandler = (event: Event) => {
          console.error('WebSocket connection error:', event);
          this.connected = false;
          resolve(false);
          
          // Remove these temporary handlers
          if (this.socket) {
            this.socket.removeEventListener('open', tempOpenHandler);
            this.socket.removeEventListener('error', tempErrorHandler);
            this.socket.removeEventListener('close', tempCloseHandler);
          }
        };
        
        const tempCloseHandler = () => {
          console.log('WebSocket closed during connection attempt');
          this.connected = false;
          resolve(false);
          
          // Remove these temporary handlers
          if (this.socket) {
            this.socket.removeEventListener('open', tempOpenHandler);
            this.socket.removeEventListener('error', tempErrorHandler);
            this.socket.removeEventListener('close', tempCloseHandler);
          }
        };
        
        // Add temporary handlers
        this.socket?.addEventListener('open', tempOpenHandler);
        this.socket?.addEventListener('error', tempErrorHandler);
        this.socket?.addEventListener('close', tempCloseHandler);
        
        // Set a timeout
        const timeout = setTimeout(() => {
          console.error('WebSocket connection timeout');
          
          // Remove handlers
          if (this.socket) {
            this.socket.removeEventListener('open', tempOpenHandler);
            this.socket.removeEventListener('error', tempErrorHandler);
            this.socket.removeEventListener('close', tempCloseHandler);
          }
          
          this.connected = false;
          resolve(false);
        }, 10000); // 10 second timeout
        
        // Add a cleanup for the timeout
        this.socket?.addEventListener('open', () => clearTimeout(timeout));
        this.socket?.addEventListener('error', () => clearTimeout(timeout));
        this.socket?.addEventListener('close', () => clearTimeout(timeout));
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.errorCallback?.(error);
      return false;
    }
  }
  
  /**
   * Disconnect from the WebSocket API
   */
  disconnect() {
    this.stopHealthCheck();
    this.stopPing();
    
    if (this.socket) {
      console.log('Disconnecting from WebSocket...');
      this.socket.close();
      this.socket = null;
    }
    
    this.setStatus(WebSocketStatus.DISCONNECTED);
  }
  
  /**
   * Dispose of the WebSocket manager
   */
  dispose() {
    this.stopReconnect();
    this.disconnect();
    this.removeAllListeners();
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen() {
    console.log('WebSocket connection established');
    this.setStatus(WebSocketStatus.CONNECTED);
    this.resetReconnectAttempts();
    this.lastMessageTime = Date.now();
    this.startPing();
    this.startHealthCheck();
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent) {
    try {
      // Update last message time
      this.lastMessageTime = Date.now();
      
      // Parse message
      const message = JSON.parse(event.data);
      
      // Debug
      if (message.type !== 'ping') {
        console.log(`WebSocket message received: ${message.type || 'unknown'}`);
      }
      
      // Emit message event
      this.emit('message', message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error, event.data);
    }
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event) {
    console.error('WebSocket error:', event);
    this.setStatus(WebSocketStatus.ERROR);
    this.emit('error', event);
    this.attemptReconnect();
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent) {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    this.stopPing();
    this.stopHealthCheck();
    
    // Only set to disconnected if we're not in error state
    if (this.status !== WebSocketStatus.ERROR) {
      this.setStatus(WebSocketStatus.DISCONNECTED);
    }
    
    // Attempt to reconnect
    this.attemptReconnect();
  }
  
  /**
   * Set the WebSocket status and emit status change event
   * Also broadcasts to global window events
   */
  private setStatus(status: WebSocketStatus) {
    if (this.status !== status) {
      console.log(`WebSocket status changed from ${this.status} to ${status}`);
      this.status = status;
      this.emit('status_change', status);
      
      // Update the connection metrics
      if (status === WebSocketStatus.CONNECTED) {
        this.connectionMetrics.connectedSince = new Date();
        this.connectionMetrics.disconnectedSince = null;
      } else if (status === WebSocketStatus.DISCONNECTED || status === WebSocketStatus.ERROR) {
        this.connectionMetrics.disconnectedSince = new Date();
      }
      
      this.connectionMetrics.status = status;
      this.connectionMetrics.lastActivity = Date.now();
      
      // Store status in session storage for persistence
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('websocket_status', status);
      }
      
      // Broadcast the status change to all components
      this.broadcastStatus();
    }
  }
  
  /**
   * Broadcast status to global event system
   */
  private broadcastStatus() {
    if (typeof window !== 'undefined') {
      // Create a custom event to notify all components
      const statusEvent = new CustomEvent('websocket-status-change', {
        detail: {
          status: this.status,
          metrics: this.getConnectionMetrics()
        }
      });
      
      // Dispatch the event globally
      window.dispatchEvent(statusEvent);
    }
  }
  
  /**
   * Get the current WebSocket status without triggering connections
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }
  
  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.status === WebSocketStatus.CONNECTED;
  }
  
  /**
   * Send ping message to keep connection alive
   */
  private startPing() {
    // Clear any existing ping interval
    this.stopPing();
    
    // Set up ping interval (every 30 seconds)
    this.pingInterval = setInterval(() => {
      if (this.status === WebSocketStatus.CONNECTED && this.socket) {
        try {
          // Send ping
          this.socket.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('Error sending ping:', error);
          this.disconnect();
          this.attemptReconnect();
        }
      }
    }, 30000); // 30 seconds
  }
  
  /**
   * Stop sending ping messages
   */
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Start health check to detect stale connections
   */
  private startHealthCheck() {
    // Clear any existing health check
    this.stopHealthCheck();
    
    // Set up health check (every minute)
    this.healthCheckInterval = setInterval(() => {
      // If no message received in 2 minutes, reconnect
      const now = Date.now();
      const messageAge = now - this.lastMessageTime;
      
      if (messageAge > 120000) { // 2 minutes
        console.warn(`No WebSocket messages received in ${messageAge / 1000} seconds, reconnecting...`);
        this.disconnect();
        this.attemptReconnect();
      }
    }, 60000); // Check every minute
  }
  
  /**
   * Stop health check
   */
  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  /**
   * Attempt to reconnect to WebSocket with exponential backoff
   */
  private attemptReconnect() {
    // Don't attempt to reconnect if we're already trying
    if (this.isReconnecting) {
      return;
    }
    
    this.isReconnecting = true;
    
    // Stop any existing reconnect timer
    this.stopReconnect();
    
    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`Exceeded maximum reconnect attempts (${this.maxReconnectAttempts}), giving up`);
      this.isReconnecting = false;
      return;
    }
    
    // Calculate backoff time (exponential with jitter)
    const backoffMs = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      30000 // Max 30 seconds
    );
    
    console.log(`WebSocket reconnect attempt ${this.reconnectAttempts + 1} scheduled in ${Math.round(backoffMs / 1000)} seconds`);
    
    // Schedule reconnect
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      console.log(`Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      const connected = await this.connect();
      
      if (!connected) {
        // If still not connected, try again
        this.attemptReconnect();
      }
      
      this.isReconnecting = false;
    }, backoffMs);
  }
  
  /**
   * Stop reconnect attempts
   */
  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Reset reconnect attempts counter
   */
  private resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }
  
  /**
   * Get connection metrics for monitoring
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }
} 