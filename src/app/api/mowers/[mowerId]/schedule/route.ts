import { NextRequest, NextResponse } from 'next/server';
import HusqvarnaClient from '@/lib/husqvarna-client';
import { validateToken } from '@/lib/auth-utils';
import { DailySchedule } from '@/components/scheduler/MowerScheduler';
import { getZoneData } from '@/lib/firestoreDB';

const SCHEDULE_STORAGE_KEY = 'mower_schedules';

// Helper to safely access localStorage (avoiding SSR issues)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  }
};

// Get schedule from local storage
function getMowerScheduleFromStorage(mowerId: string): DailySchedule | null {
  try {
    const storageData = safeLocalStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (storageData) {
      const schedules = JSON.parse(storageData);
      return schedules[mowerId] || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting schedule from storage:', error);
    return null;
  }
}

// Save schedule to local storage
function saveMowerScheduleToStorage(mowerId: string, schedule: DailySchedule): boolean {
  try {
    const storageData = safeLocalStorage.getItem(SCHEDULE_STORAGE_KEY) || '{}';
    const schedules = JSON.parse(storageData);
    schedules[mowerId] = schedule;
    return safeLocalStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
  } catch (error) {
    console.error('Error saving schedule to storage:', error);
    return false;
  }
}

// GET handler to retrieve mower schedule
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
    
    // Get schedule from storage
    // In a real implementation, this would likely come from a database
    const schedule = getMowerScheduleFromStorage(mowerId);
    
    if (schedule) {
      return NextResponse.json(schedule);
    }
    
    // If no schedule is found, return empty schedule structure
    return NextResponse.json({
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    });
  } catch (error) {
    console.error('Error getting mower schedule:', error);
    return NextResponse.json(
      { error: 'Failed to get mower schedule' },
      { status: 500 }
    );
  }
}

// PUT handler to update mower schedule
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
    
    // Get the schedule data from the request body
    const requestData = await request.json();
    if (!requestData.schedule) {
      return NextResponse.json(
        { error: 'No schedule provided in request' },
        { status: 400 }
      );
    }
    
    // Save the schedule to storage
    const saveSuccess = saveMowerScheduleToStorage(mowerId, requestData.schedule);
    
    if (!saveSuccess) {
      return NextResponse.json(
        { error: 'Failed to save schedule' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schedule updated successfully',
      schedule: requestData.schedule
    });
  } catch (error) {
    console.error('Error updating mower schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update mower schedule' },
      { status: 500 }
    );
  }
} 