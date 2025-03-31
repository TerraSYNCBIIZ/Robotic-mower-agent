import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    // Get the WebSocket proxy details
    const host = process.env.WEBSOCKET_PROXY_HOST || 'localhost';
    const port = process.env.WEBSOCKET_PROXY_PORT || '8000';
    const isSecure = process.env.NODE_ENV === 'production';
    const protocol = isSecure ? 'https' : 'http';
    
    // Check if the WebSocket proxy is running
    try {
      // Query the proxy's health endpoint
      const response = await axios.get(`${protocol}://${host}:${port}/health`, {
        timeout: 2000 // 2 second timeout
      });
      
      if (response.status === 200 && response.data) {
        // Return the proxy status with persistent connection info
        return NextResponse.json({
          status: 'ok',
          proxyRunning: true,
          persistentConnection: response.data.persistentConnection === 'active',
          connections: response.data.connections || 0,
          uptime: response.data.uptime || 0
        });
      }
    } catch (proxyError: any) {
      console.warn('Error connecting to WebSocket proxy:', proxyError.message);
      // Continue to return a response even if proxy check fails
    }
    
    return NextResponse.json({
      status: 'error',
      proxyRunning: false,
      persistentConnection: false,
      message: 'WebSocket proxy server is not running or not reachable'
    });
  } catch (error) {
    console.error('Error checking proxy status:', error);
    return NextResponse.json(
      { error: 'Failed to check WebSocket proxy status' },
      { status: 500 }
    );
  }
} 