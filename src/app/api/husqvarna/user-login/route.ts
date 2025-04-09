import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('STARTING USER LOGIN FLOW FOR AUTOMOWER API');
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const redirectAfterAuth = searchParams.get('redirect') || '/api-sandbox';
    
    // Check for API credentials in environment variables
    const clientId = process.env.HUSQVARNA_APP_KEY || 
                     process.env.HUSQVARNA_CLIENT_ID || 
                     process.env.HUSQVARNA_API_KEY || '';
    
    const clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || 
                         process.env.HUSQVARNA_SECRET || '';
    
    if (!clientId || !clientSecret) {
      console.error('Missing API credentials in environment variables');
      return NextResponse.json(
        { error: "Missing API credentials. Please check environment variables." },
        { status: 500 }
      );
    }
    
    console.log(`Starting OAuth flow with client ID: ${clientId.substring(0, 5)}...`);
    
    // Create the redirect URI for the callback after authorization
    // Using the exact URI that's registered in the Husqvarna developer portal
    const redirectUri = 'http://localhost:3000/api/auth/husqvarna/callback';
    console.log(`Using redirect URI: ${redirectUri}`);
    
    // Pass the credentials and redirect path in state
    const stateData = {
      redirect: redirectAfterAuth,
      clientId: clientId,
      clientSecret: clientSecret,
      enhancedLogin: true // Flag for the callback to recognize this flow
    };
    
    // Encode state data for security
    const encodedState = encodeURIComponent(Buffer.from(JSON.stringify(stateData)).toString('base64'));
    
    // Build the authorization URL - explicitly requesting the amc:api scope
    const authUrl = new URL('https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', encodedState);
    authUrl.searchParams.append('scope', 'iam:read amc:api'); // Explicit scope for Automower API
    
    console.log(`Redirecting to Husqvarna auth: ${authUrl.toString()}`);
    
    // Redirect the user to the Husqvarna authorization page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating Husqvarna user auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate user authentication", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 