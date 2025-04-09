import { NextResponse } from 'next/server';
import webSocketManager from '@/services/husqvarnaWebSocket';
import { cookies } from 'next/headers';

/**
 * API route to test WebSocket connection with Husqvarna API
 * Uses the user's authentication token from cookies
 */
export async function GET() {
  try {
    console.log('Starting WebSocket connection test...');
    
    // Get authentication token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('userAccessToken')?.value;
    
    if (!token) {
      return NextResponse.json({
        success: false,
        stage: 'authentication-check',
        error: 'No authentication token found in cookies',
        details: 'User must be logged in to test WebSocket connection'
      }, { status: 401 });
    }
    
    // Configure the WebSocket with user's token
    webSocketManager.setToken(token);
    
    try {
      // Try to connect
      const ws = await webSocketManager.connect();
      
      // Successfully connected
      return NextResponse.json({
        success: true,
        message: 'WebSocket connection successful using authentication token',
        tokenSource: 'user-authentication',
        websocketState: ws.readyState,
        timestamp: new Date().toISOString()
      });
    } catch (wsError) {
      return NextResponse.json({
        success: false,
        stage: 'websocket-connection',
        error: 'Failed to connect to WebSocket using authentication token',
        details: wsError instanceof Error ? wsError.message : String(wsError)
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      stage: 'unexpected-error',
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 