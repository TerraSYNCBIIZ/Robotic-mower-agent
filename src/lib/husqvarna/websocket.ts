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
  
  /**
 * Husqvarna WebSocket Manager
 * Manages the WebSocket connection to Husqvarna API via our proxy server
 */
export class HusqvarnaWebSocketManager extends EventEmitter {
  private websocket: WebSocket | null = null;
  private status = WebSocketStatus.DISCONNECTED;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private connectionMetrics: ConnectionMetrics = {
    wsUrl: '',
    status: WebSocketStatus.DISCONNECTED,
    lastMessageTime: null,
    connectionAttempts: 0,
    totalMessagesReceived: 0,
    lastError: null,
    connectedSince: null,
    disconnectedSince: new Date()
  };
  
  /**
   * Connect to the WebSocket via our proxy server
   * @returns Promise that resolves to true if connected successfully, false otherwise
   */
  async connect(): Promise<boolean> {
    try {
      // Check if we're already connected
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return true;
      }
      
      // If a connection attempt is in progress (connecting state), wait for it to complete
      if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket connection in progress, waiting...');
        return new Promise<boolean>((resolve) => {
          const checkConnection = () => {
            if (!this.websocket) {
              resolve(false);
              return;
            }
            
            if (this.websocket.readyState === WebSocket.OPEN) {
              resolve(true);
            } else if (this.websocket.readyState === WebSocket.CLOSED || 
                     this.websocket.readyState === WebSocket.CLOSING) {
              resolve(false);
            } else {
              // Still connecting, check again in 100ms
              setTimeout(checkConnection, 100);
            }
          };
          
          setTimeout(checkConnection, 100);
        });
      }
      
      // Dispose any existing connection
      this.disconnect();
      
      // Reset connection state
      this.connectionAttempts++;
      this.connectionMetrics.connectionAttempts = this.connectionAttempts;
      this.connectionMetrics.lastError = null;
      
      // Update connection status
      this.setStatus(WebSocketStatus.CONNECTING);
      
      // Get the WebSocket proxy details from our API endpoint
      const response = await fetch('/api/proxy/websocket', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include', // Include cookies for authentication
        cache: 'no-store' // Prevent caching of the proxy details
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to get WebSocket proxy details:', errorData);
        this.setStatus(WebSocketStatus.ERROR);
        this.connectionMetrics.lastError = `Failed to get WebSocket proxy details: ${errorData.error || response.statusText}`;
        return false;
      }
      
      const data = await response.json();
      
      if (!data.wsProxyUrl || !data.token || !data.apiKey) {
        console.error('Invalid WebSocket proxy details:', data);
        this.setStatus(WebSocketStatus.ERROR);
        this.connectionMetrics.lastError = 'Invalid WebSocket proxy details';
        return false;
      }
      
      // Update connection metrics with the URL
      this.connectionMetrics.wsUrl = data.wsProxyUrl;
      
      // Create WebSocket URL with token as query parameter for our proxy
      const wsUrl = `${data.wsProxyUrl}?token=${encodeURIComponent(data.token)}&apiKey=${encodeURIComponent(data.apiKey)}`;
      
      console.log(`Connecting to WebSocket proxy at ${data.wsProxyUrl}`);
      
      // Create new WebSocket connection to our proxy
      this.websocket = new WebSocket(wsUrl);
      
