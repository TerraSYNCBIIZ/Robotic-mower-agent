import { NextRequest, NextResponse } from 'next/server';
import HusqvarnaClient from '@/lib/husqvarna-client';
import { validateToken } from '@/lib/auth-utils';

interface TaskProps {
  start: {
    hour: number;
    minute: number;
  };
  duration: {
    hour: number;
    minute: number;
  };
  sunday?: boolean;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  zoneId?: string;
}

interface ScheduleRequest {
  tasks: TaskProps[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const isValid = await validateToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = new HusqvarnaClient(token);
    const calendar = await client.getMowerCalendar(params.mowerId);

    return NextResponse.json(calendar);
  } catch (error) {
    console.error('Error fetching mower calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mower calendar' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const isValid = await validateToken(token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const client = new HusqvarnaClient(token);
    const mowerId = params.mowerId;
    
    // Get the schedule data from the request body
    const scheduleData: ScheduleRequest = await request.json();
    
    // Validate the schedule data
    if (!scheduleData.tasks || !Array.isArray(scheduleData.tasks)) {
      return NextResponse.json(
        { error: 'Invalid schedule data: tasks array is required' },
        { status: 400 }
      );
    }

    // Update the mower calendar
    const updatedCalendar = await client.updateMowerCalendar(mowerId, scheduleData);

    return NextResponse.json(updatedCalendar);
  } catch (error) {
    console.error('Error updating mower calendar:', error);
    return NextResponse.json(
      { error: 'Failed to update mower calendar' },
      { status: 500 }
    );
  }
} 