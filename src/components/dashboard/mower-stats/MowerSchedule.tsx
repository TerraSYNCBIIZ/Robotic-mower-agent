"use client"

import * as React from "react"
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  isToday,
  parseISO
} from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Clock, Calendar } from "lucide-react"
import { useEffect, useState } from 'react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { MowerDataService } from "@/lib/husqvarna/mowerDataService"
import { husqvarnaApi } from "@/lib/husqvarna/api-client" // Import the API client directly
import { useDashboard } from '@/hooks/useDashboard'

// Interface for a calendar task from the API
interface CalendarTask {
  start: number;        // Minutes after midnight
  duration: number;     // Duration in minutes
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  workAreaId?: number;  // Optional work area ID for EPOS models
  workAreaName?: string;
}

// Interface for calendar data
interface CalendarData {
  tasks: CalendarTask[];
}

// Interface for a processed schedule item for display
interface ScheduleItem {
  start: number;       // Minutes after midnight
  end: number;         // Minutes after midnight
  day: number;         // 0-6 for Monday-Sunday
  workAreaId?: number; // Optional work area ID
  workAreaName?: string; // Optional work area name
}

// Interface for work area
interface WorkArea {
  id?: string;
  attributes?: {
    workAreaId?: number;
    name?: string;
    progress?: number;
    cuttingHeight?: number;
    enabled?: boolean;
    lastTimeCompleted?: number;
    calendar?: {
      tasks?: Array<{
        start: number;
        duration: number;
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
        sunday: boolean;
        workAreaId?: number;
      }>;
    };
  };
}

