import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint that directly calls the Husqvarna API with the token from cookies
 * and logs detailed information about the request and response.
 */
export async function GET(req: NextRequest) {
  try {
    console.log('DEBUG API - Starting diagnostic check');
    
    // Get the endpoint to test from query parameters
    const endpoint = req.nextUrl.searchParams.get('endpoint') || '/mowers';
    
    // Check for authentication tokens in cookies
    const userAccessToken = req.cookies.get('userAccessToken')?.value;
    const mowerAccessToken = req.cookies.get('mowerAccessToken')?.value;
    
    // Get API key from environment variables
    const apiKey = process.env.HUSQVARNA_APP_KEY || 
                   process.env.HUSQVARNA_API_KEY || 
                   process.env.HUSQVARNA_CLIENT_ID || '';
    
    if (!apiKey) {
      console.error('Missing API key in environment variables');
      return NextResponse.json({ error: 'Missing API key' }, { status: 400 });
    }
    
    // Determine which token to use
    const token = userAccessToken || mowerAccessToken;
    
    if (!token) {
      console.error('No access token found in cookies');
      return NextResponse.json({ error: 'No access token found in cookies' }, { status: 400 });
    }
    
    // Try to decode the token to check its contents
    let tokenInfo = null;
    let tokenIssuer = null;
    let tokenScopes = null;
    
    try {
      // The token is a JWT. Split by dots and decode the middle part
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
        
        // These are important for diagnosing issues
        tokenIssuer = payload.iss;
        tokenScopes = payload.scope || payload.scopes;
      }
    } catch (e) {
      console.error('Error decoding token:', e);
      // Continue anyway, this is just diagnostic info
    }
    
    console.log('Test auth details:', {
      hasToken: !!token,
      tokenLength: token.length,
      tokenFirstChars: token.substring(0, 10) + '...',
      tokenIssuer,
      tokenScopes,
      apiKeyFirstChars: apiKey.substring(0, 5) + '...',
    });
    
    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-Api-Key': apiKey,
      'Authorization-Provider': 'husqvarna',
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    };
    
    console.log('Request headers:', headers);
    
    // Construct API URL
    const apiUrl = `https://api.amc.husqvarna.dev/v1${endpoint}`;
    console.log(`Making request to: ${apiUrl}`);
    
    // Make the API request
    const startTime = performance.now();
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });
    const endTime = performance.now();
    
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    // Parse response
    let data;
    let responseBody;
    try {
      responseBody = await response.text();
      console.log(`Raw response body: ${responseBody.substring(0, 400)}${responseBody.length > 400 ? '...' : ''}`);
      
      // Try to parse as JSON
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        console.error('Error parsing response as JSON:', e);
        data = { text: responseBody };
      }
    } catch (e) {
      console.error('Error reading response body:', e);
      data = { error: 'Failed to read response body' };
    }
    
    // Return diagnostic information
    return NextResponse.json({
      success: response.ok,
      endpoint,
      requestedUrl: apiUrl,
      responseTime: Math.round(endTime - startTime),
      statusCode: response.status,
      statusText: response.statusText,
      dataReceived: !!data,
      apiKeyProvided: !!apiKey,
      tokenProvided: !!token,
      tokenType: userAccessToken ? 'userAccessToken' : 'mowerAccessToken',
      tokenInfo,
      response: data,
      requestHeaders: headers,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    });
    
  } catch (error) {
    console.error('Error in debug API call:', error);
    return NextResponse.json({ 
      error: 'Debug API call failed', 
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 