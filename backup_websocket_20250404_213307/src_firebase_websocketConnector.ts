import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import webSocketManager from '../services/husqvarnaWebSocket';
import cors from 'cors';

// Initialize Firebase if needed
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Create a CORS middleware instance
const corsHandler = cors({
  origin: true, // Allow requests from any origin in development
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // 24 hours
});

/**
 * Firebase Function that initiates and maintains the WebSocket connection
 * 
 * This is a callable function that can be triggered from the client to
 * start the WebSocket connection manually.
 */
export const initiateWebSocketConnection = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes (maximum allowable for standard functions)
    memory: '256MB'
  })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // Log the request for debugging
    console.log('WebSocket initialization request received', { 
      auth: context.auth ? 'authenticated' : 'unauthenticated',
      origin: context.rawRequest?.headers.origin || 'unknown'
    });
    
    // Allow non-authenticated requests during development
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         context.rawRequest?.headers.origin?.includes('localhost');
    
    if (!context.auth && !isDevelopment) {
      console.error('Authentication required but not provided');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to initiate WebSocket'
      );
    }
    
    try {
      console.log('Attempting to connect to WebSocket...');
      await webSocketManager.connect();
      
      console.log('WebSocket connection successful');
      return {
        success: true,
        message: 'WebSocket connection initiated',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error initiating WebSocket:', error);
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      
      throw new functions.https.HttpsError(
        'internal',
        `Failed to initiate WebSocket connection: ${errorMessage}`,
        { 
          details: errorMessage,
          stack: errorStack,
          timestamp: new Date().toISOString()
        }
      );
    }
  });

/**
 * HTTP version of the WebSocket initiator function
 * This version handles CORS and is more compatible with local development
 */
export const initiateWebSocketConnectionHttp = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '256MB'
  })
  .https.onRequest(async (req, res) => {
    // Apply CORS middleware
    return corsHandler(req, res, async () => {
      try {
        // Log request details for debugging
        console.log('HTTP WebSocket init request received', {
          origin: req.headers.origin || 'unknown',
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        
        if (req.method === 'OPTIONS') {
          // Handle preflight request
          res.status(204).send('');
          return;
        }
        
        // Connect to WebSocket
        await webSocketManager.connect();
        
        // Send success response
        res.status(200).json({
          success: true,
          message: 'WebSocket connection initiated via HTTP endpoint',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error in HTTP WebSocket initialization:', error);
        
        // Send error response
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });
  }); 