interface MowerScheduleGridProps {
  mowerId: string;
  workAreaColors?: Record<string, string>; // Optional colors for work areas
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Helper to convert minutes after midnight to a formatted time string
const formatMinutes = (minutes: number): string => {
  // Handle edge cases
  if (minutes === undefined || minutes === null) return "00:00";
  
  // Handle overflow - ensure minutes don't exceed 24 hours (1440 minutes)
  const adjustedMinutes = minutes % 1440;
  
  const hours = Math.floor(adjustedMinutes / 60);
  const mins = adjustedMinutes % 60;
  
  // Format with leading zeros
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Sort schedule items by start time for better display
const sortScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
  return [...items].sort((a, b) => a.start - b.start);
};

// Get work area name from ID using the workAreaColors map or available workAreas
const getWorkAreaName = (workAreaId?: number, workAreaColors?: Record<string, string>, workAreas?: any[]): string => {
  if (!workAreaId) return 'Default Area';
  
  // If workAreas array is available, try to find the name
  if (workAreas && Array.isArray(workAreas)) {
    // First try to match by attributes.workAreaId
    const areaByAttribute = workAreas.find(a => a.attributes?.workAreaId === workAreaId);
    if (areaByAttribute && areaByAttribute.attributes?.name) {
      return areaByAttribute.attributes.name;
    }
    
    // Then try to match by id as string
    const areaById = workAreas.find(a => a.id === workAreaId.toString());
    if (areaById && areaById.attributes?.name) {
      return areaById.attributes.name;
    }
  }
  
  // Try to extract known work area names from the workAreaColors keys
  if (workAreaColors) {
    // Look for keys that might contain both name and ID like "name|id" or metadata
  for (const key in workAreaColors) {
    if (key.includes('|')) {
      const [name, keyId] = key.split('|');
        if (keyId === workAreaId.toString() && name) {
          return name;
        }
      }
    }
  }
  
  // Finally, check if we can find it in the global workAreaNames map
  // (This could be added as a global cache if needed)
  
  // Fallback to just showing the ID
  return `Area ${workAreaId}`;
}

export function MowerScheduleGrid({ mowerId, workAreaColors = {} }: MowerScheduleGridProps): React.ReactElement {
  const [scheduleData, setScheduleData] = React.useState<CalendarData | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [debugInfo, setDebugInfo] = React.useState<string | null>(null);
  const [workAreas, setWorkAreas] = React.useState<WorkArea[]>([]);
  const [isEposModel, setIsEposModel] = React.useState(false);
  const [workAreaNamesMap, setWorkAreaNamesMap] = React.useState<Record<string, string>>({});
  
  // Get data from dashboard context
  const { mowerData } = useDashboard();
  
  const mowerService = React.useMemo(() => new MowerDataService(), []);
  
  const today = new Date();
  const startDay = startOfWeek(today, { weekStartsOn: 1 });
  const endDay = endOfWeek(today, { weekStartsOn: 1 });
  const days = React.useMemo(() => {
    const daysArray = [];
    let day = startDay;
    while (day <= endDay) {
      daysArray.push(day);
      day = addDays(day, 1);
    }
    return daysArray;
  }, [startDay, endDay]);

  // Enhanced version of getWorkAreasForMower that also retrieves names and calendar data
  const getWorkAreasForMower = React.useCallback(async (mowerId: string): Promise<WorkArea[]> => {
    try {
      // First check if we already have the data in the dashboard context
      const selectedMower = mowerData.find(m => m.id === mowerId);
      if (selectedMower && selectedMower.zones && selectedMower.zones.length > 0) {
        console.log(`[MowerSchedule] Using work areas from dashboard context for ${mowerId}`);
        
        // Convert zones to work areas format
        const areasFromDashboard = selectedMower.zones.map(zone => ({
          id: zone.workAreaId,
          attributes: {
            name: zone.name,
            workAreaId: zone.workAreaId,
            color: zone.color
          }
        })) as WorkArea[];
        
        // Extract work area names to a map for easier lookup
        const namesMap: Record<string, string> = {};
        areasFromDashboard.forEach((area: WorkArea) => {
          if (area.attributes?.workAreaId !== undefined && area.attributes?.name) {
            namesMap[area.attributes.workAreaId.toString()] = area.attributes.name;
          }
        });
        
        console.log(`[MowerSchedule] Extracted work area names from dashboard:`, namesMap);
        setWorkAreaNamesMap(namesMap);
        
        return areasFromDashboard;
      }
      
      // Fall back to API call if needed using the original implementation
      console.log(`[MowerSchedule] Falling back to API call for work areas`);
      const workAreas = await husqvarnaApi.getMowerWorkAreas(mowerId);
      
      // Extract work area names
      const namesMap: Record<string, string> = {};
      if (workAreas && Array.isArray(workAreas)) {
        workAreas.forEach((area: any) => {
          if (area.attributes?.workAreaId !== undefined && area.attributes?.name) {
            namesMap[area.attributes.workAreaId.toString()] = area.attributes.name;
          }
        });
        setWorkAreaNamesMap(namesMap);
      }
      
      return workAreas || [];
    } catch (error) {
      console.error('[MowerSchedule] Error fetching work areas:', error);
      return [];
    }
  }, [mowerData]);

  const fetchScheduleData = React.useCallback(async () => {
    // Track the start time of the fetch operation
    const startTime = Date.now();
    const minLoadTime = 750; // minimum loading time to prevent flashing

    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`[MowerSchedule] Fetching schedule data for mower ${mowerId} from dashboard context`);
      
      // Find the mower in the dashboard data
      const selectedMower = mowerData.find((m: any) => m.id === mowerId);
      
      if (!selectedMower) {
        console.log(`[MowerSchedule] Mower ${mowerId} not found in dashboard data`);
        // Continue with API fallback below
      } else {
        // Get model info from dashboard data
        const modelName = selectedMower.model || '';
        
        // Determine if this is an EPOS/advanced model
        const isEpos = modelName.includes('EPOS') || 
          modelName.includes('550') || 
          modelName.includes('520') || 
          modelName.includes('NERA') || 
          modelName.includes('CEORA');
        
        console.log(`[MowerSchedule] Mower model from dashboard: ${modelName}, isEPOS: ${isEpos}`);
        setIsEposModel(isEpos);
        
        // Check if we already have schedule data in the dashboard context
        if (selectedMower.schedule) {
          console.log(`[MowerSchedule] Using schedule data from dashboard context`);
          
          // Convert schedule format from dashboard to our component format
          const tasks: CalendarTask[] = [];
          
          // Loop through each day in the schedule
          selectedMower.schedule?.forEach((daySchedule: any) => {
            // Skip days with no time slots
            if (!daySchedule.timeSlots || daySchedule.timeSlots.length === 0) return;
            
            // Get the day index (0 = Monday, 1 = Tuesday, etc.)
            const dayName = daySchedule.day || '';
            const dayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dayName);
            if (dayIndex === -1) return;
            
            // For each time slot, create a task
            daySchedule.timeSlots.forEach((slot: any) => {
              // Parse start and end times to get minutes
              const startParts = slot.startTime.split(':').map(Number);
              const endParts = slot.endTime.split(':').map(Number);
              
              const startMinutes = startParts[0] * 60 + startParts[1];
              const endMinutes = endParts[0] * 60 + endParts[1];
              const duration = endMinutes - startMinutes;
              
              // Determine work area ID and name from the first zone
              const workAreaId = typeof slot.zones?.[0]?.id === 'number' ? 
                slot.zones[0].id : 
                undefined;
                
              const workAreaName = slot.zones?.[0]?.name || undefined;
              
              // Create a task with the appropriate day set to true
              const task: CalendarTask = {
                start: startMinutes,
                duration: duration,
                monday: dayIndex === 0,
                tuesday: dayIndex === 1,
                wednesday: dayIndex === 2,
                thursday: dayIndex === 3,
                friday: dayIndex === 4,
                saturday: dayIndex === 5,
                sunday: dayIndex === 6,
                workAreaId,
                workAreaName
              };
              
              tasks.push(task);
            });
          });
          
          console.log(`[MowerSchedule] Converted ${tasks.length} tasks from dashboard schedule`);
          setScheduleData({ tasks });
          setLastUpdated(new Date());
          
          // Also load work areas for better display
          getWorkAreasForMower(mowerId)
            .then(areas => setWorkAreas(areas))
            .catch(error => console.error('[MowerSchedule] Error loading work areas:', error));
          
          // End the loading early since we have data
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime < minLoadTime) {
            setTimeout(() => setIsLoading(false), minLoadTime - elapsedTime);
          } else {
            setIsLoading(false);
          }
          
          return; // End here since we have data
        }
      }
      
