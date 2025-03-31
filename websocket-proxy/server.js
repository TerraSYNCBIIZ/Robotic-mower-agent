// WebSocket Proxy Server for Husqvarna API
// This server acts as a bridge between browser clients and Husqvarna's WebSocket API
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

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

// Store active connections for management
const connections = new Map();

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

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      connections: connections.size,
      uptime: process.uptime()
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

// Handle new WebSocket connections
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
    console.log(`[${connectionId}] New WebSocket connection established`);
    
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
    
    // Store the connection details including token for potential reconnection
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
    
    // Connect to Husqvarna's WebSocket API
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
        
        // Try to reconnect if client is still connected
        if (connection.clientWs.readyState === WebSocket.OPEN) {
          connection.reconnectAttempts++;
          if (connection.reconnectAttempts < 5) {
            const delay = Math.min(30000, RECONNECT_INTERVAL * Math.pow(1.5, connection.reconnectAttempts));
            console.log(`[${connectionId}] Will retry in ${delay}ms (attempt ${connection.reconnectAttempts})`);
            setTimeout(() => connectToHusqvarnaWS(connectionId), delay);
          } else {
            console.error(`[${connectionId}] Maximum reconnection attempts reached`);
            connection.clientWs.close(1011, 'Failed to connect to Husqvarna API after multiple attempts');
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
    
    // Handle messages from Husqvarna to the client
    husqvarnaWs.on('message', (message) => {
      try {
        if (connection.clientWs.readyState === WebSocket.OPEN) {
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
        console.error(`[${connectionId}] Error forwarding message to client:`, error);
      }
    });
    
    // Handle successful connection
    husqvarnaWs.on('open', () => {
      // Clear the connection timeout
      clearTimeout(timeoutId);
      
      console.log(`[${connectionId}] Successfully connected to Husqvarna WebSocket API`);
      connection.status = 'connected';
      connection.reconnectAttempts = 0;
      
      // Send a success message to the client
      if (connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Successfully connected to Husqvarna WebSocket API'
        }));
      }
      
      // Set up token refresh after 45 minutes (tokens last 60 min)
      // This follows Husqvarna's recommendation to refresh tokens preemptively
      setTimeout(() => {
        if (connections.has(connectionId) && 
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
        
        // Try to get a fresh token
        try {
          console.log(`[${connectionId}] Attempting to get a fresh token and reconnect...`);
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
          
          // Notify client about token refresh
          if (connection.clientWs.readyState === WebSocket.OPEN) {
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'refreshing_token',
              message: 'Getting a fresh token due to authentication error'
            }));
          }
        } catch (tokenError) {
          console.error(`[${connectionId}] Failed to get fresh token:`, tokenError);
          
          // Notify client about the fatal error
          if (connection.clientWs.readyState === WebSocket.OPEN) {
            connection.clientWs.send(JSON.stringify({
              type: 'connection_status',
              status: 'error',
              error: 'authentication_failed',
              message: 'Failed to authenticate with Husqvarna API'
            }));
          }
        }
      } else if (error.message && error.message.includes('simultaneous.logins')) {
        console.error(`[${connectionId}] Simultaneous logins error with Husqvarna API`);
        
        if (connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.send(JSON.stringify({
            type: 'connection_status',
            status: 'error',
            error: 'simultaneous_logins',
            message: 'Husqvarna API rejected the connection due to simultaneous logins'
          }));
        }
      }
    });
    
    // Handle connection close
    husqvarnaWs.on('close', (code, reason) => {
      // Clear the connection timeout
      clearTimeout(timeoutId);
      
      console.log(`[${connectionId}] Husqvarna WebSocket closed (${code}): ${reason}`);
      
      // If closed due to an error (not a normal closure), try to reconnect
      if (code !== 1000 && code !== 1001) {
        if (connection.clientWs.readyState === WebSocket.OPEN) {
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
        if (connection.clientWs.readyState === WebSocket.OPEN) {
          connection.clientWs.close(code, reason);
        }
        
        // Remove the connection
        connections.delete(connectionId);
      }
    });
    
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
    
  } catch (error) {
    console.error(`[${connectionId}] Error establishing Husqvarna WebSocket connection:`, error);
    
    // Clean up on error
    const connection = connections.get(connectionId);
    if (connection && connection.clientWs.readyState === WebSocket.OPEN) {
      connection.clientWs.close(1011, 'Error connecting to Husqvarna API');
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
      if (connection.clientWs.readyState === WebSocket.OPEN) {
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

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket proxy server running on port ${PORT}`);
  console.log(`Proxying connections to ${HUSQVARNA_WS_URL}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket proxy server...');
  
  // Stop the heartbeat interval
  clearInterval(heartbeat);
  
  // Close all connections
  connections.forEach((connection, id) => {
    try {
      if (connection.clientWs.readyState === WebSocket.OPEN) {
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