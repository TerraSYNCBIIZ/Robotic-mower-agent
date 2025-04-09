import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import firebaseAdmin from './firebase-admin.mjs';

// Load environment variables
dotenv.config();

// Enable debug logging
const DEBUG = process.env.DEBUG === 'true';
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';
const log = (message, ...args) => {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
};
const debug = (...args) => {
  if (DEBUG && (VERBOSE_LOGGING || args[0]?.startsWith('[ERROR]') || args[0]?.startsWith('[WARN]'))) {
    log('[DEBUG]', ...args);
  }
};
const logError = (...args) => {
  console.error(`[${new Date().toISOString()}] [ERROR]`, ...args);
};
const logWarning = (...args) => {
  console.warn(`[${new Date().toISOString()}] [WARN]`, ...args);
};
const logEvent = (...args) => {
  console.log(`[${new Date().toISOString()}] [EVENT]`, ...args);
};

// Add Firebase-specific logging functions
const logFirebase = (...args) => {
  console.log(`[${new Date().toISOString()}] [FIREBASE]`, ...args);
};
const logFirebaseQueue = (...args) => {
  console.log(`[${new Date().toISOString()}] [FIREBASE:QUEUE]`, ...args);
};
const logFirebaseSave = (...args) => {
  console.log(`[${new Date().toISOString()}] [FIREBASE:SAVE]`, ...args);
};
const logFirebaseThrottle = (...args) => {
  console.log(`[${new Date().toISOString()}] [FIREBASE:THROTTLE]`, ...args);
};

// Determine the directory where this file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for required environment variables
const checkEnvironment = () => {
  const requiredVars = [
    'HUSQVARNA_API_KEY',
    'HUSQVARNA_CLIENT_ID',
    'HUSQVARNA_CLIENT_SECRET'
  ];
  
  const missing = requiredVars.filter(name => !process.env[name] || process.env[name].includes('placeholder'));
  
  if (missing.length > 0) {
    logError(`Missing or placeholder environment variables: ${missing.join(', ')}`);
    logError('Please update your .env file with valid credentials');
    process.exit(1); // Exit process if required credentials are missing
  }
};

// Validate environment variables
checkEnvironment();

// Replace all old Firebase initialization code with this
let admin = firebaseAdmin;
let db = admin ? admin.firestore() : null;
let firebaseInitialized = !!admin;