      // If we're still here, we need to fall back to API calls
      
      // First get the model information from cached data
      const apiMowerData = await mowerService.getMowerData(mowerId);
      const modelName = apiMowerData?.mowerData?.attributes?.system?.model || '';
      
      // Determine if this is an EPOS/advanced model
      const isEpos = modelName.includes('EPOS') || 
        modelName.includes('550') || 
        modelName.includes('520') || 
        modelName.includes('NERA') || 
        modelName.includes('CEORA');
      
      console.log(`[MowerSchedule] Mower model from API: ${modelName}, isEPOS: ${isEpos}`);
      setIsEposModel(isEpos);
      
      // Always fetch work areas first for EPOS mowers
      if (isEpos) {
        try {
          // Get all work areas for the mower
          const areas = await getWorkAreasForMower(mowerId);
          setWorkAreas(areas);
          console.log(`[MowerSchedule] Loaded ${areas.length} work areas for EPOS mower`);
        } catch (workAreaError) {
          console.error('[MowerSchedule] Error fetching work areas:', workAreaError);
        }
      }
      
      // Use the enhanced API directly for both model types
      console.log(`[MowerSchedule] Falling back to API call for schedule`);
      const calendar = await husqvarnaApi.getMowerCalendar(mowerId, modelName);
      
