import WebSocket from 'ws';
import { getApiInstance } from '../api/createHusqvarnaApi';
import * as admin from 'firebase-admin';
import { throttleUpdates } from './throttleService';
import EventEmitter from 'events';

// Initialize Firebase if needed
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Create a typed event emitter for WebSocket events
export class WebSocketEventEmitter extends EventEmitter {
  emitMessage(message: any): void {
    this.emit('message', message);
  }
  
  emitSentToFirebase(data: any, type: string, mowerId: string): void {
    this.emit('sent-to-firebase', { data, type, mowerId, timestamp: new Date() });
  }
  
  emitStatus(status: { connected: boolean, timestamp: Date }): void {
    this.emit('status-change', status);
  }
  
  emitError(error: Error): void {
    this.emit('error', error);
  }
}

/**
 * Manages WebSocket connection to Husqvarna API
 * Handles connection lifecycle, reconnection, and message processing
 */
export class HusqvarnaWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;
  private lastMessageTime: number = Date.now();
  private reconnectAttempts: number = 0;
  private currentToken: string | null = null;
  
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
  private readonly RECONNECT_BEFORE_MS = 110 * 60 * 1000; // Reconnect after 110 minutes (before 2-hour limit)
  private readonly PING_INTERVAL_MS = 60 * 1000; // Ping every 60 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 10; // Maximum reconnection attempts
  private readonly HUSQVARNA_WS_URL = 'wss://ws.amc.husqvarna.dev/v1';
  
  // Getter for statistics
  public getStats() {
    return { ...this.stats };
  }
  
  /**
   * Set the API token to use for WebSocket connections
   * @param token Valid Husqvarna API token from user authentication
   */
  public setToken(token: string): void {
    this.currentToken = token;
    console.log('WebSocket token set from user authentication');
  }
  
  /**
   * Get the current API token
   * @returns Current API token or null if not set
   */
  public getToken(): string | null {
    return this.currentToken;
  }
  
  /**
   * Connect to the Husqvarna WebSocket API
   * @returns WebSocket instance
   */
  async connect(): Promise<WebSocket> {
    try {
      // Close existing connection if any
      if (this.ws) {
        this.ws.terminate();
      }
      
      // Check for the token
      const token = this.currentToken;
      
      if (!token) {
        console.error('No authentication token available for WebSocket connection');
        const error = new Error('No authentication token available for WebSocket connection. User must be logged in.');
        this.events.emitError(error);
        throw error;
      }
      
      console.log('Connecting to Husqvarna WebSocket...');
      
      // Create WebSocket connection
      this.ws = new WebSocket(this.HUSQVARNA_WS_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Provider': 'husqvarna'
        }
      });
      
      // Set up event handlers
      this.ws.on('open', this.handleOpen.bind(this));
      this.ws.on('message', this.handleMessage.bind(this));
      this.ws.on('error', this.handleError.bind(this));
      this.ws.on('close', this.handleClose.bind(this));
      
      // Reset reconnection state
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      
      return this.ws;
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.updateConnectionStatus(false);
      this.scheduleReconnect();
      if (error instanceof Error) {
        this.events.emitError(error);
      }
      throw error;
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log(`WebSocket connected at ${new Date().toISOString()}`);
    
    // Set up ping interval to keep connection alive
    this.startPingInterval();
    
    // Schedule reconnection before the 2-hour limit
    this.scheduleReconnectBeforeLimit();
    
    // Update connection status in Firebase
    this.updateConnectionStatus(true);
    
    // Emit status for UI
    this.events.emitStatus({
      connected: true,
      timestamp: new Date()
    });
  }
  
  /**
   * Handle WebSocket message event
   * @param data Message data
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      this.lastMessageTime = Date.now();
      this.stats.lastMessageTime = new Date();
      this.stats.messagesReceived++;
      
      // Parse and process the message
      const message = JSON.parse(data.toString());
      console.log('Received WebSocket message type:', message.type);
      
      // Update stats
      if (message.type) {
        this.stats.messagesByType[message.type] = (this.stats.messagesByType[message.type] || 0) + 1;
      }
      
      // Emit to listeners
      this.events.emitMessage(message);
      
      // Process different message types
      if (message.type === 'data') {
        this.processData(message.data);
      } else if (message.type === 'status') {
        this.processStatus(message.data);
      } else if (message.type === 'heartbeat') {
        // Respond to heartbeat
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      this.logError('websocket_message_processing_error', error);
      this.stats.errors++;
      if (error instanceof Error) {
        this.events.emitError(error);
      }
    }
  }
  
  /**
   * Handle WebSocket error event
   * @param error Error object
   */
  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    this.logError('websocket_error', error);
    this.stats.errors++;
    this.events.emitError(error);
  }
  
  /**
   * Handle WebSocket close event
   * @param code Close code
   * @param reason Close reason
   */
  private handleClose(code: number, reason: string): void {
    console.log(`WebSocket closed with code ${code} and reason: ${reason}`);
    
    // Clean up
    this.clearIntervals();
    
    // Update connection status
    this.updateConnectionStatus(false);
    
    // Emit status for UI
    this.events.emitStatus({
      connected: false,
      timestamp: new Date()
    });
    
    // Reconnect if not already in reconnection process
    if (!this.isReconnecting) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Start new ping interval
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
        console.log('Ping sent at', new Date().toISOString());
      }
    }, this.PING_INTERVAL_MS);
  }
  
  /**
   * Schedule reconnection before the 2-hour limit
   */
  private scheduleReconnectBeforeLimit(): void {
    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Schedule reconnection before 2-hour limit
    this.reconnectTimeout = setTimeout(() => {
      console.log('Scheduled reconnect before 2-hour limit at', new Date().toISOString());
      this.isReconnecting = true;
      this.connect().catch(err => {
        console.error('Scheduled reconnection failed:', err);
        this.scheduleReconnect();
      });
    }, this.RECONNECT_BEFORE_MS);
  }
  
  /**
   * Schedule reconnection attempt with exponential backoff
   * @param delay Initial delay in milliseconds
   */
  private scheduleReconnect(delay = 5000): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached. Giving up.');
      this.logError('websocket_max_reconnect_attempts', 
        { attempts: this.reconnectAttempts });
      return;
    }
    
    const reconnectDelay = delay * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${reconnectDelay}ms`);
    
    setTimeout(() => {
      this.isReconnecting = true;
      this.connect()
        .catch(err => {
          console.error('Reconnection failed:', err);
          this.scheduleReconnect(delay);
        });
    }, reconnectDelay);
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
  
  /**
   * Update WebSocket connection status in Firebase
   * @param isConnected Connection status
   */
  private async updateConnectionStatus(isConnected: boolean): Promise<void> {
    try {
      const db = admin.firestore();
      await db.collection('system').doc('websocket').set({
        connected: isConnected,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        reconnectAttempts: this.reconnectAttempts
      }, { merge: true });
    } catch (error) {
      console.error('Error updating connection status:', error);
    }
  }
  
  /**
   * Log error to Firebase
   * @param type Error type
   * @param error Error object or message
   */
  private async logError(type: string, error: any): Promise<void> {
    try {
      const db = admin.firestore();
      await db.collection('logs').add({
        type,
        error: error instanceof Error ? error.message : String(error),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    } catch (logError) {
      console.error('Error logging to Firebase:', logError);
    }
  }
  
  /**
   * Process data received from WebSocket
   * @param data Data object
   */
  private async processData(data: any): Promise<void> {
    if (!data) {
      console.warn('Received empty data payload');
      return;
    }
    
    try {
      // Extract mower ID
      const mowerId = data.id || data.mowerId;
      if (!mowerId) {
        console.warn('Received data without mower ID:', data);
        return;
      }
      
      // Process different data types with throttling
      if (data.battery && data.mower) {
        // Status data - process with throttling
        const processed = await throttleUpdates(data, 'status', mowerId);
        if (processed) {
          this.stats.dataSentToFirebase++;
          this.events.emitSentToFirebase(data, 'status', mowerId);
        }
      }
      
      if (data.latitude && data.longitude) {
        // Position data - process with throttling
        const processed = await throttleUpdates(data, 'positions', mowerId);
        if (processed) {
          this.stats.dataSentToFirebase++;
          this.events.emitSentToFirebase(data, 'positions', mowerId);
        }
      }
      
      if (data.statistics) {
        // Statistics data - process with throttling
        const processed = await throttleUpdates(data.statistics, 'statistics', mowerId);
        if (processed) {
          this.stats.dataSentToFirebase++;
          this.events.emitSentToFirebase(data.statistics, 'statistics', mowerId);
        }
      }
      
      if (data.settings) {
        // Settings data - process with throttling
        const processed = await throttleUpdates(data.settings, 'settings', mowerId);
        if (processed) {
          this.stats.dataSentToFirebase++;
          this.events.emitSentToFirebase(data.settings, 'settings', mowerId);
        }
      }
      
      if (data.calendar) {
        // Calendar data - process with throttling
        const processed = await throttleUpdates(data.calendar, 'calendar', mowerId);
        if (processed) {
          this.stats.dataSentToFirebase++;
          this.events.emitSentToFirebase(data.calendar, 'calendar', mowerId);
        }
      }
    } catch (error) {
      console.error('Error processing data payload:', error);
      this.logError('data_processing_error', error);
      if (error instanceof Error) {
        this.events.emitError(error);
      }
    }
  }
  
  /**
   * Process status message
   * @param data Status data
   */
  private async processStatus(data: any): Promise<void> {
    // Handle status messages if needed
    console.log('Received status message:', data);
  }
}

// Create and export singleton instance
const webSocketManager = new HusqvarnaWebSocketManager();
export default webSocketManager; 