// Log Firebase initialization status
if (firebaseInitialized) {
  log('Firebase Admin SDK initialized successfully, Firestore available');
  
  // Initialize Firestore settings
  db.settings({
    ignoreUndefinedProperties: true // Ignore undefined fields
  });
  
  // Create initial system record
  try {
    db.collection('system').doc('websocket').set({
      initialized: true,
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      connected: false,
      version: '1.1.0',
      environment: process.env.NODE_ENV || 'development',
      lastInitialized: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    logError('Error creating system record:', error);
  }
} else {
  logWarning('Firebase Admin SDK failed to initialize, running without database storage');
}

// Configuration
const PORT = process.env.PORT || 8081;
const HUSQVARNA_API_KEY = process.env.HUSQVARNA_API_KEY;
const HUSQVARNA_CLIENT_ID = process.env.HUSQVARNA_CLIENT_ID;
const HUSQVARNA_CLIENT_SECRET = process.env.HUSQVARNA_CLIENT_SECRET;
const TOKEN_URL = 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token';
const HUSQVARNA_WS_URL = 'wss://ws.openapi.husqvarna.dev/v1';
const HUSQVARNA_API_URL = 'https://api.amc.husqvarna.dev/v1';

// Track connected clients and the Husqvarna WebSocket connection
const clients = new Set();
let husqvarnaWs = null;
let reconnectTimeout = null;
let authToken = null;
let tokenExpiry = 0;
let isReconnecting = false;

// Variables to store user token from client
let userProvidedToken = null;

// Add connection management variables with circuit breaker pattern
let lastReconnectTime = 0;
let consecutiveFailures = 0;
const MIN_RECONNECT_INTERVAL = 30000; // 30 seconds minimum between reconnects
const CIRCUIT_BREAKER_THRESHOLD = 5; // After 5 consecutive failures, activate circuit breaker
const CIRCUIT_BREAKER_RESET_TIME = 300000; // 5 minutes pause when circuit breaker trips
let circuitBreakerUntil = 0; // Timestamp when circuit breaker will reset

// Token management
async function getAuthToken() {
  try {
    // Check if token is still valid (with 5-minute buffer)
    const now = Date.now();
    if (authToken && tokenExpiry > now + 300000) {
      debug('Using existing auth token');
      return authToken;
    }
    
    log('Getting new auth token...');
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', HUSQVARNA_CLIENT_ID);
    params.append('client_secret', HUSQVARNA_CLIENT_SECRET);
    
    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000 // 10 second timeout for token requests
    });
    
    if (!response.data || !response.data.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }
    
    authToken = response.data.access_token;
    // Set expiry time (convert seconds to milliseconds and subtract 5 minutes for safety)
    const expiresIn = response.data.expires_in || 1800; // Default to 30 minutes if not provided
    tokenExpiry = now + (expiresIn * 1000) - 300000;
    
    log('New auth token obtained, expires in', 
      Math.floor((tokenExpiry - now) / 60000), 'minutes');
    
    // Broadcast token refresh event to clients (for debugging)
    if (DEBUG) {
      broadcastToClients({
        type: 'debug',
        event: 'token_refresh',
        expires_in: Math.floor((tokenExpiry - now) / 60000),
        timestamp: new Date().toISOString()
      });
    }
    
    return authToken;
  } catch (err) {
    logError('Failed to get auth token:', err.message);
    if (err.response) {
      logError('Response status:', err.response.status);
      logError('Response data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      logError('No response received, network issue');
    }
    
    // Reset token state
    authToken = null;
    tokenExpiry = 0;
    
    throw err;
  }
}

// Create HTTP server
const server = createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    // Simple health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok', 
      clients: clients.size,
      connectedToHusqvarna: husqvarnaWs && husqvarnaWs.readyState === WebSocket.OPEN,
      firebase: admin ? 'connected' : 'disconnected',
      tokenExpiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : null
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Throttle mechanism to prevent excessive Firestore writes
const throttleSettings = {
  battery: 60000,      // 1 minute
  position: 30000,     // 30 seconds
  mower: 60000,        // 1 minute
  statistics: 300000,  // 5 minutes
  settings: 300000,    // 5 minutes 
  calendar: 3600000,   // 1 hour
  system: 600000,      // 10 minutes
  headlight: 300000,   // 5 minutes
  cuttingHeight: 300000, // 5 minutes
  default: 60000       // Default for any other event types
};

// Add a list of high-priority events that shouldn't be throttled
const highPriorityEvents = [
  'error',                // Always process error events immediately
  'message',              // Always process user messages immediately
  'planner'               // Always process schedule changes immediately
];

const lastUpdates = {
  // Structure: { mowerId: { dataType: timestamp } }
};

// Add Firebase operation statistics
const firebaseStats = {
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  throttledOperations: 0,
  queuedOperations: 0,
  operationQueue: []
};

function shouldThrottle(mowerId, dataType) {
  // Never throttle high priority events
  if (highPriorityEvents.includes(dataType)) {
    return false;
  }

  const now = Date.now();
  if (!lastUpdates[mowerId]) {
    lastUpdates[mowerId] = {};
  }
  
  const lastUpdate = lastUpdates[mowerId][dataType] || 0;
  const throttleTime = throttleSettings[dataType] || throttleSettings.default;
  
  if (now - lastUpdate < throttleTime) {
    // Add logging for throttled operations
    logFirebaseThrottle(`Throttling ${dataType} update for mower ${mowerId}, next update allowed in ${(throttleTime - (now - lastUpdate))/1000}s`);
    firebaseStats.throttledOperations++;
    return true;
  }
  
  lastUpdates[mowerId][dataType] = now;
  return false;
}

// Function to generate a UUID for message IDs
function randomUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// Keep-alive ping interval
let pingInterval = null;

function startPingInterval() {
  // Clear existing interval
  if (pingInterval) {
    clearInterval(pingInterval);
  }
  
  // Send empty message every 60 seconds to keep connection alive
  // According to Husqvarna docs: "If you want a response, you can instead send an empty message to get an empty message in response"
  pingInterval = setInterval(() => {
    if (husqvarnaWs && husqvarnaWs.readyState === WebSocket.OPEN) {
      husqvarnaWs.send('');
      debug('Empty message sent to keep connection alive');
    }
  }, 60000); // 60 seconds as per documentation
}

// Schedule reconnection before token expires
function scheduleReconnection() {
  // Clear existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // Calculate time until token expiry (minus 5 minutes for safety)
  const now = Date.now();
  
  // Husqvarna docs state 2-hour max connection time, so reconnect after 110 minutes regardless of token
  const maxConnectionTime = 110 * 60 * 1000; // 110 minutes in ms
  
  // Use the earlier of token expiry or max connection time
  const tokenExpireTime = tokenExpiry - now - 300000; // 5 min before token expiry
  const reconnectTime = Math.min(maxConnectionTime, Math.max(tokenExpireTime, 60000)); // At least 1 minute
  
  log(`Scheduling reconnection in ${Math.floor(reconnectTime / 60000)} minutes (token expires in ${Math.floor((tokenExpiry - now) / 60000)} minutes)`);
  
  reconnectTimeout = setTimeout(() => {
    log('Scheduled reconnection triggered');
    isReconnecting = false;
    connectToHusqvarna();
  }, reconnectTime);
}

// Connect to Husqvarna WebSocket API
async function connectToHusqvarna() {
  // Apply circuit breaker pattern
  const now = Date.now();
  
  // Check if we're in a circuit breaker cooldown period
  if (circuitBreakerUntil > now) {
    const waitTime = Math.ceil((circuitBreakerUntil - now) / 1000);
    logWarning(`Circuit breaker active, pausing reconnection attempts for ${waitTime} seconds`);
    setTimeout(() => {
      isReconnecting = false;
      connectToHusqvarna();
    }, circuitBreakerUntil - now + 1000);
    return;
  }
  
  // Enforce minimum time between reconnection attempts
  const timeSinceLastReconnect = now - lastReconnectTime;
  if (isReconnecting || (timeSinceLastReconnect < MIN_RECONNECT_INTERVAL && lastReconnectTime > 0)) {
    const waitTime = Math.ceil((MIN_RECONNECT_INTERVAL - timeSinceLastReconnect) / 1000);
    debug(`Enforcing reconnection cooldown, waiting ${waitTime}s before trying again`);
    setTimeout(() => {
      isReconnecting = false;
      connectToHusqvarna();
    }, MIN_RECONNECT_INTERVAL - timeSinceLastReconnect + 100);
    return;
  }
  
  // Update reconnection timestamp and set flag
  lastReconnectTime = now;
  isReconnecting = true;
  
  try {
    // Close existing connection if any
    if (husqvarnaWs) {
      husqvarnaWs.terminate();
      husqvarnaWs = null;
    }
    
    // Get a fresh token every time we reconnect to avoid 403 errors
    // This follows Husqvarna docs recommendation: "Try to renew the application"
    let token;
    if (userProvidedToken) {
      // If using user token from client, keep using it
      token = userProvidedToken;
      log('Using token provided by client');
    } else {
      // Otherwise force a new token generation
      authToken = null; // Clear cached token
      tokenExpiry = 0;  // Reset expiry time
      token = await getAuthToken();
      log('Generated fresh token for reconnection');
    }
    
    // Check DNS resolution before connecting
    try {
      debug('Checking DNS resolution for Husqvarna WebSocket server...');
      const { lookup } = await import('dns');
      const { promisify } = await import('util');
      const lookupPromise = promisify(lookup);
      
      // Extract hostname from WebSocket URL
      const wsUrl = new URL(HUSQVARNA_WS_URL);
      await lookupPromise(wsUrl.hostname);
      debug(`DNS resolution successful for ${wsUrl.hostname}`);
    } catch (dnsError) {
      logError(`DNS resolution failed: ${dnsError.message}`);
      logError('Please check your network connection, firewall settings, or DNS configuration');
      throw new Error(`Cannot resolve hostname: ${dnsError.message}`);
    }
    
    // Connect to Husqvarna WebSocket with only the Authorization header as per docs
    log('Connecting to Husqvarna WebSocket...');
    husqvarnaWs = new WebSocket(HUSQVARNA_WS_URL, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Set up event handlers for Husqvarna WebSocket
    husqvarnaWs.on('open', async () => {
      log('Connected to Husqvarna WebSocket');
      
      // Reset consecutive failures counter on successful connection
      consecutiveFailures = 0;
      
      // Update connection status in Firestore
      updateConnectionStatus(true);
      
      // Schedule reconnection before token expires
      scheduleReconnection();
      
      // Broadcast connection status to clients
      broadcastToClients({
        type: 'status',
        connected: true,
        timestamp: new Date().toISOString()
      });
      
      try {
        // Step 1: Fetch user's mowers from the REST API
        const { userId, mowerIds } = await fetchUserMowers(token);
        
        // Step 2: Initialize with user ID
        log(`Initializing WebSocket with user ID: ${userId}`);
        const initMessage = {
          id: randomUUID(),
          type: 'initialize',
          attributes: {
            userId: userId
          }
        };
        husqvarnaWs.send(JSON.stringify(initMessage));
        
        // Step 3: Subscribe to each mower's topic after a short delay
        setTimeout(() => {
          if (mowerIds.length === 0) {
            logWarning('No mowers found to subscribe to');
          } else {
            log(`Subscribing to ${mowerIds.length} mowers...`);
            
            mowerIds.forEach((mowerId, index) => {
              setTimeout(() => {
                log(`Subscribing to mower: ${mowerId}`);
                const subscribeMessage = {
                  id: randomUUID(),
                  type: 'start-subscription',
                  attributes: {
                    topics: [`mower/${mowerId}`]
                  }
                };
                husqvarnaWs.send(JSON.stringify(subscribeMessage));
              }, index * 100); // Stagger subscriptions
            });
          }
        }, 1000); // Wait 1s after initialization
      } catch (error) {
        logError('Failed to initialize WebSocket subscriptions:', error);
      }
      
      // Start ping interval to keep connection alive
      startPingInterval();
    });
    
    husqvarnaWs.on('message', async (data) => {
      try {
        // Check if the data is empty or a ping response
        const messageStr = data.toString();
        if (!messageStr || messageStr.trim() === '') {
          debug('Received empty message (ping response)');
          return;
        }
        
        // Try to parse as JSON
        let message;
        try {
          message = JSON.parse(messageStr);
          
          // Handle initial "ready" message specifically 
          if (message.ready === true && message.connectionId) {
            log(`WebSocket connection ready with ID: ${message.connectionId}`);
            return;
          }
          
          // Handle acknowledgment messages for subscriptions
          if (message.type === 'start-subscription-ack') {
            log(`Successfully subscribed to topic: ${message.attributes?.topics?.join(', ') || 'unknown'}`);
            return;
          }
          
          // Handle subscription failure messages
          if (message.type === 'start-subscription-nack') {
            logWarning(`Failed to subscribe: ${message.attributes?.error || 'Unknown error'}`);
            return;
          }
          
          // Only log event messages, not connection messages
          if (message.type && message.type.endsWith('-event-v2')) {
            logEvent(`Received ${message.type} for mower ID: ${message.id || 'unknown'}`);
            
            if (VERBOSE_LOGGING) {
              debug('Message content:', JSON.stringify(message, null, 2));
            }
          } else {
            debug(`Received message type: ${message.type || 'unknown'}`);
          }
        } catch (parseError) {
          // Not JSON, handle as plain text message
          debug('Received non-JSON message:', messageStr);
          
          // Forward raw message to clients
          broadcastToClients({
            type: 'raw',
            data: messageStr,
            timestamp: new Date().toISOString()
          });
          
          return;
        }
        
        // Forward message to connected clients
        broadcastToClients(message);
        
        // Process event messages for mowers
        if (message.type && message.type.endsWith('-event-v2') && message.id) {
          // Extract mower ID and event type
          const mowerId = message.id;
          const eventType = message.type.replace('-event-v2', '');
          
          // Skip throttled events
          if (!shouldThrottle(mowerId, eventType)) {
            // Save to Firebase using improved function
            await saveEventToFirestore(mowerId, eventType, message.attributes, message.type);
          } else {
            logFirebaseThrottle(`Throttled ${eventType} update for mower ${mowerId}`);
          }
        }
      } catch (processError) {
        // Don't treat message processing errors as critical - just log and continue
        logError('Error processing WebSocket message:', processError.message);
        if (VERBOSE_LOGGING) {
          console.error(processError);
        }
      }
    });
    
    husqvarnaWs.on('error', (wsError) => {
      logError('Husqvarna WebSocket error:', wsError.message || wsError);
      const errorDetails = getNetworkErrorType(wsError);
      logError(`Error type: ${errorDetails.type} - ${errorDetails.message}`);
      
      // Broadcast more detailed error to clients
      broadcastToClients({
        type: 'error',
        errorType: errorDetails.type,
        message: errorDetails.message,
        timestamp: new Date().toISOString()
      });
      
      saveErrorToFirebase('husqvarna_websocket_error', {
        ...wsError,
        errorType: errorDetails.type,
        errorDetails: errorDetails.message
      });
    });
    
    husqvarnaWs.on('close', (code, reason) => {
      log(`Husqvarna WebSocket closed with code ${code} and reason: ${reason || 'No reason provided'}`);
      
      // Clear ping interval
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      // Clear reconnection timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Update connection status
      updateConnectionStatus(false);
      
      // Broadcast connection status to clients
      broadcastToClients({
        type: 'status',
        connected: false,
        timestamp: new Date().toISOString()
      });
      
      // Handle reconnection based on the close code
      if (code === 1000) {
        // Normal closure, schedule reconnection after a short delay
        log('Normal closure, will reconnect in 5 seconds');
        setTimeout(() => {
          isReconnecting = false;
          connectToHusqvarna();
        }, 5000);
      } else if (code === 1006) {
        // Abnormal closure, likely network issue
        logWarning('Abnormal closure (code 1006), likely network issue');
        setTimeout(() => {
          isReconnecting = false;
          connectToHusqvarna();
        }, 10000);
      } else if (code === 1008 || code === 1011) {
        // Policy violation or server error, wait longer
        logWarning(`Server policy violation or error: ${code} ${reason}`);
        setTimeout(() => {
          isReconnecting = false;
          connectToHusqvarna();
        }, 30000);
      } else if (code === 1012) {
        // Server is restarting, reconnect after 10 seconds
        log('Server restarting, will reconnect in 10 seconds');
        setTimeout(() => {
          isReconnecting = false;
          connectToHusqvarna();
        }, 10000);
      } else {
        // Other errors, use exponential backoff
        const delay = Math.min(10000 * Math.pow(1.5, Math.min(consecutiveFailures || 0, 5)), 60000);
        logWarning(`Will attempt reconnection in ${Math.floor(delay/1000)} seconds`);
        
        setTimeout(() => {
          isReconnecting = false;
          connectToHusqvarna();
        }, delay);
      }
    });
  } catch (connectionError) {
    logError('Failed to connect to Husqvarna WebSocket:', connectionError.message);
    saveErrorToFirebase('husqvarna_websocket_connection_error', connectionError);
    
    // Increment consecutive failures counter
    consecutiveFailures++;
    
    // Activate circuit breaker if too many consecutive failures
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreakerUntil = Date.now() + CIRCUIT_BREAKER_RESET_TIME;
      logWarning(`Circuit breaker activated after ${consecutiveFailures} consecutive failures. Pausing reconnection for ${CIRCUIT_BREAKER_RESET_TIME/60000} minutes`);
      consecutiveFailures = 0;
      
      setTimeout(() => {
        log('Circuit breaker reset, resuming connection attempts');
        isReconnecting = false;
        connectToHusqvarna();
      }, CIRCUIT_BREAKER_RESET_TIME);
    } else {
      // Reset reconnecting flag and try again after a delay, with exponential backoff
      const delay = Math.min(10000 * Math.pow(1.5, consecutiveFailures), 30000);
      setTimeout(() => {
        isReconnecting = false;
        connectToHusqvarna();
      }, delay);
    }
  }
}

// Process event data and save to Firestore
async function saveEventToFirestore(mowerId, eventType, attributes, messageType) {
  if (!admin) {
    debug('Firebase not initialized, skipping save');
    return;
  }
  
  try {
    // Log operation starting
    logFirebaseQueue(`Queueing ${eventType} event for mower ${mowerId} to Firestore`);
    firebaseStats.queuedOperations++;
    firebaseStats.totalOperations++;
    
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const mowerRef = db.collection('mowers').doc(mowerId);
    
    // Basic update for all event types - update the mower document
    const basicUpdate = {
      lastEvent: {
        type: messageType,
        timestamp: now
      },
      lastUpdated: now,
      [`lastUpdated_${eventType}`]: now
    };
    
    // Add event-specific data if available
    if (attributes && attributes[eventType]) {
      basicUpdate[eventType] = attributes[eventType];
    }
    
    // Create a batch for multiple operations
    const batch = db.batch();
    
    // Update main mower document
    batch.set(mowerRef, basicUpdate, { merge: true });
    
    // Handle specific event types with custom processing
    switch (eventType) {
      case 'position':
        if (attributes?.position) {
          // Add to position history subcollection with timestamp
          const positionDoc = mowerRef.collection('positions').doc();
          batch.set(positionDoc, {
            ...attributes.position,
            timestamp: now
          });
          
          // Update latest position in main document for quick access
          batch.set(mowerRef, {
            latestPosition: {
              ...attributes.position,
              timestamp: now
            }
          }, { merge: true });
          
          logFirebaseQueue(`Adding position data to history for mower ${mowerId}`);
        }
        break;
        
      case 'battery':
        if (attributes?.battery) {
          // Add to battery history subcollection
          const batteryDoc = mowerRef.collection('batteryHistory').doc();
          batch.set(batteryDoc, {
            batteryPercent: attributes.battery.batteryPercent,
            timestamp: now
          });
          
          // Also store in a daily log for charting
          const today = new Date().toISOString().split('T')[0];
          const dailyBatteryRef = mowerRef.collection('dailyBattery').doc(today);
          
          // Use arrayUnion to add to the day's readings - with JavaScript Date instead of serverTimestamp
          batch.set(dailyBatteryRef, {
            date: today,
            readings: admin.firestore.FieldValue.arrayUnion({
              batteryPercent: attributes.battery.batteryPercent,
              timestamp: new Date() // Use JavaScript Date instead of serverTimestamp for array elements
            })
          }, { merge: true });
          
          logFirebaseQueue(`Adding battery data (${attributes.battery.batteryPercent}%) to history for mower ${mowerId}`);
        }
        break;
        
      case 'mower':
        if (attributes?.mower) {
          // Add to status history subcollection
          const statusDoc = mowerRef.collection('statusHistory').doc();
          batch.set(statusDoc, {
            ...attributes.mower,
            timestamp: now
          });
          
          // Track state changes separately
          // This helps with analyzing how much time is spent in each state
          const activityState = `${attributes.mower.activity || 'UNKNOWN'}_${attributes.mower.state || 'UNKNOWN'}`;
          batch.set(mowerRef, {
            activityStates: admin.firestore.FieldValue.arrayUnion({
              state: activityState,
              mode: attributes.mower.mode || 'UNKNOWN',
              timestamp: now
            })
          }, { merge: true });
        }
        break;
        
      case 'error':
        if (attributes?.error) {
          // All errors go to a dedicated errors collection
          const errorDoc = mowerRef.collection('errors').doc();
          
          // Include full error details
          batch.set(errorDoc, {
            ...attributes.error,
            timestamp: now
          });
          
          // Also update latest error in main document
          batch.set(mowerRef, {
            latestError: {
              ...attributes.error,
              timestamp: now
            }
          }, { merge: true });
        }
        break;
        
      case 'statistics':
        if (attributes?.statistics) {
          // Store complete statistics snapshot
          const statsDoc = mowerRef.collection('statistics').doc();
          batch.set(statsDoc, {
            ...attributes.statistics,
            timestamp: now
          });
        }
        break;
        
      // Add other event types as needed
      
      default:
        // For all other event types, just store in type-specific subcollection
        if (attributes && attributes[eventType]) {
          const historyDoc = mowerRef.collection(`${eventType}History`).doc();
          batch.set(historyDoc, {
            ...attributes[eventType],
            timestamp: now
          });
          logFirebaseQueue(`Adding ${eventType} data to history for mower ${mowerId}`);
        }
        break;
    }
    
    // Commit all the batched writes
    logFirebaseQueue(`Committing batch with ${eventType} data for mower ${mowerId}...`);
    const startTime = Date.now();
    await batch.commit();
    const endTime = Date.now();
    logFirebaseSave(`Saved ${messageType} event to Firestore for mower ${mowerId} in ${endTime - startTime}ms`);
    firebaseStats.successfulOperations++;
    
    // Log statistics periodically (every 10 operations)
    if (firebaseStats.totalOperations % 10 === 0) {
      logFirebase(`Stats: ${firebaseStats.successfulOperations} saved, ${firebaseStats.throttledOperations} throttled, ${firebaseStats.failedOperations} failed out of ${firebaseStats.totalOperations} total`);
    }
    
    // Update system status to indicate active data flow
    await db.collection('system').doc('websocket').set({
      lastEventReceived: now,
      lastEventType: messageType,
      lastMowerId: mowerId
    }, { merge: true });
    
    return true;
  } catch (error) {
    logError(`Error saving ${eventType} event to Firestore:`, error.message);
    firebaseStats.failedOperations++;
    
    if (VERBOSE_LOGGING) {
      console.error(error);
    }
    
    // Log error to dedicated collection
    try {
      if (admin) {
        const db = admin.firestore();
        await db.collection('errors').add({
          type: 'firebase_write_error',
          mowerId: mowerId,
          eventType: eventType,
          message: error.message,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logFirebase(`Logged write error for ${eventType} to errors collection`);
      }
    } catch (logError) {
      console.error('Failed to log error to Firestore:', logError);
    }
    
    return false;
  }
}

// Update WebSocket connection status in Firestore
async function updateConnectionStatus(isConnected) {
  if (!admin) return;
  
  try {
    const db = admin.firestore();
    await db.collection('system').doc('websocket').set({
      connected: isConnected,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      proxyServer: true,
      proxyVersion: '1.0.0'
    }, { merge: true });
  } catch (error) {
    logError('Error updating connection status:', error.message);
  }
}

// Log error to Firestore
async function saveErrorToFirebase(type, err) {
  if (!admin) return;
  
  try {
    const db = admin.firestore();
    await db.collection('logs').add({
      type,
      error: err instanceof Error ? err.message : String(err),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: JSON.stringify(err, Object.getOwnPropertyNames(err))
    });
  } catch (logError) {
    logError('Error logging to Firebase:', logError.message);
  }
}

// Helper function to get error description based on error code
function getErrorDescription(errorCode) {
  const errorCodes = {
    0: 'No error',
    1: 'Unexpected error',
    2: 'Outside working area',
    3: 'No loop signal',
    4: 'Wrong loop signal',
    5: 'Charging station blocked',
    // Add more error codes as needed
  };
  
  return errorCodes[errorCode] || `Unknown error code: ${errorCode}`;
}

// Broadcast message to all connected proxy clients
function broadcastToClients(message) {
  const messageString = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
}

// Handle client connections to our proxy
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  log(`Client connected to proxy from: ${clientIp}`);
  
  // Extract token from URL query parameters if provided
  const url = new URL(req.url, 'http://localhost');
  const tokenFromQuery = url.searchParams.get('token');
  
  if (tokenFromQuery) {
    log('Received token from client, will use for WebSocket connection');
    userProvidedToken = tokenFromQuery;
    
    // If we have a token and an active connection, reconnect to use the new token
    if (husqvarnaWs && husqvarnaWs.readyState === WebSocket.OPEN) {
      log('Reconnecting with the provided token...');
      isReconnecting = false;
      connectToHusqvarna();
    }
  }
  
  // Add client to set
  clients.add(ws);
  
  // Send initial connection status
  ws.send(JSON.stringify({
    type: 'status',
    connected: husqvarnaWs && husqvarnaWs.readyState === WebSocket.OPEN,
    timestamp: new Date().toISOString(),
    clients: clients.size
  }));
  
  // Handle messages from client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      log('Received message from client:', data.type || 'unknown type');
      
      // Handle different message types
      if (data.type === 'command' && data.action && data.mowerId) {
        // Forward command to Husqvarna
        if (husqvarnaWs && husqvarnaWs.readyState === WebSocket.OPEN) {
          husqvarnaWs.send(JSON.stringify({
            type: 'command',
            mowerId: data.mowerId,
            action: data.action,
            parameters: data.parameters || {}
          }));
          
          log(`Sent command ${data.action} to mower ${data.mowerId}`);
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Not connected to Husqvarna WebSocket',
            timestamp: new Date().toISOString()
          }));
        }
      } else if (data.type === 'reconnect') {
        // Manual reconnection request
        log('Manual reconnection requested');
        isReconnecting = false;
        connectToHusqvarna();
        
        ws.send(JSON.stringify({
          type: 'status',
          message: 'Reconnection initiated',
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      logError('Error processing client message:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message',
        details: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    log('Client disconnected from proxy');
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (clientError) => {
    logError('Client WebSocket error:', clientError.message || clientError);
    clients.delete(ws);
  });
});

// Start server
server.listen(PORT, () => {
  log(`WebSocket proxy server running on port ${PORT}`);
  log('Environment loaded:', {
    hasApiKey: !!HUSQVARNA_API_KEY,
    hasClientId: !!HUSQVARNA_CLIENT_ID,
    hasClientSecret: !!HUSQVARNA_CLIENT_SECRET,
    port: PORT,
    firebaseConnected: !!admin
  });
  
  // Connect to Husqvarna immediately
  connectToHusqvarna();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down server...');
  
  // Close Husqvarna WebSocket
  if (husqvarnaWs) {
    husqvarnaWs.terminate();
  }
  
  // Clear intervals and timeouts
  if (pingInterval) clearInterval(pingInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  
  // Close server
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

// Add error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
  logError('Uncaught exception:', err);
  // Don't exit the process, just log the error
});

// Add error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled promise rejection:', reason);
  // Don't exit the process, just log the error
});

// Helper function to determine the type of network error
function getNetworkErrorType(error) {
  const message = error.message || '';
  
  if (message.includes('ENOTFOUND')) {
    return {
      type: 'dns',
      message: 'DNS resolution failed. Check your network connection and DNS settings.'
    };
  } else if (message.includes('ECONNREFUSED')) {
    return {
      type: 'connection',
      message: 'Connection refused. The server may be down or not accepting connections.'
    };
  } else if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return {
      type: 'timeout',
      message: 'Connection timed out. Check your network connection or firewall settings.'
    };
  } else if (message.includes('certificate') || message.includes('SSL')) {
    return {
      type: 'ssl',
      message: 'SSL/TLS error. There might be an issue with the server certificate or your security settings.'
    };
  }
  
  return {
    type: 'unknown',
    message: `Network error: ${message}`
  };
}

/**
 * Fetch user's mowers from Husqvarna API
 * @param {string} token - Access token
 * @returns {Promise<{userId: string, mowerIds: string[]}>}
 */
async function fetchUserMowers(token) {
  try {
    log('Fetching mowers directly...');
    
    // Skip the /users/me endpoint which returns 404
    // Instead, go directly to fetch mowers
    const mowersResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': HUSQVARNA_API_KEY
      }
    });
    
    if (!mowersResponse.data || !mowersResponse.data.data) {
      throw new Error('Could not retrieve mowers from Husqvarna API');
    }
    
    const mowers = mowersResponse.data.data;
    const mowerIds = mowers.map(mower => mower.id);
    
    // Get the user ID from the token instead (JWT contains user info)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    // Decode the JWT payload
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const userId = payload.sub || 'unknown';
    
    log(`Using user ID from token: ${userId}`);
    log(`Found ${mowerIds.length} mowers: ${mowerIds.join(', ')}`);
    
    return {
      userId,
      mowerIds,
      mowers
    };
  } catch (error) {
    logError('Error fetching user mowers:', error.message);
    if (error.response) {
      logError('Response status:', error.response.status);
      logError('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
} 