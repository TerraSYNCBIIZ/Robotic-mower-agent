import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HusqvarnaClient } from "@/lib/husqvarna/api";
import { saveMowerData, MowerData, getAllMowers } from "@/lib/firestoreDB";
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    let mowers: any[] = [];
    
    // Try to get mowers from Firestore first
    try {
      const querySnapshot = await getDocs(collection(db, 'mowers'));
      querySnapshot.forEach((doc) => {
        mowers.push({ id: doc.id, ...doc.data() });
      });
      
      if (mowers.length > 0) {
        return NextResponse.json(mowers);
      }
    } catch (error) {
      // Continue to fallback if Firestore fails
    }
    
    // Fallback to Husqvarna API if no mowers in Firestore
    // Get auth token from the request Authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }
    
    // Create Husqvarna client with the token
    const client = new HusqvarnaClient(token);
    
    try {
      // Get mowers from Husqvarna API
      const apiMowers = await client.getMowers();
      
      if (apiMowers && apiMowers.length > 0) {
        // For each mower, also fetch their work areas
        for (const mower of apiMowers) {
          try {
            // Fetch work areas for this mower
            const workAreas = await client.getMowerWorkAreas(mower.id);
            if (workAreas && workAreas.length > 0) {
              // Add the work areas data to the mower
              mower.workAreas = workAreas;
            }
          } catch (workAreaError) {
            console.error(`Error fetching work areas for mower ${mower.id}:`, workAreaError);
          }
        }
        
        // Debug log to see the structure of the API response
        console.log("Husqvarna API Response:", JSON.stringify({
          hasData: !!apiMowers,
          responseType: typeof apiMowers
        }));
        
        if (apiMowers[0]?.attributes?.calendar) {
          console.log("Sample mower calendar data:", 
            JSON.stringify(apiMowers[0].attributes.calendar, null, 2)
          );
        } else {
          console.log("No calendar data found in first mower");
        }
        
        return NextResponse.json(apiMowers);
      }
      
      // Return empty array if no mowers found
      return NextResponse.json([]);
    } catch (error: any) {
      // Check if token expired (401)
      if (error.message && error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Token expired or invalid', requiresRefresh: true },
          { status: 401 }
        );
      }
      
      // Return server error for other issues
      return NextResponse.json(
        { error: 'Failed to fetch mowers from Husqvarna API' },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// This endpoint is deprecated - tokens are now stored client-side
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Tokens are now managed client-side." },
    { status: 400 }
  );
} 