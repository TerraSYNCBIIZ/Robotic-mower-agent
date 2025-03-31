// WebSocket Proxy Server for Husqvarna API
// This server acts as a bridge between browser clients and Husqvarna's WebSocket API
// AND maintains a persistent connection to collect data regardless of client connections
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from parent directory's .env.local file
config({ path: join(__dirname, '..', '.env.local') });

// Configuration
const PORT = process.env.WEBSOCKET_PROXY_PORT || 8000;
const HUSQVARNA_WS_URL = 'wss://ws.openapi.husqvarna.dev/v1';
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes in ms (tokens last 60 min)
const CONNECTION_TIMEOUT = 60000; // 60 seconds
const RECONNECT_INTERVAL = 10000; // 10 seconds
const FIREBASE_UPDATE_THROTTLE = 5000; // Throttle updates to Firebase to once every 5 seconds per mower

// Store active connections for management
const connections = new Map();

// Firebase integration
let db = null;
const MOWERS_COLLECTION = 'mowers';
const UPDATE_TIMESTAMPS = {}; // Track last update timestamp per mower/data type
const UPDATE_QUEUE = {}; // Queue updates to be processed

// Initialize Firebase
function initializeFirebase() {
  try {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    
    if (!firebaseConfig.apiKey) {
      console.warn('Firebase configuration missing, data will not be stored persistently');
      return null;
    }
    
    // Initialize Firebase app
    const app = initializeApp(firebaseConfig);
    
    // Initialize Firestore
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return null;
  }
}

/**
 * Get a fresh OAuth token using client credentials
 */
async function getAccessToken() {
  try {
    const appKey = process.env.HUSQVARNA_APP_KEY;
    const appSecret = process.env.HUSQVARNA_CLIENT_SECRET;
    
    if (!appKey || !appSecret) {
      throw new Error('Missing API credentials in environment variables');
    }
    
    console.log('Getting fresh OAuth token from Husqvarna API...');
    
    const response = await axios({
      method: 'POST',
      url: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      data: `grant_type=client_credentials&client_id=${appKey}&client_secret=${appSecret}`
    });
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('Successfully obtained new OAuth token');
      return response.data.access_token;
    } else {
      throw new Error('Invalid response from Husqvarna authentication API');
    }
  } catch (error) {
    console.error('Error getting OAuth token:', error.message);
    throw error;
  }
}

// Process the update queue for Firebase at a controlled rate
function processUpdateQueue() {
  if (!db) return;
  
  const now = Date.now();
  
  // Process all queued updates
  Object.entries(UPDATE_QUEUE).forEach(([mowerId, dataTypes]) => {
    Object.entries(dataTypes).forEach(([dataType, data]) => {
      const lastUpdate = UPDATE_TIMESTAMPS[mowerId]?.[dataType] || 0;
      
      // Only update if it's been more than the throttle period
      if (now - lastUpdate > FIREBASE_UPDATE_THROTTLE) {
        updateFirebaseData(mowerId, dataType, data);
        
        // Update the timestamp
        if (!UPDATE_TIMESTAMPS[mowerId]) {
          UPDATE_TIMESTAMPS[mowerId] = {};
        }
        UPDATE_TIMESTAMPS[mowerId][dataType] = now;
        
        // Remove from queue
        delete UPDATE_QUEUE[mowerId][dataType];
      }
    });
    
    // Clean up empty mower entries
    if (Object.keys(UPDATE_QUEUE[mowerId]).length === 0) {
      delete UPDATE_QUEUE[mowerId];
    }
  });
}

// Process queue at regular intervals
setInterval(processUpdateQueue, 1000); // Check every second

