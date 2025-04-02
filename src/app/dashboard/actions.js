'use server';

/**
 * Dashboard actions for triggering API refreshes and data fetch operations
 * These functions are used to interact with the WebSocket proxy server's HTTP endpoints
 */

/**
 * Triggers a comprehensive refresh of all data for all mowers
 * This will fetch data from all available endpoints and store it in the database
 */
export async function triggerComprehensiveDataRefresh() {
  try {
    // Get the WebSocket proxy URL from environment variables with fallback
    const wsProxyUrl = process.env.NEXT_PUBLIC_WEBSOCKET_PROXY_URL || 'http://localhost:8000';
    
    // Make a POST request to the WebSocket proxy server's refresh endpoint
    const response = await fetch(`${wsProxyUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/dashboard/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ comprehensive: true })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to trigger data refresh');
    }
    
    return { 
      success: true,
      message: 'Refresh initiated. This may take a few seconds to complete.'
    };
  } catch (error) {
    console.error('Error triggering refresh:', error);
    return { 
      success: false, 
      error: error.message,
      message: 'Failed to trigger refresh'
    };
  }
} 