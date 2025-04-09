import { NextResponse } from 'next/server';

/**
 * Mock API route handler for WebSocket connection
 * This provides a client-side option for connecting to the WebSocket in development
 * It returns success without actually connecting to anything
 */
export async function POST() {
  try {
    console.log('Mock API route: Simulating WebSocket connection...');
    
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Mock WebSocket connection simulated',
      timestamp: new Date().toISOString(),
      mode: 'development',
      note: 'This is a mock connection that doesn\'t connect to a real WebSocket'
    });
  } catch (error) {
    console.error('Mock API route: Error:', error);
    
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