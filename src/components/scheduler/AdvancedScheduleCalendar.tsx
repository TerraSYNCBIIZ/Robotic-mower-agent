"use client";

import * as React from "react";
import { format, addDays, startOfWeek, parseISO, differenceInMinutes } from "date-fns";
import { ChevronLeft, ChevronRight, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface Zone {
  id: string;
  name: string;
  color: string;
}

interface ScheduleEvent {
  id: string;
  zoneId: string;
  startTime: string;
  endTime: string;
  day: number; // 0-6 (Sunday-Saturday)
  description?: string;
}

interface MowerScheduleCalendarProps {
  zones: Zone[];
  events: ScheduleEvent[];
  onEventClick?: (event: ScheduleEvent) => void;
  restrictions?: { 
    zoneId: string;
    days: string[]; // format: "0-8" for Sunday 8am, "1-14" for Monday 2pm, etc.
  }[];
  onEventMove?: (eventId: string, newDay: number, newStartTime: string, newEndTime: string) => void;
}

const timeSlots = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", 
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", 
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", 
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
];

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Using actual cell height for correct calculation
const GRID_CELL_HEIGHT = 40; // Height in pixels of each hour cell in the grid
const HEADER_CELL_HEIGHT = 40; // Header height
const GRID_CELL_WIDTH = 0; // Store for reference

// Scale factor to make heights more reasonable and fit the grid
const HOUR_HEIGHT_SCALING = 1; // 1 hour = 1 grid cell height (40px)
const ONE_HOUR_PIXELS = GRID_CELL_HEIGHT; // One hour = 40px
const EVENT_MARGIN = 1; // 1px margin between events