// Update Firebase data
async function updateFirebaseData(mowerId, dataType, data) {
  if (!db) return;
  
  try {
    const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
    
    // Create update for the specific data type
    const update = {};
    update[dataType] = data;
    update['lastUpdated'] = serverTimestamp();
    
    // Add update timestamp
    update[`${dataType}_updated`] = serverTimestamp();
    
    // Update Firestore
    await setDoc(mowerRef, update, { merge: true });
    
    // Also store in history collection if needed
    if (dataType === 'position' || dataType === 'battery' || dataType === 'mower') {
      const historyData = {
        timestamp: serverTimestamp(),
        type: dataType,
        data
      };
      
      // Add to history collection
      await setDoc(
        doc(collection(db, MOWERS_COLLECTION, mowerId, 'history'), randomUUID()),
        historyData
      );
    }
    
    console.log(`Updated Firebase data for mower ${mowerId} - data type: ${dataType}`);
  } catch (error) {
    console.error(`Error updating Firebase for mower ${mowerId}:`, error);
  }
}

// Queue an update for Firebase
function queueFirebaseUpdate(mowerId, dataType, data) {
  if (!UPDATE_QUEUE[mowerId]) {
    UPDATE_QUEUE[mowerId] = {};
  }
  
  // Store the data to be processed later
  UPDATE_QUEUE[mowerId][dataType] = data;
}

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      connections: connections.size,
      uptime: process.uptime(),
      persistentConnection: persistentConnectionId ? 'active' : 'inactive'
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Heartbeat interval (ms)
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Persistent connection ID for the always-on connection
let persistentConnectionId = null;

// Create a persistent connection to Husqvarna WebSocket
async function createPersistentConnection() {
  try {
    console.log('Starting persistent connection to Husqvarna WebSocket API...');
    const token = await getAccessToken();
    
    // Create a new connection ID
    persistentConnectionId = randomUUID();
    console.log(`[PERSISTENT:${persistentConnectionId}] Creating persistent connection`);
    
    // Store connection in the connections map
    connections.set(persistentConnectionId, {
      clientWs: null, // No client for persistent connection
      husqvarnaWs: null,
      token,
      apiKey: process.env.HUSQVARNA_APP_KEY,
      connectedAt: new Date(),
      messageCount: 0,
      lastMessageTime: null,
      reconnectAttempts: 0,
      status: 'connecting',
      lastActivity: Date.now(),
      isAlive: true,
      isPersistent: true
    });
    
    // Connect to Husqvarna WebSocket
    connectToHusqvarnaWS(persistentConnectionId);
    
    // Set up token refresh timer
    setTimeout(() => {
      if (connections.has(persistentConnectionId)) {
        console.log(`[PERSISTENT:${persistentConnectionId}] Refreshing token`);
        
        // Close the current connection
        if (connections.get(persistentConnectionId).husqvarnaWs) {
          connections.get(persistentConnectionId).husqvarnaWs.close(1000, 'Token refresh');
        }
        
        // Re-create the persistent connection with a fresh token
        createPersistentConnection();
      }
    }, TOKEN_REFRESH_INTERVAL);
    
    return true;
  } catch (error) {
    console.error('Error creating persistent connection:', error);
    persistentConnectionId = null;
    
    // Try again after a delay
    setTimeout(createPersistentConnection, 60000);
    return false;
  }
}

// Handle new WebSocket connections from browsers
wss.on('connection', (clientWs, req) => {
  try {
    // Parse the URL to get the token from query parameters
    const parsedUrl = parse(req.url, true);
    const token = parsedUrl.query.token;
    const apiKey = parsedUrl.query.apiKey || process.env.HUSQVARNA_APP_KEY;
    
    if (!token) {
      console.error('No token provided in WebSocket connection');
      clientWs.close(1008, 'Authentication required');
      return;
    }
    
    // Generate a unique connection ID
    const connectionId = randomUUID();
    console.log(`[${connectionId}] New WebSocket connection established from browser`);
    
    // Add isAlive property for heartbeat
    clientWs.isAlive = true;
    
    // Handle pong messages to confirm client is alive
    clientWs.on('pong', () => {
      clientWs.isAlive = true;
      console.log(`[${connectionId}] Client heartbeat received (pong)`);
    });
    
    // Handle ping messages (custom ping from client)
    clientWs.on('ping', () => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.pong();
        console.log(`[${connectionId}] Responded to client ping with pong`);
      }
    });
    
    // Store the connection details
    connections.set(connectionId, {
      clientWs,
      husqvarnaWs: null,
      token,
      apiKey, 
      connectedAt: new Date(),
      messageCount: 0,
      lastMessageTime: null,
      reconnectAttempts: 0,
      status: 'connecting',
      lastActivity: Date.now(),
      isAlive: true,
      isPersistent: false
    });
    
    // If we have a persistent connection, share its data instead of making a new connection
    if (persistentConnectionId && connections.has(persistentConnectionId)) {
      console.log(`[${connectionId}] Using existing persistent connection`);
      watchPersistentConnection(connectionId);
    } else {
      // Otherwise create a dedicated connection for this client
      connectToHusqvarnaWS(connectionId);
    }
  } catch (error) {
    console.error('Error handling WebSocket connection:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Internal server error');
    }
  }
});

