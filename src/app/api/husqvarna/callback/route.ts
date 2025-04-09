import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Add debug information for authentication flow
    console.log('HUSQVARNA CALLBACK RECEIVED - checking for enhanced login flow');
    
    // Get the authorization code from the query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains our redirect path
    
    // If there's no code, something went wrong with the authorization
    if (!code) {
      console.error('No authorization code received from Husqvarna');
      return NextResponse.redirect(`/api-sandbox?error=no_auth_code`);
    }
    
    console.log('Received authorization code from Husqvarna');
    
    // Check if this is from the enhanced login flow by decoding state
    let isEnhancedFlow = false;
    let stateData: any = null;
    let redirectAfterAuth = '/api-sandbox';
    
    try {
      if (state) {
        const decodedState = decodeURIComponent(state);
        // Check if this is a JSON object in base64
        if (decodedState.startsWith('eyJ')) {
          stateData = JSON.parse(Buffer.from(decodedState, 'base64').toString());
          
          if (stateData.redirectUris) {
            console.log('Enhanced login flow detected');
            isEnhancedFlow = true;
            redirectAfterAuth = stateData.redirect || '/api-sandbox';
          }
        } else {
          // Regular flow with direct path
          redirectAfterAuth = decodedState;
        }
      }
    } catch (error) {
      console.error('Error decoding state:', error);
      // Continue with default behavior if there's an error
    }
    
    // Get application credentials directly from environment variables or state
    const appKey = (isEnhancedFlow && stateData?.clientId) 
                  ? stateData.clientId 
                  : process.env.HUSQVARNA_APP_KEY || '';
                  
    const clientSecret = (isEnhancedFlow && stateData?.clientSecret) 
                       ? stateData.clientSecret 
                       : process.env.HUSQVARNA_CLIENT_SECRET || '';
    
    if (!appKey || !clientSecret) {
      console.error('Missing API credentials in environment variables');
      return NextResponse.redirect(`/api-sandbox?error=missing_credentials`);
    }
    
    // Create the redirect URI (must match what was used in the authorization request)
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/husqvarna/callback`;
    
    // Exchange the authorization code for tokens
    console.log('Exchanging code for tokens...');
    
    // Prepare token request parameters
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    });
    
    // Add scope for enhanced flow
    if (isEnhancedFlow) {
      tokenParams.append('scope', 'iam:read amc:api');
      console.log('Added explicit scopes to token request: iam:read amc:api');
    }
    
    const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });
    
    const tokenData = await tokenResponse.json();
    
    // Check if token exchange was successful
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to exchange code for token:', tokenData);
      return NextResponse.redirect(`/api-sandbox?error=token_exchange_failed`);
    }
    
    // Try to parse the token to see the scopes
    try {
      const parts = tokenData.access_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('Token scopes:', payload.scope || payload.scopes || 'No scope found');
      }
    } catch (err) {
      console.error('Error parsing token payload:', err);
    }
    
    console.log('Successfully obtained tokens from Husqvarna');
    
    // Create a response to redirect
    const response = NextResponse.redirect(new URL(redirectAfterAuth, req.nextUrl.origin));
    
    // Set cookies in the response - make them accessible to client JS
    response.cookies.set('userAccessToken', tokenData.access_token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    });
    
    // Also set mowerAccessToken for compatibility
    response.cookies.set('mowerAccessToken', tokenData.access_token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    });
    
    if (tokenData.refresh_token) {
      response.cookies.set('userRefreshToken', tokenData.refresh_token, {
        httpOnly: true, // Keep refresh token secure
        secure: process.env.NODE_ENV === 'production',
        maxAge: 86400, // 24 hours
        path: '/'
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('Error in Husqvarna callback:', error);
    return NextResponse.redirect(`/api-sandbox?error=callback_error`);
  }
} 