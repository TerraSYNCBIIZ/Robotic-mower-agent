import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Get the authorization code from the query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains our encrypted state
    
    // If there's no code, something went wrong with the authorization
    if (!code) {
      console.error('No authorization code received from Husqvarna');
      return NextResponse.redirect(`/login?error=no_auth_code`);
    }
    
    console.log('Received authorization code from Husqvarna');
    
    // Check if this is from the enhanced login flow by decoding state
    let isEnhancedFlow = false;
    let redirectAfterAuth = '/dashboard';
    
    try {
      if (state) {
        // Try to decode as JSON if it's base64 encoded
        try {
          const decodedState = decodeURIComponent(state);
          const stateData = JSON.parse(Buffer.from(decodedState, 'base64').toString());
          
          // Check if this is our enhanced login flow
          if (stateData.enhancedLogin) {
            console.log('Enhanced login flow detected with explicit amc:api scope');
            isEnhancedFlow = true;
            
            // Use the redirect path from state if available
            if (stateData.redirect) {
              redirectAfterAuth = stateData.redirect;
            }
          }
        } catch (e) {
          // Not JSON, just a regular redirect path
          redirectAfterAuth = decodeURIComponent(state);
          console.log('Regular login flow detected with redirect path:', redirectAfterAuth);
        }
      }
    } catch (error) {
      console.error('Error decoding state:', error);
      // Continue with default redirect path
    }
    
    // Check for multiple possible environment variable names for API credentials
    // First try to use credentials from state, then fall back to environment variables
    const clientId = process.env.HUSQVARNA_APP_KEY || 
                     process.env.HUSQVARNA_CLIENT_ID || 
                     process.env.HUSQVARNA_API_KEY || '';
    
    const clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || 
                         process.env.HUSQVARNA_SECRET || '';
    
    // Validate credentials
    if (!clientId || !clientSecret) {
      console.error('Missing credentials in state or environment');
      return NextResponse.redirect(`/login?error=missing_credentials`);
    }
    
    // Log which credentials we're using (don't do this in production!)
    console.log(`Using Client ID: ${clientId.substring(0, 5)}...`);
    console.log(`Using Client Secret: ${clientSecret.substring(0, 5)}...`);
    
    // Create the redirect URI (must match what was used in the authorization request)
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/husqvarna/callback`;
    
    // Prepare token request
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    });
    
    // Add scope explicitly for enhanced flow
    if (isEnhancedFlow) {
      params.append('scope', 'iam:read amc:api');
      console.log('Added explicit amc:api scope for enhanced flow');
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });
    
    const tokenData = await tokenResponse.json();
    
    // Check if token exchange was successful
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to exchange code for token:', tokenData);
      return NextResponse.redirect(`/login?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(tokenData))}`);
    }
    
    console.log('Successfully obtained tokens from Husqvarna');
    
    // Create a response to redirect to the specified page or dashboard
    const response = NextResponse.redirect(new URL(redirectAfterAuth, req.nextUrl.origin));
    
    // Set cookies in the response - needs to be client accessible for UI
    response.cookies.set('userAccessToken', tokenData.access_token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    });
    
    // Also set as mowerAccessToken for compatibility
    response.cookies.set('mowerAccessToken', tokenData.access_token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    });
    
    // Log success with token information
    try {
      const tokenParts = tokenData.access_token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        console.log('Token scopes:', payload.scope || payload.scopes || 'No scope found in token');
        console.log('Token issuer:', payload.iss || 'No issuer found');
        console.log('Token subject:', payload.sub || 'No subject found');
      }
    } catch (e) {
      console.error('Error parsing token:', e);
    }
    
    console.log('Authentication successful, redirecting to:', redirectAfterAuth);
    
    if (tokenData.refresh_token) {
      response.cookies.set('userRefreshToken', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 86400, // 24 hours
        path: '/'
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('Error in Husqvarna callback:', error);
    return NextResponse.redirect(`/login?error=callback_error&message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
} 