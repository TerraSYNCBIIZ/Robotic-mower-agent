import { NextResponse } from 'next/server';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';

/**
 * Test endpoint to verify Husqvarna API credentials
 */
export async function GET() {
  try {
    console.log('Testing Husqvarna API credentials with client credentials flow');
    
    // Get credentials from environment
    const appKey = HUSQVARNA_API.APP_KEY.trim();
    const clientSecret = HUSQVARNA_API.CLIENT_SECRET.trim();
    
    if (!appKey || !clientSecret) {
      console.error('Missing API credentials');
      return NextResponse.json({ error: 'Missing API credentials' }, { status: 500 });
    }
    
    console.log('Using client_id:', appKey);
    console.log('Client secret length:', clientSecret.length);
    
    // Create token request using client credentials flow
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', appKey);
    params.set('client_secret', clientSecret);
    params.set('scope', 'iam:read');
    
    // Make the request to get a token
    const response = await fetch(HUSQVARNA_API.OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });
    
    if (!response.ok) {
      // Try to get error details
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (err) {
        errorDetails = await response.text();
      }
      
      console.error('Failed to get token:', response.status, response.statusText, errorDetails);
      
      return NextResponse.json({
        error: 'Authentication failed',
        status: response.status,
        statusText: response.statusText,
        details: errorDetails
      }, { status: 500 });
    }
    
    const tokenData = await response.json();
    
    return NextResponse.json({
      success: true,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      // Only show partial token for security
      access_token: tokenData.access_token ? `${tokenData.access_token.substring(0, 10)}...` : null
    });
  } catch (error: unknown) {
    console.error('Error testing auth:', error);
    return NextResponse.json({ 
      error: 'Failed to test authentication',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 