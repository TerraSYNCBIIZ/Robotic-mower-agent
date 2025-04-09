import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint that directly gets a token using client credentials
 * and sets it as a cookie for testing purposes.
 */
export async function GET(req: NextRequest) {
  try {
    console.log('DEBUG LOGIN - Starting diagnostic flow');
    
    // Get API credentials from environment
    const clientId = process.env.HUSQVARNA_APP_KEY || 
                     process.env.HUSQVARNA_CLIENT_ID || 
                     process.env.HUSQVARNA_API_KEY || '';
    
    const clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || 
                         process.env.HUSQVARNA_SECRET || '';
    
    if (!clientId || !clientSecret) {
      console.error('Missing API credentials');
      return NextResponse.json({ error: 'Missing API credentials' }, { status: 400 });
    }
    
    console.log(`Using Client ID: ${clientId.substring(0, 5)}...`);
    
    // Get token using client credentials flow
    const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'iam:read amc:api'
      }).toString()
    });
    
    const tokenData = await tokenResponse.json();
    
    console.log('Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to get token:', tokenData);
      return NextResponse.json({ 
        error: 'Failed to get token', 
        details: tokenData,
        status: tokenResponse.status
      }, { status: 500 });
    }
    
    console.log('Successfully obtained test token, length:', tokenData.access_token.length);
    
    // Create response and set cookie
    const response = NextResponse.json({ 
      success: true,
      message: 'Debug login successful - token set as cookie',
      tokenLength: tokenData.access_token.length,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });
    
    // Set the cookie for testing
    response.cookies.set('userAccessToken', tokenData.access_token, {
      httpOnly: false,  // Make accessible to client-side JavaScript
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    });
    
    // Also set as mowerAccessToken for compatibility with existing code
    response.cookies.set('mowerAccessToken', tokenData.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    });
    
    console.log('Cookies set in response');
    
    return response;
  } catch (error) {
    console.error('Error in debug login:', error);
    return NextResponse.json({ 
      error: 'Debug login failed', 
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 