      if (calendar && calendar.tasks && Array.isArray(calendar.tasks)) {
        console.log(`[MowerSchedule] API returned ${calendar.tasks.length} tasks with work area information`);
        
        // Log ALL task day settings to verify they're correct
        calendar.tasks.forEach((task: CalendarTask, i: number) => {
          console.log(`[MowerSchedule] Task ${i} complete day settings:`, {
            workAreaId: task.workAreaId,
            workAreaName: (task as any).workAreaName,
            start: task.start,
            duration: task.duration,
            monday: task.monday,
            tuesday: task.tuesday,
            wednesday: task.wednesday, 
            thursday: task.thursday,
            friday: task.friday,
            saturday: task.saturday,
            sunday: task.sunday
          });
          
          // Count enabled days using strict === true comparison
          const enabledDays = [
            task.monday === true,
            task.tuesday === true, 
            task.wednesday === true,
            task.thursday === true,
            task.friday === true,
            task.saturday === true,
            task.sunday === true
          ].filter(Boolean).length;
          
          console.log(`[MowerSchedule] Task ${i} has ${enabledDays} explicitly enabled days`);
          
          // Check for any non-boolean values that could cause incorrect rendering
          if (typeof task.monday !== 'boolean' || 
              typeof task.tuesday !== 'boolean' ||
              typeof task.wednesday !== 'boolean' ||
              typeof task.thursday !== 'boolean' ||
              typeof task.friday !== 'boolean' ||
              typeof task.saturday !== 'boolean' ||
              typeof task.sunday !== 'boolean') {
            console.warn(`[MowerSchedule] Task ${i} has non-boolean day values that may cause rendering issues`);
          }
        });
        
        setScheduleData(calendar);
        setLastUpdated(new Date());
      } else {
        console.log(`[MowerSchedule] No tasks found in schedule data`);
        setScheduleData({ tasks: [] });
        setError("No schedule data available for this mower");
      }
    } catch (err) {
      console.error(`[MowerSchedule] Error fetching schedule:`, err);
      setError("Failed to load mower schedule. Please try again.");
    } finally {
      // Ensure minimum loading time to prevent flickering
      const elapsedTime = Date.now() - startTime;
      
      if (elapsedTime < minLoadTime && !error) {
        setTimeout(() => {
          setIsLoading(false);
        }, minLoadTime - elapsedTime);
      } else {
        setIsLoading(false);
      }
    }
  }, [mowerId, mowerData, mowerService, getWorkAreasForMower, error]);

  React.useEffect(() => {
    fetchScheduleData();
    
    // Listen for WebSocket events
    const handleUpdate = (event: CustomEvent) => {
      if (event.detail?.mowerId === mowerId && 
          (event.detail?.data?.type === 'calendar' || 
           event.detail?.data?.type === 'calendar-event-v2')) {
        console.log("Schedule update received via WebSocket, refreshing data");
        fetchScheduleData();
      }
    };
    
    // Add event listeners for both general and mower-specific updates
    window.addEventListener('mower-data-updated', handleUpdate as EventListener);
    window.addEventListener(`mower-${mowerId}-updated`, handleUpdate as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('mower-data-updated', handleUpdate as EventListener);
      window.removeEventListener(`mower-${mowerId}-updated`, handleUpdate as EventListener);
    };
  }, [fetchScheduleData, mowerId, getWorkAreasForMower]);

  const handleRefresh = () => {
    fetchScheduleData();
  };

  // Convert API tasks to day-specific schedule items for display
  const processScheduleData = React.useCallback((data: CalendarData | null): ScheduleItem[] => {
    if (!data || !data.tasks || !Array.isArray(data.tasks)) {
      console.log(`[MowerSchedule] No data to process`);
      return [];
    }
    
    console.log(`[MowerSchedule] Processing ${data.tasks.length} calendar tasks`);
    
    const scheduleItems: ScheduleItem[] = [];
    
    // Process each task
    for (const task of data.tasks) {
      console.log(`[MowerSchedule] Processing task:`, JSON.stringify(task, null, 2));
      
      // Add a specific log for workAreaName to help debug
      if ((task as any).workAreaName) {
        console.log(`[MowerSchedule] Task has workAreaName: ${(task as any).workAreaName} for workAreaId: ${task.workAreaId}`);
      } else if (task.workAreaId !== undefined) {
        console.log(`[MowerSchedule] Task has workAreaId: ${task.workAreaId} but no workAreaName`);
      }
      
      // Check if the task is valid
      if (typeof task.start !== 'number' || typeof task.duration !== 'number') {
        console.log(`[MowerSchedule] Invalid task - missing start or duration:`, task);
        continue;
      }
      
      // Define the days and their properties
      const daysToCheck = [
        { day: 0, key: 'monday' as const, name: 'Monday' },
        { day: 1, key: 'tuesday' as const, name: 'Tuesday' },
        { day: 2, key: 'wednesday' as const, name: 'Wednesday' },
        { day: 3, key: 'thursday' as const, name: 'Thursday' },
        { day: 4, key: 'friday' as const, name: 'Friday' },
        { day: 5, key: 'saturday' as const, name: 'Saturday' },
        { day: 6, key: 'sunday' as const, name: 'Sunday' }
      ];
      
      // Check each day - log all day values for debugging
      console.log(`[MowerSchedule] Task day settings:`, {
        monday: task.monday,
        tuesday: task.tuesday,
        wednesday: task.wednesday,
        thursday: task.thursday,
        friday: task.friday,
        saturday: task.saturday,
        sunday: task.sunday
      });
      
      // Check each day
      for (const { day, key, name } of daysToCheck) {
        // Get the value for this day (true/false) - IMPORTANT: must be exactly true
        const isDayEnabled = task[key] === true;
        
        // Debug: show day key and value
        console.log(`[MowerSchedule] Checking ${name} (${key}) = ${isDayEnabled ? 'enabled' : 'disabled'} (raw value: ${task[key]})`);
        
        // Only create schedule items for days that are explicitly true
        if (isDayEnabled) {
          console.log(`[MowerSchedule] Task scheduled for ${name}`);
          
          // Calculate the end time (start time + duration)
          const endTime = task.start + task.duration;
          
          // Use workAreaName directly from API task if available
          const workAreaName = (task as any).workAreaName;
          
          // Create a schedule item for this day
          scheduleItems.push({
            start: task.start,
            end: endTime,
            day,
            workAreaId: task.workAreaId,
            workAreaName: workAreaName
          });
        }
      }
    }
    
    console.log(`[MowerSchedule] Created ${scheduleItems.length} schedule items for display`);
    return scheduleItems;
  }, []);

  const scheduleItems = React.useMemo(() => {
    return processScheduleData(scheduleData);
  }, [scheduleData, processScheduleData]);

  // Helper function to get schedules for a specific day, grouped by work area for EPOS models
  const getSchedulesForDay = (dayIndex: number) => {
    // Get all items for this day
    const filteredItems = scheduleItems.filter(item => item.day === dayIndex);
    
    // Sort items by work area ID (grouping them) and then by start time
    return filteredItems.sort((a, b) => {
      // First sort by work area ID (putting undefined/null at the end)
      if (a.workAreaId !== undefined && b.workAreaId === undefined) return -1;
      if (a.workAreaId === undefined && b.workAreaId !== undefined) return 1;
      if (a.workAreaId !== b.workAreaId) {
        return (a.workAreaId || 0) - (b.workAreaId || 0);
      }
      // Then sort by start time within each work area
      return a.start - b.start;
    });
  };

  // Determine if this is an EPOS/advanced model with multiple work areas
  const hasMultipleWorkAreas = React.useMemo(() => {
    if (!scheduleItems.length) return false;
    
    // Check if we have tasks with different work area IDs
    const workAreaIds = new Set(
      scheduleItems
        .filter(item => item.workAreaId !== undefined)
        .map(item => item.workAreaId)
    );
    
    return workAreaIds.size > 1;
  }, [scheduleItems]);

  // Group schedule items by work area ID for rendering
  const getScheduleItemsGroupedByWorkArea = (items: ScheduleItem[]) => {
    if (!hasMultipleWorkAreas) return { null: items };
    
    const grouped: Record<string, ScheduleItem[]> = {};
    
    for (const item of items) {
      const key = item.workAreaId !== undefined ? item.workAreaId.toString() : 'null';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }
    
    return grouped;
  };

  // Updated color function to ensure more distinct unique colors for work areas
  const getWorkAreaColor = (workAreaId?: number | string): string => {
    if (workAreaId === undefined) return '#3b82f6'; // Default blue
    
    const id = workAreaId.toString();
    
    // Check in workAreaColors
    if (workAreaColors[id]) {
      return workAreaColors[id];
    }
    
    // Use a consistent color based on the work area ID - updated with more vibrant and distinct colors
    const colors = [
      '#10b981', // emerald
      '#3b82f6', // blue
      '#8b5cf6', // violet
      '#f59e0b', // amber
      '#ef4444', // red
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#84cc16', // lime
      '#a855f7', // purple
      '#14b8a6', // teal
      '#f97316', // orange
      '#06aed4', // sky
      '#dc2626', // rose
      '#0891b2', // cyan-700
      '#db2777', // pink-600
      '#4f46e5', // indigo-600
      '#2563eb', // blue-600
      '#7c3aed'  // violet-600
    ];
    
    // Use a more deterministic but distributed approach for color assignment
    // This ensures consistent coloring while distributing colors more evenly
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    // Make sure hash is positive
    hash = Math.abs(hash);
    
    return colors[hash % colors.length];
  };

  // Get the actual name of the work area using the ID
  const getWorkAreaDisplayName = (workAreaId?: number): string => {
    if (workAreaId === undefined) return 'Default Area';
    
    // First check the names map we built from the API
    const idStr = workAreaId.toString();
    if (workAreaNamesMap[idStr]) {
      return workAreaNamesMap[idStr];
    }
    
    // Then check the workAreas array
    const area = workAreas.find(a => a.attributes?.workAreaId === workAreaId);
    if (area?.attributes?.name) {
      return area.attributes.name;
    }
    
    return `Area ${workAreaId}`;
  };

  // Modified function to return unique work areas for this mower
  const getUniqueWorkAreas = React.useMemo(() => {
    if (!scheduleItems.length) return [];
    
    const uniqueAreaMap = new Map();
    
    scheduleItems.forEach(item => {
      if (item.workAreaId !== undefined) {
        const areaId = item.workAreaId.toString();
        if (!uniqueAreaMap.has(areaId)) {
          uniqueAreaMap.set(areaId, {
            id: item.workAreaId,
            name: item.workAreaName || getWorkAreaDisplayName(item.workAreaId),
            color: getWorkAreaColor(item.workAreaId)
          });
        }
      }
    });
    
    return Array.from(uniqueAreaMap.values());
  }, [scheduleItems, getWorkAreaDisplayName]);

  // Add a debug function to directly check raw API data
  const checkRawApiData = React.useCallback(async () => {
    setDebugInfo("Loading mower data...");
    setIsLoading(true);
    
    try {
      console.log(`[MowerSchedule] Running enhanced debug fetch for ${mowerId}`);
      
      // First try to get data from dashboard context
      const selectedMower = mowerData.find((m: any) => m.id === mowerId);
      let hasContextData = false;
      
      if (selectedMower) {
        console.log(`[MowerSchedule] Using data from dashboard context for debug`);
        const modelName = selectedMower.model || 'Unknown';
        
        // Get work areas and schedule from dashboard
        const dashboardWorkAreas = selectedMower.zones || [];
        const dashboardSchedule = selectedMower.schedule || [];
        hasContextData = true;
        
        // Display the results from dashboard context
        setDebugInfo(
          `Model: ${modelName}\n` +
          `Found ${dashboardWorkAreas.length} zones in dashboard data\n` +
          `Dashboard schedule has data: ${dashboardSchedule.length > 0 ? 'YES' : 'NO'}\n` +
          `Current source: ${hasContextData ? 'Dashboard Context' : 'API Fallback'}\n\n` +
          `Work area names:\n` +
          Object.entries(workAreaNamesMap).map(([id, name]) => `- Area ${id}: ${name}`).join('\n')
        );
      } else {
        console.log(`[MowerSchedule] Mower not found in dashboard context, using API`);
      }
      
      // Trigger a refresh of the schedule data with the new approach
      fetchScheduleData();
      
      // Clear debug info after 10 seconds
      setTimeout(() => {
        setDebugInfo(null);
        setIsLoading(false);
      }, 10000);
    } catch (error) {
      console.error('[MowerSchedule] Debug error:', error);
      setDebugInfo(`Error during debug check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Clear debug info after 8 seconds
      setTimeout(() => {
        setDebugInfo(null);
        setIsLoading(false);
      }, 8000);
    }
  }, [mowerId, mowerService, fetchScheduleData, mowerData, workAreaNamesMap]);

  return (
    <div className="w-full">
      {lastUpdated && (
        <div className="px-4 pt-4 pb-2 flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Last updated: {format(lastUpdated, "MMM d, yyyy 'at' h:mm a")}
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRefresh} 
              disabled={isLoading}
              className="h-8 w-8"
            >
              <motion.div
                animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw size={14} className="text-foreground" />
              </motion.div>
              <span className="sr-only">Refresh schedule</span>
            </Button>
          </div>
        </div>
      )}

      {/* Debug info alert */}
      {debugInfo && (
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm whitespace-pre-line">
          {debugInfo}
        </div>
      )}

      {/* Work Areas Legend - Show even before data is fully loaded */}
      {!error && getUniqueWorkAreas.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-muted-foreground">Zones:</span>
            {getUniqueWorkAreas.map(area => (
              <div 
                key={`legend-${area.id}`} 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                style={{ backgroundColor: `${area.color}15` }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }}></div>
                <span style={{ color: area.color }} className="font-medium">{area.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4"
          >
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <div className="grid grid-cols-7 gap-2">
                {Array(7).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-md" />
                ))}
              </div>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-40 items-center justify-center p-4 text-destructive"
          >
            {error}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4"
          >
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold">
              {DAYS_OF_WEEK.map((day, index) => (
                <div key={day} className="py-2">
                  <span className="block">{day.substring(0, 3)}</span>
                  <span className={cn(
                    "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isSameDay(days[index], today) && "bg-primary text-primary-foreground"
                  )}>
                    {format(days[index], "d")}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-2" />
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day, dayIndex) => {
                const daySchedules = getSchedulesForDay(dayIndex);
                return (
                  <div 
                    key={day} 
                    className={cn(
                      "min-h-24 rounded-md border p-2 overflow-y-auto",
                      isSameDay(days[dayIndex], today) && "border-primary/50 bg-primary/5"
                    )}
                  >
                    {daySchedules.length > 0 ? (
                      <div className="space-y-2">
                        {/* Flatten the schedule items to avoid nested structures */}
                        {daySchedules.map((schedule, index) => {
                          const areaId = schedule.workAreaId;
                          const areaColor = getWorkAreaColor(areaId);
                          const areaName = schedule.workAreaName || getWorkAreaDisplayName(areaId);
                          
                          return (
                            <motion.div
                              key={`${dayIndex}-${index}`}
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="rounded-md shadow-sm p-2 text-left"
                              style={{
                                backgroundColor: `${areaColor}15`,
                                borderRadius: '6px'
                              }}
                            >
                              <div className="flex flex-col space-y-1">
                                {/* Zone name displayed prominently at the top */}
                                <div className="text-xs font-semibold" style={{ color: areaColor }}>
                                  {areaName}
                                </div>
                                
                                {/* Time display */}
                                <div className="flex items-center gap-1 text-xs text-foreground">
                                  <Clock size={12} className="text-muted-foreground" />
                                  <span>
                                    {formatMinutes(schedule.start)} - {formatMinutes(schedule.end)}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-foreground/70">
                        No schedule
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {scheduleData && !isLoading && (
        <div className="border-t p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={14} />
            <span>
              {scheduleData?.tasks?.length || 0} scheduled task{(scheduleData?.tasks?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// This is the component that's used in the dashboard
// It needs to pass through the mowerId from the page params
export default function MowerSchedule({ mowerId }: { mowerId: string }) {
  // Just render the grid component with the correct ID
  return <MowerScheduleGrid mowerId={mowerId} />;
} 