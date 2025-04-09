import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Check for user access token in cookies
    const userAccessToken = req.cookies.get('userAccessToken')?.value;
    
    // Get all cookies for debugging
    const allCookies = req.cookies.getAll();
    const cookieNames = allCookies.map(c => c.name);
    
    // Get info about the userAccessToken cookie if it exists
    const tokenCookieDetails = req.cookies.get('userAccessToken') 
      ? {
          name: req.cookies.get('userAccessToken')?.name,
          value: req.cookies.get('userAccessToken')?.value?.substring(0, 20) + '...',
          valueLength: req.cookies.get('userAccessToken')?.value?.length,
        }
      : null;
    
    // Return authentication status with detailed debug info
    return NextResponse.json({
      isAuthenticated: !!userAccessToken,
      tokenPresent: !!userAccessToken,
      tokenLength: userAccessToken?.length || 0,
      hasRefreshToken: !!req.cookies.get('userRefreshToken')?.value,
      timestamp: new Date().toISOString(),
      debug: {
        allCookieNames: cookieNames,
        numCookies: allCookies.length,
        headers: Object.fromEntries(req.headers),
        tokenCookieDetails,
        mowerAccessTokenPresent: !!req.cookies.get('mowerAccessToken')?.value,
      }
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check authentication status', 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
} 