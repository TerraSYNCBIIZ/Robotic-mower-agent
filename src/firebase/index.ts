import * as admin from 'firebase-admin';
import { initiateWebSocketConnection } from './websocketConnector';
import { monitorWebSocketHealth } from './websocketMonitor';

// Initialize Firebase if it hasn't been initialized elsewhere
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export functions
export {
  initiateWebSocketConnection,
  monitorWebSocketHealth
}; 