// Husqvarna API Configuration
export const HUSQVARNA_API = {
  // API endpoints
  AUTH_URL: 'https://api.authentication.husqvarnagroup.dev/v1',
  AMC_URL: 'https://api.amc.husqvarna.dev/v1',
  
  // API keys (from environment variables)
  APP_KEY: process.env.HUSQVARNA_APP_KEY || '',
  CLIENT_SECRET: process.env.HUSQVARNA_CLIENT_SECRET || '',
  
  // OAuth2 routes
  OAUTH_TOKEN_URL: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token',
  OAUTH_AUTHORIZE_URL: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize',
  
  // WebSocket URL - updated to match ioBroker implementation
  WEBSOCKET_URL: 'wss://ws.openapi.husqvarna.dev/v1',
  
  // API headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Authorization-Provider': 'husqvarna',
    'Accept': 'application/vnd.api+json'
  }
};

// Store in environment variables in production
// Comment is reminder to move these to .env files 