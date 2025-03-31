'use client';

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MowerSelector from './MowerSelector';
import ZoneManager from './ZoneManager';
import RestrictionsInput from './RestrictionsInput';
import ScheduleDisplay from './ScheduleDisplay';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AdvancedScheduleView from './AdvancedScheduleView';

// Interfaces from the original MowerScheduler
export interface TimeRestriction {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
  acreage: number;
  frequency: number;
  restrictions: string[];
  mapData?: {
    polygon: Location[];
  } | null;
}

export interface Mower {
  id: string;
  name: string;
  model?: string;
  cyclesPerDay: number;
  acresPerCycle: number;
  acresPerDay: number;
  acresPerWeek: number;
  cycleTime: number; // in minutes
  location?: Location;
  zones?: {
    id: string;
    name: string;
    color: string;
  }[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  attributes?: {
    positions?: {
      latitude: number;
      longitude: number;
    }[];
    [key: string]: unknown;
  };
}

type Step = 'mower' | 'zones' | 'restrictions' | 'schedule';

interface ScheduleBlock {
  startTime: string;
  endTime: string;
  zoneId: string;
  zoneName: string;
  cycleNumber: number;
}

interface DailySchedule {
  [key: string]: ScheduleBlock[];
}

interface MowingCycle {
  startTime: string;
  endTime: string;
  zoneId: string;
  zoneName: string;
  cycleNumber: number;
  acreageCovered: number;
  totalAcreageCompleted: number;  // Running total of acreage mowed in this session
  totalZoneAcreage: number;       // Total acreage of the zone
  isPartialCycle: boolean;
  percentageOfFullCycle: number;
  isContinuation: boolean;
  hasNextDayPart: boolean;
  sessionNumber: number;          // Which mowing session of the week this is
}

// Add step indicator styling
const stepIndicatorStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "1rem",
  marginBottom: "1.5rem",
  width: "100%"
};

const stepButtonStyle = (isActive: boolean) => ({
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: isActive ? "#10b981" : "#e2e8f0",
  color: isActive ? "white" : "#64748b",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: isActive ? "0 2px 4px rgba(0, 0, 0, 0.1)" : "none"
});

const stepConnectorStyle = (isActive: boolean) => ({
  height: "2px",
  width: "50px",
  background: isActive ? "#10b981" : "#e2e8f0",
});

interface MowerSchedulerProps {
  availableMowers: Mower[];
  onScheduleSubmit: (schedule: DailySchedule, mowerId: string) => Promise<unknown>;
}

interface StepIndicatorProps {
  currentStep: Step;
  steps: Step[];
  onStepClick: (step: Step) => void;
}

// Step indicator component
const StepIndicator = ({ currentStep, steps, onStepClick }: StepIndicatorProps) => {
  return (
    <div style={stepIndicatorStyle}>
      {steps.map((step, index) => {
        const isActive = steps.indexOf(currentStep) >= index;
        const currentIndex = steps.indexOf(currentStep);
        const isClickable = index <= currentIndex + 1;
        
        return (
          <div key={step} style={{ display: "flex", alignItems: "center" }}>
            {index > 0 && (
              <div style={stepConnectorStyle(steps.indexOf(currentStep) >= index)} />
            )}
            <button
              type="button"
              style={{
                ...stepButtonStyle(step === currentStep),
                cursor: isClickable ? 'pointer' : 'not-allowed',
                opacity: isClickable ? 1 : 0.6
              }}
              onClick={() => isClickable && onStepClick(step)}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  onStepClick(step);
                }
              }}
              disabled={!isClickable}
              aria-label={`Go to ${step} step`}
            >
              {index + 1}
            </button>
          </div>
        );
      })}
    </div>
  );
};

