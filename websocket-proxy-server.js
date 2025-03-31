// WebSocket Proxy Server for Husqvarna API
// This server acts as a bridge between browser clients and Husqvarna's WebSocket API
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configuration
const PORT = process.env.WEBSOCKET_PROXY_PORT || 3001;
const HUSQVARNA_WS_URL = 'wss://api.amc.husqvarna.dev/v1/websocket';

// Store active connections for management
const connections = new Map();

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Health check endpoint
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', connections: connections.size }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Handle new WebSocket connections
wss.on('connection', function connection(clientWs, req) {
  try {
    // Parse the URL to get the token from query parameters
    const parsedUrl = url.parse(req.url, true);
    const token = parsedUrl.query.token;
    
    if (!token) {
      console.error('No token provided in WebSocket connection');
      clientWs.close(1008, 'Authentication required');
      return;
    }
    
    // Generate a unique connection ID
    const connectionId = crypto.randomUUID();
    console.log(`[${connectionId}] New WebSocket connection established`);
    
    // Connect to Husqvarna's WebSocket API with the token
    console.log(`[${connectionId}] Connecting to Husqvarna WebSocket API...`);
    const husqvarnaWs = new WebSocket(HUSQVARNA_WS_URL, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Store the connection for management
    connections.set(connectionId, {
      clientWs,
      husqvarnaWs,
      connectedAt: new Date(),
      messageCount: 0
    });
    
    // Handle messages from the client to Husqvarna
    clientWs.on('message', function(message) {
      if (husqvarnaWs.readyState === WebSocket.OPEN) {
        connections.get(connectionId).messageCount++;
        console.log(`[${connectionId}] Client -> Husqvarna: ${message}`);
        husqvarnaWs.send(message);
      }
    });
    
    // Handle messages from Husqvarna to the client
    husqvarnaWs.on('message', function(message) {
      if (clientWs.readyState === WebSocket.OPEN) {
        connections.get(connectionId).messageCount++;
        console.log(`[${connectionId}] Husqvarna -> Client: ${message.length} bytes`);
        clientWs.send(message);
      }
    });
    
    // Handle client disconnection
    clientWs.on('close', function(code, reason) {
      console.log(`[${connectionId}] Client disconnected (${code}): ${reason}`);
      if (husqvarnaWs.readyState === WebSocket.OPEN) {
        husqvarnaWs.close();
      }
      connections.delete(connectionId);
    });
    
    // Handle Husqvarna disconnection
    husqvarnaWs.on('close', function(code, reason) {
      console.log(`[${connectionId}] Husqvarna disconnected (${code}): ${reason}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason);
      }
      connections.delete(connectionId);
    });
    
    // Handle errors from client
    clientWs.on('error', function(error) {
      console.error(`[${connectionId}] Client error:`, error);
    });
    
    // Handle errors from Husqvarna
    husqvarnaWs.on('error', function(error) {
      console.error(`[${connectionId}] Husqvarna error:`, error);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'Error connecting to Husqvarna API');
      }
    });
    
    // Handle Husqvarna WebSocket connection
    husqvarnaWs.on('open', function() {
      console.log(`[${connectionId}] Successfully connected to Husqvarna WebSocket API`);
      // Send a success message to the client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Successfully connected to Husqvarna WebSocket API'
        }));
      }
    });
  } catch (error) {
    console.error('Error handling WebSocket connection:', error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Internal server error');
    }
  }
});

// Create automatic ping functionality to keep connections alive
setInterval(() => {
  connections.forEach((connection, id) => {
    try {
      // Check if Husqvarna connection is still alive
      if (connection.husqvarnaWs.readyState === WebSocket.OPEN) {
        connection.husqvarnaWs.ping();
      }
      
      // Check if client connection is still alive
      if (connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.ping();
      }
    } catch (error) {
      console.error(`[${id}] Error pinging connection:`, error);
    }
  });
}, 30000); // Every 30 seconds

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket proxy server running on port ${PORT}`);
  console.log(`Proxying connections to ${HUSQVARNA_WS_URL}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket proxy server...');
  
  // Close all connections
  connections.forEach((connection, id) => {
    try {
      if (connection.clientWs.readyState === WebSocket.OPEN) {
        connection.clientWs.close(1001, 'Server shutting down');
      }
      if (connection.husqvarnaWs.readyState === WebSocket.OPEN) {
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