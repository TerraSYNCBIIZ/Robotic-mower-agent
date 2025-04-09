import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const redirectAfterAuth = searchParams.get('redirect') || '/dashboard';
    
    // Check for multiple possible environment variable names for API credentials
    const clientId = process.env.HUSQVARNA_APP_KEY || 
                     process.env.HUSQVARNA_CLIENT_ID || 
                     process.env.HUSQVARNA_API_KEY || '';
    
    const clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || 
                         process.env.HUSQVARNA_SECRET || '';
    
    // Log the environment variables (don't do this in production!)
    console.log('Environment variables:');
    console.log('HUSQVARNA_APP_KEY:', process.env.HUSQVARNA_APP_KEY ? 'Set' : 'Not set');
    console.log('HUSQVARNA_CLIENT_SECRET:', process.env.HUSQVARNA_CLIENT_SECRET ? 'Set' : 'Not set');
    console.log('HUSQVARNA_API_KEY:', process.env.HUSQVARNA_API_KEY ? 'Set' : 'Not set');
    console.log('All env variables:', Object.keys(process.env).filter(key => key.includes('HUSQ')));
    
    if (!clientId || !clientSecret) {
      console.error('Missing credentials in environment variables');
      return NextResponse.json(
        { 
          error: "Missing API credentials. Please set HUSQVARNA_APP_KEY and HUSQVARNA_CLIENT_SECRET in your environment variables.",
          envKeys: Object.keys(process.env).filter(key => key.includes('HUSQ'))
        },
        { status: 500 }
      );
    }
    
    console.log(`Using Client ID: ${clientId.substring(0, 5)}...`);
    console.log(`Using Client Secret: ${clientSecret.substring(0, 5)}...`);
    
    // Create the redirect URI for the callback after authorization
    // This should be registered in your Husqvarna developer application
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/husqvarna/callback`;
    
    // Pass the credentials to the callback URL as query parameters (will be encrypted in state)
    const stateData = {
      redirect: redirectAfterAuth,
      clientId: clientId,
      clientSecret: clientSecret
    };
    
    // Encode and encrypt the state data
    const encodedState = encodeURIComponent(Buffer.from(JSON.stringify(stateData)).toString('base64'));
    
    // Build the authorization URL
    const authUrl = new URL('https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', encodedState);
    
    console.log(`Redirecting to Husqvarna auth: ${authUrl.toString()}`);
    
    // Redirect the user to the Husqvarna authorization page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Husqvarna auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Husqvarna authentication", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 