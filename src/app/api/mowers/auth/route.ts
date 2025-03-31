import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HusqvarnaClient } from "@/lib/husqvarna/api";

// API route for handling Husqvarna authentication and token storage
export async function POST(req: NextRequest) {
  try {
    console.log("Received auth callback request");
    const { code, redirectUri } = await req.json();
    
    console.log("Auth callback received with code and redirectUri:", 
      { codeLength: code?.length, redirectUri });
    
    // Validate request
    if (!code || !redirectUri) {
      return NextResponse.json(
        { error: "Authorization code and redirect URI are required" },
        { status: 400 }
      );
    }
    
    // Exchange code for tokens
    console.log("Creating Husqvarna client");
    const client = new HusqvarnaClient();
    
    console.log("Exchanging code for tokens");
    try {
      const authData = await client.getTokensFromCode(code, redirectUri);
      console.log("Token exchange successful:", 
        { tokenReceived: !!authData.access_token, expiresIn: authData.expires_in });
      
      // Fetch mowers after successful authentication
      console.log("Fetching mowers");
      try {
        const mowers = await client.getMowers();
        console.log("Mowers fetched successfully:", { count: mowers.length });
        
        // Return success with mower data and tokens for client-side storage
        return NextResponse.json({
          success: true,
          message: "Authentication successful",
          mowers,
          authData, // Include auth data for client to store
        });
      } catch (mowerError) {
        console.error("Error fetching mowers:", mowerError);
        return NextResponse.json(
          { error: "Authentication successful but failed to fetch mowers", details: (mowerError as Error).message },
          { status: 500 }
        );
      }
    } catch (tokenError) {
      console.error("Error exchanging code for tokens:", tokenError);
      return NextResponse.json(
        { error: "Failed to exchange authorization code for tokens", details: (tokenError as Error).message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Husqvarna auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Route to fetch mowers using stored tokens
export async function GET(req: NextRequest) {
  try {
    // In a real app, retrieve tokens from secure storage
    // For demo purposes, we'll expect tokens in authorization header
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }
    
    const accessToken = authHeader.split(" ")[1];
    
    // Use token to create client and get mowers
    const client = new HusqvarnaClient(accessToken);
    const mowers = await client.getMowers();
    
    return NextResponse.json({
      success: true,
      mowers,
    });
  } catch (error) {
    console.error("Error fetching mowers:", error);
    return NextResponse.json(
      { error: "Failed to fetch mowers", details: (error as Error).message },
      { status: 500 }
    );
  }
} 