function MowerSchedulerContent({ availableMowers, onScheduleSubmit }: MowerSchedulerProps) {
  const [currentStep, setCurrentStep] = useState<Step>('mower');
  const [selectedMower, setSelectedMower] = useState<Mower | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const steps: Step[] = ['mower', 'zones', 'restrictions', 'schedule'];

  const goToNextStep = async () => {
    setError(null); // Clear any previous errors
    
    if (currentStep === 'mower' && !selectedMower) {
      setError('Please select a mower to continue');
      return;
    }
    
    if (currentStep === 'zones' && zones.length === 0) {
      setError('Please add at least one zone to continue');
      return;
    }
    
    if (currentStep === 'schedule') {
      // We're on the last step, don't do anything as the Save Schedule button is now in AdvancedScheduleView
      return;
    }
    
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      // If we're going to the schedule step, generate the schedule
      if (steps[currentIndex + 1] === 'schedule') {
        try {
          setIsLoading(true);
          // Generate schedule using API if available, otherwise fall back to local algorithm
          const newSchedule = await generateSchedule(selectedMower || availableMowers[0], zones);
          
          setSchedule(newSchedule);
          setIsLoading(false);
        } catch (err) {
          setIsLoading(false);
          setError('Failed to generate schedule. Please try again.');
          return;
        }
      }
      
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleStepClick = (step: Step) => {
    const currentIndex = steps.indexOf(currentStep);
    const targetIndex = steps.indexOf(step);
    
    // Only allow clicking to completed steps or the next step
    if (targetIndex <= currentIndex + 1) {
      setCurrentStep(step);
    }
  };

  // Format the selected mower to include location if available from positions
  const formattedSelectedMower = useMemo(() => {
    if (!selectedMower) return null;
    
    // Extract location from attributes.positions if available
    let location: Location | undefined = selectedMower.location;
    
    // Check if we have a mower with attributes.positions
    if (selectedMower.attributes?.positions && selectedMower.attributes.positions.length > 0) {
      const position = selectedMower.attributes.positions[0];
      location = {
        lat: position.latitude,
        lng: position.longitude
      };
      console.log("Using mower position from attributes:", location);
    }
    
    return {
      ...selectedMower,
      location
    };
  }, [selectedMower]);

  // Helper function to determine optimal mowing days based on frequency
  const getOptimalMowingDays = (frequency: number): string[] => {
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Ensure a much more even distribution based on frequency
    switch (frequency) {
      case 1:
        return ['Wednesday']; // Middle of the week
      case 2:
        return ['Monday', 'Thursday']; // Evenly spaced
      case 3:
        return ['Monday', 'Wednesday', 'Friday']; // Evenly spaced
      case 4:
        return ['Monday', 'Tuesday', 'Thursday', 'Saturday']; // As evenly as possible
      case 5:
        return ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Sunday']; // As evenly as possible
      case 6:
        return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; // One day break
      case 7:
        return allDays;
      default:
        return ['Wednesday']; // Default to middle of week
    }
  };

  // Convert time string to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Convert minutes to time string
  const minutesToTime = (minutes: number): string => {
    // Handle minutes that might be outside the 24-hour range
    const adjustedMinutes = minutes % (24 * 60);
    const hours = Math.floor(adjustedMinutes / 60);
    const mins = adjustedMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Get the next day in the week
  const getNextDay = (currentDay: string): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const currentIndex = days.indexOf(currentDay);
    return days[(currentIndex + 1) % days.length];
  };

  // Check if a time is restricted for a zone
  const isRestrictedTime = (day: string, minutes: number, zone: Zone): boolean => {
    // Check if zone has any restrictions
    if (!zone.restrictions || zone.restrictions.length === 0) {
      return false;
    }
    
    const hour = Math.floor(minutes / 60);
    
    // Get day index (1=Monday, 2=Tuesday, etc. 0=Sunday)
    // This matches the format used in the TimeRestrictionScheduler component
    const dayMapping: Record<string, number> = {
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
      'Sunday': 0
    };
    
    const dayIndex = dayMapping[day];
    if (dayIndex === undefined) {
      console.error(`Invalid day: ${day}`);
      return false;
    }
    
    // Format we're looking for in restrictions
    const specificTimeRestriction = `${dayIndex}-${hour}`;
    
    // Check if any restriction applies
    for (const restriction of zone.restrictions) {
      // Simple restriction types
      if (restriction === "morning" && hour >= 6 && hour < 12) {
        console.log(`Zone ${zone.name} has morning restriction, rejecting time ${hour}:${minutes % 60} on ${day}`);
        return true;
      }
      if (restriction === "afternoon" && hour >= 12 && hour < 18) {
        console.log(`Zone ${zone.name} has afternoon restriction, rejecting time ${hour}:${minutes % 60} on ${day}`);
        return true;
      }
      if (restriction === "evening" && hour >= 18) {
        console.log(`Zone ${zone.name} has evening restriction, rejecting time ${hour}:${minutes % 60} on ${day}`);
        return true;
      }
      
      // Check for specific day-hour restriction format
      // This is the exact format used in the RestrictionsInput component
      if (restriction === specificTimeRestriction) {
        console.log(`Zone ${zone.name} has specific restriction "${restriction}" matching ${day} at hour ${hour}`);
        return true;
      }
    }
    
    return false;
  };

  // Check if a proposed time slot overlaps with any existing slots
  const doesSlotOverlap = (
    schedule: DailySchedule, 
    day: string, 
    startMinutes: number, 
    endMinutes: number
  ): boolean => {
    const daySchedule = schedule[day] || [];
    for (const slot of daySchedule) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      
      // Handle overnight sessions - if the session crosses midnight
      if (endMinutes < startMinutes) {
        // Our session crosses midnight
        if (slotEnd < slotStart) {
          // Both sessions cross midnight - always overlap
          return true;
        }
        // Normal session - check if it overlaps with any part of our overnight session
        if (slotStart < endMinutes || slotEnd > startMinutes) {
          return true;
        }
      } else if (slotEnd < slotStart) {
        // Our session is normal, but existing session crosses midnight
        if (startMinutes < slotEnd || endMinutes > slotStart) {
          return true;
        }
      } else {
        // Neither session crosses midnight - standard overlap check
        if (startMinutes < slotEnd && endMinutes > slotStart) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Find an available time slot for a zone on a specific day
  const findAvailableTimeSlot = (
    schedule: DailySchedule,
    day: string,
    durationMinutes: number
  ): number | null => {
    // Try various time slots from 6 AM (6*60 = 360 minutes) to 10 PM (22*60 = 1320 minutes)
    // Start with hourly slots for efficiency
    for (let hour = 6; hour < 22; hour++) {
      const startMinutes = hour * 60;
      const endMinutes = startMinutes + durationMinutes;
      
      // Don't go past 10 PM
      if (endMinutes > 22 * 60) continue;
      
      // Check if this slot overlaps with existing slots
      if (!doesSlotOverlap(schedule, day, startMinutes, endMinutes)) {
        return startMinutes;
      }
    }
    
    // If we couldn't find a slot with hourly increments, try half-hour increments
    for (let hour = 6; hour < 22; hour++) {
      for (const minute of [0, 30]) {
        const startMinutes = (hour * 60) + minute;
        const endMinutes = startMinutes + durationMinutes;
        
        // Don't go past 10 PM
        if (endMinutes > 22 * 60) continue;
        
        // Check if this slot overlaps with existing slots
        if (!doesSlotOverlap(schedule, day, startMinutes, endMinutes)) {
          return startMinutes;
        }
      }
    }
    
    // Last resort: try 15-minute increments for maximum flexibility
    for (let hour = 6; hour < 22; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        const startMinutes = (hour * 60) + minute;
        const endMinutes = startMinutes + durationMinutes;
        
        // Don't go past 10 PM
        if (endMinutes > 22 * 60) continue;
        
        // Check if this slot overlaps with existing slots
        if (!doesSlotOverlap(schedule, day, startMinutes, endMinutes)) {
          return startMinutes;
        }
      }
    }
    
    // No suitable slot found
    return null;
  };

  // This function generates a schedule based on the mower and zones
  const generateSchedule = async (mower: Mower, zones: Zone[]): Promise<DailySchedule> => {
    console.log("Generating schedule with improved TypeScript algorithm...");
    
    // Validate inputs first
    if (!mower) {
      throw new Error("No mower selected");
    }
    
    if (!zones || zones.length === 0) {
      throw new Error("No zones defined");
    }
    
    // Debug: Log all zone restrictions 
    console.log("==== ZONE RESTRICTIONS ====");
    for (const zone of zones) {
      console.log(`Zone ${zone.name} has ${zone.restrictions?.length || 0} restrictions:`);
      if (zone.restrictions && zone.restrictions.length > 0) {
        for (const r of zone.restrictions) {
          console.log(`  - ${r}`);
        }
      } else {
        console.log("  (no restrictions)");
      }
    }
    console.log("==========================");
    
    try {
      // Initialize empty schedule for each day
      const schedule: DailySchedule = {
        'Monday': [],
        'Tuesday': [],
        'Wednesday': [],
        'Thursday': [],
        'Friday': [],
        'Saturday': [],
        'Sunday': []
      };
      
      // Calculate total weekly mowing requirements
      const totalWeeklyRequiredAcreage = zones.reduce(
        (sum, zone) => sum + (zone.acreage * zone.frequency), 0
      );
      
      // Check if mower can handle the total acreage
      if (totalWeeklyRequiredAcreage > mower.acresPerWeek) {
        toast.warning("Warning: Total required mowing exceeds mower capacity. Some zones may not be fully scheduled.");
      }
      
      // Sort zones by priority (frequency first, then size)
      const prioritizedZones = [...zones].sort((a, b) => {
        if (b.frequency !== a.frequency) {
          return b.frequency - a.frequency;
        }
        return b.acreage - a.acreage;
      });

      // IMPROVEMENT: Add a schedule capacity indicator
      const weeklyMinutesAvailable = 7 * 24 * 60; // All minutes in a week
      const totalRequiredMinutes = prioritizedZones.reduce((total, zone) => {
        const zoneDuration = Math.ceil((zone.acreage / mower.acresPerCycle) * mower.cycleTime);
        return total + (zoneDuration * zone.frequency);
      }, 0);
      
      const capacityUtilization = (totalRequiredMinutes / weeklyMinutesAvailable) * 100;
      console.log(`Schedule capacity utilization: ${capacityUtilization.toFixed(2)}% (${totalRequiredMinutes} minutes needed out of ${weeklyMinutesAvailable} available)`);
      
      // Determine scheduling mode based on utilization
      const isHighLoadMode = capacityUtilization > 50;
      if (isHighLoadMode) {
        console.log("Using high-load scheduling mode for tighter packing");
      }
      
      // Track zones that couldn't be scheduled
      const unscheduledZones: {zone: Zone; days: string[]}[] = [];
      
      // For each zone, create a session plan (days and durations)
      const zoneSessions = new Map<string, {day: string, duration: number}[]>();
      
      // IMPROVEMENT: Create a continuous timeline for the week to better visualize available slots
      // Each day has 1440 minutes (24 hours * 60 minutes)
      const weekTimeline: {
        [day: string]: {
          startMinute: number;
          endMinute: number;
          zoneId: string;
        }[]
      } = {
        'Monday': [],
        'Tuesday': [],
        'Wednesday': [],
        'Thursday': [],
        'Friday': [],
        'Saturday': [],
        'Sunday': []
      };
      
      // IMPROVEMENT: Begin with a preliminary planning phase
      for (const zone of prioritizedZones) {
        // Calculate mowing duration for this zone
        const durationMinutes = Math.ceil((zone.acreage / mower.acresPerCycle) * mower.cycleTime);
        console.log(`Zone ${zone.name} needs ${durationMinutes} minutes per session, ${zone.frequency} times per week`);
        
        // Get optimal mowing days distribution
        const targetDays = getOptimalMowingDays(zone.frequency);
        const sessions: {day: string, duration: number}[] = [];
        
        for (const day of targetDays) {
          sessions.push({ day, duration: durationMinutes });
        }
        
        zoneSessions.set(zone.id, sessions);
      }
      
      // IMPROVEMENT: Function to find best available slot with Tetris-like packing
      const findBestTimeSlot = (day: string, duration: number, zoneId: string, zoneName: string): number | null => {
        // Get the current zone by ID
        const currentZone = prioritizedZones.find(z => z.id === zoneId);
        if (!currentZone) {
          console.error(`Zone with ID ${zoneId} not found`);
          return null;
        }
        
        // First, create an array representing every minute of the day (0-1439)
        // Each item is true if the minute is available, false if occupied or restricted
        const dayMinutes = Array(24 * 60).fill(true);
        
        // Mark occupied minutes as unavailable
        const dayTimeline = weekTimeline[day];
        for (const slot of dayTimeline) {
          for (let m = slot.startMinute; m <= slot.endMinute; m++) {
            if (m < dayMinutes.length) {
              dayMinutes[m] = false;
            }
          }
        }
        
        // Mark restricted minutes as unavailable
        for (let m = 0; m < dayMinutes.length; m++) {
          if (isRestrictedTime(day, m, currentZone)) {
            dayMinutes[m] = false;
          }
        }
        
        // Now find valid slots that have enough consecutive available minutes
        const validSlots: Array<{start: number, end: number}> = [];
        let startOfSlot: number | null = null;
        
        for (let m = 0; m < dayMinutes.length; m++) {
          if (dayMinutes[m]) {
            // This minute is available
            if (startOfSlot === null) {
              startOfSlot = m;
            }
            // Continue extending the current slot
          } else {
            // This minute is unavailable - end the current slot if we had one
            if (startOfSlot !== null) {
              // Only add slots that are long enough
              if (m - startOfSlot >= duration) {
                validSlots.push({
                  start: startOfSlot,
                  end: m - 1
                });
              }
              startOfSlot = null;
            }
          }
        }
        
        // Don't forget to check the last slot if it extends to the end of the day
        if (startOfSlot !== null && (dayMinutes.length - startOfSlot) >= duration) {
          validSlots.push({
            start: startOfSlot,
            end: dayMinutes.length - 1
          });
        }
        
        // Validate that there are no restrictions in any of the valid slots
        for (const slot of validSlots) {
          for (let m = slot.start; m < slot.start + duration; m++) {
            if (isRestrictedTime(day, m, currentZone)) {
              console.error(`BUG: Found a restricted minute at ${m} in a supposedly valid slot!`);
              // Remove this slot
              const index = validSlots.indexOf(slot);
              if (index !== -1) {
                validSlots.splice(index, 1);
              }
              break;
            }
          }
        }
        
        if (validSlots.length === 0) {
          console.log(`No valid slot found for zone ${zoneName} on ${day} (needs ${duration} minutes)`);
          return null;
        }
        
        // IMPROVEMENT: Different slot selection strategies based on load
        if (isHighLoadMode) {
          // In high load mode, find the smallest slot that fits (minimize waste)
          validSlots.sort((a, b) => (a.end - a.start) - (b.end - b.start));
          return validSlots[0].start;
        }
        
        // In normal mode, prefer morning slots first, then evening
        // First try morning (6am-12pm)
        const morningSlots = validSlots.filter(slot => 
          (slot.start >= 6 * 60 && slot.start < 12 * 60) || 
          (slot.start < 6 * 60 && slot.end >= 6 * 60)
        );
        
        if (morningSlots.length > 0) {
          morningSlots.sort((a, b) => a.start - b.start);
          // Prefer 8am if available
          const eightAmSlot = morningSlots.find(slot => slot.start <= 8 * 60 && slot.end >= 8 * 60 + duration);
          return eightAmSlot ? 8 * 60 : morningSlots[0].start;
        }
        
        // Then try afternoon (12pm-6pm)
        const afternoonSlots = validSlots.filter(slot => 
          (slot.start >= 12 * 60 && slot.start < 18 * 60) || 
          (slot.start < 12 * 60 && slot.end >= 12 * 60)
        );
        
        if (afternoonSlots.length > 0) {
          afternoonSlots.sort((a, b) => a.start - b.start);
          return afternoonSlots[0].start;
        }
        
        // Last, use evening slots (6pm onwards)
        const eveningSlots = validSlots.filter(slot => slot.start >= 18 * 60 || slot.end >= 18 * 60);
        if (eveningSlots.length > 0) {
          eveningSlots.sort((a, b) => a.start - b.start);
          return eveningSlots[0].start;
        }
        
        // If we got here, just use the first available slot
        validSlots.sort((a, b) => a.start - b.start);
        return validSlots[0].start;
      };
      
      // IMPROVEMENT: Add a session to the timeline and schedule
      const addSession = (day: string, startMinute: number, duration: number, zone: Zone): void => {
        const endMinute = startMinute + duration - 1;
        
        // Triple-check every single minute to make absolutely sure 
        // this session does not include any restricted times
        console.log(`Attempting to add session for ${zone.name} on ${day} from ${startMinute} to ${endMinute}`);
        
        if (zone.restrictions && zone.restrictions.length > 0) {
          console.log(`Zone has ${zone.restrictions.length} restrictions, checking each minute carefully...`);
        }
        
        // Check every single minute individually
        for (let minute = startMinute; minute <= endMinute; minute++) {
          if (isRestrictedTime(day, minute, zone)) {
            const hour = Math.floor(minute / 60);
            const min = minute % 60;
            
            console.error("BLOCKED: Cannot schedule during a restricted time!");
            console.error(`- Zone: ${zone.name}`);
            console.error(`- Day: ${day}`);
            console.error(`- Time: ${hour}:${min.toString().padStart(2, '0')}`);
            
            toast.error(`Cannot schedule ${zone.name} during restricted time on ${day} at ${hour}:${min.toString().padStart(2, '0')}`);
            return; // Don't add the session
          }
        }
        
        // Also check for overnight sessions that cross into the next day
        if (endMinute >= 24 * 60) {
          const nextDay = getNextDay(day);
          const nextDayDuration = endMinute - (24 * 60) + 1;
          
          console.log(`This is an overnight session extending into ${nextDay} for ${nextDayDuration} minutes`);
          
          // Check every minute in the next day portion
          for (let minute = 0; minute < nextDayDuration; minute++) {
            if (isRestrictedTime(nextDay, minute, zone)) {
              const hour = Math.floor(minute / 60);
              const min = minute % 60;
              
              console.error("BLOCKED: Cannot schedule overnight session (restricted time on next day)!");
              console.error(`- Zone: ${zone.name}`);
              console.error(`- Day: ${nextDay} (next day)`);
              console.error(`- Time: ${hour}:${min.toString().padStart(2, '0')}`);
              
              toast.error(`Cannot schedule ${zone.name} overnight (restricted time on ${nextDay})`);
              return; // Don't add the session
            }
          }
        }
        
        // We've survived all the checks! This session is valid and restriction-free
        console.log(`✅ Adding valid session for ${zone.name} on ${day} - passed all restriction checks!`);
        
        // Add to timeline for tracking
        weekTimeline[day].push({
          startMinute,
          endMinute,
          zoneId: zone.id
        });
        
        // Check if session crosses midnight
        if (endMinute >= 24 * 60) {
          // Split into two parts at midnight
          const firstPartDuration = (24 * 60) - startMinute;
          const secondPartDuration = duration - firstPartDuration;
          const nextDay = getNextDay(day);
          
          // Add first part (until midnight)
          schedule[day].push({
            zoneId: zone.id,
            zoneName: zone.name,
            startTime: minutesToTime(startMinute),
            endTime: '23:59',
            cycleNumber: 1
          });
          
          // Add second part (after midnight)
          schedule[nextDay].push({
            zoneId: zone.id,
            zoneName: zone.name,
            startTime: '00:00',
            endTime: minutesToTime(secondPartDuration - 1),  // -1 because end minute is inclusive
            cycleNumber: 1
          });
          
          // Also add the continuation to the timeline
          weekTimeline[nextDay].push({
            startMinute: 0,
            endMinute: secondPartDuration - 1,
            zoneId: zone.id
          });
          
          console.log(`Scheduled overnight session for ${zone.name} from ${day} ${minutesToTime(startMinute)} to ${nextDay} ${minutesToTime(secondPartDuration - 1)}`);
        } else {
          // Normal session within one day
          schedule[day].push({
            zoneId: zone.id,
            zoneName: zone.name,
            startTime: minutesToTime(startMinute),
            endTime: minutesToTime(endMinute),
            cycleNumber: 1
          });
        }
      };
      
      // IMPROVEMENT: First scheduling pass - try to schedule each zone on its optimal days
      const failedSessions: {zone: Zone, day: string, duration: number}[] = [];
      
      for (const zone of prioritizedZones) {
        const sessions = zoneSessions.get(zone.id) || [];
        const failedDays: string[] = [];
        
        for (const session of sessions) {
          const { day, duration } = session;
          
          // Find best time slot for this session
          const startTime = findBestTimeSlot(day, duration, zone.id, zone.name);
          
          if (startTime !== null) {
            // Add session to schedule
            addSession(day, startTime, duration, zone);
          } else {
            // Track failed session for retry
            failedSessions.push({ zone, day, duration });
            failedDays.push(day);
          }
        }
        
        // Report on scheduling success for this zone
        if (failedDays.length > 0) {
          if (failedDays.length === sessions.length) {
            console.warn(`Zone ${zone.name} couldn't be scheduled on any preferred days`);
          } else {
            console.warn(`Zone ${zone.name} couldn't be scheduled on ${failedDays.join(', ')}`);
          }
        }
      }
      
      // IMPROVEMENT: Retry failed sessions with alternative days and slot splitting
      if (failedSessions.length > 0) {
        console.log(`Attempting to reschedule ${failedSessions.length} failed sessions...`);
        
        for (const { zone, day, duration } of failedSessions) {
          // Try scheduling on any day that's not already used for this zone
          const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          const usedDays = new Set(
            Object.entries(schedule)
              .filter(([_, slots]) => slots.some(slot => slot.zoneId === zone.id))
              .map(([day]) => day)
          );
          
          const availableDays = allDays.filter(d => !usedDays.has(d));
          
          // First try scheduling the full duration on an alternative day
          let rescheduled = false;
          
          for (const altDay of availableDays) {
            const startTime = findBestTimeSlot(altDay, duration, zone.id, zone.name);
            
            if (startTime !== null) {
              addSession(altDay, startTime, duration, zone);
              console.log(`Rescheduled ${zone.name} from ${day} to alternative day ${altDay}`);
              rescheduled = true;
              break;
            }
          }
          
          // If still not scheduled, try splitting the session into smaller parts
          if (!rescheduled && duration > 120) { // Only split if longer than 2 hours
            console.log(`Attempting to split session for ${zone.name} (${duration} minutes) into smaller parts`);
            
            // Try splitting in half
            const halfDuration = Math.ceil(duration / 2);
            
            // Try to place each half on available days
            for (const altDay of availableDays) {
              const startTime = findBestTimeSlot(altDay, halfDuration, zone.id, zone.name);
              
              if (startTime !== null) {
                addSession(altDay, startTime, halfDuration, zone);
                console.log(`Scheduled first half of ${zone.name} on ${altDay}`);
                
                // Try to place second half
                const secondHalfDays = availableDays.filter(d => d !== altDay);
                
                for (const secondDay of secondHalfDays) {
                  const secondStartTime = findBestTimeSlot(secondDay, duration - halfDuration, zone.id, zone.name);
                  
                  if (secondStartTime !== null) {
                    addSession(secondDay, secondStartTime, duration - halfDuration, zone);
                    console.log(`Scheduled second half of ${zone.name} on ${secondDay}`);
                    rescheduled = true;
                    break;
                  }
                }
                
                if (rescheduled) break;
              }
            }
          }
          
          // If still not scheduled, record as unscheduled
          if (!rescheduled) {
            unscheduledZones.push({ zone, days: [day] });
            console.warn(`Could not schedule zone "${zone.name}" on ${day} or any alternative day`);
          }
        }
      }
      
      // IMPROVEMENT: Final optimization pass - try to compact the schedule by shifting sessions
      // This helps minimize gaps between sessions
      for (const day of Object.keys(weekTimeline)) {
        const timeline = weekTimeline[day];
        
        // Sort by start time
        timeline.sort((a, b) => a.startMinute - b.startMinute);
        
        // Try to shift sessions earlier to fill gaps
        for (let i = 1; i < timeline.length; i++) {
          const currentSlot = timeline[i];
          const previousSlot = timeline[i - 1];
          
          const gap = currentSlot.startMinute - previousSlot.endMinute - 1;
          
          // If there's a significant gap (more than 30 minutes), try to shift current session earlier
          if (gap > 30) {
            const zone = prioritizedZones.find(z => z.id === currentSlot.zoneId);
            if (!zone) continue;
            
            const duration = currentSlot.endMinute - currentSlot.startMinute + 1;
            const newStartTime = previousSlot.endMinute + 1;
            
            // CRITICAL FIX: Check if the new time slot would overlap with restricted times
            let hasRestrictions = false;
            for (let minute = newStartTime; minute < newStartTime + duration; minute++) {
              if (isRestrictedTime(day, minute, zone)) {
                console.log(`Cannot shift ${zone.name} earlier due to restriction at ${minutesToTime(minute)} on ${day}`);
                hasRestrictions = true;
                break;
              }
            }
            
            // Only proceed with the shift if no restrictions found
            if (!hasRestrictions) {
              // Update the schedule entry
              const scheduleEntry = schedule[day].find(
                entry => entry.zoneId === currentSlot.zoneId && 
                        timeToMinutes(entry.startTime) === currentSlot.startMinute
              );
              
              if (scheduleEntry) {
                // Update the entry times
                scheduleEntry.startTime = minutesToTime(newStartTime);
                scheduleEntry.endTime = minutesToTime(newStartTime + duration - 1);
                
                // Update the timeline
                currentSlot.startMinute = newStartTime;
                currentSlot.endMinute = newStartTime + duration - 1;
                
                console.log(`Optimized schedule: Shifted ${zone.name} earlier on ${day} to fill a gap`);
              }
            } else {
              console.log(`Skipped shifting ${zone.name} on ${day} to avoid restricted times`);
            }
          }
        }
      }

      // Sort each day's schedule by start time
      for (const day of Object.keys(schedule)) {
        schedule[day].sort((a, b) => {
          return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        });
      }
      
      // IMPROVEMENT: Analyze final schedule and report statistics
      let totalScheduledMinutes = 0;
      const zoneStats = new Map<string, {scheduled: number, required: number}>();
      
      for (const day of Object.keys(schedule)) {
        for (const slot of schedule[day]) {
          const startMinutes = timeToMinutes(slot.startTime);
          const endMinutes = timeToMinutes(slot.endTime);
          const duration = endMinutes < startMinutes ? 
            (24 * 60 - startMinutes) + endMinutes : // overnight session
            endMinutes - startMinutes; // same day session
          
          totalScheduledMinutes += duration;
          
          // Track per-zone statistics
          const zoneStat = zoneStats.get(slot.zoneId) || {scheduled: 0, required: 0};
          zoneStat.scheduled += duration;
          zoneStats.set(slot.zoneId, zoneStat);
        }
      }
      
      // Calculate required minutes per zone
      for (const zone of prioritizedZones) {
        const duration = Math.ceil((zone.acreage / mower.acresPerCycle) * mower.cycleTime);
        const required = duration * zone.frequency;
        
        const stat = zoneStats.get(zone.id) || {scheduled: 0, required};
        stat.required = required;
        zoneStats.set(zone.id, stat);
      }
      
      // Log scheduling statistics
      console.log("Final schedule statistics:");
      console.log(`Total scheduled: ${totalScheduledMinutes} minutes (${(totalScheduledMinutes / totalRequiredMinutes * 100).toFixed(2)}% of required)`);
      
      const zoneEntries = Array.from(zoneStats.entries());
      for (const [zoneId, stats] of zoneEntries) {
        const zone = prioritizedZones.find(z => z.id === zoneId);
        if (zone) {
          const completionPct = (stats.scheduled / stats.required * 100).toFixed(2);
          console.log(`Zone ${zone.name}: ${stats.scheduled}/${stats.required} minutes (${completionPct}%)`);
        }
      }
      
      // Show warnings about unscheduled zones
      if (unscheduledZones.length > 0) {
        // Group by zone to show more useful messages
        const zoneFailures = new Map<string, string[]>();
        
        for (const failure of unscheduledZones) {
          const existing = zoneFailures.get(failure.zone.id) || [];
          zoneFailures.set(failure.zone.id, [...existing, ...failure.days]);
        }
        
        // Convert Map entries to array to avoid iterator issues
        const zoneEntries = Array.from(zoneFailures.entries());
        for (const [zoneId, days] of zoneEntries) {
          const zone = prioritizedZones.find(z => z.id === zoneId);
          if (zone) {
            const targetDays = getOptimalMowingDays(zone.frequency);
            
            if (days.length === targetDays.length) {
              toast.error(`Could not schedule zone "${zone.name}" on any of its required days.`);
            } else {
              toast.warning(`Zone "${zone.name}" could only be scheduled for ${targetDays.length - days.length} of ${targetDays.length} required days.`);
            }
          }
        }
      }
      
      // This function validates the final schedule to ensure no zones are scheduled during restricted times
      const validateSchedule = (schedule: DailySchedule, zones: Zone[]): boolean => {
        let isValid = true;
        const conflicts: Array<{zone: string, day: string, time: string}> = [];
        
        // Create a map of zone IDs to zone objects for faster lookup
        const zoneMap = new Map<string, Zone>();
        for (const zone of zones) {
          zoneMap.set(zone.id, zone);
        }
        
        // Check each day in the schedule
        for (const [day, slots] of Object.entries(schedule)) {
          // Check each slot in this day
          for (const slot of slots) {
            const zone = zoneMap.get(slot.zoneId);
            if (!zone) continue; // Skip if zone not found
            
            // Convert start and end times to minutes
            const startMinutes = timeToMinutes(slot.startTime);
            const endMinutes = timeToMinutes(slot.endTime);
            
            // Handle overnight sessions
            if (endMinutes < startMinutes) {
              // Check first part (until midnight)
              for (let minute = startMinutes; minute < 24 * 60; minute++) {
                if (isRestrictedTime(day, minute, zone)) {
                  const timeStr = minutesToTime(minute);
                  console.error(`VALIDATION FAILED: ${zone.name} scheduled during restricted time on ${day}`);
                  console.error(`- Time: ${timeStr}`);
                  conflicts.push({zone: zone.name, day, time: timeStr});
                  isValid = false;
                }
              }
              
              // Check second part (after midnight, next day)
              const nextDay = getNextDay(day);
              for (let minute = 0; minute <= endMinutes; minute++) {
                if (isRestrictedTime(nextDay, minute, zone)) {
                  const timeStr = minutesToTime(minute);
                  console.error(`VALIDATION FAILED: ${zone.name} scheduled during restricted time on ${nextDay}`);
                  console.error(`- Time: ${timeStr}`);
                  conflicts.push({zone: zone.name, day: nextDay, time: timeStr});
                  isValid = false;
                }
              }
            } else {
              // Normal session within one day
              for (let minute = startMinutes; minute <= endMinutes; minute++) {
                if (isRestrictedTime(day, minute, zone)) {
                  const timeStr = minutesToTime(minute);
                  console.error(`VALIDATION FAILED: ${zone.name} scheduled during restricted time on ${day}`);
                  console.error(`- Time: ${timeStr}`);
                  conflicts.push({zone: zone.name, day, time: timeStr});
                  isValid = false;
                }
              }
            }
          }
        }
        
        // Group conflicts by zone for more concise reporting
        if (conflicts.length > 0) {
          const conflictsByZone = new Map<string, {days: Set<string>}>();
          
          for (const conflict of conflicts) {
            const key = conflict.zone;
            if (!conflictsByZone.has(key)) {
              conflictsByZone.set(key, {days: new Set()});
            }
            conflictsByZone.get(key)?.days.add(conflict.day);
          }
          
          // Log a summary of conflicts
          console.error("=== SCHEDULE CONFLICTS SUMMARY ===");
          // Convert Map entries to array before iterating
          const zoneEntries = Array.from(conflictsByZone.entries());
          for (const [zone, info] of zoneEntries) {
            const daysString = Array.from(info.days).join(", ");
            console.error(`${zone}: Conflicts on ${daysString}`);
          }
          console.error("==================================");
          
          // Show a toast for each affected zone
          for (const [zone, info] of zoneEntries) {
            const daysString = Array.from(info.days).join(", ");
            toast.error(`Scheduling conflict: ${zone} zone has ${conflicts.filter(c => c.zone === zone).length} conflicts on ${daysString}`, {
              duration: 6000
            });
          }
        }
        
        return isValid;
      };

      // Sort each day's schedule by start time
      for (const day of Object.keys(schedule)) {
        schedule[day].sort((a, b) => {
          return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        });
      }
      
      // FINAL VALIDATION: Triple-check that no zones are scheduled during restricted times
      const isScheduleValid = validateSchedule(schedule, prioritizedZones);
      if (!isScheduleValid) {
        toast.error("WARNING: Schedule contains conflicts with zone restrictions. Review the details in browser console.", {
          duration: 10000
        });
      } else {
        console.log("✅ VALIDATION PASSED: All scheduled sessions respect zone restrictions!");
      }
      
      return schedule;
    } catch (error) {
      console.error("Error generating schedule:", error);
      toast.error(`Failed to generate schedule: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error;
    }
  };

  // Contents to render based on current step
  const renderStepContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p>Processing...</p>
          </div>
        </div>
      );
    }
    
    switch (currentStep) {
      case 'mower':
        return (
          <MowerSelector 
            availableMowers={availableMowers} 
            selectedMower={selectedMower}
            onSelect={setSelectedMower}
            onNext={goToNextStep}
          />
        );
      case 'zones':
        if (!formattedSelectedMower) return <div>Please select a mower first</div>;
        return (
          <ZoneManager 
            zones={zones} 
            setZones={setZones} 
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            selectedMower={formattedSelectedMower}
          />
        );
      case 'restrictions':
        return (
          <RestrictionsInput
            zones={zones}
            setZones={setZones}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            mowerId={selectedMower?.id}
          />
        );
      case 'schedule':
        if (!schedule || !formattedSelectedMower) return <div>Please generate a schedule first</div>;
        
        return (
          <div className="space-y-6">            
            <AdvancedScheduleView
              schedule={schedule}
              zones={zones}
              selectedMower={formattedSelectedMower}
              onSubmit={async (updatedSchedule) => {
                try {
                  setIsLoading(true);
                  await onScheduleSubmit(updatedSchedule, selectedMower?.id || 'temp-id');
                  setSchedule(updatedSchedule); // Update the local schedule
                  setIsLoading(false);
                  toast.success('Schedule successfully saved!');
                } catch (err) {
                  setIsLoading(false);
                  setError('Failed to save schedule. Please try again.');
                }
              }}
              onEdit={() => goToPreviousStep()}
            />
          </div>
        );
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto bg-background/80 backdrop-blur-sm dark:bg-background/20 rounded-xl shadow-md overflow-hidden border border-border">
      <div className="p-8">
        {/* Step Indicator */}
        <StepIndicator 
          currentStep={currentStep} 
          steps={steps} 
          onStepClick={handleStepClick} 
        />
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive dark:bg-destructive/20">
            {error}
          </div>
        )}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
          </div>
        )}
        
        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
        
        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          {currentStep !== 'restrictions' && (
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 'mower'}
            >
              Back
            </Button>
          )}
          
          {currentStep !== 'schedule' && currentStep !== 'restrictions' && (
            <Button onClick={goToNextStep}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MowerScheduler(props: MowerSchedulerProps) {
  return (
    <MowerSchedulerContent {...props} />
  );
} 