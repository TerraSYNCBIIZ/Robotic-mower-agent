'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Zone, TimeRestriction, Mower, DailySchedule } from './MowerScheduler';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, ShieldAlert, KeyboardKey } from 'lucide-react';
import { toast } from 'sonner';
import { Kbd } from '@/components/ui/kbd';

// Dynamically import the schedule calendar to avoid SSR issues with date functions
const MowerScheduleCalendar = dynamic(
  () => import('./AdvancedScheduleCalendar').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

// Map our schedule data format to the calendar component format
interface CalendarEvent {
  id: string;
  zoneId: string;
  startTime: string;
  endTime: string;
  day: number; // 0 = Sunday, 1 = Monday, etc.
  description?: string;
}

interface CalendarZone {
  id: string;
  name: string;
  color: string;
}

interface AdvancedScheduleViewProps {
  schedule: Record<string, Array<{
    zoneId: string;
    zoneName: string;
    startTime: string;
    endTime: string;
    cycleNumber: number;
  }>>;
  zones: Zone[];
  selectedMower: Record<string, any>;
  onSubmit: (schedule: DailySchedule) => Promise<void>;
  onEdit: () => void;
}

// Day name to index mapping
const dayToIndex: Record<string, number> = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

// Generate a distinct color for each zone
function generateZoneColor(index: number): string {
  const colors = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#E91E63', // Pink
    '#00BCD4', // Cyan
    '#3F51B5', // Indigo
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#FFEB3B', // Yellow
  ];
  return colors[index % colors.length];
}

