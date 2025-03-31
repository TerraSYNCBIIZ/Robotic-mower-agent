import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';

/**
 * Special API endpoint to handle the "simultaneous logins" error from Husqvarna API
 * This makes a request using DIRECT API access (not user token)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Resetting Husqvarna authentication - using direct API key method');
    
    // Skip user token completely and use client credentials flow
    // This avoids the "simultaneous logins" issue by not using user tokens
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', HUSQVARNA_API.APP_KEY);
    params.set('client_secret', HUSQVARNA_API.CLIENT_SECRET);
    params.set('scope', 'iam:read amc:api');

    const tokenResponse = await fetch(HUSQVARNA_API.OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });
    
    const result = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Failed to get client credentials token:', result);
      return NextResponse.json(
        { error: 'Failed to reset authentication', details: result },
        { status: tokenResponse.status }
      );
    }
    
    console.log('Successfully obtained fresh client credentials token');
    
    return NextResponse.json({ 
      success: true,
      access_token: result.access_token,
      expires_in: result.expires_in,
      token_type: result.token_type
    });
    
  } catch (error) {
    console.error('Error resetting authentication:', error);
    return NextResponse.json(
      { error: 'Failed to reset authentication', message: (error as Error).message },
      { status: 500 }
    );
  }
} 