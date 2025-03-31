import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { husqvarnaApi } from '@/lib/husqvarna/api-client';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';
import axios from 'axios';

// In-memory token cache with expiry (lasts 45 minutes)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_CACHE_DURATION = 45 * 60 * 1000; // 45 minutes

// Function to get a fresh token using client credentials
async function getClientCredentialsToken() {
  try {
    // Check if we have a cached token that's still valid
    const now = Date.now();
    if (cachedToken && tokenExpiry > now) {
      console.log('Using cached OAuth token for WebSocket connection');
      return cachedToken;
    }
    
    console.log('Getting fresh OAuth token for WebSocket connection');
    const response = await axios({
      method: 'POST',
      url: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      data: `grant_type=client_credentials&client_id=${HUSQVARNA_API.APP_KEY}&client_secret=${HUSQVARNA_API.CLIENT_SECRET}`
    });
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('Successfully obtained fresh OAuth token for WebSocket');
      // Cache the token
      cachedToken = response.data.access_token;
      tokenExpiry = Date.now() + TOKEN_CACHE_DURATION;
      return response.data.access_token;
    } else {
      throw new Error('Invalid response from Husqvarna authentication API');
    }
  } catch (error) {
    console.error('Error getting OAuth token:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if the request has a cache control header
    const skipCache = request.headers.get('cache-control') === 'no-cache';
    
    // Try to get existing token first - prioritize stored tokens
    let token;
    const cookieStore = await cookies();
    token = cookieStore.get('mowerAccessToken')?.value;
    
    // If no token in cookies, try to get it from the API client
    if (!token) {
      const apiToken = husqvarnaApi.getAccessToken();
      if (apiToken) {
        console.log('Using existing API token for WebSocket connection');
        token = apiToken;
      }
    }
    
    // Only if we don't have a token, or cache is explicitly skipped, get a fresh one
    if (!token || skipCache) {
      try {
        token = await getClientCredentialsToken();
      } catch (tokenError) {
        console.error('Failed to get client credentials token:', tokenError);
        
        // If we still don't have a token, try to generate a direct API token
        if (!token) {
          console.log('No authentication token found, generating a direct API token');
          // Generate a synthetic token containing the API key
          const apiKey = HUSQVARNA_API.APP_KEY;
          const timestamp = Date.now();
          
          // Create a synthetic token containing the API key
          const tokenData = {
            api_key: apiKey,
            created: timestamp,
            exp: timestamp + (3600 * 1000), // 1 hour expiry
            type: 'direct_api'
          };
          
          const syntheticToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
          token = `directapi.${syntheticToken}`;
        }
      }
    } else {
      console.log('Using existing token for WebSocket connection');
    }
    
    if (!token) {
      console.error('No authentication token could be generated for WebSocket connection');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('🔑 WebSocket proxy providing connection details with token');
    
    // Get the WebSocket proxy details from environment variables or use defaults
    const host = request.headers.get('host') || 'localhost';
    const isSecure = request.headers.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production';
    const wsProxyHost = process.env.WEBSOCKET_PROXY_HOST || host.split(':')[0]; // Remove port if present
    const wsProxyPort = process.env.WEBSOCKET_PROXY_PORT || '8000'; 
    const wsProxyProtocol = isSecure ? 'wss' : 'ws';
    
    // Determine if port should be included in URL
    const includePort = wsProxyHost === 'localhost' || !isSecure;
    const wsProxyUrl = includePort 
      ? `${wsProxyProtocol}://${wsProxyHost}:${wsProxyPort}`
      : `${wsProxyProtocol}://${wsProxyHost}`;
    
    console.log(`Using WebSocket proxy URL: ${wsProxyUrl}`);
    
    // Add cache control headers to reduce frequent calls
    const response = NextResponse.json({
      wsProxyUrl,
      token,
      apiKey: HUSQVARNA_API.APP_KEY,
      success: true
    });
    
    // Add cache headers to prevent frequent calls
    response.headers.set('Cache-Control', 'private, max-age=300'); // 5 minute cache
    
    return response;
  } catch (error) {
    console.error('WebSocket proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to get WebSocket connection details' },
      { status: 500 }
    );
  }
} 