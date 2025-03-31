import { NextRequest, NextResponse } from 'next/server';
import { HusqvarnaClient } from '@/lib/husqvarna/api';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';

// This endpoint tests the connection to Husqvarna API
// It will try to authenticate and fetch mowers to diagnose any issues
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token') || '';
    
    const debugInfo: any = {
      testTime: new Date().toISOString(),
      authStatus: 'pending',
      steps: [],
      appKey: HUSQVARNA_API.APP_KEY ? HUSQVARNA_API.APP_KEY.substring(0, 8) + '...' : 'missing',
      clientSecret: HUSQVARNA_API.CLIENT_SECRET ? 'configured' : 'missing',
      token: token ? token.substring(0, 10) + '...' : 'not provided',
      error: null,
      mowersCount: 0,
      requestHeaders: {}
    };
    
    // Step 1: Create API client
    debugInfo.steps.push({ step: 1, action: 'Creating API client', status: 'started' });
    const apiClient = new HusqvarnaClient(token);
    debugInfo.steps[0].status = 'completed';
    
    // Prepare headers for direct API call test
    const headers = {
      'Content-Type': 'application/vnd.api+json',
      'Authorization-Provider': 'husqvarna',
      'Authorization': `Bearer ${token}`,
      'X-Api-Key': HUSQVARNA_API.APP_KEY,
    };
    
    debugInfo.requestHeaders = { ...headers, 'Authorization': `Bearer ${token.substring(0, 10)}...` };
    
    // Step 2: Direct fetch to Husqvarna API for authentication test
    debugInfo.steps.push({ step: 2, action: 'Testing API connection directly', status: 'started' });
    
    try {
      // We'll use fetch directly to get more detailed error information
      const response = await fetch('https://api.amc.husqvarna.dev/v1/mowers', {
        method: 'GET',
        headers,
        cache: 'no-store'
      });
      
      debugInfo.steps[1].status = 'completed';
      debugInfo.steps[1].httpStatus = response.status;
      debugInfo.steps[1].statusText = response.statusText;
      
      if (response.ok) {
        const data = await response.json();
        debugInfo.authStatus = 'authenticated';
        debugInfo.mowersCount = data.data?.length || 0;
        debugInfo.steps.push({ 
          step: 3, 
          action: 'Successfully retrieved mowers data', 
          status: 'completed',
          mowersCount: debugInfo.mowersCount
        });
      } else {
        // Try to get error details
        let errorDetails = '';
        try {
          if (response.headers.get('content-type')?.includes('application/json')) {
            errorDetails = await response.json();
          } else {
            errorDetails = await response.text();
          }
        } catch (e) {
          errorDetails = 'Could not parse error response';
        }
        
        debugInfo.authStatus = 'failed';
        debugInfo.error = {
          status: response.status,
          statusText: response.statusText,
          details: errorDetails
        };
        
        debugInfo.steps.push({ 
          step: 3, 
          action: 'API call failed', 
          status: 'failed',
          error: debugInfo.error
        });
      }
    } catch (error) {
      debugInfo.steps[1].status = 'failed';
      debugInfo.steps[1].error = error.message;
      debugInfo.authStatus = 'error';
      debugInfo.error = error.message;
    }
    
    // Return all debug info
    return NextResponse.json(debugInfo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 