function MowerScheduleCalendar({ 
  zones, 
  events, 
  onEventClick, 
  restrictions,
  onEventMove 
}: MowerScheduleCalendarProps) {
  const [currentWeek, setCurrentWeek] = React.useState<Date>(startOfWeek(new Date()));
  const [displayHours, setDisplayHours] = React.useState<"all" | "active">("all");
  
  // Add drag state
  const [draggedEvent, setDraggedEvent] = React.useState<ScheduleEvent | null>(null);
  const [dragOverCell, setDragOverCell] = React.useState<{day: number, hour: string} | null>(null);
  const [dragOffset, setDragOffset] = React.useState<{x: number, y: number}>({ x: 0, y: 0 });
  
  // Ref to keep track of grid dimensions for accurate calculations
  const gridRef = React.useRef<HTMLDivElement>(null);

  const handlePreviousWeek = () => {
    setCurrentWeek(prevWeek => addDays(prevWeek, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prevWeek => addDays(prevWeek, 7));
  };

  // Get zone by id - memoized to prevent re-renders
  const getZoneById = React.useCallback((zoneId: string) => {
    return zones.find(zone => zone.id === zoneId) || { id: "", name: "Unknown", color: "#ccc" };
  }, [zones]);

  const getEventsForDayAndTime = (day: number, time: string) => {
    return events.filter(event => {
      return event.day === day && 
             event.startTime <= time && 
             event.endTime > time;
    });
  };

  // Calculate event duration in time slots
  const getEventDuration = (startTime: string, endTime: string): number => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    // Calculate hours between times
    if (start !== null && end !== null) {
      // Handle case where end time is on the next day or for long events
      if (end < start) {
        return (24 * 60 + end - start) / 60;
      }
      
      // Special case for events running almost 24 hours
      if (startTime === "00:00" && (end >= 23*60 || endTime.startsWith("23:"))) {
        return 23.9; // Almost 24 hours
      }
      
      return (end - start) / 60;
    }
    
    return 1; // Default to 1 hour if parsing fails
  };
  
  // Parse time string to minutes since midnight
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  };

  // Filter timeSlots based on display preference
  const visibleTimeSlots = React.useMemo(() => {
    if (displayHours === "all") {
      return timeSlots;
    }
    
    // When in "active" mode, make sure we display the full range needed for all events
    const activeSlots = new Set<string>();
    
    // First add standard business hours
    for (const slot of timeSlots) {
      const hour = Number.parseInt(slot.split(":")[0], 10);
      if (hour >= 6 && hour <= 22) { // 6 AM to 10 PM by default
        activeSlots.add(slot);
      }
    }
    
    // Then add any hours that have events
    for (const event of events) {
      // Add start hour
      const startHour = event.startTime.split(":")[0].padStart(2, "0");
      activeSlots.add(`${startHour}:00`);
      
      // Add end hour
      const endHour = event.endTime.split(":")[0].padStart(2, "0");
      activeSlots.add(`${endHour}:00`);
      
      // Also add the hour after end hour to ensure we show the full range
      const endHourNum = Number.parseInt(endHour, 10) + 1;
      if (endHourNum <= 23) {
        const nextHour = endHourNum.toString().padStart(2, "0");
        activeSlots.add(`${nextHour}:00`);
      }
    }
    
    return Array.from(activeSlots).sort((a, b) => {
      const hourA = Number.parseInt(a.split(":")[0], 10);
      const hourB = Number.parseInt(b.split(":")[0], 10);
      return hourA - hourB;
    });
  }, [displayHours, events]);

  // STEP 1: Add a function to check if a time slot is restricted for any zone
  const isAnyZoneRestricted = React.useCallback((day: number, hour: number): {
    restricted: boolean;
    restrictedZones: Array<{id: string, name: string, color: string}>;
  } => {
    if (!restrictions || restrictions.length === 0) {
      return { restricted: false, restrictedZones: [] };
    }
    
    const timeKey = `${day}-${hour}`;
    const restrictedZones: Array<{id: string, name: string, color: string}> = [];
    
    // Check each zone's restrictions
    for (const restriction of restrictions) {
      const { zoneId, days } = restriction;
      if (days.includes(timeKey)) {
        const zone = getZoneById(zoneId);
        restrictedZones.push({
          id: zoneId, 
          name: zone.name,
          color: zone.color
        });
      }
    }
    
    return { 
      restricted: restrictedZones.length > 0,
      restrictedZones
    };
  }, [restrictions, getZoneById]);

  // Check if a specific day/hour slot has any events
  const hasEventsAtTime = (day: number, hour: string): boolean => {
    return getEventsForDayAndTime(day, hour).length > 0;
  };

  // Format time from minutes to HH:MM
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  
  // Handle drag start
  const handleDragStart = (event: React.DragEvent, scheduleEvent: ScheduleEvent) => {
    event.dataTransfer.setData('text/plain', scheduleEvent.id);
    
    // Store the offset from the top-left corner of the element
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setDraggedEvent(scheduleEvent);
    
    // Add move cursor visually
    const element = event.target as HTMLElement;
    element.style.cursor = 'move';
  };
  
  // Handle drag over
  const handleDragOver = (event: React.DragEvent, day: number, hour: string) => {
    event.preventDefault();
    setDragOverCell({ day, hour });
    
    // Show the move cursor during drag
    event.dataTransfer.dropEffect = 'move';
  };
  
  // Handle drop
  const handleDrop = (event: React.DragEvent, targetDay: number, targetHour: string) => {
    event.preventDefault();
    
    // Reset drag states
    setDragOverCell(null);
    
    if (!draggedEvent || !onEventMove) return;
    
    // Calculate new start and end times
    const eventDuration = getEventDuration(draggedEvent.startTime, draggedEvent.endTime);
    const targetHourMinutes = parseTime(targetHour);
    
    // Calculate the offset within the current hour cell
    const cellRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeY = event.clientY - cellRect.top;
    const minuteOffset = Math.floor((relativeY / GRID_CELL_HEIGHT) * 60);
    
    // Adjust the minutes to align with 5-minute intervals for better UX
    const roundedMinutes = Math.round(minuteOffset / 5) * 5;
    
    // Calculate new times
    const newStartMinutes = targetHourMinutes + roundedMinutes;
    const newEndMinutes = newStartMinutes + (parseTime(draggedEvent.endTime) - parseTime(draggedEvent.startTime));
    const newEventOvernight = newEndMinutes < newStartMinutes;
    
    const newStartTime = formatTime(newStartMinutes);
    const newEndTime = formatTime(newEndMinutes);
    
    // Create a warning toast function that shows a visual toast with error styling
    const showWarningToast = (message: string) => {
      toast.error(message, { duration: 3000 });
    };
    
    // VALIDATION STEP 1: Check for time restriction conflicts
    // Get the zone for this event
    const zone = getZoneById(draggedEvent.zoneId);
    
    // Check each minute for restrictions
    let hasRestriction = false;
    let restrictionHour = -1;
    
    for (let minute = newStartMinutes; minute <= newEndMinutes; minute++) {
      const hour = Math.floor(minute / 60) % 24;
      if (isAnyZoneRestricted(targetDay, hour).restricted) {
        hasRestriction = true;
        restrictionHour = hour;
        break;
      }
    }
    
    if (hasRestriction) {
      showWarningToast(`Cannot move ${zone.name} to restricted time (${restrictionHour}:00)`);
      return;
    }
    
    // VALIDATION STEP 2: Check for overlapping events
    // Find all events on the target day (excluding the one being dragged)
    const targetDayEvents = events.filter(e => 
      e.day === targetDay && e.id !== draggedEvent.id
    );
    
    // Check for overlap with any other event
    let hasOverlap = false;
    let overlapEvent = null;
    
    for (const existingEvent of targetDayEvents) {
      const eventStart = parseTime(existingEvent.startTime);
      const eventEnd = parseTime(existingEvent.endTime);
      
      // Handle overnight events
      const existingEventOvernight = eventEnd < eventStart;
      const newEventOvernight = newEndMinutes < newStartMinutes;
      
      let overlaps = false;
      
      // Check for overlaps based on event types
      if (!existingEventOvernight && !newEventOvernight) {
        // Neither event is overnight - standard overlap check
        overlaps = (newStartMinutes < eventEnd && newEndMinutes > eventStart);
      } else if (existingEventOvernight && newEventOvernight) {
        // Both events are overnight - they always overlap
        overlaps = true;
      } else if (existingEventOvernight) {
        // Existing event is overnight, new event is not
        overlaps = (newStartMinutes < eventEnd || newEndMinutes > eventStart);
      } else {
        // New event is overnight, existing event is not
        overlaps = (eventStart < newEndMinutes || eventEnd > newStartMinutes);
      }
      
      if (overlaps) {
        hasOverlap = true;
        overlapEvent = existingEvent;
        break;
      }
    }
    
    if (hasOverlap && overlapEvent) {
      const overlapZone = getZoneById(overlapEvent.zoneId);
      showWarningToast(`Cannot move ${zone.name} here - overlaps with ${overlapZone.name} (${overlapEvent.startTime}-${overlapEvent.endTime})`);
      return;
    }
    
    // VALIDATION STEP 3: Check if event would go beyond valid hours (e.g., after 11 PM)
    const maxEndHour = 23; // 11 PM
    const endHour = Math.floor(newEndMinutes / 60);
    
    if (endHour > maxEndHour && !newEventOvernight) {
      showWarningToast(`Cannot schedule beyond 11 PM. Please select an earlier time.`);
      return;
    }
    
    // VALIDATION STEP 4: Minimum event length check (optional)
    // If you want to ensure events maintain a minimum length
    const minimumLengthMinutes = 15; // 15 minutes minimum
    const eventLengthMinutes = newEndMinutes - newStartMinutes;
    
    if (eventLengthMinutes < minimumLengthMinutes) {
      showWarningToast("Events must be at least " + minimumLengthMinutes + " minutes long.");
      return;
    }
    
    // All validations passed - call the handler with the new position
    onEventMove(draggedEvent.id, targetDay, newStartTime, newEndTime);
    setDraggedEvent(null);
  };
  
  // Handle drag end (cleanup)
  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDragOverCell(null);
  };

  const renderTimeSlots = () => {
    return (
      <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1" ref={gridRef}>
        <div 
          className="flex items-center justify-center font-medium text-foreground/80"
          style={{ height: `${HEADER_CELL_HEIGHT}px` }}
        >
          Time
        </div>
        {daysOfWeek.map((day, index) => (
          <div 
            key={day} 
            className="flex items-center justify-center font-medium border-b border-border bg-background/80"
            style={{ height: `${HEADER_CELL_HEIGHT}px` }}
          >
            <div className="text-center">
              <div className="font-semibold text-foreground">{day}</div>
              <div className="text-xs text-foreground/70">
                {format(addDays(currentWeek, index), "MMM d")}
              </div>
            </div>
          </div>
        ))}

        {visibleTimeSlots.map((time, timeIndex) => (
          <React.Fragment key={time}>
            <div 
              className="flex items-center justify-center text-sm text-foreground/80 font-medium border-r border-border bg-background/70"
              style={{ height: `${GRID_CELL_HEIGHT}px` }}
            >
              <span className={time.endsWith(":00") ? "font-medium" : "opacity-80"}>
                {time}
              </span>
            </div>
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              // Get all events for this day
              const allDayEvents = events.filter(event => event.day === dayIndex);
              
              // Sort events by start time to ensure consistent rendering
              const sortedDayEvents = [...allDayEvents].sort((a, b) => {
                return parseTime(a.startTime) - parseTime(b.startTime);
              });
              
              // Filter to only events that start or continue during this time slot
              const eventsInThisSlot = sortedDayEvents.filter(event => {
                const slotTime = parseTime(time);
                const slotEndTime = parseTime(timeIndex < visibleTimeSlots.length - 1 
                  ? visibleTimeSlots[timeIndex + 1] 
                  : "23:59");
                const eventStartTime = parseTime(event.startTime);
                const eventEndTime = parseTime(event.endTime);
                
                // Handle overnight events
                if (eventEndTime < eventStartTime) {
                  // Event crosses midnight
                  return (eventStartTime <= slotTime || eventEndTime >= slotTime);
                }
                
                // Regular event - check if it overlaps with this slot
                return (eventStartTime <= slotEndTime && eventEndTime >= slotTime);
              });
              
              return (
                <div 
                  key={`${dayIndex}-${time}`}
                  className={cn(
                    "border border-border/2 relative transition-colors duration-150",
                    {
                      "bg-muted/30 dark:bg-muted/10 hover:bg-background/70": !isAnyZoneRestricted(dayIndex, Number.parseInt(time.split(":")[0], 10)).restricted,
                      "bg-red-50/20 dark:bg-red-900/10 hover:bg-red-50/30 dark:hover:bg-red-900/20": isAnyZoneRestricted(dayIndex, Number.parseInt(time.split(":")[0], 10)).restricted
                    }
                  )}
                  style={{ height: `${GRID_CELL_HEIGHT}px`, margin: 0, padding: 0 }}
                  onDragOver={(e) => handleDragOver(e, dayIndex, time)}
                  onDrop={(e) => handleDrop(e, dayIndex, time)}
                >
                  {/* Highlight cell when dragging over */}
                  {dragOverCell && dragOverCell.day === dayIndex && dragOverCell.hour === time && (
                    <div className="absolute inset-0 z-10 bg-primary/20 border-2 border-dashed border-primary/50 pointer-events-none" />
                  )}
                  
                  {/* Add subtle pattern for restricted time slots */}
                  {(() => {
                    const { restricted, restrictedZones } = isAnyZoneRestricted(dayIndex, Number.parseInt(time.split(":")[0], 10));
                    
                    if (restricted) {
                      // If multiple zones have restrictions for this time, use a generic pattern
                      if (restrictedZones.length > 1) {
                        return (
                          <div 
                            className="absolute inset-0 z-5 pointer-events-none bg-red-100/10 dark:bg-red-900/10"
                            style={{ 
                              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 0, 0, 0.05) 10px, rgba(255, 0, 0, 0.05) 20px)'
                            }}
                          >
                            <div className="absolute bottom-1 right-1">
                              <div className="flex items-center justify-center bg-white/80 dark:bg-black/60 rounded-full p-0.5 shadow-sm">
                                <ShieldAlert className="h-3 w-3 text-red-500" />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // For a single zone, use zone-specific styling
                      const zone = restrictedZones[0];
                      return (
                        <div 
                          className="absolute inset-0 z-5 pointer-events-none"
                          style={{ 
                            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${zone.color}10 10px, ${zone.color}10 20px)`,
                            borderLeft: `3px solid ${zone.color}70`
                          }}
                        >
                          <div className="absolute bottom-1 right-1">
                            <div className="flex items-center justify-center bg-white/80 dark:bg-black/60 rounded-full p-0.5 shadow-sm">
                              <ShieldAlert className="h-3 w-3" style={{ color: zone.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                  
                  {/* Events */}
                  {eventsInThisSlot.map(event => {
                    const zone = getZoneById(event.zoneId);
                    
                    // Calculate position relative to current time slot
                    const eventStart = parseTime(event.startTime);
                    const slotStart = parseTime(time);
                    const nextSlotStart = timeIndex < visibleTimeSlots.length - 1 
                      ? parseTime(visibleTimeSlots[timeIndex + 1]) 
                      : slotStart + 60; // Default to 1 hour if last slot
                    
                    // Only render the event once, at its exact starting position
                    const startMinute = Number.parseInt(event.startTime.split(':')[1], 10);
                    const hourPrefix = time.split(':')[0];
                    
                    // An event is starting in this slot if:
                    // 1. It starts within this hour's range
                    // 2. For 00:00 events in the first slot
                    // 3. For events that start exactly at this hour
                    const isStartingInThisSlot = 
                      (eventStart >= slotStart && eventStart < nextSlotStart) || 
                      (timeIndex === 0 && event.startTime === "00:00") ||
                      (event.startTime.startsWith(`${hourPrefix}:`));
                    
                    // Only render the event once, at its starting position
                    if (!isStartingInThisSlot) return null;
                    
                    // Calculate the position within this hour slot (for events that don't start exactly on the hour)
                    const minutesIntoSlot = eventStart - slotStart;
                    const positionFromTopPercent = (minutesIntoSlot / 60) * 100;
                    
                    // Special handling for overnight or all-day events
                    const isNearlyAllDay = 
                      (event.startTime === "00:00" && 
                      (parseTime(event.endTime) >= 23 * 60 || event.endTime.startsWith("23:"))) ||
                      (event.endTime === "00:00" && event.startTime === "00:00");
                    
                    // Calculate actual duration based on start and end times
                    const eventDurationInMinutes = 
                      parseTime(event.endTime) < parseTime(event.startTime) 
                        ? (parseTime(event.endTime) + 24 * 60) - parseTime(event.startTime) 
                        : parseTime(event.endTime) - parseTime(event.startTime);
                    
                    // Use the calculated hours for display - 1 hour becomes 1 time slot height (3.5rem)
                    const durationHours = isNearlyAllDay
                      ? 23.9
                      : eventDurationInMinutes / 60;
                    
                    // For events that don't start at the top of the hour, adjust the position and height
                    // Events that start in the middle of an hour slot should only render from their start point
                    // and have their height adjusted accordingly
                    const heightPercent = (durationHours * 100) - positionFromTopPercent;
                    
                    // For precise pixel measurements, convert to absolute values
                    const hourSlotHeight = GRID_CELL_HEIGHT; // Height of one hour cell
                    
                    // Calculate exact top position based on minutes into the hour
                    const topPosition = (minutesIntoSlot / 60) * hourSlotHeight;
                    
                    // Calculate exact height based on duration in minutes
                    const adjustedHeightPx = durationHours * GRID_CELL_HEIGHT;
                    
                    // Add small extension to events that end just before another begins
                    const endsAtMinute = Number.parseInt(event.endTime.split(':')[1], 10);
                    
                    // Check if this event is directly followed by another event (sequential timing)
                    const nextEvent = eventsInThisSlot.find(e => {
                      if (e.id === event.id) return false;
                      
                      const thisEndTime = parseTime(event.endTime);
                      const eStartTime = parseTime(e.startTime);
                      
                      // Consider sequential if start time is within 5 minutes of end time
                      return eStartTime >= thisEndTime && eStartTime - thisEndTime <= 5;
                    });
                    
                    // Check if this event directly follows another event
                    const prevEvent = eventsInThisSlot.find(e => {
                      if (e.id === event.id) return false;
                      
                      const eEndTime = parseTime(e.endTime);
                      const thisStartTime = parseTime(event.startTime);
                      
                      // Consider sequential if start time is within 5 minutes of previous end time
                      return thisStartTime >= eEndTime && thisStartTime - eEndTime <= 5;
                    });
                    
                    // For back-to-back events, use the exact same spacing as between Back and f
                    const isFollowedByEvent = nextEvent !== undefined;
                    const followsAnotherEvent = prevEvent !== undefined;
                    
                    // Visual adjustment for perfect sequential rendering
                    // Make events that are followed by another one end exactly at their time
                    // Make events that follow another start exactly at their time
                    // This creates uniform visual spacing for all sequential events
                    const finalHeight = durationHours * GRID_CELL_HEIGHT;
                    
                    // Calculate horizontal position based on other events
                    const overlapEvents = eventsInThisSlot.filter(e => {
                      // Skip comparing an event with itself
                      if (e.id === event.id) return true;
                      
                      // Get times in minutes for comparison
                      const eStart = parseTime(e.startTime);
                      const eEnd = parseTime(e.endTime);
                      const thisStart = parseTime(event.startTime);
                      const thisEnd = parseTime(event.endTime);
                      
                      // Sequential events should NOT be considered overlapping
                      // Add a small buffer (2 minutes) to account for any rounding errors
                      if (Math.abs(eEnd - thisStart) <= 2 || Math.abs(thisEnd - eStart) <= 2) {
                        return false;
                      }
                      
                      // For events happening at the exact same time, consider them overlapping
                      if (eStart === thisStart) {
                        return true;
                      }
                      
                      // Properly handle overnight events
                      const eIsOvernight = eEnd < eStart;
                      const thisIsOvernight = thisEnd < thisStart;
                      
                      // Both events are overnight - they definitely overlap
                      if (eIsOvernight && thisIsOvernight) {
                        return true;
                      }
                      
                      // Handle when only one event is overnight
                      if (eIsOvernight) {
                        return (thisStart < eEnd) || (thisStart > eStart);
                      }
                      
                      if (thisIsOvernight) {
                        return (eStart < thisEnd) || (eStart > thisStart);
                      }
                      
                      // Normal case: check if there's an actual time overlap
                      // Use < and > rather than <= and >= to avoid considering adjacent events as overlapping
                      return (eStart < thisEnd) && (eEnd > thisStart);
                    });
                    
                    const overlapCount = overlapEvents.length;
                    const eventIndex = overlapEvents.findIndex(e => e.id === event.id);
                    
                    // Calculate width and position based on number of overlapping events
                    const width = overlapCount > 1 ? 100 / overlapCount : 100;
                    const left = eventIndex * width;
                    
                    // Add drag properties to the event
                    const isDragging = draggedEvent?.id === event.id;
                    
                    // Return the event UI - make draggable
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute z-10 rounded-md overflow-hidden shadow-md border transition-opacity",
                          "flex flex-col justify-between",
                          isDragging ? "opacity-50 cursor-move" : "opacity-100",
                          "hover:ring-2 hover:ring-primary hover:ring-opacity-50 hover:shadow-lg"
                        )}
                        style={{
                          left: "2px",
                          right: "2px",
                          top: `${topPosition}px`,
                          height: `${finalHeight - 1}px`,
                          backgroundColor: `${zone.color}40`,
                          borderColor: zone.color,
                          cursor: 'grab'
                        }}
                        onClick={() => onEventClick?.(event)}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, event)}
                        onDragEnd={handleDragEnd}
                        onKeyDown={(e) => {
                          // Add keyboard support for accessibility
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEventClick?.(event);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${zone.name} from ${event.startTime} to ${event.endTime} on ${daysOfWeek[event.day]}`}
                      >
                        <div 
                          className="p-1 text-xs font-semibold truncate w-full"
                          style={{ 
                            backgroundColor: zone.color,
                            color: 'white' 
                          }}
                        >
                          <div className="flex items-center">
                            <Move className="h-3 w-3 mr-1 inline-block" />
                            {event.startTime} - {event.endTime}
                          </div>
                        </div>
                        
                        <div className="p-1 text-xs font-medium overflow-hidden grow">
                          <div className="truncate">{zone.name}</div>
                          {event.description && (
                            <div className="truncate text-xs opacity-75">{event.description}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <div className="p-4 border-b border-border flex items-center justify-between bg-card">
        <h2 className="text-xl font-semibold">Mower Schedule</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePreviousWeek}
            className="border-border/50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="font-medium px-2">
            {format(currentWeek, "MMM d")} - {format(addDays(currentWeek, 6), "MMM d, yyyy")}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleNextWeek}
            className="border-border/50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="px-4 pt-2 border-b border-border flex justify-between items-center">
        <div className="flex gap-2 pb-2">
          <Button 
            variant={displayHours === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setDisplayHours("active")}
          >
            Active Hours
          </Button>
          <Button 
            variant={displayHours === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setDisplayHours("all")}
          >
            24-Hour View
          </Button>
        </div>
      </div>
      
      <div className="p-4 overflow-x-auto bg-gradient-to-b from-background to-muted/30">
        <div className="overflow-y-auto max-h-[800px]">
          {renderTimeSlots()}
        </div>
      </div>
      
      <div className="p-4 border-t border-border">
        <div className="flex flex-wrap gap-3">
          {zones.map(zone => (
            <TooltipProvider key={zone.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: zone.color }}
                    />
                    <span className="text-sm">{zone.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{zone.name} zone</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
        
        {/* Show restriction legend with colored indicators by zone */}
        {restrictions?.some(r => r.days.length > 0) && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-sm font-medium mb-2">Restricted Times:</div>
            <div className="flex flex-col gap-2">
              {restrictions.filter(r => r.days.length > 0).map(restriction => {
                const zone = getZoneById(restriction.zoneId);
                return (
                  <div key={zone.id} className="flex items-center gap-2 text-sm">
                    <div className="flex items-center justify-center w-4 h-4" style={{ 
                      backgroundColor: `${zone.color}20`,
                      border: `1px solid ${zone.color}40`
                    }}>
                      <ShieldAlert className="h-3 w-3" style={{ color: zone.color }} />
                    </div>
                    <span>
                      <span className="font-medium">{zone.name}</span> cannot be scheduled during restricted times
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default MowerScheduleCalendar; 