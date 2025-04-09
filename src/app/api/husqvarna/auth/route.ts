import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('AUTH REQUEST RECEIVED');
    
    // Get form data from request
    const formData = await req.formData();
    
    // Use provided credentials or fall back to environment variables
    let clientId = formData.get('client_id') as string;
    let clientSecret = formData.get('client_secret') as string;
    const grantType = formData.get('grant_type') || 'client_credentials';
    
    // If credentials not provided, use environment variables
    if (!clientId || clientId === 'env') {
      clientId = process.env.HUSQVARNA_CLIENT_ID || '';
      console.log('Using client ID from environment variables');
    }
    
    if (!clientSecret || clientSecret === 'env') {
      clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || '';
      console.log('Using client secret from environment variables');
    }
    
    // Validate request
    if (!clientId || !clientSecret) {
      console.error('Missing required credentials');
      return NextResponse.json(
        { error: 'Missing required credentials. Please provide client_id and client_secret or configure environment variables.' },
        { status: 400 }
      );
    }
    
    // Prepare the request to Husqvarna OAuth endpoint
    const authUrl = 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token';
    
    // Build request body
    const requestBody = new URLSearchParams();
    requestBody.append('grant_type', grantType.toString());
    requestBody.append('client_id', clientId);
    requestBody.append('client_secret', clientSecret);
    
    console.log(`Attempting authentication with client ID: ${clientId.substring(0, 5)}...`);
    
    // Make the request to Husqvarna OAuth service
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody.toString(),
    });
    
    // Get response data
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Authentication failed with status ${response.status}: ${JSON.stringify(data)}`);
      
      // Handle specific error cases
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Authentication failed: Invalid credentials', 
            details: data.error_description || data.error || 'Invalid application key or secret'
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Authentication failed', 
          details: data.error_description || data.error || `HTTP ${response.status}`
        },
        { status: response.status }
      );
    }
    
    console.log('Authentication successful');
    
    // Return the response
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Authentication failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 