      // Set up a connection timeout
      this.clearReconnectTimeout();
      this.reconnectTimeout = window.setTimeout(() => {
        if (this.status !== WebSocketStatus.CONNECTED) {
          console.error('WebSocket connection timed out');
          this.connectionMetrics.lastError = 'Connection timeout';
          
          // Close the socket if it's still connecting
          if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
            this.websocket.close();
            this.websocket = null;
          }
          
          this.setStatus(WebSocketStatus.ERROR);
        }
      }, 10000) as unknown as number; // 10 second timeout
      
      // Set up event handlers
      this.websocket.onopen = this.handleOpen.bind(this);
      this.websocket.onmessage = this.handleMessage.bind(this);
      this.websocket.onerror = this.handleError.bind(this);
      this.websocket.onclose = this.handleClose.bind(this);
      
      // Wait for the connection to be established or fail
      return new Promise<boolean>((resolve) => {
        const checkConnection = () => {
          if (!this.websocket) {
            resolve(false);
            return;
          }
          
          if (this.status === WebSocketStatus.CONNECTED) {
            resolve(true);
          } else if (this.status === WebSocketStatus.ERROR || this.status === WebSocketStatus.DISCONNECTED) {
            resolve(false);
          } else {
            // Still connecting, check again in 100ms
            setTimeout(checkConnection, 100);
          }
        };
        
        setTimeout(checkConnection, 100);
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.setStatus(WebSocketStatus.ERROR);
      this.connectionMetrics.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.clearReconnectTimeout();
    console.log('WebSocket connection established');
    this.setStatus(WebSocketStatus.CONNECTED);
    this.connectionMetrics.connectedSince = new Date();
    this.connectionMetrics.disconnectedSince = null;
    
    // Start the ping interval to keep the connection alive
    this.startPingInterval();
  }
  
  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Parse the message
      const message = JSON.parse(event.data as string);
      
      // Update metrics
      this.connectionMetrics.totalMessagesReceived++;
      this.connectionMetrics.lastMessageTime = new Date();
      
      // Handle connection status messages from our proxy
      if (message.type === 'connection_status') {
        console.log(`WebSocket connection status: ${message.status}`);
        return;
      }
      
      // Emit the message
      this.emit('message', message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    this.connectionMetrics.lastError = 'Connection error';
    this.setStatus(WebSocketStatus.ERROR);
    
    // Emit the error
    this.emit('error', event);
  }
  
  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.clearPingInterval();
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.setStatus(WebSocketStatus.DISCONNECTED);
    this.connectionMetrics.disconnectedSince = new Date();
    this.connectionMetrics.connectedSince = null;
    
    // Emit the close event
    this.emit('close', event);
    
    // Clean up
    this.websocket = null;
    
    // Add a delay before reconnecting based on the close code
    let shouldReconnect = false;
    let reconnectDelay = 1000;
    
    // Determine if we should reconnect based on the close code
    if (event.code === 1000 || event.code === 1001) {
      // Normal closure, only reconnect if it was for a reconnect
      shouldReconnect = event.reason === 'Reconnecting';
    } else if (event.code === 1006) {
      // Abnormal closure (e.g., server crashed)
      console.warn('Abnormal WebSocket closure, will attempt to reconnect');
      shouldReconnect = true;
      reconnectDelay = 5000; // Wait a bit longer for abnormal closures
    } else if (event.code >= 4000) {
      // Application-specific error codes
      console.error(`WebSocket closed with application code ${event.code}: ${event.reason}`);
      shouldReconnect = false; // Don't retry auth errors or other app errors
    } else {
      // Other closure, attempt to reconnect
      shouldReconnect = true;
    }
    
    // Attempt to reconnect if needed
    if (shouldReconnect && this.connectionAttempts < this.maxConnectionAttempts) {
      console.log(`Will attempt to reconnect in ${reconnectDelay}ms...`);
      this.clearReconnectTimeout();
      this.reconnectTimeout = window.setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
      }, reconnectDelay) as unknown as number;
    } else if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.error(`Maximum reconnect attempts (${this.maxConnectionAttempts}) reached`);
    }
  }
  
  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.clearPingInterval();
    
    // Send ping every 20 seconds to keep the connection alive (more frequent than default)
    this.pingInterval = window.setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        try {
          // Send a ping message to our proxy, which will keep the connection alive
          this.websocket.send(JSON.stringify({ 
            type: 'ping', 
            timestamp: Date.now() 
          }));
          
          // Check if we haven't received a message in a while (2 minutes)
          const lastMessageTime = this.connectionMetrics.lastMessageTime;
          if (lastMessageTime && (Date.now() - lastMessageTime.getTime() > 120000)) {
            console.warn('No WebSocket messages received in 2 minutes, reconnecting...');
            // Force reconnect to ensure connection is still alive
            this.reconnect();
          }
        } catch (error) {
          console.error('Error sending ping:', error);
          // Connection might be broken, try to reconnect
          this.reconnect();
        }
      }
    }, 20000) as unknown as number;
  }
  
  /**
   * Force a reconnection (close and reopen)
   */
  private reconnect(): void {
    if (this.websocket) {
      // Close the current connection
      try {
        this.websocket.close(1000, 'Reconnecting');
      } catch (error) {
        console.error('Error closing WebSocket for reconnect:', error);
      }
      
      this.websocket = null;
      this.setStatus(WebSocketStatus.DISCONNECTED);
      
      // Immediately try to reconnect
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, 1000);
    }
  }
  
  /**
   * Clear ping interval
   */
  private clearPingInterval(): void {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    this.clearPingInterval();
    this.clearReconnectTimeout();
    
    if (this.websocket) {
      console.log('Disconnecting from WebSocket');
      this.websocket.close(1000, 'Client disconnected');
      this.websocket = null;
      this.setStatus(WebSocketStatus.DISCONNECTED);
      this.connectionMetrics.disconnectedSince = new Date();
      this.connectionMetrics.connectedSince = null;
    }
  }
  
  /**
   * Get the current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }
  
  /**
   * Set the connection status and emit an event
   */
  private setStatus(status: WebSocketStatus): void {
    // Only emit if the status has changed
    if (this.status !== status) {
      this.status = status;
      this.connectionMetrics.status = status;
      
      // Emit the status change event
    this.emit('status_change', status);
    
    // Also dispatch a DOM event for components to listen to
    if (typeof window !== 'undefined') {
        const event = new CustomEvent('websocket-status-change', { 
        detail: { status }
        });
        window.dispatchEvent(event);
      }
    }
  }
  
  /**
   * Get connection metrics for monitoring
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.disconnect();
    this.removeAllListeners();
  }
} 