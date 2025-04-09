import * as admin from 'firebase-admin';
import * as functions from './src/firebase';

// Initialize Firebase
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export all functions
export const initiateWebSocketConnection = functions.initiateWebSocketConnection;
export const monitorWebSocketHealth = functions.monitorWebSocketHealth; 