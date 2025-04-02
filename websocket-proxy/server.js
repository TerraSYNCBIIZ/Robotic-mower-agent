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
const HUSQVARNA_API_URL = 'https://api.amc.husqvarna.dev/v1';
const CONNECTION_TIMEOUT = 60000; // 60 seconds
const RECONNECT_INTERVAL = 10000; // 10 seconds
const FIREBASE_UPDATE_THROTTLES = {
  'position': 10000,        // 10 seconds for position (mowers move slowly but we want responsive tracking)
  'battery': 300000,        // 5 minutes for battery (changes slowly)
  'mower': 60000,           // 1 minute for mower status (activity, state, mode)
  'calendar': 3600000,      // 1 hour for calendar (rarely changes)
  'cuttingHeight': 3600000, // 1 hour for cutting height (rarely changes)
  'headlights': 3600000,    // 1 hour for headlights (rarely changes)
  'messages': 120000,       // 2 minutes for messages (fairly important)
  'planner': 600000,        // 10 minutes for planner
  'statistics': 1800000,    // 30 minutes for statistics (accumulated slowly)
  'workAreas': 86400000,    // 24 hours for work areas (very static)
  'stayOutZones': 86400000, // 24 hours for stay out zones (very static)
  'settings': 1800000,      // 30 minutes for settings
  'system': 86400000,       // 24 hours for system info
  'errors': 60000,          // 1 minute for errors (important to show promptly)
  'default': 300000         // 5 minutes default for unknown types
};

// Define API polling interval (6 hours = 4 times per day)
const API_POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Store active connections for management
const connections = new Map();

// Track API polling state
const apiPollingState = {
  isRunning: false,
  lastPollTime: null,
  scheduledPollTime: null,
  pollCount: 0
};

/**
 * Fetch user's mowers from Husqvarna API using the user's token
 * @param {string} token - User's authentication token
 * @param {string} apiKey - Husqvarna API key
 * @returns {Promise<{userId: string, mowerIds: string[]}>} Object containing user ID and array of mower IDs
 */
