import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('mowerAccessToken')?.value;
    
    // Return debug information
    return NextResponse.json({
      token: token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : null,
      hasToken: !!token,
      cookiesFound: cookieStore.getAll().map(c => c.name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Auth debug error:', error);
    return NextResponse.json(
      { error: 'Failed to debug auth state' },
      { status: 500 }
    );
  }
} 