import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth-utils';
import { getZoneData } from '@/lib/firestoreDB';

// POST handler to regenerate a mower's schedule
export async function POST(
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
    
    // Parse the request body
    const requestData = await request.json();
    const respectRestrictions = requestData.respectRestrictions === true;
    
    // 1. Get the mower's zones
    const zoneResult = await getZoneData(mowerId);
    if (!zoneResult.success || !zoneResult.data?.zones) {
      return NextResponse.json(
        { error: 'Failed to get zone data for mower' },
        { status: 404 }
      );
    }
    
    const zones = zoneResult.data.zones;
    
    // 2. Generate a new schedule for the mower
    // This would typically call your schedule generation algorithm
    // For now, we'll mock a simple schedule generation
    const newSchedule = generateMockSchedule(zones, respectRestrictions);
    
    // 3. Save the schedule to storage
    // We'll assume this is done in the same way as the schedule PUT endpoint
    saveMowerScheduleToStorage(mowerId, newSchedule);
    
    return NextResponse.json({
      success: true,
      message: 'Schedule regenerated successfully',
      schedule: newSchedule
    });
  } catch (error) {
    console.error('Error regenerating mower schedule:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate mower schedule' },
      { status: 500 }
    );
  }
}

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

// The storage key for mower schedules (should match the one used in schedule endpoints)
const SCHEDULE_STORAGE_KEY = 'mower_schedules';

// Save schedule to local storage
function saveMowerScheduleToStorage(mowerId: string, schedule: any): boolean {
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

// Generate a mock schedule for testing purposes
// In a real implementation, this would be your actual schedule generation algorithm
function generateMockSchedule(zones: any[], respectRestrictions: boolean): any {
  // Create an empty schedule structure
  const schedule: any = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: []
  };
  
  // Mock optimal mowing days based on zone frequency
  const getOptimalDays = (frequency: number): string[] => {
    switch (frequency) {
      case 1: return ['Wednesday'];
      case 2: return ['Monday', 'Thursday'];
      case 3: return ['Monday', 'Wednesday', 'Friday'];
      case 4: return ['Monday', 'Tuesday', 'Thursday', 'Saturday'];
      case 5: return ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Sunday'];
      case 6: return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      case 7: return Object.keys(schedule);
      default: return ['Monday', 'Wednesday', 'Friday'];
    }
  };
  
  // Check if a time is restricted for a zone on a specific day
  const isTimeRestricted = (zone: any, day: string, hour: number): boolean => {
    if (!respectRestrictions || !zone.restrictions || zone.restrictions.length === 0) {
      return false;
    }
    
    // Get day index (0=Sunday, 1=Monday, etc.)
    const dayMapping: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    const dayIndex = dayMapping[day];
    
    // Check for day-hour restrictions like "1-14" (Monday at 2pm)
    const specificRestriction = `${dayIndex}-${hour}`;
    if (zone.restrictions.includes(specificRestriction)) {
      return true;
    }
    
    // Check for named period restrictions
    if (zone.restrictions.includes('morning') && hour >= 6 && hour < 12) {
      return true;
    }
    if (zone.restrictions.includes('afternoon') && hour >= 12 && hour < 18) {
      return true;
    }
    if (zone.restrictions.includes('evening') && hour >= 18) {
      return true;
    }
    
    return false;
  };
  
  // For each zone, add mowing slots on appropriate days
  let currentHour = 8; // Start at 8am
  
  for (const zone of zones) {
    // Get optimal mowing days based on frequency
    const frequency = zone.frequency || 3; // Default to 3 times per week
    const optimalDays = getOptimalDays(frequency);
    
    // Calculate mowing duration based on acreage
    // Assume 1 hour per 0.25 acres as a rule of thumb
    const acreage = zone.acreage || 0.1;
    const durationHours = Math.max(1, Math.ceil(acreage / 0.25));
    
    // For each optimal day, add a mowing slot
    for (const day of optimalDays) {
      // Find a suitable time slot that respects restrictions
      let startHour = currentHour;
      let found = false;
      
      // Search for a non-restricted time slot
      for (let attempt = 0; attempt < 24; attempt++) {
        let hourOk = true;
        
        // Check if any hour in the duration is restricted
        for (let h = 0; h < durationHours; h++) {
          const hourToCheck = (startHour + h) % 24;
          if (isTimeRestricted(zone, day, hourToCheck)) {
            hourOk = false;
            break;
          }
        }
        
        if (hourOk) {
          found = true;
          break;
        }
        
        // Try the next hour
        startHour = (startHour + 1) % 24;
      }
      
      if (found) {
        // Add the mowing slot
        const endHour = (startHour + durationHours) % 24;
        
        schedule[day].push({
          zoneId: zone.id,
          zoneName: zone.name,
          startTime: `${String(startHour).padStart(2, '0')}:00`,
          endTime: `${String(endHour).padStart(2, '0')}:00`,
          cycleNumber: 1
        });
        
        // Update the current hour for the next zone
        currentHour = (endHour + 1) % 24;
        if (currentHour < 8) currentHour = 8; // Reset to 8am if we went past midnight
      }
    }
  }
  
  // Sort slots by start time on each day
  for (const day in schedule) {
    schedule[day].sort((a: any, b: any) => {
      return a.startTime.localeCompare(b.startTime);
    });
  }
  
  return schedule;
} 