import { NextRequest, NextResponse } from "next/server";
import { HusqvarnaClient } from "@/lib/husqvarna/api";

export async function GET(req: NextRequest) {
  try {
    // Get the authorization code from query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    // Validate parameters
    if (!code) {
      console.error("Auth callback missing code parameter");
      return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
    }
    
    // Get the redirect destination from state parameter
    const redirectDestination = state ? decodeURIComponent(state) : '/dashboard';
    
    // Create Husqvarna client
    const client = new HusqvarnaClient();
    
    // Set the redirect URI (must exactly match what was used in the auth request)
    // Make sure this is exactly the same as used in the initial authorization URL
    const redirectUri = "http://localhost:3000/api/auth/husqvarna/callback";
    
    console.log("Exchanging code for tokens with redirectUri:", redirectUri);
    console.log("Code parameter (first 10 chars):", code.substring(0, 10) + "...");
    
    // Exchange the code for tokens
    const authData = await client.getTokensFromCode(code, redirectUri);
    
    if (!authData || !authData.access_token) {
      console.error("Failed to exchange code for token:", authData);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url));
    }
    
    // Build the redirect URL with tokens as query parameters
    // These will be processed by the client-side code to store in localStorage and cookies
    const successRedirect = new URL('/auth-callback', req.url);
    successRedirect.searchParams.set('access_token', authData.access_token);
    
    if (authData.refresh_token) {
      successRedirect.searchParams.set('refresh_token', authData.refresh_token);
    }
    
    successRedirect.searchParams.set('redirect_to', redirectDestination);
    
    console.log("Authentication successful, redirecting to:", successRedirect.pathname);
    
    return NextResponse.redirect(successRedirect);
    
  } catch (error) {
    console.error("Error in auth callback:", error);
    return NextResponse.redirect(new URL('/login?error=server_error', req.url));
  }
} 