// Husqvarna API configuration
const HUSQVARNA_APP_KEY = process.env.HUSQVARNA_APP_KEY;
const HUSQVARNA_CLIENT_SECRET = process.env.HUSQVARNA_CLIENT_SECRET;
const HUSQVARNA_AUTH_API = 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token';
const HUSQVARNA_API_BASE = 'https://api.amc.husqvarna.dev/v1';
const WEBSOCKET_PROXY_URL = process.env.NEXT_PUBLIC_WEBSOCKET_PROXY_URL || 'ws://localhost:8000';

/**
 * Get an OAuth2 token from the Husqvarna API
 * @returns {Promise<string>} Access token
 */
export async function getHusqvarnaToken() {
  try {
    const response = await fetch(HUSQVARNA_AUTH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: `grant_type=client_credentials&client_id=${HUSQVARNA_APP_KEY}&client_secret=${HUSQVARNA_CLIENT_SECRET}`
    });

    if (!response.ok) {
      throw new Error(`Authentication error: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error obtaining Husqvarna token:', error);
    throw error;
  }
}

/**
 * Get a list of mowers from the Husqvarna API
 * @param {string} token - Access token
 * @returns {Promise<Array>} List of mowers
 */
export async function getMowers(token) {
  try {
    const response = await fetch(`${HUSQVARNA_API_BASE}/mowers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': HUSQVARNA_APP_KEY,
        'Authorization-Provider': 'husqvarna'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get mowers: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching mowers:', error);
    throw error;
  }
}

/**
 * Create a WebSocket connection to the proxy server
 * @param {string} token - Access token
 * @returns {WebSocket} WebSocket connection
 */
export function createWebSocketConnection(token) {
  if (typeof window === 'undefined') {
    console.error('WebSocket can only be created in browser environment');
    return null;
  }

  try {
    const wsUrl = `${WEBSOCKET_PROXY_URL}?token=${token}&apiKey=${HUSQVARNA_APP_KEY}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return ws;
  } catch (error) {
    console.error('Error creating WebSocket connection:', error);
    throw error;
  }
}

/**
 * Send a command to a mower
 * @param {string} token - Access token
 * @param {string} mowerId - Mower ID
 * @param {string} command - Command to send
 * @returns {Promise<object>} Command response
 */
export async function sendMowerCommand(token, mowerId, command) {
  try {
    const response = await fetch(`${HUSQVARNA_API_BASE}/mowers/${mowerId}/actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': HUSQVARNA_APP_KEY,
        'Authorization-Provider': 'husqvarna',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          type: 'actions',
          attributes: {
            action: command
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send command: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error sending ${command} command:`, error);
    throw error;
  }
}

export default {
  getHusqvarnaToken,
  getMowers,
  createWebSocketConnection,
  sendMowerCommand
}; 