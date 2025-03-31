import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { husqvarnaApi } from '@/lib/husqvarna/api-client';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';
import axios from 'axios';

// Function to get a fresh token using client credentials
async function getClientCredentialsToken() {
  try {
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
    // Try to get a fresh token using client credentials
    let token;
    try {
      token = await getClientCredentialsToken();
      console.log('Using fresh OAuth token for WebSocket connection');
    } catch (tokenError) {
      console.error('Failed to get client credentials token:', tokenError);
      
      // Fall back to stored token
      const cookieStore = await cookies();
      token = cookieStore.get('mowerAccessToken')?.value;
      
      // If still no token, try to get it from the API client
      if (!token) {
        const apiToken = husqvarnaApi.getAccessToken();
        if (apiToken) token = apiToken;
      }
      
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
    
    if (!token) {
      console.error('No authentication token could be generated for WebSocket connection');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('🔑 WebSocket proxy providing connection details with token');
    
    // Get the WebSocket proxy details from environment variables or use defaults
    // Always use port 8000 to avoid conflict with Next.js on port 3000
    const wsProxyHost = process.env.WEBSOCKET_PROXY_HOST || 'localhost';
    const wsProxyPort = '8000'; // Hardcoded to ensure we use port 8000
    const wsProxyProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    
    // Return both the token and API key for the proxy to use
    return NextResponse.json({
      wsProxyUrl: `${wsProxyProtocol}://${wsProxyHost}:${wsProxyPort}`,
      token,
      apiKey: HUSQVARNA_API.APP_KEY,
      success: true
    });
  } catch (error) {
    console.error('WebSocket proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to get WebSocket connection details' },
      { status: 500 }
    );
  }
} 