import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies or request headers - properly awaited
    const cookieStore = await cookies();
    const mowerAccessTokenCookie = cookieStore.get('mowerAccessToken');
    let token = mowerAccessTokenCookie?.value;
    
    // If no token in cookies, check Authorization header
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // Ensure we have a token
    if (!token) {
      console.error('No access token found for WebSocket auth');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Make request to Husqvarna API to get WebSocket token
    // The correct endpoint for WebSocket authentication
    const response = await axios({
      method: 'GET',
      url: 'https://api.amc.husqvarna.dev/v1/token/websocket',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': HUSQVARNA_API.APP_KEY,
        'Accept': 'application/vnd.api+json'
      }
    });
    
    // Check response and return the token
    if (response.status === 200 && response.data && response.data.data?.token) {
      return NextResponse.json({
        token: response.data.data.token,
        success: true
      });
    } else {
      console.error('Invalid response from Husqvarna WebSocket auth API', response.data);
      return NextResponse.json(
        { error: 'Invalid WebSocket auth response' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting WebSocket auth token:', error);
    
    // Extract more detailed error information if available
    let status = 500;
    let message = 'Failed to get WebSocket auth token';
    
    if (axios.isAxiosError(error) && error.response) {
      status = error.response.status;
      message = `API Error: ${error.response.statusText}`;
      console.error('API error details:', error.response.data);
    }
    
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
} 