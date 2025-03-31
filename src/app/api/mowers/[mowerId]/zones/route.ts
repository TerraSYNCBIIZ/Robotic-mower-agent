import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-utils';
import { getZoneData, saveZoneData } from '@/lib/firestoreDB';

// GET handler to retrieve mower zones
export async function GET(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    // Get the auth token from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate the auth token
    const token = authHeader.split(' ')[1];
    const isValid = await validateToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const mowerId = params.mowerId;
    
    // Get zones from Firestore
    const result = await getZoneData(mowerId);
    
    if (result.success && result.data?.zones) {
      return NextResponse.json(result.data.zones);
    }
    
    // Return empty array if no zones found
    return NextResponse.json([]);
  } catch (error) {
    console.error('Error getting mower zones:', error);
    return NextResponse.json(
      { error: 'Failed to get mower zones' },
      { status: 500 }
    );
  }
}

// PUT handler to update mower zones
export async function PUT(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    // Get the auth token from the request header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate the auth token
    const token = authHeader.split(' ')[1];
    const isValid = await validateToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const mowerId = params.mowerId;
    
    // Get the zones data from the request body
    const requestData = await request.json();
    
    if (!requestData.zones || !Array.isArray(requestData.zones)) {
      return NextResponse.json(
        { error: 'Invalid zones data: zones array is required' },
        { status: 400 }
      );
    }
    
    // Save zones to Firestore
    const result = await saveZoneData(mowerId, requestData.zones);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save zones' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Zones updated successfully',
      zones: requestData.zones
    });
  } catch (error) {
    console.error('Error updating mower zones:', error);
    return NextResponse.json(
      { error: 'Failed to update mower zones' },
      { status: 500 }
    );
  }
} 