async function fetchUserMowers(connectionId, token, apiKey) {
  try {
    console.log(`[${connectionId}] Fetching user information and mowers using token...`);
    
    // First, get the user ID by calling the /me endpoint
    const meResponse = await axios.get(`${HUSQVARNA_API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': apiKey,
        'Authorization-Provider': 'husqvarna'
      }
    });
    
    if (!meResponse.data || !meResponse.data.data || !meResponse.data.data.id) {
      throw new Error('Could not retrieve user ID from Husqvarna API');
    }
    
    const userId = meResponse.data.data.id;
    console.log(`[${connectionId}] User ID retrieved: ${userId}`);
    
    // Now fetch mowers associated with this user
    const mowersResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': apiKey,
        'Authorization-Provider': 'husqvarna'
      }
    });
    
    if (!mowersResponse.data || !mowersResponse.data.data) {
      throw new Error('Could not retrieve mowers from Husqvarna API');
    }
    
    const mowers = mowersResponse.data.data;
    const mowerIds = mowers.map(mower => mower.id);
    
    console.log(`[${connectionId}] Found ${mowerIds.length} mowers for user ${userId}: ${mowerIds.join(', ')}`);
    
    // Return both the user ID and mower IDs
    return {
      userId,
      mowerIds,
      mowers: mowers // Return full mower objects for additional information
    };
  } catch (error) {
    console.error(`[${connectionId}] Error fetching user mowers:`, error.response?.data || error.message);
    throw error;
  }
}

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
      console.warn('Make sure FIREBASE_API_KEY is set in .env.local');
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

// Process the update queue for Firebase at a controlled rate
function processUpdateQueue() {
  if (!db) return;
  
  const now = Date.now();
  const queueSize = Object.keys(UPDATE_QUEUE).length;
  
  if (queueSize > 0) {
    console.log(`⏳ PROCESSING UPDATE QUEUE: ${queueSize} mowers in queue`);
  }
  
  // Process all queued updates
  Object.entries(UPDATE_QUEUE).forEach(([mowerId, dataTypes]) => {
    Object.entries(dataTypes).forEach(([dataType, data]) => {
      const lastUpdate = UPDATE_TIMESTAMPS[mowerId]?.[dataType] || 0;
      
      // Get the specific throttle time for this data type, or use default
      const throttleTime = FIREBASE_UPDATE_THROTTLES[dataType] || FIREBASE_UPDATE_THROTTLES.default;
      
      // Only update if it's been more than the throttle period for this data type
      if (now - lastUpdate > throttleTime) {
        console.log(`⏰ THROTTLE CHECK PASSED: Mower ${mowerId}, Type: ${dataType}, Last update: ${now - lastUpdate}ms ago, Throttle: ${throttleTime}ms`);
        updateFirebaseData(mowerId, dataType, data);
        
        // Update the timestamp
        if (!UPDATE_TIMESTAMPS[mowerId]) {
          UPDATE_TIMESTAMPS[mowerId] = {};
        }
        UPDATE_TIMESTAMPS[mowerId][dataType] = now;
        
        // Remove from queue
        delete UPDATE_QUEUE[mowerId][dataType];
        console.log(`🗑️ REMOVED FROM QUEUE: Mower ${mowerId}, Type: ${dataType}`);
      } else {
        console.log(`⏱️ THROTTLE ACTIVE: Mower ${mowerId}, Type: ${dataType}, Last update: ${now - lastUpdate}ms ago, need to wait ${throttleTime - (now - lastUpdate)}ms more`);
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
  if (!db) {
    console.log(`⚠️ FIREBASE UPDATE SKIPPED: Firebase not initialized`);
    return;
  }
  
  try {
    console.log(`🔥 FIREBASE UPDATE START: Mower ${mowerId}, Type: ${dataType}`);
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
      console.log(`📜 HISTORY UPDATED: Mower ${mowerId}, Type: ${dataType}`);
    }
    
    console.log(`✅ FIREBASE UPDATE COMPLETE: Mower ${mowerId}, Type: ${dataType}, Data: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error(`❌ FIREBASE UPDATE ERROR: Mower ${mowerId}, Type: ${dataType}`, error);
  }
}

// Queue an update for Firebase
function queueFirebaseUpdate(mowerId, dataType, data) {
  console.log(`📊 QUEUE UPDATE: Mower ${mowerId}, Type: ${dataType}, Data: ${JSON.stringify(data)}`);
  
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
      persistentConnection: null // No more persistent connection with user-based auth
    }));
  } else if (req.url === '/dashboard/refresh' && req.method === 'POST') {
    // Dashboard refresh endpoint - triggers a comprehensive data fetch
    handleDashboardRefresh(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Heartbeat interval (ms)
const HEARTBEAT_INTERVAL = 300000; // 5 minutes (increased from 30 seconds)

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

    console.log(`Received connection with token: ${token.substring(0, 20)}...`);
    
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
      isAlive: true
    });
    
    // Create a dedicated connection for this client using the client's token
    connectToHusqvarnaWS(connectionId);
  } catch (error) {
    console.error('Error handling WebSocket connection:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Internal server error');
    }
  }
});

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
    console.log(`[${connectionId}] Connecting to Husqvarna WebSocket API using user token...`);
    
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
        
        // Try to reconnect if client is still connected
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
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
            
            connections.delete(connectionId);
          }
        }
      }
    }, CONNECTION_TIMEOUT);
    
    // Create the WebSocket connection to Husqvarna with token in header (as per their docs)
    // Use the token provided by the client - this is the key change!
    const husqvarnaWs = new WebSocket(HUSQVARNA_WS_URL, {
      headers: {
        'Authorization': `Bearer ${connection.token}`, // User's token from the client
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
        // Log every message received from Husqvarna
        console.log(`[${connectionId}] ⬇️ MESSAGE FROM HUSQVARNA: ${message.length} bytes`);
        
        // Process message for Firebase updates
        try {
          const messageStr = message.toString();
          console.log(`[${connectionId}] 📋 RECEIVED MESSAGE CONTENT: ${messageStr.substring(0, 200)}${messageStr.length > 200 ? '...' : ''}`);
          
          const data = JSON.parse(messageStr);
          
          // Only process actual mower events
          if (data.id && data.type && data.attributes) {
            const mowerId = data.id;
            console.log(`[${connectionId}] 🚜 MOWER EVENT: ${data.type} for mower ${mowerId}`);
            
            // Process different event types
            switch (data.type) {
              case 'battery-event-v2':
                // Update battery data
                console.log(`[${connectionId}] 🔋 BATTERY EVENT: ${JSON.stringify(data.attributes.battery || {})}`);
                queueFirebaseUpdate(mowerId, 'battery', {
                  batteryPercent: data.attributes.battery?.batteryPercent || 0,
                  timestamp: new Date()
                });
                break;
                
              case 'mower-event-v2':
                // Update mower status data
                console.log(`[${connectionId}] 🛠️ MOWER STATUS EVENT: activity=${data.attributes.mower?.activity || 'UNKNOWN'}, state=${data.attributes.mower?.state || 'UNKNOWN'}, mode=${data.attributes.mower?.mode || 'UNKNOWN'}`);
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
                  console.log(`[${connectionId}] 📍 POSITION EVENT: lat=${data.attributes.position.latitude}, long=${data.attributes.position.longitude}`);
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
                  console.log(`[${connectionId}] 📅 CALENDAR EVENT: ${JSON.stringify(data.attributes.calendar).substring(0, 200)}...`);
                  queueFirebaseUpdate(mowerId, 'calendar', {
                    tasks: data.attributes.calendar.tasks || [],
                    timestamp: new Date()
                  });
                }
                break;
              
              case 'cuttingHeight-event-v2':
                // Update cutting height data
                if (data.attributes.cuttingHeight !== undefined) {
                  console.log(`[${connectionId}] ✂️ CUTTING HEIGHT EVENT: value=${data.attributes.cuttingHeight}`);
                  queueFirebaseUpdate(mowerId, 'cuttingHeight', {
                    value: data.attributes.cuttingHeight,
                    timestamp: new Date()
                  });
                }
                break;
              
              case 'headlights-event-v2':
                // Update headlights data
                if (data.attributes.headlight) {
                  console.log(`[${connectionId}] 💡 HEADLIGHTS EVENT: mode=${data.attributes.headlight.mode || 'UNKNOWN'}`);
                  queueFirebaseUpdate(mowerId, 'headlights', {
                    mode: data.attributes.headlight.mode || 'UNKNOWN',
                    timestamp: new Date()
                  });
                }
                break;
              
              case 'message-event-v2':
                // Update message/alert data
                if (data.attributes.message) {
                  const message = data.attributes.message;
                  console.log(`[${connectionId}] 📢 MESSAGE EVENT: level=${message.level || 'INFO'}, headline=${message.headline || ''}`);
                  queueFirebaseUpdate(mowerId, 'messages', {
                    id: message.id || `msg-${Date.now()}`,
                    level: message.level || 'INFO',
                    headline: message.headline || '',
                    text: message.text || '',
                    datetime: message.datetime || new Date().toISOString(),
                    resolved: message.resolved || false,
                    timestamp: new Date()
                  });
                  
                  // Also store in history collection for messages
                  const historyData = {
                    timestamp: serverTimestamp(),
                    type: 'message',
                    data: {
                      id: message.id || `msg-${Date.now()}`,
                      level: message.level || 'INFO',
                      headline: message.headline || '',
                      text: message.text || '',
                      datetime: message.datetime || new Date().toISOString(),
                      resolved: message.resolved || false
                    }
                  };
                  
                  try {
                    // Add to history collection if Firebase is initialized
                    if (db) {
                      setDoc(
                        doc(collection(db, MOWERS_COLLECTION, mowerId, 'history'), randomUUID()),
                        historyData
                      );
                    }
                  } catch (error) {
                    console.error(`Error storing message history for mower ${mowerId}:`, error);
                  }
                }
                break;
              
              case 'planner-event-v2':
                // Update planner data
                if (data.attributes.planner) {
                  const planner = data.attributes.planner;
                  console.log(`[${connectionId}] 📝 PLANNER EVENT: nextStart=${planner.nextStartTimestamp || 'NONE'}, override=${JSON.stringify(planner.override || { action: 'NO_SOURCE' })}`);
                  queueFirebaseUpdate(mowerId, 'planner', {
                    nextStartTimestamp: planner.nextStartTimestamp || null,
                    override: planner.override || { action: 'NO_SOURCE' },
                    restrictedReason: planner.restrictedReason || 'NONE',
                    timestamp: new Date()
                  });
                }
                break;
                
                // NEW EVENT HANDLERS ADDED BELOW
                
                case 'statistics-event-v2':
                  // Handle statistics events
                  try {
                    if (data.attributes.statistics) {
                      console.log(`[${connectionId}] 📊 STATISTICS EVENT: ${JSON.stringify(data.attributes.statistics)}`);
                      queueFirebaseUpdate(mowerId, 'statistics', {
                        ...data.attributes.statistics,
                        timestamp: new Date()
                      });
                      console.log(`[${connectionId}] Successfully processed statistics-event-v2 for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing statistics-event-v2:`, eventError);
                  }
                  break;
                  
                case 'workArea-event-v2':
                  // Handle work area events
                  try {
                    if (data.attributes.workArea) {
                      console.log(`[${connectionId}] 🗺️ WORK AREA EVENT: ${JSON.stringify(data.attributes.workArea)}`);
                      queueFirebaseUpdate(mowerId, 'workAreas', {
                        ...data.attributes.workArea,
                        timestamp: new Date()
                      });
                      console.log(`[${connectionId}] Successfully processed workArea-event-v2 for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing workArea-event-v2:`, eventError);
                  }
                  break;
                  
                case 'stayOutZone-event-v2':
                  // Handle stay out zone events
                  try {
                    if (data.attributes.stayOutZone) {
                      console.log(`[${connectionId}] 🚫 STAY OUT ZONE EVENT: ${JSON.stringify(data.attributes.stayOutZone)}`);
                      queueFirebaseUpdate(mowerId, 'stayOutZones', {
                        ...data.attributes.stayOutZone,
                        timestamp: new Date()
                      });
                      console.log(`[${connectionId}] Successfully processed stayOutZone-event-v2 for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing stayOutZone-event-v2:`, eventError);
                  }
                  break;
                  
                case 'settings-event-v2':
                  // Handle settings events
                  try {
                    if (data.attributes.settings) {
                      console.log(`[${connectionId}] ⚙️ SETTINGS EVENT: ${JSON.stringify(data.attributes.settings)}`);
                      queueFirebaseUpdate(mowerId, 'settings', {
                        ...data.attributes.settings,
                        timestamp: new Date()
                      });
                      console.log(`[${connectionId}] Successfully processed settings-event-v2 for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing settings-event-v2:`, eventError);
                  }
                  break;
                  
                case 'system-event-v2':
                  // Handle system events
                  try {
                    if (data.attributes.system) {
                      console.log(`[${connectionId}] 🖥️ SYSTEM EVENT: ${JSON.stringify(data.attributes.system)}`);
                      queueFirebaseUpdate(mowerId, 'system', {
                        ...data.attributes.system,
                        timestamp: new Date()
                      });
                      console.log(`[${connectionId}] Successfully processed system-event-v2 for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing system-event-v2:`, eventError);
                  }
                  break;
                  
                case 'error-event-v2':
                  // Handle error events
                  try {
                    if (data.attributes.error) {
                      console.log(`[${connectionId}] ❌ ERROR EVENT: ${JSON.stringify(data.attributes.error)}`);
                      queueFirebaseUpdate(mowerId, 'errors', {
                        ...data.attributes.error,
                        timestamp: new Date()
                      });
                      
                      // Also store in history collection for errors
                      if (db) {
                        try {
                          const historyData = {
                            timestamp: serverTimestamp(),
                            type: 'error',
                            data: data.attributes.error
                          };
                          
                          setDoc(
                            doc(collection(db, MOWERS_COLLECTION, mowerId, 'history'), randomUUID()),
                            historyData
                          );
                        } catch (error) {
                          console.error(`Error storing error history for mower ${mowerId}:`, error);
                        }
                      }
                      console.log(`[${connectionId}] Successfully processed error-event-v2 for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing error-event-v2:`, eventError);
                  }
                  break;
              
                // Default case to catch any other event types
                default:
                  try {
                    console.log(`[${connectionId}] ⚠️ UNHANDLED EVENT TYPE: ${data.type}`);
                    // Still store unknown event types in Firebase for future reference
                    if (data.attributes) {
                      queueFirebaseUpdate(mowerId, `events_${data.type}`, {
                        ...data.attributes,
                        timestamp: new Date()
                      });
                      console.log(`[${connectionId}] Stored unknown event type ${data.type} for mower ${mowerId}`);
                    }
                  } catch (eventError) {
                    console.error(`[${connectionId}] Error processing unknown event type ${data.type}:`, eventError);
                  }
                  break;
            }
          } else {
            console.log(`[${connectionId}] ℹ️ NON-MOWER EVENT MESSAGE: ${JSON.stringify(data)}`);
          }
        } catch (parseError) {
          // Just log parsing errors and continue
          console.error(`[${connectionId}] ❌ ERROR PARSING MESSAGE:`, parseError);
        }
        
        // If client is still connected, send the message
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
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
        console.error(`[${connectionId}] ❌ ERROR PROCESSING MESSAGE:`, error);
      }
    });
    
    // Handle successful connection
    husqvarnaWs.on('open', async () => {
      try {
        // Clear the connection timeout
        clearTimeout(timeoutId);
        
        console.log(`[${connectionId}] Successfully connected to Husqvarna WebSocket API`);
        connection.status = 'connected';
        connection.reconnectAttempts = 0;
        
        // CRITICAL ADDITION: Fetch user information and mowers to properly initialize WebSocket
        try {
          // Fetch user ID and mowers using REST API
          const { userId, mowerIds, mowers } = await fetchUserMowers(connectionId, connection.token, connection.apiKey);
          
          // Store user ID and mower IDs in the connection
          connection.userId = userId;
          connection.mowerIds = mowerIds;
          connection.mowers = mowers;
          
          // STEP 1: Send initialization message with user ID
          console.log(`[${connectionId}] Initializing WebSocket with user ID: ${userId}`);
          const initMessage = {
            id: randomUUID(),
            type: 'initialize',
            attributes: {
              userId: userId
            }
          };
          husqvarnaWs.send(JSON.stringify(initMessage));
          
          // STEP 2: Subscribe to each mower
          // Wait a short time to ensure initialization is processed
          setTimeout(() => {
            if (mowerIds.length === 0) {
              console.warn(`[${connectionId}] No mowers found for user ${userId}`);
              
              // Notify client
              if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
                connection.clientWs.send(JSON.stringify({
                  type: 'connection_status',
                  status: 'warning',
                  message: 'Connected to Husqvarna WebSocket API, but no mowers were found.'
                }));
              }
              return;
            }
            
            console.log(`[${connectionId}] Subscribing to ${mowerIds.length} mowers...`);
            
            // Subscribe to each mower
            mowerIds.forEach((mowerId, index) => {
              // Stagger subscriptions slightly to avoid overwhelming the API
              setTimeout(() => {
                console.log(`[${connectionId}] Subscribing to mower: ${mowerId}`);
                const subscribeMessage = {
                  id: randomUUID(),
                  type: 'start-subscription',
                  attributes: {
                    topics: [
                      `mower/${mowerId}`
                    ]
                  }
                };
                husqvarnaWs.send(JSON.stringify(subscribeMessage));
              }, index * 100); // 100ms delay between each subscription
            });
            
            // Notify client of successful connection and subscriptions
            if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
              connection.clientWs.send(JSON.stringify({
                type: 'connection_status',
                status: 'subscribed',
                message: `Successfully connected to Husqvarna WebSocket API and subscribed to ${mowerIds.length} mowers`,
                mowers: mowers.map(m => ({ id: m.id, name: m.attributes.system?.name || 'Unknown Mower' }))
              }));
            }
          }, 1000); // Wait 1s after initialization to begin subscriptions
          
        } catch (error) {
          console.error(`[${connectionId}] Failed to initialize WebSocket with user data:`, error.message);
          
          // Still notify client of basic connection
          if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'connected',
              message: 'Connected to Husqvarna WebSocket API, but failed to fetch mower information.',
              error: error.message
            }));
          }
        }
      } catch (error) {
        console.error(`[${connectionId}] Error during WebSocket initialization:`, error);
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.send(JSON.stringify({
            type: 'connection_status',
            status: 'error',
            error: 'initialization_failed',
            message: `Connected but failed to initialize: ${error.message}`
          }));
        }
      }
    });
    
    // Handle connection errors
    husqvarnaWs.on('error', async (error) => {
      console.error(`[${connectionId}] Husqvarna WebSocket error:`, error.message || error);
      
      // Clear the connection timeout
      clearTimeout(timeoutId);
      
      // Check if the error is related to authentication
      if (error.message && error.message.includes('403')) {
        console.error(`[${connectionId}] Authentication error with Husqvarna API - likely an invalid or expired token`);
        
        // Notify client about the authentication error
        if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.send(JSON.stringify({
            type: 'connection_status',
            status: 'error',
            error: 'authentication_failed',
            message: 'The authentication token was rejected by the Husqvarna API. Please log in again.'
          }));
        }
      }
      
      // If client is still connected, try to reconnect
      if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
        connection.reconnectAttempts++;
        if (connection.reconnectAttempts < 5) {
          const delay = Math.min(30000, RECONNECT_INTERVAL * Math.pow(1.5, connection.reconnectAttempts));
          console.log(`[${connectionId}] Will retry in ${delay}ms (attempt ${connection.reconnectAttempts})`);
          setTimeout(() => connectToHusqvarnaWS(connectionId), delay);
        } else {
          console.error(`[${connectionId}] Maximum reconnection attempts reached`);
          
          // Notify client
          if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'error',
              error: 'max_retry_exceeded',
              message: 'Failed to connect to Husqvarna API after 5 attempts'
            }));
          }
        }
      }
    });
    
    // Handle connection closure
    husqvarnaWs.on('close', (code, reason) => {
      console.log(`[${connectionId}] Husqvarna WebSocket closed: ${code} ${reason || 'No reason provided'}`);
      
      // If client is still connected, try to reconnect
      if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
        if (code === 1000) {
          // Normal closure, no need to reconnect
          console.log(`[${connectionId}] Normal closure, no reconnection needed`);
          
          // Notify client
          connection.clientWs.send(JSON.stringify({
            type: 'connection_status',
            status: 'disconnected',
            message: 'Husqvarna WebSocket connection closed normally'
          }));
        } else {
          // Abnormal closure, try to reconnect
          connection.reconnectAttempts++;
          if (connection.reconnectAttempts < 5) {
            const delay = Math.min(30000, RECONNECT_INTERVAL * Math.pow(1.5, connection.reconnectAttempts));
            console.log(`[${connectionId}] Will retry in ${delay}ms (attempt ${connection.reconnectAttempts})`);
            
            // Notify client
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'reconnecting',
              message: `Connection lost. Reconnecting in ${delay/1000} seconds...`
            }));
            
            setTimeout(() => connectToHusqvarnaWS(connectionId), delay);
          } else {
            console.error(`[${connectionId}] Maximum reconnection attempts reached`);
            
            // Notify client
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'error',
              error: 'max_retry_exceeded',
              message: 'Failed to connect to Husqvarna API after 5 attempts'
            }));
          }
        }
      }
    });
    
    // Handle client disconnection
    connection.clientWs.on('close', () => {
      console.log(`[${connectionId}] Client disconnected`);
      
      // Close Husqvarna connection when client disconnects
      if (connection.husqvarnaWs) {
        connection.husqvarnaWs.close(1000, 'Client disconnected');
      }
      
      // Remove connection
      connections.delete(connectionId);
    });
    
    // Handle client errors
    connection.clientWs.on('error', (error) => {
      console.error(`[${connectionId}] Client WebSocket error:`, error);
    });
    
    // Handle messages from client (to Husqvarna)
    connection.clientWs.on('message', (message) => {
      if (connection.husqvarnaWs && connection.husqvarnaWs.readyState === WebSocket.OPEN) {
        try {
          // Check if it's a ping message (don't forward)
          let isPing = false;
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
              isPing = true;
              console.log(`[${connectionId}] Client ping received (not forwarded)`);
              
              // Send pong response
              connection.clientWs.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
              }));
            }
          } catch (e) {
            // Not JSON, just forward
          }
          
          // Forward non-ping messages
          if (!isPing) {
            connection.messageCount++;
            console.log(`[${connectionId}] Forwarding to Husqvarna: ${message}`);
            connection.husqvarnaWs.send(message);
          }
        } catch (error) {
          console.error(`[${connectionId}] Error forwarding message to Husqvarna:`, error);
        }
      } else {
        console.warn(`[${connectionId}] Client message received but Husqvarna connection is not open`);
      }
    });
  } catch (error) {
    console.error(`[${connectionId}] ❌ ERROR ESTABLISHING HUSQVARNA WEBSOCKET CONNECTION:`, error);
    
    // Clean up on error
    if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.send(JSON.stringify({
        type: 'connection_status',
        status: 'error',
        error: 'connection_failed',
        message: `Failed to establish connection: ${error.message}`
      }));
    }
  }
}

