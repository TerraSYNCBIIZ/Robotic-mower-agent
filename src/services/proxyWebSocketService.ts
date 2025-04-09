import { EventEmitter } from 'eventemitter3';

// Create a typed event emitter for WebSocket events
export class WebSocketEventEmitter extends EventEmitter {
  emitMessage(message: any): void {
    this.emit('message', message);
  }
  
  emitSentToData(data: any, type: string, mowerId: string): void {
    this.emit('sent-to-data', { data, type, mowerId, timestamp: new Date() });
  }
  
  emitStatus(status: { connected: boolean; timestamp: Date }): void {
    this.emit('status-change', status);
  }
  
  emitError(error: Error): void {
    this.emit('error', error);
  }
}

/**
 * ProxyWebSocketService
 * 
 * Client-side service that connects to the WebSocket proxy server
 * Handles connection management, reconnection, and event forwarding
 */
class ProxyWebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private isReconnecting: boolean = false;
  private autoReconnect: boolean = true;
  private connectionPromise: Promise<void> | null = null;
  
  // Event emitter for UI monitoring
  public events = new WebSocketEventEmitter();
  
  // Statistics
  private stats = {
    messagesReceived: 0,
    messagesByType: {} as Record<string, number>,
    dataSentToFirebase: 0,
    lastMessageTime: new Date(),
    errors: 0
  };
  
  // Configuration
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 3000; // 3 seconds
  private readonly PING_INTERVAL = 30000; // 30 seconds
  
  constructor() {
    // Determine WebSocket proxy URL based on environment
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const port = isLocalhost ? '8081' : ''; // Port the proxy is running on
    
    if (isLocalhost) {
      this.url = `ws://localhost:${port}`;
    } else {
      // For production
      // This should be updated to the actual deployed proxy server URL
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      this.url = `wss://${hostname}:${port}`;
    }
    
    // For local development, you might want to use a hardcoded URL
    // this.url = 'ws://localhost:8081';
    
    console.log(`ProxyWebSocketService initialized with URL: ${this.url}`);
  }
  
  /**
   * Set the WebSocket proxy URL manually
   * @param url The WebSocket proxy URL
   */
  setUrl(url: string): void {
    this.url = url;
    console.log(`WebSocket proxy URL set to: ${url}`);
  }
  
  /**
   * Connect to the WebSocket proxy server
   * @returns Promise that resolves when connection is established
   */
  connect(): Promise<void> {
    // If there's an active connection attempt, return it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // If already connected, just return a resolved promise
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }
    
    // Get the user token from cookies if available
    let token = '';
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('userAccessToken='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1].trim();
        console.log('Found user token in cookies, will pass to WebSocket proxy');
      }
    }
    
    // Create new connection promise
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        // Close existing connection if any
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        
        // Create connection URL with token if available
        const connectionUrl = token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url;
        console.log(`Connecting to WebSocket proxy at ${this.url}...${token ? ' with user token' : ''}`);
        this.isReconnecting = true;
        
        // Create WebSocket connection
        this.ws = new WebSocket(connectionUrl);
        
        // Handle connection established
        this.ws.onopen = () => {
          console.log('Connected to WebSocket proxy');
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          
          // Start ping interval to verify connection
          this.startPingInterval();
          
          // Emit status change
          this.events.emitStatus({
            connected: true,
            timestamp: new Date()
          });
          
          // Clear connection promise
          this.connectionPromise = null;
          
          resolve();
        };
        
        // Handle messages
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        // Handle connection closed
        this.ws.onclose = (event) => {
          console.log(`WebSocket connection closed: ${event.code} ${event.reason || ''}`);
          
          // Clean up
          this.clearIntervals();
          
          // Emit status change
          this.events.emitStatus({
            connected: false,
            timestamp: new Date()
          });
          
          // Clear connection promise
          this.connectionPromise = null;
          this.isReconnecting = false;
          
          // Reconnect if enabled
          if (this.autoReconnect) {
            this.scheduleReconnect();
          }
          
          // Only reject if this was from an explicit connect() call
          if (!event.wasClean) {
            reject(new Error(`Connection closed: ${event.code} ${event.reason || ''}`));
          }
        };
        
        // Handle errors
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.stats.errors++;
          
          // Emit error event
          this.events.emitError(new Error('WebSocket connection error'));
          
          // Don't reject here - let onclose handle it
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        
        // Reset state
        this.isReconnecting = false;
        this.connectionPromise = null;
        
        // Emit error
        this.events.emitError(error instanceof Error ? error : new Error('Unknown error'));
        
        reject(error);
      }
    });
    
    return this.connectionPromise;
  }
  
  /**
   * Disconnect from the WebSocket proxy server
   */
  disconnect(): void {
    // Disable auto-reconnect
    this.autoReconnect = false;
    
    // Clear intervals
    this.clearIntervals();
    
    // Close connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reset connection state
    this.connectionPromise = null;
    this.isReconnecting = false;
    
    console.log('Disconnected from WebSocket proxy');
  }
  
  /**
   * Send a message to the WebSocket proxy server
   * @param message The message to send
   */
  send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, cannot send message');
      return;
    }
    
    try {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(messageString);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      this.events.emitError(error instanceof Error ? error : new Error('Error sending message'));
    }
  }
  
  /**
   * Send a command to a mower through the WebSocket proxy
   * @param mowerId The ID of the mower
   * @param action The action to perform
   * @param parameters Optional parameters for the action
   */
  sendCommand(mowerId: string, action: string, parameters?: Record<string, any>): void {
    this.send({
      type: 'command',
      mowerId,
      action,
      parameters: parameters || {}
    });
  }
  
  /**
   * Request a manual reconnection to the Husqvarna WebSocket
   */
  requestReconnect(): void {
    this.send({
      type: 'reconnect'
    });
  }
  
  /**
   * Handle incoming messages from the WebSocket proxy
   * @param data The message data
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Update stats
      this.stats.messagesReceived++;
      this.stats.lastMessageTime = new Date();
      
      if (message.type) {
        this.stats.messagesByType[message.type] = (this.stats.messagesByType[message.type] || 0) + 1;
      }
      
      // Emit message event
      this.events.emitMessage(message);
      
      // Handle specific message types
      if (message.type === 'status') {
        this.events.emitStatus({
          connected: message.connected,
          timestamp: new Date(message.timestamp || Date.now())
        });
      } else if (message.type === 'error') {
        console.error('Error from WebSocket proxy:', message.message);
        this.events.emitError(new Error(message.message || 'Unknown error from proxy'));
      } else if (message.type === 'data') {
        // Handle data message (e.g., mower updates)
        this.stats.dataSentToFirebase++;
        
        if (message.data && message.data.id) {
          this.events.emitSentToData(
            message.data, 
            'data', 
            message.data.id
          );
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      console.error('Raw message:', data);
      this.events.emitError(error instanceof Error ? error : new Error('Error processing message'));
    }
  }
  
  /**
   * Get WebSocket connection status
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get statistics about the WebSocket connection
   * @returns Statistics object
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Start ping interval to verify connection
   */
  private startPingInterval(): void {
    // Clear existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Start new interval
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, this.PING_INTERVAL);
  }
  
  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Clear existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Maximum reconnection attempts reached
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Maximum reconnection attempts reached, giving up');
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = this.RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    // Schedule reconnection
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }
  
  /**
   * Clear all intervals and timeouts
   */
  private clearIntervals(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Create singleton instance
const proxyWebSocketService = new ProxyWebSocketService();
export default proxyWebSocketService; 