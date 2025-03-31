import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HusqvarnaClient } from "@/lib/husqvarna/api";

export async function POST(
  req: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    console.log("API called with mowerId:", params.mowerId);
    
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    console.log("Authorization header:", authHeader ? "Present" : "Missing");
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "Authentication required", authRequired: true },
        { status: 401 }
      );
    }
    
    // Extract token
    const accessToken = authHeader.split(' ')[1];
    console.log("Token extracted:", accessToken ? "Present" : "Missing");
    
    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication required", authRequired: true },
        { status: 401 }
      );
    }
    
    // Get mower ID from route parameters
    const { mowerId } = params;
    console.log("Mower ID from params:", mowerId);
    
    if (!mowerId) {
      return NextResponse.json(
        { error: "Mower ID is required" },
        { status: 400 }
      );
    }
    
    // Get params from request
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    const { command, duration } = requestBody;
    
    if (!command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }
    
    // Create client with the token
    const client = new HusqvarnaClient(accessToken);
    console.log("Client created, authenticated:", client.isAuthenticated());
    
    // Ensure client is authenticated
    if (!client.isAuthenticated()) {
      // Handle authentication error
      return NextResponse.json(
        { error: "Not authenticated", authRequired: true },
        { status: 401 }
      );
    }
    
    // Map command to Husqvarna API command
    let apiCommand: string;
    let attributes: Record<string, unknown> = {};
    
    switch (command) {
      case 'play':
      case 'start':
        apiCommand = 'Start';
        if (duration) {
          attributes = { duration };
        }
        break;
      case 'pause':
        apiCommand = 'Pause';
        break;
      case 'home':
      case 'park':
        if (duration) {
          apiCommand = 'Park';
          attributes = { duration };
        } else {
          apiCommand = 'ParkUntilFurtherNotice';
        }
        break;
      case 'parkUntilNext':
        apiCommand = 'ParkUntilNextSchedule';
        break;
      case 'resumeSchedule':
        apiCommand = 'ResumeSchedule';
        break;
      default:
        return NextResponse.json(
          { error: "Invalid command", valid: ['play', 'start', 'pause', 'home', 'park', 'parkUntilNext', 'resumeSchedule'] },
          { status: 400 }
        );
    }
    
    // Send command to mower
    try {
      await client.sendCommand(mowerId, apiCommand, Object.keys(attributes).length > 0 ? attributes : undefined);
      
      return NextResponse.json({
        success: true,
        message: `Command '${command}' sent successfully to mower '${mowerId}'`
      });
    } catch (apiError) {
      console.error("Husqvarna API error:", apiError);
      return NextResponse.json(
        { 
          error: "Failed to send command to Husqvarna API", 
          details: apiError instanceof Error ? apiError.message : "Unknown error" 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error controlling mower:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    
    return NextResponse.json(
      { error: "Failed to control mower", details: errorMessage },
      { status: 500 }
    );
  }
}

// Add a GET method to test if the route is working
export async function GET(
  req: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  return NextResponse.json({
    success: true,
    message: "Actions endpoint is working",
    mowerId: params.mowerId
  });
} 