/**
 * Periodic API polling function to ensure we have recent data even for idle mowers
 * This acts as a backup to WebSocket data and ensures we have data at least a few times per day
 */
async function pollMowerData() {
  if (!db) {
    console.log('Skipping API poll: Firebase not initialized');
    return;
  }
  
  try {
    apiPollingState.isRunning = true;
    apiPollingState.lastPollTime = new Date();
    apiPollingState.pollCount++;
    
    console.log(`🔄 STARTING API POLL #${apiPollingState.pollCount} at ${apiPollingState.lastPollTime.toISOString()}`);
    
    // Get all active user connections to poll their mowers
    if (connections.size === 0) {
      console.log('No active connections to poll mowers for');
      return;
    }
    
    // For each connection, poll all their mowers
    let totalMowersPolled = 0;
    
    for (const [connectionId, connection] of connections.entries()) {
      // Skip connections without tokens or API keys
      if (!connection.token || !connection.apiKey) {
        console.log(`[${connectionId}] Skipping poll: Missing token or API key`);
        continue;
      }
      
      try {
        console.log(`[${connectionId}] Polling mowers via REST API using token...`);
        
        // Get user mowers if not already fetched
        if (!connection.mowerIds || connection.mowerIds.length === 0) {
          try {
            const { userId, mowerIds } = await fetchUserMowers(connectionId, connection.token, connection.apiKey);
            connection.userId = userId;
            connection.mowerIds = mowerIds;
          } catch (error) {
            console.error(`[${connectionId}] Failed to fetch mowers for polling:`, error.message);
            continue;
          }
        }
        
        // If we have mower IDs, poll each one
        if (connection.mowerIds && connection.mowerIds.length > 0) {
          for (const mowerId of connection.mowerIds) {
            try {
              console.log(`[${connectionId}] Polling mower ${mowerId} via REST API...`);
              
              // Fetch mower details
              const mowerResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers/${mowerId}`, {
                headers: {
                  'Authorization': `Bearer ${connection.token}`,
                  'X-Api-Key': connection.apiKey,
                  'Authorization-Provider': 'husqvarna',
                  'Accept': 'application/vnd.api+json'
                }
              });
              
              if (mowerResponse.status === 200 && mowerResponse.data && mowerResponse.data.data) {
                const mowerData = mowerResponse.data.data;
                console.log(`[${connectionId}] ✅ Successfully polled mower ${mowerId} data via REST API`);
                
                // Process and store different aspects of the mower data
                const attributes = mowerData.attributes || {};
                
                // Store battery data if available
                if (attributes.battery) {
                  queueFirebaseUpdate(mowerId, 'battery', {
                    batteryPercent: attributes.battery.batteryPercent || 0,
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store mower status data if available
                if (attributes.mower) {
                  queueFirebaseUpdate(mowerId, 'mower', {
                    activity: attributes.mower.activity || 'UNKNOWN',
                    state: attributes.mower.state || 'UNKNOWN',
                    mode: attributes.mower.mode || 'UNKNOWN',
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store position data if available
                if (attributes.positions && attributes.positions.length > 0) {
                  const position = attributes.positions[0]; // Use most recent position
                  queueFirebaseUpdate(mowerId, 'position', {
                    latitude: position.latitude,
                    longitude: position.longitude,
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store system data if available
                if (attributes.system) {
                  queueFirebaseUpdate(mowerId, 'system', {
                    ...attributes.system,
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store settings data if available
                if (attributes.settings) {
                  queueFirebaseUpdate(mowerId, 'settings', {
                    ...attributes.settings,
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store calendar data if available
                if (attributes.calendar) {
                  queueFirebaseUpdate(mowerId, 'calendar', {
                    tasks: attributes.calendar.tasks || [],
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store planner data if available
                if (attributes.planner) {
                  queueFirebaseUpdate(mowerId, 'planner', {
                    ...attributes.planner,
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                // Store statistics data if available
                if (attributes.statistics) {
                  queueFirebaseUpdate(mowerId, 'statistics', {
                    ...attributes.statistics,
                    timestamp: new Date(),
                    source: 'api_poll'
                  });
                }
                
                totalMowersPolled++;
              } else {
                console.error(`[${connectionId}] Failed to poll mower ${mowerId}: ${mowerResponse.status} ${mowerResponse.statusText}`);
              }
            } catch (mowerError) {
              console.error(`[${connectionId}] Error polling mower ${mowerId}:`, mowerError.message);
            }
          }
        } else {
          console.log(`[${connectionId}] No mowers to poll`);
        }
      } catch (connectionError) {
        console.error(`[${connectionId}] Error during poll:`, connectionError.message);
      }
    }
    
    console.log(`🔄 API POLL COMPLETE: Successfully polled ${totalMowersPolled} mowers`);
    
    // Store API poll statistics in Firebase for monitoring
    if (db) {
      try {
        await setDoc(doc(db, 'system', 'api_polling'), {
          lastPollTime: serverTimestamp(),
          pollCount: apiPollingState.pollCount,
          mowersPolled: totalMowersPolled,
          connectionCount: connections.size
        }, { merge: true });
      } catch (error) {
        console.error('Error storing API poll statistics:', error);
      }
    }
  } catch (error) {
    console.error('Error in API polling function:', error);
  } finally {
    apiPollingState.isRunning = false;
    
    // Schedule next poll
    apiPollingState.scheduledPollTime = new Date(Date.now() + API_POLL_INTERVAL);
    console.log(`📅 Next API poll scheduled for ${apiPollingState.scheduledPollTime.toISOString()}`);
  }
}

/**
 * Handle dashboard refresh request to fetch all mower data comprehensively
 * This is more thorough than the periodic polling and fetches additional data
 * like messages, work areas, stay out zones, etc.
 */
async function handleDashboardRefresh(req, res) {
  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Firebase not initialized' }));
    return;
  }
  
  // Check if there are active connections
  if (connections.size === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No active connections to fetch mower data' }));
    return;
  }
  
  // Start the refresh process asynchronously so we can return a response immediately
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Dashboard refresh started',
    connections: connections.size,
    timestamp: new Date().toISOString()
  }));
  
  // Now perform the comprehensive data fetch asynchronously
  (async () => {
    try {
      console.log('🔄 DASHBOARD REFRESH: Starting comprehensive mower data fetch');
      let totalMowersRefreshed = 0;
      let totalEndpointsCalled = 0;
      
      // Track fetch stats for each mower
      const refreshStats = {
        startTime: new Date(),
        mowers: {},
        success: true
      };
      
      // For each connection, fetch detailed data for all associated mowers
      for (const [connectionId, connection] of connections.entries()) {
        // Skip connections without tokens or API keys
        if (!connection.token || !connection.apiKey) {
          console.log(`[${connectionId}] Skipping dashboard refresh: Missing token or API key`);
          continue;
        }
        
        try {
          console.log(`[${connectionId}] Fetching comprehensive mower data for dashboard...`);
          
          // Get user mowers if not already fetched
          if (!connection.mowerIds || connection.mowerIds.length === 0) {
            try {
              const { userId, mowerIds } = await fetchUserMowers(connectionId, connection.token, connection.apiKey);
              connection.userId = userId;
              connection.mowerIds = mowerIds;
            } catch (error) {
              console.error(`[${connectionId}] Failed to fetch mowers for dashboard refresh:`, error.message);
              continue;
            }
          }
          
          // If we have mower IDs, fetch detailed data for each one
          if (connection.mowerIds && connection.mowerIds.length > 0) {
            for (const mowerId of connection.mowerIds) {
              try {
                console.log(`[${connectionId}] Fetching comprehensive data for mower ${mowerId}...`);
                refreshStats.mowers[mowerId] = {
                  endpoints: {},
                  success: true
                };
                
                // ENDPOINT 1: Fetch main mower details
                try {
                  const mowerResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers/${mowerId}`, {
                    headers: {
                      'Authorization': `Bearer ${connection.token}`,
                      'X-Api-Key': connection.apiKey,
                      'Authorization-Provider': 'husqvarna',
                      'Accept': 'application/vnd.api+json'
                    }
                  });
                  
                  totalEndpointsCalled++;
                  refreshStats.mowers[mowerId].endpoints.mower = true;
                  
                  if (mowerResponse.status === 200 && mowerResponse.data && mowerResponse.data.data) {
                    console.log(`[${connectionId}] ✅ Successfully fetched main data for mower ${mowerId}`);
                    
                    // Store the entire mower object
                    const mowerData = mowerResponse.data.data;
                    
                    // Extract and store individual data attributes
                    const attributes = mowerData.attributes || {};
                    
                    // Basic mower metadata
                    queueFirebaseUpdate(mowerId, 'metadata', {
                      id: mowerData.id,
                      type: mowerData.type,
                      timestamp: new Date(),
                      source: 'dashboard_refresh'
                    });
                    
                    // Store battery data if available
                    if (attributes.battery) {
                      queueFirebaseUpdate(mowerId, 'battery', {
                        ...attributes.battery,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store mower status data if available
                    if (attributes.mower) {
                      queueFirebaseUpdate(mowerId, 'mower', {
                        ...attributes.mower,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store position data if available
                    if (attributes.positions && attributes.positions.length > 0) {
                      queueFirebaseUpdate(mowerId, 'position', {
                        ...attributes.positions[0],
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store system data if available
                    if (attributes.system) {
                      queueFirebaseUpdate(mowerId, 'system', {
                        ...attributes.system,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store settings data if available
                    if (attributes.settings) {
                      queueFirebaseUpdate(mowerId, 'settings', {
                        ...attributes.settings,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store calendar data if available
                    if (attributes.calendar) {
                      queueFirebaseUpdate(mowerId, 'calendar', {
                        ...attributes.calendar,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store planner data if available
                    if (attributes.planner) {
                      queueFirebaseUpdate(mowerId, 'planner', {
                        ...attributes.planner,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store statistics data if available
                    if (attributes.statistics) {
                      queueFirebaseUpdate(mowerId, 'statistics', {
                        ...attributes.statistics,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                    
                    // Store capabilities if available
                    if (attributes.capabilities) {
                      queueFirebaseUpdate(mowerId, 'capabilities', {
                        ...attributes.capabilities,
                        timestamp: new Date(),
                        source: 'dashboard_refresh'
                      });
                    }
                  } else {
                    console.error(`[${connectionId}] Failed to fetch main data for mower ${mowerId}: ${mowerResponse.status}`);
                    refreshStats.mowers[mowerId].endpoints.mower = false;
                    refreshStats.mowers[mowerId].success = false;
                    refreshStats.success = false;
                  }
                } catch (error) {
                  console.error(`[${connectionId}] Error fetching main data for mower ${mowerId}:`, error.message);
                  refreshStats.mowers[mowerId].endpoints.mower = false;
                  refreshStats.mowers[mowerId].success = false;
                  refreshStats.success = false;
                }
                
                // ENDPOINT 2: Fetch mower messages
                try {
                  const messagesResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers/${mowerId}/messages`, {
                    headers: {
                      'Authorization': `Bearer ${connection.token}`,
                      'X-Api-Key': connection.apiKey,
                      'Authorization-Provider': 'husqvarna',
                      'Accept': 'application/vnd.api+json'
                    }
                  });
                  
                  totalEndpointsCalled++;
                  refreshStats.mowers[mowerId].endpoints.messages = true;
                  
                  if (messagesResponse.status === 200 && messagesResponse.data && messagesResponse.data.data) {
                    console.log(`[${connectionId}] ✅ Successfully fetched messages for mower ${mowerId}`);
                    
                    const messages = messagesResponse.data.data;
                    queueFirebaseUpdate(mowerId, 'messagesList', {
                      items: messages,
                      count: messages.length,
                      timestamp: new Date(),
                      source: 'dashboard_refresh'
                    });
                    
                    // Also store individual messages
                    messages.forEach((message, index) => {
                      if (message.attributes) {
                        // Store in Firebase
                        queueFirebaseUpdate(mowerId, `messages/${message.id || `msg-${Date.now()}-${index}`}`, {
                          ...message.attributes,
                          timestamp: new Date(),
                          source: 'dashboard_refresh'
                        });
                        
                        // Also add to history if it's a recent message
                        if (db && message.attributes.datetime) {
                          const messageDate = new Date(message.attributes.datetime);
                          const now = new Date();
                          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                          
                          // Only add to history if message is from the last week
                          if (messageDate > oneWeekAgo) {
                            try {
                              setDoc(
                                doc(collection(db, MOWERS_COLLECTION, mowerId, 'history'), `msg-${message.id || Date.now()}-${index}`),
                                {
                                  timestamp: serverTimestamp(),
                                  type: 'message',
                                  data: message.attributes,
                                  source: 'dashboard_refresh'
                                }
                              );
                            } catch (historyError) {
                              console.error(`Error storing message in history:`, historyError);
                            }
                          }
                        }
                      }
                    });
                  } else {
                    console.error(`[${connectionId}] Failed to fetch messages for mower ${mowerId}: ${messagesResponse.status}`);
                    refreshStats.mowers[mowerId].endpoints.messages = false;
                  }
                } catch (error) {
                  console.error(`[${connectionId}] Error fetching messages for mower ${mowerId}:`, error.message);
                  refreshStats.mowers[mowerId].endpoints.messages = false;
                }
                
                // ENDPOINT 3: Fetch stay out zones
                try {
                  const stayOutZonesResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers/${mowerId}/stayOutZones`, {
                    headers: {
                      'Authorization': `Bearer ${connection.token}`,
                      'X-Api-Key': connection.apiKey,
                      'Authorization-Provider': 'husqvarna',
                      'Accept': 'application/vnd.api+json'
                    }
                  });
                  
                  totalEndpointsCalled++;
                  refreshStats.mowers[mowerId].endpoints.stayOutZones = true;
                  
                  if (stayOutZonesResponse.status === 200 && stayOutZonesResponse.data && stayOutZonesResponse.data.data) {
                    console.log(`[${connectionId}] ✅ Successfully fetched stay out zones for mower ${mowerId}`);
                    
                    const zones = stayOutZonesResponse.data.data;
                    queueFirebaseUpdate(mowerId, 'stayOutZones', {
                      items: zones,
                      count: zones.length,
                      timestamp: new Date(),
                      source: 'dashboard_refresh'
                    });
                    
                    // Also store individual zones
                    zones.forEach((zone, index) => {
                      if (zone.id && zone.attributes) {
                        queueFirebaseUpdate(mowerId, `stayOutZone/${zone.id}`, {
                          id: zone.id,
                          ...zone.attributes,
                          timestamp: new Date(),
                          source: 'dashboard_refresh'
                        });
                      }
                    });
                  } else {
                    console.error(`[${connectionId}] Failed to fetch stay out zones for mower ${mowerId}: ${stayOutZonesResponse.status}`);
                    refreshStats.mowers[mowerId].endpoints.stayOutZones = false;
                  }
                } catch (error) {
                  console.error(`[${connectionId}] Error fetching stay out zones for mower ${mowerId}:`, error.message);
                  refreshStats.mowers[mowerId].endpoints.stayOutZones = false;
                }
                
                // ENDPOINT 4: Fetch work areas
                try {
                  const workAreasResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers/${mowerId}/workAreas`, {
                    headers: {
                      'Authorization': `Bearer ${connection.token}`,
                      'X-Api-Key': connection.apiKey,
                      'Authorization-Provider': 'husqvarna',
                      'Accept': 'application/vnd.api+json'
                    }
                  });
                  
                  totalEndpointsCalled++;
                  refreshStats.mowers[mowerId].endpoints.workAreas = true;
                  
                  if (workAreasResponse.status === 200 && workAreasResponse.data && workAreasResponse.data.data) {
                    console.log(`[${connectionId}] ✅ Successfully fetched work areas for mower ${mowerId}`);
                    
                    const workAreas = workAreasResponse.data.data;
                    queueFirebaseUpdate(mowerId, 'workAreas', {
                      items: workAreas,
                      count: workAreas.length,
                      timestamp: new Date(),
                      source: 'dashboard_refresh'
                    });
                    
                    // Also store individual work areas
                    for (const workArea of workAreas) {
                      if (workArea.id) {
                        queueFirebaseUpdate(mowerId, `workArea/${workArea.id}`, {
                          id: workArea.id,
                          ...workArea.attributes,
                          timestamp: new Date(),
                          source: 'dashboard_refresh'
                        });
                        
                        // ENDPOINT 5: Fetch detailed work area data for each work area
                        try {
                          const workAreaDetailResponse = await axios.get(`${HUSQVARNA_API_URL}/mowers/${mowerId}/workAreas/${workArea.id}`, {
                            headers: {
                              'Authorization': `Bearer ${connection.token}`,
                              'X-Api-Key': connection.apiKey,
                              'Authorization-Provider': 'husqvarna',
                              'Accept': 'application/vnd.api+json'
                            }
                          });
                          
                          totalEndpointsCalled++;
                          refreshStats.mowers[mowerId].endpoints[`workArea_${workArea.id}`] = true;
                          
                          if (workAreaDetailResponse.status === 200 && workAreaDetailResponse.data && workAreaDetailResponse.data.data) {
                            console.log(`[${connectionId}] ✅ Successfully fetched work area details for area ${workArea.id}`);
                            
                            const workAreaDetail = workAreaDetailResponse.data.data;
                            queueFirebaseUpdate(mowerId, `workAreaDetail/${workArea.id}`, {
                              ...workAreaDetail.attributes,
                              timestamp: new Date(),
                              source: 'dashboard_refresh'
                            });
                          } else {
                            console.error(`[${connectionId}] Failed to fetch work area details for area ${workArea.id}: ${workAreaDetailResponse.status}`);
                            refreshStats.mowers[mowerId].endpoints[`workArea_${workArea.id}`] = false;
                          }
                        } catch (error) {
                          console.error(`[${connectionId}] Error fetching work area details for area ${workArea.id}:`, error.message);
                          refreshStats.mowers[mowerId].endpoints[`workArea_${workArea.id}`] = false;
                        }
                      }
                    }
                  } else {
                    console.error(`[${connectionId}] Failed to fetch work areas for mower ${mowerId}: ${workAreasResponse.status}`);
                    refreshStats.mowers[mowerId].endpoints.workAreas = false;
                  }
                } catch (error) {
                  console.error(`[${connectionId}] Error fetching work areas for mower ${mowerId}:`, error.message);
                  refreshStats.mowers[mowerId].endpoints.workAreas = false;
                }
                
                // Mark this mower as refreshed
                totalMowersRefreshed++;
              } catch (mowerError) {
                console.error(`[${connectionId}] Error in dashboard refresh for mower ${mowerId}:`, mowerError.message);
                refreshStats.mowers[mowerId].success = false;
                refreshStats.success = false;
              }
            }
          } else {
            console.log(`[${connectionId}] No mowers to refresh for dashboard`);
          }
        } catch (connectionError) {
          console.error(`[${connectionId}] Error during dashboard refresh:`, connectionError.message);
        }
      }
      
      // Finalize refresh statistics
      refreshStats.endTime = new Date();
      refreshStats.duration = refreshStats.endTime - refreshStats.startTime;
      refreshStats.totalMowersRefreshed = totalMowersRefreshed;
      refreshStats.totalEndpointsCalled = totalEndpointsCalled;
      
      console.log(`🔄 DASHBOARD REFRESH COMPLETE: Refreshed ${totalMowersRefreshed} mowers with ${totalEndpointsCalled} API calls in ${refreshStats.duration}ms`);
      
      // Store refresh statistics in Firebase
      if (db) {
        try {
          await setDoc(doc(db, 'system', 'dashboard_refresh'), {
            lastRefresh: serverTimestamp(),
            stats: refreshStats,
            success: refreshStats.success
          }, { merge: true });
        } catch (error) {
          console.error('Error storing dashboard refresh statistics:', error);
        }
      }
    } catch (error) {
      console.error('Error in dashboard refresh:', error);
    }
  })();
}

// Initialize server components
async function initializeServer() {
  // Initialize Firebase
  initializeFirebase();
  
  // Schedule periodic API polling (first poll after 5 minutes, then every API_POLL_INTERVAL)
  setTimeout(() => {
    pollMowerData();
    // Set up recurring polls
    setInterval(pollMowerData, API_POLL_INTERVAL);
  }, 5 * 60 * 1000); // 5 minutes delay for first poll
  
  // Start server
  server.listen(PORT, () => {
    console.log(`WebSocket proxy server started on port ${PORT}`);
    console.log(`API polling will run every ${API_POLL_INTERVAL / (60 * 60 * 1000)} hours`);
  });
}

// Start the server
initializeServer();

// Server startup
server.listen(PORT, () => {
  console.log(`WebSocket proxy server listening on port ${PORT}`);
  
  // Initialize Firebase at startup
  db = initializeFirebase();
  
  // Set up heartbeat interval to check connections
  setInterval(() => {
    console.log(`Checking ${connections.size} connections for heartbeat...`);
    connections.forEach((connection, id) => {
      if (!connection.isAlive) {
        console.log(`[${id}] Connection is no longer alive, terminating`);
        if (connection.husqvarnaWs) {
          connection.husqvarnaWs.terminate();
        }
        if (connection.clientWs) {
          connection.clientWs.terminate();
        }
        connections.delete(id);
        return;
      }
      
      // Set to not alive, expecting pong to set it back to alive
      connection.isAlive = false;
      
      // Send ping to both Husqvarna and client WebSockets
      if (connection.husqvarnaWs && connection.husqvarnaWs.readyState === WebSocket.OPEN) {
        connection.husqvarnaWs.ping();
      }
      if (connection.clientWs && connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.ping();
      }
    });
  }, HEARTBEAT_INTERVAL);
}); 