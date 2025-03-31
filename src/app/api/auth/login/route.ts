import { NextRequest, NextResponse } from "next/server";
import { HusqvarnaClient } from "@/lib/husqvarna/api";

export async function GET(req: NextRequest) {
  try {
    // Get the redirect parameter
    const searchParams = req.nextUrl.searchParams;
    const redirect = searchParams.get('redirect') || '/dashboard';
    
    // Create Husqvarna client
    const client = new HusqvarnaClient();
    
    // Set the redirect URI to our callback endpoint with port and full path
    // This should be registered in the Husqvarna developer console
    const redirectUri = "http://localhost:3000/api/auth/husqvarna/callback";
    
    // Generate authorization URL
    const authUrl = client.getAuthorizationUrl(redirectUri);
    
    // Store the redirect path in the session or cookies so we can use it after callback
    // For this example, we'll append it to the state parameter
    const stateWithRedirect = encodeURIComponent(redirect);
    const finalAuthUrl = `${authUrl}&state=${stateWithRedirect}`;
    
    console.log(`Redirecting to Husqvarna auth: ${finalAuthUrl}`);
    
    // Redirect the user to the Husqvarna authorization page
    return NextResponse.redirect(finalAuthUrl);
    
  } catch (error) {
    console.error("Error initiating Husqvarna auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Husqvarna authentication" },
      { status: 500 }
    );
  }
} 