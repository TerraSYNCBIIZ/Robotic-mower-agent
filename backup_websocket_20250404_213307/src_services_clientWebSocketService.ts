import EventEmitter from 'events';

// Create a typed event emitter for WebSocket events
export class WebSocketEventEmitter extends EventEmitter {
  emitMessage(message: any): void {
    this.emit('message', message);
  }
  
  emitSentToData(data: any, type: string, mowerId: string): void {
    this.emit('sent-to-data', { data, type, mowerId, timestamp: new Date() });
  }
  
  emitStatus(status: { connected: boolean, timestamp: Date }): void {
    this.emit('status-change', status);
  }
  
  emitError(error: Error): void {
    this.emit('error', error);
  }
}

/**
 * Client-side WebSocket service for monitoring
 * Doesn't try to connect to real WebSockets but acts as a monitoring layer
 */
class ClientWebSocketService {
  // Event emitter for UI monitoring
  public events = new WebSocketEventEmitter();
  private isConnected: boolean = false;
  
  // Statistics
  private stats = {
    messagesReceived: 0,
    messagesByType: {} as Record<string, number>,
    dataSentToFirebase: 0,
    lastMessageTime: new Date(),
    errors: 0
  };
  
  // Getter for statistics
  public getStats() {
    return { ...this.stats };
  }
  
  /**
   * Record a message being received
   */
  recordMessage(message: any): void {
    this.stats.messagesReceived++;
    this.stats.lastMessageTime = new Date();
    
    if (message.type) {
      this.stats.messagesByType[message.type] = (this.stats.messagesByType[message.type] || 0) + 1;
    }
    
    this.events.emitMessage(message);
  }
  
  /**
   * Record data being sent to Firebase
   */
  recordDataSent(data: any, type: string, mowerId: string): void {
    this.stats.dataSentToFirebase++;
    this.events.emitSentToData(data, type, mowerId);
  }
  
  /**
   * Record connection status change
   */
  recordStatus(connected: boolean): void {
    this.isConnected = connected;
    this.events.emitStatus({
      connected,
      timestamp: new Date()
    });
  }
  
  /**
   * Record an error
   */
  recordError(error: Error): void {
    this.stats.errors++;
    this.events.emitError(error);
  }
  
  /**
   * Check if connected
   */
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }
}

// Create singleton instance
const clientWebSocketService = new ClientWebSocketService();
export default clientWebSocketService; 