/**
 * Handle persistent connection messages for a client connection
 */
function watchPersistentConnection(clientConnectionId) {
  // Get client connection
  const clientConnection = connections.get(clientConnectionId);
  if (!clientConnection || !clientConnection.clientWs) return;
  
  // Get persistent connection
  const persistentConnection = connections.get(persistentConnectionId);
  if (!persistentConnection) return;
  
  // Watch for messages on the persistent connection
  const messageHandler = (message) => {
    try {
      // If client is still connected, send the message
      if (clientConnection.clientWs.readyState === WebSocket.OPEN) {
        clientConnection.clientWs.send(message);
        clientConnection.messageCount++;
        clientConnection.lastMessageTime = new Date();
        
        // Parse the message to log type
        try {
          const parsedMsg = JSON.parse(message.toString());
          console.log(`[${clientConnectionId}] Forwarded from persistent: ${parsedMsg.type || 'unknown'} event`);
        } catch (e) {
          console.log(`[${clientConnectionId}] Forwarded from persistent: ${message.length} bytes`);
        }
      }
    } catch (error) {
      console.error(`[${clientConnectionId}] Error forwarding message from persistent connection:`, error);
    }
  };
  
  // Function to send initial connection status
  const sendStatus = () => {
    try {
      if (clientConnection.clientWs.readyState === WebSocket.OPEN) {
        clientConnection.clientWs.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Connected via persistent WebSocket connection'
        }));
      }
    } catch (error) {
      console.error(`[${clientConnectionId}] Error sending status:`, error);
    }
  };
  
  // If the persistent connection is active, send connection status
  if (persistentConnection.status === 'connected' && 
      persistentConnection.husqvarnaWs &&
      persistentConnection.husqvarnaWs.readyState === WebSocket.OPEN) {
    sendStatus();
    
    // Add message listener
    persistentConnection.husqvarnaWs.on('message', messageHandler);
    
    // Add cleanup when client disconnects
    clientConnection.clientWs.on('close', () => {
      console.log(`[${clientConnectionId}] Client disconnected from persistent connection`);
      persistentConnection.husqvarnaWs.removeListener('message', messageHandler);
      connections.delete(clientConnectionId);
    });
    
    // Handle client errors
    clientConnection.clientWs.on('error', (error) => {
      console.error(`[${clientConnectionId}] Client error:`, error);
    });
    
    // Handle messages from client
    clientConnection.clientWs.on('message', (message) => {
      // If persistent connection is active, forward the message
      if (persistentConnection.husqvarnaWs && 
          persistentConnection.husqvarnaWs.readyState === WebSocket.OPEN) {
        try {
          // Check if it's a ping message (don't forward)
          let isPing = false;
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
              isPing = true;
              console.log(`[${clientConnectionId}] Client ping received (not forwarded)`);
            }
          } catch (e) {
            // Not JSON, just forward
          }
          
          // Forward non-ping messages
          if (!isPing) {
            clientConnection.messageCount++;
            console.log(`[${clientConnectionId}] Forwarding to Husqvarna: ${message}`);
            persistentConnection.husqvarnaWs.send(message);
          }
        } catch (error) {
          console.error(`[${clientConnectionId}] Error forwarding message to Husqvarna:`, error);
        }
      }
    });
    
  } else {
    // If persistent connection isn't ready, fall back to direct connection
    console.log(`[${clientConnectionId}] Persistent connection not ready, creating direct connection`);
    connectToHusqvarnaWS(clientConnectionId);
  }
}

