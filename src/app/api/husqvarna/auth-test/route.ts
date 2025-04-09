import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint that tests different authentication methods with the Husqvarna API
 * to help diagnose issues.
 */
export async function GET(req: NextRequest) {
  try {
    console.log('AUTH TEST - Testing authentication methods');
    
    // Get API credentials from environment
    const appKey = process.env.HUSQVARNA_APP_KEY || 
                   process.env.HUSQVARNA_API_KEY || 
                   process.env.HUSQVARNA_CLIENT_ID || '';
    
    const clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || 
                         process.env.HUSQVARNA_SECRET || '';
    
    if (!appKey || !clientSecret) {
      console.error('Missing API credentials in environment');
      return NextResponse.json({ error: 'Missing API credentials in environment' }, { status: 400 });
    }
    
    // Step 1: Get token using client credentials flow
    console.log('Getting token using client credentials flow');
    
    const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appKey,
        client_secret: clientSecret,
        scope: 'iam:read amc:api'
      }).toString()
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to get token:', tokenData);
      return NextResponse.json({ 
        error: 'Failed to get token with client credentials', 
        details: tokenData 
      }, { status: 500 });
    }
    
    const token = tokenData.access_token;
    console.log('Successfully obtained token with client credentials flow');
    
    // Extract token information
    let tokenInfo = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        tokenInfo = {
          sub: payload.sub,
          exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
          scope: payload.scope,
          scopes: payload.scopes,
          jti: payload.jti,
          issuer: payload.iss,
          client_id: payload.client_id,
        };
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
    
    // Step 2: Try to call the API with this token
    console.log('Testing API call with client credentials token');
    
    const apiResponse = await fetch('https://api.amc.husqvarna.dev/v1/mowers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Api-Key': appKey,
        'Authorization-Provider': 'husqvarna',
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      }
    });
    
    let apiData;
    try {
      apiData = await apiResponse.json();
    } catch (e) {
      apiData = { error: 'Failed to parse response' };
    }
    
    console.log(`API response status: ${apiResponse.status}`);
    
    // Return diagnostic information
    return NextResponse.json({
      clientCredentialsAuthentication: {
        success: tokenResponse.ok,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        tokenLength: token.length,
        tokenInfo
      },
      apiTest: {
        success: apiResponse.ok,
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        response: apiData
      },
      message: 'This tests client credentials flow, which may not show personal mowers. If this works but your user authentication does not, the issue is likely with your user token scope.'
    });
    
  } catch (error) {
    console.error('Error in auth test:', error);
    return NextResponse.json({ 
      error: 'Auth test failed', 
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 