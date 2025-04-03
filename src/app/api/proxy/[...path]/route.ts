import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// The base URL for the Husqvarna API
const API_BASE_URL = 'https://api.amc.husqvarna.dev/v1';

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  // Get the path parameters - use await Promise.resolve pattern recommended by Next.js
  const pathArray = [...await Promise.resolve(context.params.path)];
  return handleRequest(request, pathArray, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  // Get the path parameters - use await Promise.resolve pattern recommended by Next.js
  const pathArray = [...await Promise.resolve(context.params.path)];
  return handleRequest(request, pathArray, 'POST');
}

export async function PUT(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  // Get the path parameters - use await Promise.resolve pattern recommended by Next.js
  const pathArray = [...await Promise.resolve(context.params.path)];
  return handleRequest(request, pathArray, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  // Get the path parameters - use await Promise.resolve pattern recommended by Next.js
  const pathArray = [...await Promise.resolve(context.params.path)];
  return handleRequest(request, pathArray, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    
    // Log all available cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log(`Proxy request cookies found: ${allCookies.length}`, 
      allCookies.map(c => c.name).join(', '));
    
    // Try to get token from cookies
    const token = cookieStore.get('mowerAccessToken')?.value;
    
    // Also check for token in request headers (sent from client)
    const authHeader = request.headers.get('Authorization');
    const headerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    // Use token from cookie or header
    const finalToken = token || headerToken;
    
    // Log token status but don't expose the full token
    if (token) {
      console.log(`Token found in cookies: ${token.substring(0, 10)}...`);
    } else if (headerToken) {
      console.log(`Token found in Authorization header: ${headerToken.substring(0, 10)}...`);
    } else {
      console.error('No authentication token found in cookies or headers');
    }
    
    if (!finalToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Reconstruct the API path
    const apiPath = pathSegments.join('/');
    const url = `${API_BASE_URL}/${apiPath}`;
    
    console.log(`Proxying ${method} request to: ${url}`);
    
    // Check if this is a direct API token (our fallback method)
    const isDirectApiToken = finalToken.startsWith('directapi.');
    
    // Prepare headers
    const headers = new Headers();
    
    // Common headers for all API requests
    headers.set('Content-Type', 'application/json');
    
    // Set the correct Accept header based on the endpoint
    if (apiPath.includes('mowers')) {
      // Most Husqvarna API endpoints require vnd.api+json
      headers.set('Accept', 'application/vnd.api+json');
      
      // For POST actions to mowers endpoints, also need vnd.api+json content type
      if (method === 'POST' && (apiPath.includes('actions') || apiPath.includes('calendar'))) {
        headers.set('Content-Type', 'application/vnd.api+json');
      }
    } else {
      // Use regular JSON for other endpoints
      headers.set('Accept', 'application/json');
    }
    
    // Always include the API key and Authorization-Provider headers
    const apiKey = process.env.HUSQVARNA_APP_KEY || '';
    headers.set('X-Api-Key', apiKey);
    headers.set('Authorization-Provider', 'husqvarna');
    
    if (isDirectApiToken) {
      // Direct API method - extract the token data
      try {
        const tokenData = JSON.parse(
          Buffer.from(finalToken.split('.')[1], 'base64').toString()
        );
        
        if (tokenData.api_key) {
          console.log('Using direct API key authentication');
          // Always set both API key and Authorization header
          // Even with direct API method, the Authorization header is required
          headers.set('Authorization', `Bearer ${finalToken}`);
          console.log('Using direct token in Authorization header');
        } else {
          throw new Error('Invalid direct API token format');
        }
      } catch (error) {
        console.error('Failed to parse direct API token:', error);
        return NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    } else {
      // Standard OAuth method - use bearer token
      headers.set('Authorization', `Bearer ${finalToken}`);
    }

    // Create request options
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Handle request body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const body = await request.json().catch(() => ({}));
      requestOptions.body = JSON.stringify(body);
    }

    // Forward the request to the API
    const response = await fetch(url, requestOptions);
    
    // Log response status
    console.log(`Proxy received response: ${response.status} ${response.statusText}`);
    
    // Get response data
    const responseData = await response.json().catch(() => ({}));
    
    // Create the response with appropriate status
    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to API' },
      { status: 500 }
    );
  }
}

// Function to get a fresh token using client credentials
async function getClientCredentialsToken() {
  try {
    const appKey = process.env.HUSQVARNA_APP_KEY;
    const appSecret = process.env.HUSQVARNA_CLIENT_SECRET;
    
    if (!appKey || !appSecret) {
      throw new Error('Missing API credentials in environment variables');
    }
    
    const response = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: `grant_type=client_credentials&client_id=${appKey}&client_secret=${appSecret}`
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Client credentials authentication failed:', error);
      throw new Error(`Failed to get client credentials token: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.access_token) {
      return data.access_token;
    }
    
    throw new Error('Invalid response from Husqvarna authentication API');
  } catch (error) {
    console.error('Error getting OAuth token:', error);
    throw error;
  }
} 