/**
 * Connect to Husqvarna's WebSocket API for a specific connection
 */
async function connectToHusqvarnaWS(connectionId) {
  const connection = connections.get(connectionId);
  
  if (!connection) {
    console.error(`[${connectionId}] Connection not found`);
    return;
  }
  
  try {
    console.log(`[${connectionId}] Connecting to Husqvarna WebSocket API...`);
    
    // Update connection status
    connection.status = 'connecting';
    
    // Set up connection timeout
    const timeoutId = setTimeout(() => {
      if (connection.status === 'connecting') {
        console.error(`[${connectionId}] Connection to Husqvarna WebSocket API timed out`);
        if (connection.husqvarnaWs) {
          connection.husqvarnaWs.terminate();
          connection.husqvarnaWs = null;
        }
        
        // Try to reconnect if client is still connected or this is a persistent connection
        if ((connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) || connection.isPersistent) {
          connection.reconnectAttempts++;
          if (connection.reconnectAttempts < 5) {
            const delay = Math.min(30000, RECONNECT_INTERVAL * Math.pow(1.5, connection.reconnectAttempts));
            console.log(`[${connectionId}] Will retry in ${delay}ms (attempt ${connection.reconnectAttempts})`);
            setTimeout(() => connectToHusqvarnaWS(connectionId), delay);
          } else {
            console.error(`[${connectionId}] Maximum reconnection attempts reached`);
            
            if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
              connection.clientWs.close(1011, 'Failed to connect to Husqvarna API after multiple attempts');
            }
            
            if (connection.isPersistent) {
              console.error(`Persistent connection ${connectionId} failed. Will recreate in 1 minute.`);
              persistentConnectionId = null;
              setTimeout(createPersistentConnection, 60000);
            }
            
            connections.delete(connectionId);
          }
        }
      }
    }, CONNECTION_TIMEOUT);
    
    // Create the WebSocket connection to Husqvarna with token in header (as per their docs)
    const husqvarnaWs = new WebSocket(HUSQVARNA_WS_URL, {
      headers: {
        'Authorization': `Bearer ${connection.token}`,
        'X-Api-Key': connection.apiKey,
        'Authorization-Provider': 'husqvarna',
        'Accept': 'application/vnd.api+json'
      },
      // Set to false to prevent compression issues
      perMessageDeflate: false
    });
    
    // Add heartbeat properties to Husqvarna connection
    husqvarnaWs.isAlive = true;
    
    // Store the WebSocket connection
    connection.husqvarnaWs = husqvarnaWs;
    
    // Handle messages from Husqvarna
    husqvarnaWs.on('message', (message) => {
      try {
        // Always process message for Firebase updates if this is a persistent connection
        // or if there is no persistent connection
        if (connection.isPersistent || persistentConnectionId === null) {
          try {
            const messageStr = message.toString();
            const data = JSON.parse(messageStr);
            
            // Only process actual mower events
            if (data.id && data.type && data.attributes) {
              const mowerId = data.id;
              
              // Process different event types
              switch (data.type) {
                case 'battery-event-v2':
                  // Update battery data
                  queueFirebaseUpdate(mowerId, 'battery', {
                    batteryPercent: data.attributes.battery?.batteryPercent || 0,
                    timestamp: new Date()
                  });
                  break;
                  
                case 'mower-event-v2':
                  // Update mower status data
                  queueFirebaseUpdate(mowerId, 'mower', {
                    activity: data.attributes.mower?.activity || 'UNKNOWN',
                    state: data.attributes.mower?.state || 'UNKNOWN',
                    mode: data.attributes.mower?.mode || 'UNKNOWN',
                    timestamp: new Date()
                  });
                  break;
                  
                case 'position-event-v2':
                  // Update position data
                  if (data.attributes.position) {
                    queueFirebaseUpdate(mowerId, 'position', {
                      latitude: data.attributes.position.latitude,
                      longitude: data.attributes.position.longitude,
                      timestamp: new Date()
                    });
                  }
                  break;
                  
                case 'calendar-event-v2':
                  // Update calendar data
                  if (data.attributes.calendar) {
                    queueFirebaseUpdate(mowerId, 'calendar', {
                      tasks: data.attributes.calendar.tasks || [],
                      timestamp: new Date()
                    });
                  }
                  break;
                
                // Add other event types as needed
              }
            }
          } catch (parseError) {
            // Just log parsing errors and continue
            console.error(`[${connectionId}] Error parsing message:`, parseError);
          }
        }
        
        // If this is not a persistent connection, forward to client
        if (!connection.isPersistent && connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          connection.messageCount++;
          connection.lastMessageTime = new Date();
          connection.lastActivity = Date.now();
          connection.isAlive = true;
          
          // Log message type if JSON
          try {
            const parsedMsg = JSON.parse(message.toString());
            console.log(`[${connectionId}] Husqvarna -> Client: ${parsedMsg.type || 'unknown'} event`);
          } catch (e) {
            console.log(`[${connectionId}] Husqvarna -> Client: ${message.length} bytes`);
          }
          
          connection.clientWs.send(message);
        }
      } catch (error) {
        console.error(`[${connectionId}] Error processing message:`, error);
      }
    });
    
    // Handle successful connection
    husqvarnaWs.on('open', () => {
      // Clear the connection timeout
      clearTimeout(timeoutId);
      
      console.log(`[${connectionId}] Successfully connected to Husqvarna WebSocket API`);
      connection.status = 'connected';
      connection.reconnectAttempts = 0;
      
      // If this is a persistent connection, log it
      if (connection.isPersistent) {
        console.log(`Persistent connection ${connectionId} established and collecting data`);
      }
      
      // Send a success message to the client if it exists
      if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Successfully connected to Husqvarna WebSocket API'
        }));
      }
      
      // Set up token refresh after 45 minutes (tokens last 60 min)
      // This follows Husqvarna's recommendation to refresh tokens preemptively
      setTimeout(() => {
        if (connections.has(connectionId)) {
          if (connection.isPersistent) {
            // For persistent connections, create a new persistent connection
            console.log(`[${connectionId}] Token refresh time reached for persistent connection`);
            createPersistentConnection();
          } else if (connection.clientWs && 
                    connection.clientWs.readyState === WebSocket.OPEN && 
                    connection.husqvarnaWs.readyState === WebSocket.OPEN) {
            
            console.log(`[${connectionId}] Closing connection for token refresh`);
            
            // Close the Husqvarna connection gracefully
            connection.husqvarnaWs.close(1000, 'Token refresh required');
            
            // Request client to get a new token
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'token_refresh_required',
              message: 'Please reconnect with a new token'
            }));
          }
        }
      }, TOKEN_REFRESH_INTERVAL);
    });
    
    // Handle connection errors
    husqvarnaWs.on('error', async (error) => {
      console.error(`[${connectionId}] Husqvarna WebSocket error:`, error.message || error);
      
      // Clear the connection timeout
      clearTimeout(timeoutId);
      
      // Check if the error is related to authentication
      if (error.message && error.message.includes('403')) {
        console.error(`[${connectionId}] Authentication error with Husqvarna API - likely an invalid token`);
        
        // For persistent connections, try to get a fresh token
        if (connection.isPersistent) {
          try {
            console.log(`[${connectionId}] Attempting to get a fresh token for persistent connection...`);
            const newToken = await getAccessToken();
            console.log(`[${connectionId}] Obtained fresh token, attempting to reconnect`);
            
            // Update the connection with the new token
            connection.token = newToken;
            connection.reconnectAttempts = 0; // Reset attempts with new token
            
            // Try again with the new token after a short delay
            setTimeout(() => {
              if (connections.has(connectionId)) {
                connectToHusqvarnaWS(connectionId);
              }
            }, 1000);
          } catch (tokenError) {
            console.error(`[${connectionId}] Failed to get fresh token for persistent connection:`, tokenError);
            
            // Schedule a retry after a longer delay
            console.log(`[${connectionId}] Will retry creating persistent connection in 1 minute`);
            persistentConnectionId = null;
            setTimeout(createPersistentConnection, 60000);
            
            // Clean up the failed connection
            connections.delete(connectionId);
          }
        } else if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          // For client connections, notify the client
          connection.clientWs.send(JSON.stringify({
            type: 'connection_status',
            status: 'error',
            error: 'authentication_failed',
            message: 'Failed to authenticate with Husqvarna API'
          }));
        }
      } else if (error.message && error.message.includes('simultaneous.logins')) {
        console.error(`[${connectionId}] Simultaneous logins error with Husqvarna API`);
        
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.send(JSON.stringify({
            type: 'connection_status',
            status: 'error',
            error: 'simultaneous_logins',
            message: 'Husqvarna API rejected the connection due to simultaneous logins'
          }));
        }
        
        // For persistent connections, retry after a delay
        if (connection.isPersistent) {
          console.log(`[${connectionId}] Will retry creating persistent connection in 1 minute`);
          persistentConnectionId = null;
          setTimeout(createPersistentConnection, 60000);
          connections.delete(connectionId);
        }
      }
    });
    
    // Handle connection close
    husqvarnaWs.on('close', (code, reason) => {
      // Clear the connection timeout
      clearTimeout(timeoutId);
      
      console.log(`[${connectionId}] Husqvarna WebSocket closed (${code}): ${reason}`);
      
      // If this was a persistent connection that closed, recreate it
      if (connection.isPersistent && persistentConnectionId === connectionId) {
        console.log(`Persistent connection ${connectionId} closed. Recreating in 10 seconds...`);
        persistentConnectionId = null;
        setTimeout(createPersistentConnection, 10000);
        connections.delete(connectionId);
        return;
      }
      
      // For regular connections, handle reconnection
      if (code !== 1000 && code !== 1001) {
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          connection.status = 'reconnecting';
          connection.reconnectAttempts++;
          
          if (connection.reconnectAttempts < 5) {
            const delay = Math.min(30000, RECONNECT_INTERVAL * Math.pow(1.5, connection.reconnectAttempts));
            console.log(`[${connectionId}] Will retry in ${delay}ms (attempt ${connection.reconnectAttempts})`);
            
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'reconnecting',
              message: `Connection lost. Reconnecting in ${Math.round(delay/1000)} seconds...`
            }));
            
            setTimeout(() => connectToHusqvarnaWS(connectionId), delay);
          } else {
            console.error(`[${connectionId}] Maximum reconnection attempts reached`);
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'error',
              error: 'max_reconnect_attempts',
              message: 'Failed to reconnect after multiple attempts'
            }));
            
            connection.clientWs.close(1011, 'Failed to connect to Husqvarna API after multiple attempts');
            connections.delete(connectionId);
          }
        } else {
          // Client disconnected, remove the connection
          connections.delete(connectionId);
        }
      } else if (code === 1000 && reason === 'Token refresh required') {
        // Normal closure for token refresh, keep the connection entry
        // The client should reconnect with a new token
      } else {
        // Normal closure, close the client connection if still open
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.close(code, reason);
        }
        
        // Remove the connection
        connections.delete(connectionId);
      }
    });
    
    // If this is a client connection, handle client messages and disconnections
    if (!connection.isPersistent && connection.clientWs) {
      // Handle messages from the client to Husqvarna
      connection.clientWs.on('message', (message) => {
        if (connection.husqvarnaWs && connection.husqvarnaWs.readyState === WebSocket.OPEN) {
          // Check if it's a ping message
          let isPing = false;
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
              isPing = true;
              // Just log pings but don't forward them
              console.log(`[${connectionId}] Client ping received`);
            }
          } catch (e) {
            // Not JSON, just forward the message
          }
          
          // Forward non-ping messages to Husqvarna
          if (!isPing) {
            connection.messageCount++;
            console.log(`[${connectionId}] Client -> Husqvarna: ${message}`);
            connection.husqvarnaWs.send(message);
          }
        }
      });
      
      // Handle client disconnection
      connection.clientWs.on('close', (code, reason) => {
        console.log(`[${connectionId}] Client disconnected (${code}): ${reason}`);
        
        // Close the Husqvarna WebSocket if still open
        if (connection.husqvarnaWs && connection.husqvarnaWs.readyState === WebSocket.OPEN) {
          connection.husqvarnaWs.close(1000, 'Client disconnected');
        }
        
        // Remove the connection
        connections.delete(connectionId);
      });
      
      // Handle client errors
      connection.clientWs.on('error', (error) => {
        console.error(`[${connectionId}] Client error:`, error);
      });
    }
    
  } catch (error) {
    console.error(`[${connectionId}] Error establishing Husqvarna WebSocket connection:`, error);
    
    // Clean up on error
    const connection = connections.get(connectionId);
    if (connection && connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.close(1011, 'Error connecting to Husqvarna API');
    }
    
    if (connection && connection.isPersistent) {
      console.log(`Persistent connection ${connectionId} failed. Will recreate in 1 minute.`);
      persistentConnectionId = null;
      setTimeout(createPersistentConnection, 60000);
    }
    
    connections.delete(connectionId);
  }
}