export default function AdvancedScheduleView({ 
  schedule, 
  zones, 
  selectedMower,
  onSubmit,
  onEdit
}: AdvancedScheduleViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarZones, setCalendarZones] = useState<CalendarZone[]>([]);
  const [zoneRestrictions, setZoneRestrictions] = useState<Array<{
    zoneId: string;
    days: string[];
  }>>([]);
  const [localSchedule, setLocalSchedule] = useState<DailySchedule>(schedule);

  // Update local schedule when the prop changes
  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  // Function to handle schedule submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Use our modified local schedule when submitting
      await onSubmit(localSchedule);
      toast.success('Schedule successfully submitted!');
    } catch (error) {
      toast.error('Failed to submit schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add keyboard shortcut support
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Ctrl+S or Command+S (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault(); // Prevent browser save dialog
      handleSubmit();
    }
  }, []);

  // Add event listener for keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Debug the schedule data coming in
  useEffect(() => {
    console.log("AdvancedScheduleView: Schedule received:", schedule);
    
    // Log the number of slots per day to verify data structure
    Object.entries(schedule).forEach(([day, slots]) => {
      console.log(`${day}: ${slots.length} slots`);
      if (slots.length > 0) {
        console.log(`Sample slot for ${day}:`, slots[0]);
      }
    });
    
    // Validate time formats in the schedule
    validateScheduleTimes(schedule);
  }, [schedule]);
  
  // Utility function to validate time formats
  const validateScheduleTimes = (scheduleData: Record<string, Array<{
    startTime: string;
    endTime: string;
    zoneId: string;
    zoneName: string;
  }>>) => {
    let hasInvalidTimes = false;
    
    // Check all slots in the schedule for valid time formats
    for (const [day, slots] of Object.entries(scheduleData)) {
      for (const slot of slots) {
        const startTimeValid = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(slot.startTime);
        const endTimeValid = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(slot.endTime);
        
        if (!startTimeValid || !endTimeValid) {
          console.error(`Invalid time format found in ${day} schedule:`, 
            slot.zoneName, 
            `Start: "${slot.startTime}" (${startTimeValid ? 'valid' : 'INVALID'})`, 
            `End: "${slot.endTime}" (${endTimeValid ? 'valid' : 'INVALID'})`
          );
          hasInvalidTimes = true;
        }
      }
    }
    
    if (hasInvalidTimes) {
      console.warn("⚠️ Schedule contains invalid time formats. The calendar may not display correctly.");
    } else {
      console.log("✓ All schedule times are in valid format.");
    }
  };

  // Convert our schedule data to calendar component format
  useEffect(() => {
    // Convert zones
    const newCalendarZones = zones.map((zone, index) => ({
      id: zone.id,
      name: zone.name,
      color: generateZoneColor(index)
    }));
    setCalendarZones(newCalendarZones);

    // Convert schedule to events
    const newEvents: CalendarEvent[] = [];
    
    for (const [day, daySchedule] of Object.entries(schedule)) {
      for (const slot of daySchedule) {
        // Ensure time strings are properly formatted (HH:MM)
        const startTime = normalizeTimeFormat(slot.startTime);
        const endTime = normalizeTimeFormat(slot.endTime);
        
        newEvents.push({
          id: `${slot.zoneId}-${day}-${startTime}`,
          zoneId: slot.zoneId,
          startTime,
          endTime,
          day: dayToIndex[day],
          description: `Mowing cycle ${slot.cycleNumber}`
        });
      }
    }
    
    setCalendarEvents(newEvents);
    
    // Debug the converted events
    console.log("Calendar events created:", newEvents.length);
    if (newEvents.length > 0) {
      console.log("Sample event:", newEvents[0]);
    }
  }, [schedule, zones]);

  // Process zone restrictions for calendar display
  useEffect(() => {
    const restrictions = zones.map(zone => {
      // Only process zones that have restrictions
      if (!zone.restrictions || zone.restrictions.length === 0) {
        return { zoneId: zone.id, days: [] };
      }
      
      // Process each restriction format into day-hour format
      const restrictedDays: string[] = [];
      
      zone.restrictions.forEach(restriction => {
        // Handle day-hour format directly (e.g., "1-14" for Monday 2pm)
        if (restriction.includes('-')) {
          restrictedDays.push(restriction);
          return;
        }
        
        // Handle named period restrictions (morning, afternoon, evening)
        // Expand these into specific hours
        if (restriction === "morning") {
          // Morning = 6am-12pm
          for (let day = 0; day < 7; day++) {
            for (let hour = 6; hour < 12; hour++) {
              restrictedDays.push(`${day}-${hour}`);
            }
          }
        } else if (restriction === "afternoon") {
          // Afternoon = 12pm-6pm
          for (let day = 0; day < 7; day++) {
            for (let hour = 12; hour < 18; hour++) {
              restrictedDays.push(`${day}-${hour}`);
            }
          }
        } else if (restriction === "evening") {
          // Evening = 6pm-10pm
          for (let day = 0; day < 7; day++) {
            for (let hour = 18; hour < 22; hour++) {
              restrictedDays.push(`${day}-${hour}`);
            }
          }
        }
      });
      
      return {
        zoneId: zone.id,
        days: restrictedDays
      };
    });
    
    setZoneRestrictions(restrictions);
    console.log("Processed zone restrictions:", restrictions);
  }, [zones]);

  const handleEventClick = (event: CalendarEvent) => {
    // When a calendar event is clicked, we could show more details or edit options
    console.log('Event clicked:', event);
    // Optional: Could implement editing functionality
  };

  // Add utility function to convert time to grid position
  const timeToGridPosition = (timeString: string): number => {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      // Calculate position in 24-hour format (0-23)
      return (hours + minutes / 60) * 60; // Convert to minutes for precision
    } catch (error) {
      console.error(`Error parsing time ${timeString}:`, error);
      return 0; // Default to midnight
    }
  };
  
  // Add utility to ensure slot times are correctly formatted
  const normalizeTimeFormat = (timeStr: string): string => {
    if (!timeStr) return "00:00";
    
    // Ensure HH:MM format (add leading zeros if needed)
    const [hours, minutes] = timeStr.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Handle event movement in the calendar
  const handleEventMove = (eventId: string, newDay: number, newStartTime: string, newEndTime: string) => {
    console.log(`Moving event: ${eventId} to day ${newDay} at ${newStartTime}-${newEndTime}`);
    
    // Find the moved event in our calendar events array
    const movedEvent = calendarEvents.find(e => e.id === eventId);
    if (!movedEvent) {
      console.error(`Could not find calendar event with ID: ${eventId}`);
      return;
    }
    
    // Log event details for debugging
    console.log('Moving event:', {
      id: movedEvent.id,
      zoneId: movedEvent.zoneId,
      originalDay: movedEvent.day,
      newDay,
      originalTime: `${movedEvent.startTime}-${movedEvent.endTime}`,
      newTime: `${newStartTime}-${newEndTime}`
    });
    
    // Convert day index to day name
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const oldDayName = dayNames[movedEvent.day];
    const newDayName = dayNames[newDay];
    
    // Create a deep copy of the current schedule
    const updatedSchedule = JSON.parse(JSON.stringify(localSchedule));
    
    // Debug the schedule before changes
    console.log(`Original schedule for ${oldDayName}:`, updatedSchedule[oldDayName]);
    
    // Find the event in the original day's schedule
    if (!updatedSchedule[oldDayName]) {
      console.error(`Day ${oldDayName} not found in schedule`);
      return;
    }
    
    // Find all matching events for the zone and log them
    const zoneEvents = updatedSchedule[oldDayName].filter(slot => slot.zoneId === movedEvent.zoneId);
    console.log(`Found ${zoneEvents.length} events for zone ${movedEvent.zoneId} on ${oldDayName}:`, zoneEvents);
    
    // Use both zoneId and the closest matching times to find the right event
    let bestMatch = -1;
    let smallestTimeDiff = Infinity;
    
    updatedSchedule[oldDayName].forEach((slot, idx) => {
      if (slot.zoneId === movedEvent.zoneId) {
        // Calculate how close this slot's times are to our calendar event
        const startDiff = Math.abs(timeToGridPosition(slot.startTime) - timeToGridPosition(movedEvent.startTime));
        const endDiff = Math.abs(timeToGridPosition(slot.endTime) - timeToGridPosition(movedEvent.endTime));
        const totalDiff = startDiff + endDiff;
        
        if (totalDiff < smallestTimeDiff) {
          smallestTimeDiff = totalDiff;
          bestMatch = idx;
        }
      }
    });
    
    if (bestMatch === -1) {
      console.error(`Could not find matching event in ${oldDayName} schedule`);
      return;
    }
    
    // Log the matched event
    const matchedEvent = updatedSchedule[oldDayName][bestMatch];
    console.log('Best matching event found:', matchedEvent);
    
    // Extract the event details we need
    const { zoneId, zoneName, cycleNumber } = matchedEvent;
    
    // Remove from original day
    updatedSchedule[oldDayName].splice(bestMatch, 1);
    
    // Add to new day
    if (!updatedSchedule[newDayName]) {
      updatedSchedule[newDayName] = [];
    }
    
    // Add the moved event with new times to the destination day
    updatedSchedule[newDayName].push({
      zoneId,
      zoneName,
      startTime: newStartTime,
      endTime: newEndTime,
      cycleNumber
    });
    
    // Sort the destination day's schedule by start time
    updatedSchedule[newDayName].sort((a, b) => {
      return timeToGridPosition(a.startTime) - timeToGridPosition(b.startTime);
    });
    
    // Log the updated schedule
    console.log(`Updated schedule for ${newDayName}:`, updatedSchedule[newDayName]);
    
    // Update the state with new schedule
    setLocalSchedule(updatedSchedule);
    
    // Regenerate all calendar events to ensure UI reflects data
    const newEvents: CalendarEvent[] = [];
    
    for (const [day, daySchedule] of Object.entries(updatedSchedule)) {
      for (const slot of daySchedule) {
        const startTime = normalizeTimeFormat(slot.startTime);
        const endTime = normalizeTimeFormat(slot.endTime);
        
        newEvents.push({
          id: `${slot.zoneId}-${day}-${startTime}`,
          zoneId: slot.zoneId,
          startTime,
          endTime,
          day: dayToIndex[day],
          description: `Mowing cycle ${slot.cycleNumber}`
        });
      }
    }
    
    // Log new events
    console.log(`Generated ${newEvents.length} new calendar events`);
    
    // Set the calendar events
    setCalendarEvents(newEvents);
    
    // Show a success toast
    toast.success(`Moved ${zoneName} to ${newDayName} at ${newStartTime}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">
          {selectedMower?.name || 'Mower'} Schedule
        </h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onEdit}>
            Edit Schedule
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? 
              <Loader2 className="h-4 w-4 animate-spin" /> : 
              <Save className="h-4 w-4" />
            }
            Save Schedule
          </Button>
        </div>
      </div>

      <div className="bg-muted/30 border border-border rounded-md p-3 text-sm flex items-center">
        <ShieldAlert className="h-4 w-4 mr-2 text-primary" />
        <span>
          <strong>Pro Tip:</strong> You can now drag and drop schedule blocks to adjust times. Changes are saved when you click "Save Schedule".
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-5 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="space-y-4">
          <MowerScheduleCalendar 
            zones={calendarZones}
            events={calendarEvents}
            onEventClick={handleEventClick}
            restrictions={zoneRestrictions}
            onEventMove={handleEventMove}
          />
        </TabsContent>
        
        <TabsContent value="summary" className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-4 text-lg font-medium">Schedule Overview</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Mower Details</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedMower?.name} - Capacity: {selectedMower?.acresPerWeek} acres per week
                </p>
              </div>
              
              <div>
                <h4 className="font-medium">Zones</h4>
                <ul className="mt-2 space-y-2">
                  {zones.map((zone, index) => (
                    <li key={zone.id} className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: generateZoneColor(index) }}
                      />
                      <span>{zone.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({zone.acreage} acres, {zone.frequency}x per week)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium">Weekly Summary</h4>
                <table className="mt-2 w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-sm font-medium">Day</th>
                      <th className="text-left text-sm font-medium">Zones</th>
                      <th className="text-left text-sm font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(schedule).map(([day, daySchedule]) => (
                      <tr key={day} className="border-t">
                        <td className="py-2">{day}</td>
                        <td className="py-2">
                          {daySchedule.length ? 
                            [...new Set(daySchedule.map(s => s.zoneName))].join(', ') : 
                            'None'
                          }
                        </td>
                        <td className="py-2">
                          {daySchedule.length ? 
                            calculateTotalDuration(daySchedule) : 
                            '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to calculate total mowing duration for a day
function calculateTotalDuration(daySchedule: Array<{ startTime: string, endTime: string }>) {
  let totalMinutes = 0;
  
  daySchedule.forEach(slot => {
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    
    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    
    totalMinutes += endTotalMinutes - startTotalMinutes;
  });
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}h ${minutes}m`;
} 