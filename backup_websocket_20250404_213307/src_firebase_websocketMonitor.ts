import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import webSocketManager from '../services/husqvarnaWebSocket';

// Initialize Firebase if needed
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Automatically initiate WebSocket connection when this module is loaded (on deployment)
(async function initiateOnDeploy() {
  try {
    console.log('Automatically initiating WebSocket connection on deployment/cold start...');
    await webSocketManager.connect();
    console.log('WebSocket connection initiated successfully on deployment/cold start.');
  } catch (error) {
    console.error('Failed to initiate WebSocket connection on deployment/cold start:', error);
  }
})();

/**
 * Firebase Function that monitors WebSocket health
 * 
 * This function runs every 8 minutes to check if the WebSocket connection
 * is still active and reconnects if needed.
 */
export const monitorWebSocketHealth = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '128MB'
  })
  .pubsub.schedule('every 8 minutes')
  .onRun(async (context) => {
    const db = admin.firestore();
    
    try {
      // Check WebSocket status
      const wsStatus = await db.collection('system').doc('websocket').get();
      
      if (!wsStatus.exists) {
        // No status yet, initiate connection
        console.log('No WebSocket status found, initiating connection...');
        await webSocketManager.connect();
        return null;
      }
      
      const status = wsStatus.data();
      if (!status) {
        console.log('WebSocket status document exists but has no data, reconnecting...');
        await webSocketManager.connect();
        return null;
      }
      
      const lastUpdate = status.lastUpdate?.toDate() || new Date(0);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      
      // If WebSocket status is out of date or disconnected, reconnect
      if (diffMinutes > 10 || !status.connected) {
        console.log(`WebSocket appears to be disconnected or stale (${diffMinutes.toFixed(2)} minutes since last update), reconnecting...`);
        await webSocketManager.connect();
      } else {
        console.log(`WebSocket appears to be healthy (${diffMinutes.toFixed(2)} minutes since last update).`);
      }
      
      return null;
    } catch (error) {
      console.error('Error in WebSocket health monitor:', error);
      
      // Log error to Firestore
      try {
        await db.collection('logs').add({
          type: 'websocket_monitor_error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          details: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
      } catch (logError) {
        console.error('Error logging to Firebase:', logError);
      }
      
      // Attempt to reconnect even if there was an error in monitoring
      try {
        console.log('Trying to reconnect after error...');
        await webSocketManager.connect();
      } catch (reconnectError) {
        console.error('Failed to reconnect after error:', reconnectError);
      }
      
      return null;
    }
  }); 