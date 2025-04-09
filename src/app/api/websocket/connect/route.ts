import { NextResponse } from 'next/server';
import webSocketManager from '@/services/husqvarnaWebSocket';
import { cookies } from 'next/headers';

/**
 * API route handler for WebSocket connection
 * This provides a server-side option for connecting to the WebSocket
 * which helps avoid CORS issues with the Firebase function
 * 
 * Uses the user's authentication token from cookies
 */
export async function POST() {
  try {
    console.log('API route: Connecting to WebSocket...');
    
    // Get authentication token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('userAccessToken')?.value;
    
    if (!token) {
      console.error('API route: No authentication token in cookies');
      return NextResponse.json(
        {
          success: false,
          error: 'User must be authenticated to connect to WebSocket',
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }
    
    // Set the token in the WebSocket manager
    webSocketManager.setToken(token);
    
    // Connect to WebSocket
    try {
      await webSocketManager.connect();
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: 'WebSocket connection initiated with user authentication token',
        timestamp: new Date().toISOString()
      });
    } catch (connectionError) {
      console.error('API route: Error connecting to Husqvarna WebSocket:', connectionError);
      return NextResponse.json(
        {
          success: false,
          error: connectionError instanceof Error ? connectionError.message : 'WebSocket connection failed',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API route: Unexpected error:', error);
    
    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 