// Heart beat implementation to detect and clean up broken connections
// This is a more aggressive heartbeat mechanism
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating dead client connection');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
  
  // Also check husqvarna connections
  connections.forEach((connection, id) => {
    // Check if the connection is stale (no activity for 2 minutes)
    const isStale = Date.now() - connection.lastActivity > 120000;
    
    if (isStale) {
      console.log(`[${id}] Connection appears stale, checking status...`);
      
      // Check client connection
      if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
        // Attempt to ping the client
        try {
          connection.clientWs.ping();
          console.log(`[${id}] Sent ping to client to check connection`);
        } catch (e) {
          console.error(`[${id}] Error pinging client:`, e);
        }
      }
      
      // Check Husqvarna connection
      if (connection.husqvarnaWs && connection.husqvarnaWs.readyState === WebSocket.OPEN) {
        try {
          connection.husqvarnaWs.ping();
          console.log(`[${id}] Sent ping to Husqvarna to check connection`);
        } catch (e) {
          console.error(`[${id}] Error pinging Husqvarna:`, e);
          // Try to reconnect to Husqvarna
          try {
            connection.husqvarnaWs.close(1000, 'Reconnecting due to stale connection');
            connectToHusqvarnaWS(id);
          } catch (reconnectError) {
            console.error(`[${id}] Error reconnecting to Husqvarna:`, reconnectError);
          }
        }
      }
    }
  });
}, HEARTBEAT_INTERVAL);

// Initialize Firebase
initializeFirebase();

// Start the persistent connection
createPersistentConnection();

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket proxy server running on port ${PORT}`);
  console.log(`Proxying connections to ${HUSQVARNA_WS_URL}`);
  console.log(`Persistent connection enabled: data will be collected even without browser clients`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket proxy server...');
  
  // Stop the heartbeat interval
  clearInterval(heartbeat);
  
  // Close all connections
  connections.forEach((connection, id) => {
    try {
      if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.close(1001, 'Server shutting down');
      }
      if (connection.husqvarnaWs && connection.husqvarnaWs.readyState === WebSocket.OPEN) {
        connection.husqvarnaWs.close(1001, 'Server shutting down');
      }
    } catch (error) {
      console.error(`[${id}] Error closing connection during shutdown:`, error);
    }
  });
  
  // Close the server
  server.close(() => {
    console.log('WebSocket proxy server closed');
    process.exit(0);
  });
}); 