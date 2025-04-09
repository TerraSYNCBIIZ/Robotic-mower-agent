import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/schedule',
  '/zones',
  '/settings',
  '/chat',
  '/mower-scheduler',
  '/mowers',
  '/api-sandbox',
];

// Special routes to exclude from general protection
const excludedRoutes = [
  '/login', // Allow access to login page
  '/auth-callback', // Exclude auth callback page that processes authentication tokens
  '/api/auth/callback', // Exclude API callback endpoint
];

export function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const { pathname } = request.nextUrl;
  
  // Skip middleware for excluded routes
  if (excludedRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }
  
  // Check if the path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  ) || pathname.startsWith('/mowers/') && !pathname.startsWith('/mowers/add');
  
  // Get token from cookies or authorization header - use userAccessToken instead of mowerAccessToken
  const token = request.cookies.get('userAccessToken')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  // If it's a protected route and there's no token, redirect to login
  if (isProtectedRoute && !token) {
    const url = new URL('/login', request.url);
    // Add the requested URL as a 'from' parameter to redirect back after login
    url.searchParams.set('from', pathname);
    
    return NextResponse.redirect(url);
  }
  
  // If we're on the login page but already have a token, redirect to dashboard
  if ((pathname === '/login' || pathname === '/') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  // Only run middleware on the specified routes
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 