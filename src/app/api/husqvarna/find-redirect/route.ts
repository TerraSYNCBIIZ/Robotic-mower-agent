import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('REDIRECT URI FINDER - Diagnosing allowed redirect URIs');
    
    // Get client credentials from environment
    const clientId = process.env.HUSQVARNA_APP_KEY || 
                     process.env.HUSQVARNA_CLIENT_ID || 
                     process.env.HUSQVARNA_API_KEY || '';
    
    if (!clientId) {
      return NextResponse.json({ error: 'Missing API credentials' }, { status: 400 });
    }
    
    // List of possible redirect URIs to test
    const possibleRedirectUris = [
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/husqvarna/callback`,
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/husqvarna/callback`,
      'http://localhost:3000/api/husqvarna/callback',
      'http://localhost:3000/api/auth/husqvarna/callback',
      '/api/husqvarna/callback',
      '/api/auth/husqvarna/callback'
    ];
    
    // Extract the current one being used
    const currentUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/husqvarna/callback`;
    
    // Return the list for reference
    return NextResponse.json({
      message: 'Potential redirect URIs to try',
      clientIdPrefix: clientId.substring(0, 5) + '...',
      current: currentUri,
      tryThese: possibleRedirectUris,
      instructions: `
        1. Check your Husqvarna developer portal for the correct redirect URI
        2. Update your login route to use exactly that URI
        3. If you don't have access to modify the developer settings, try clicking one of these direct login links:
      `,
      directLinks: possibleRedirectUris.map(uri => ({
        uri,
        loginUrl: `/api/husqvarna/try-redirect?uri=${encodeURIComponent(uri)}`
      }))
    });
    
  } catch (error) {
    console.error('Error finding redirect URI:', error);
    return NextResponse.json({ 
      error: 'Error finding redirect URI', 
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 