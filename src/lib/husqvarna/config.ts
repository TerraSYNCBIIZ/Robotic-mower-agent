/**
 * Husqvarna API Configuration
 */
export const HUSQVARNA_API = {
  // Application credentials
  APP_KEY: process.env.HUSQVARNA_APP_KEY || '',
  CLIENT_SECRET: process.env.HUSQVARNA_CLIENT_SECRET || '',
  
  // API URLs
  BASE_URL: 'https://api.amc.husqvarna.dev/v1',
  OAUTH_AUTH_URL: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize',
  OAUTH_TOKEN_URL: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token',
  OAUTH_REVOKE_URL: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/revoke',
  
  // WebSocket
  WEBSOCKET_URL: 'wss://ws.amc.husqvarna.dev/v1',
};

/**
 * Get API headers for Husqvarna API requests
 */
export function getHusqvarnaApiHeaders(accessToken: string, contentType = 'application/vnd.api+json') {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Authorization-Provider': 'husqvarna',
    'X-Api-Key': HUSQVARNA_API.APP_KEY,
    'Content-Type': contentType,
  };
} 