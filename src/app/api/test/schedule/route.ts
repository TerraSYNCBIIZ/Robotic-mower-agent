import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Test endpoint to return sample schedule data for debugging
 */
export async function GET(request: NextRequest) {
  try {
    // Sample schedule data in the format expected by the Husqvarna API
    const sampleScheduleData = {
      data: {
        type: "calendar",
        attributes: {
          calendar: {
            tasks: [
              {
                id: "task-1",
                start: 480, // 8:00 AM in minutes from midnight
                duration: 180, // 3 hours
                monday: true,
                tuesday: false,
                wednesday: true,
                thursday: false,
                friday: true,
                saturday: false,
                sunday: false,
                zones: [
                  {
                    id: "zone-1",
                    name: "Front Lawn",
                    color: "#3b82f6"
                  }
                ]
              },
              {
                id: "task-2",
                start: 840, // 2:00 PM in minutes from midnight
                duration: 120, // 2 hours
                monday: false,
                tuesday: true,
                wednesday: false,
                thursday: true,
                friday: false,
                saturday: true,
                sunday: false,
                zones: [
                  {
                    id: "zone-2",
                    name: "Back Yard",
                    color: "#f59e0b"
                  }
                ]
              },
              {
                id: "task-3",
                start: 1020, // 5:00 PM in minutes from midnight
                duration: 90, // 1.5 hours
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: false,
                sunday: true,
                zones: [
                  {
                    id: "zone-1",
                    name: "Front Lawn",
                    color: "#3b82f6"
                  },
                  {
                    id: "zone-2",
                    name: "Back Yard",
                    color: "#f59e0b"
                  }
                ]
              }
            ]
          }
        }
      }
    };

    return NextResponse.json(sampleScheduleData);
  } catch (error) {
    console.error('Error in test schedule endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to generate test schedule data' },
      { status: 500 }
    );
  }
} 