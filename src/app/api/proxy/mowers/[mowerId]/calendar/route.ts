import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { HUSQVARNA_API } from '@/lib/husqvarna/config';

/**
 * PUT handler to update a mower's schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    const mowerId = params.mowerId;
    
    if (!mowerId) {
      return NextResponse.json(
        { error: 'Missing mower ID' },
        { status: 400 }
      );
    }
    
    // Get the request body
    const data = await request.json();
    
    if (!data || !data.data || !data.data.attributes || !data.data.attributes.tasks) {
      return NextResponse.json(
        { error: 'Invalid schedule data format' },
        { status: 400 }
      );
    }
    
    // Get auth token from cookies or request
    const cookieStore = cookies();
    let token = cookieStore.get('mowerAccessToken')?.value;
    
    // If no token in cookies, check Authorization header
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // Ensure we have a token
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Forward the request to the Husqvarna API
    const response = await axios({
      method: 'PUT',
      url: `https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/calendar`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': HUSQVARNA_API.APP_KEY,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      },
      data
    });
    
    // Return the API response
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error updating mower schedule:', error);
    
    // Extract more detailed error information if available
    let status = 500;
    let message = 'Failed to update mower schedule';
    
    if (axios.isAxiosError(error) && error.response) {
      status = error.response.status;
      message = `API Error: ${error.response.statusText}`;
      console.error('API error details:', error.response.data);
    }
    
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

/**
 * GET handler to retrieve a mower's schedule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    const mowerId = params.mowerId;
    
    if (!mowerId) {
      return NextResponse.json(
        { error: 'Missing mower ID' },
        { status: 400 }
      );
    }
    
    // Get auth token from cookies or request
    const cookieStore = cookies();
    let token = cookieStore.get('mowerAccessToken')?.value;
    
    // If no token in cookies, check Authorization header
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // Ensure we have a token
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Forward the request to the Husqvarna API
    const response = await axios({
      method: 'GET',
      url: `https://api.amc.husqvarna.dev/v1/mowers/${mowerId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': HUSQVARNA_API.APP_KEY,
        'Accept': 'application/vnd.api+json'
      }
    });
    
    // Extract and return just the calendar data
    const mowerData = response.data.data;
    const calendarData = {
      data: {
        id: mowerId,
        type: 'calendar',
        attributes: {
          calendar: mowerData.attributes?.calendar || { tasks: [] }
        }
      }
    };
    
    return NextResponse.json(calendarData);
  } catch (error) {
    console.error('Error getting mower schedule:', error);
    
    // Extract more detailed error information if available
    let status = 500;
    let message = 'Failed to get mower schedule';
    
    if (axios.isAxiosError(error) && error.response) {
      status = error.response.status;
      message = `API Error: ${error.response.statusText}`;
      console.error('API error details:', error.response.data);
    }
    
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
} 