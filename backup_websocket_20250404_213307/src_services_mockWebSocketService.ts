/**
 * Mock WebSocket service for development mode
 * This mimics the functionality of the real WebSocket service but works client-side
 * for development and testing without requiring actual API connections
 */
class MockWebSocketService {
  private isConnected: boolean = false;
  private simulatedDelay: number = 1500; // ms to simulate network latency
  private statusUpdateListeners: Array<(status: boolean) => void> = [];
  
  /**
   * Connect to a simulated WebSocket
   * @returns A promise that resolves when the connection is established
   */
  async connect(): Promise<void> {
    console.log('🔄 [MOCK] Connecting to simulated WebSocket...');
    
    return new Promise((resolve) => {
      // Simulate connection delay
      setTimeout(() => {
        this.isConnected = true;
        console.log('✅ [MOCK] WebSocket connected successfully');
        
        // Notify listeners
        this.statusUpdateListeners.forEach(listener => listener(true));
        
        // Setup auto-disconnect after 5 minutes to simulate timeouts
        setTimeout(() => {
          if (this.isConnected) {
            this.isConnected = false;
            console.log('❌ [MOCK] WebSocket disconnected (timeout)');
            this.statusUpdateListeners.forEach(listener => listener(false));
          }
        }, 5 * 60 * 1000);
        
        resolve();
      }, this.simulatedDelay);
    });
  }
  
  /**
   * Disconnect from the simulated WebSocket
   */
  disconnect(): void {
    if (this.isConnected) {
      this.isConnected = false;
      console.log('❌ [MOCK] WebSocket disconnected (manual)');
      this.statusUpdateListeners.forEach(listener => listener(false));
    }
  }
  
  /**
   * Check if the WebSocket is connected
   * @returns Connection status
   */
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }
  
  /**
   * Subscribe to status updates
   * @param listener Function to call when status changes
   * @returns Unsubscribe function
   */
  onStatusUpdate(listener: (status: boolean) => void): () => void {
    this.statusUpdateListeners.push(listener);
    
    // Immediately call with current status
    listener(this.isConnected);
    
    // Return unsubscribe function
    return () => {
      this.statusUpdateListeners = this.statusUpdateListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Get current connection status
   * @returns Object with connection status details
   */
  getStatus(): { connected: boolean; lastUpdate: Date; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      lastUpdate: new Date(),
      reconnectAttempts: 0
    };
  }
}

// Create and export a singleton instance
const mockWebSocketService = new MockWebSocketService();
export default mockWebSocketService; 