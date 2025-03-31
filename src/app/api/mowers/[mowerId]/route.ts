import { NextRequest, NextResponse } from "next/server";
import { HusqvarnaClient } from "@/lib/husqvarna/api";
import { validateToken } from "@/lib/auth-utils";
import { getMowerData, saveMowerData, MowerData } from "@/lib/firestoreDB";

export async function GET(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    // Get the auth token from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required", authRequired: true },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Validate the token
    const isValid = await validateToken(token);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid authentication token", authRequired: true },
        { status: 401 }
      );
    }

    const mowerId = params.mowerId;
    
    // Try to get mower data from Firestore first
    const cachedResult = await getMowerData(mowerId);
    
    if (cachedResult.success && cachedResult.data) {
      console.log(`Found cached data for mower ${mowerId} in Firestore`);
      return NextResponse.json({
        success: true,
        mower: cachedResult.data,
        fromCache: true
      });
    }
    
    console.log(`No cached data found for mower ${mowerId}, fetching from API`);
    
    // Create Husqvarna client with the token
    const client = new HusqvarnaClient(token);
    
    // Fetch mower data from the API
    const mowerData = await client.getMower(mowerId);
    
    // Extract relevant info from mower data
    const attributes = mowerData.attributes;
    const systemInfo = attributes.system || {};
    const batteryInfo = attributes.battery || {};
    const mowerInfo = attributes.mower || {};
    const positions = attributes.positions || [];
    
    // Get the last position (most recent)
    const lastPosition = positions.length > 0 ? positions[0] : null;
    
    // Map activity to a more user-friendly status
    let status: MowerData['status'] = 'offline';
    
    if (attributes.metadata?.connected) {
      switch (mowerInfo.activity) {
        case 'MOWING':
          status = 'mowing';
          break;
        case 'CHARGING':
          status = 'charging';
          break;
        case 'PARKED_IN_CS':
          status = 'parked';
          break;
        case 'GOING_HOME':
          status = 'returning';
          break;
        case 'LEAVING':
        case 'STOPPED_IN_GARDEN':
          status = 'idle';
          break;
        default:
          status = mowerInfo.errorCode > 0 ? 'error' : 'idle';
      }
    }
    
    // Get zones if available
    let zones = [];
    try {
      zones = await client.getZonesForMower(mowerId);
    } catch (error) {
      console.error(`Error fetching zones for mower ${mowerId}:`, error);
    }
    
    // Format data for our frontend
    const formattedMower: MowerData = {
      id: mowerId,
      name: systemInfo.name || 'Unknown Mower',
      model: systemInfo.model || 'Unknown Model',
      status,
      batteryLevel: batteryInfo.batteryPercent || 0,
      errorCode: mowerInfo.errorCode,
      errorTimestamp: mowerInfo.errorCodeTimestamp,
      lastSeen: attributes.metadata?.statusTimestamp,
      connected: attributes.metadata?.connected || false,
      coordinates: lastPosition ? {
        latitude: lastPosition.latitude,
        longitude: lastPosition.longitude
      } : undefined,
      zones,
      lastUpdated: new Date()
    };
    
    // Save to Firestore for future use
    try {
      await saveMowerData(formattedMower);
      console.log(`Saved mower data to Firestore for ${formattedMower.name} (${mowerId})`);
    } catch (error) {
      console.error(`Error saving mower data to Firestore for ${mowerId}:`, error);
    }
    
    return NextResponse.json({
      success: true,
      mower: formattedMower
    });
  } catch (error) {
    console.error("Error in GET mower:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    
    return NextResponse.json(
      { error: "Failed to fetch mower data", details: errorMessage },
      { status: 500 }
    );
  }
} 