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

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { MowerDataService } from "@/lib/husqvarna/mowerDataService"

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
  workAreaId?: number;  // Optional workAreaId for EPOS models
}

// Interface for the calendar data returned by the API
interface CalendarData {
  tasks: CalendarTask[];
}

interface MowerScheduleGridProps {
  mowerId: string;
  workAreaColors?: Record<string, string>; // Optional colors for work areas
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Helper to convert minutes after midnight to a formatted time string
const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export function MowerScheduleGrid({ mowerId, workAreaColors = {} }: MowerScheduleGridProps) {
  const [scheduleData, setScheduleData] = React.useState<CalendarData | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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

  const fetchScheduleData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the async version to get fresh data from API if needed
      const data = await mowerService.getScheduleForMowerAsync(mowerId);
      setScheduleData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to load mower schedule. Please try again.");
      console.error(err);
      } finally {
      setIsLoading(false);
    }
  }, [mowerId, mowerService]);

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
    
    // Start listening for updates
    mowerService.startListening?.(mowerId);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('mower-data-updated', handleUpdate as EventListener);
      window.removeEventListener(`mower-${mowerId}-updated`, handleUpdate as EventListener);
      
      // Stop listening for updates
      mowerService.stopListening?.(mowerId);
    };
  }, [fetchScheduleData, mowerId, mowerService]);

  const handleRefresh = () => {
    fetchScheduleData();
  };

  // Get schedules for a specific day
  const getSchedulesForDay = (dayIndex: number) => {
    if (!scheduleData?.tasks) return [];
    
    const dayKey = DAY_KEYS[dayIndex];
    return scheduleData.tasks
      .filter(task => task[dayKey as keyof CalendarTask] === true)
      .map(task => ({
        start: task.start,
        end: task.start + task.duration,
        workAreaId: task.workAreaId
      }));
  };

  // Get color for a work area
  const getWorkAreaColor = (workAreaId?: number): string => {
    if (workAreaId === undefined) return "#10b981"; // Default color
    return workAreaColors[workAreaId.toString()] || "#10b981";
  };
  
  return (
    <Card className="w-full overflow-hidden border bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold text-foreground">Mowing Schedule</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {format(lastUpdated, "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
            </div>
                    <Button
          variant="outline" 
                      size="icon"
          onClick={handleRefresh} 
          disabled={isLoading}
          className="h-9 w-9"
        >
          <motion.div
            animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
          >
            <RefreshCw size={16} className="text-foreground" />
          </motion.div>
          <span className="sr-only">Refresh schedule</span>
                    </Button>
                  </div>
                  
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
            initial={{ opacity: 0 }}
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
                      "min-h-24 rounded-md border p-2",
                      isSameDay(days[dayIndex], today) && "border-primary/50 bg-primary/5"
                    )}
                  >
                    {daySchedules.length > 0 ? (
                      <div className="space-y-2">
                        {daySchedules.map((schedule, index) => (
                          <motion.div
                            key={`${dayIndex}-${index}`}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="rounded-md border border-border/50 bg-accent/50 p-2 text-left"
                            style={{
                              borderLeftColor: getWorkAreaColor(schedule.workAreaId),
                              borderLeftWidth: 4
                            }}
                          >
                            <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                              <Clock size={12} className="text-emerald-600" />
                              <span>
                                {formatMinutes(schedule.start)} - {formatMinutes(schedule.end)}
                              </span>
                            </div>
                            {schedule.workAreaId !== undefined && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                Area: {schedule.workAreaId}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
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
              {scheduleData.tasks.length} scheduled task{scheduleData.tasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

// Usage example
export default function MowerSchedulePage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Husqvarna Mower Schedule</h1>
      <MowerScheduleGrid mowerId="mower-123" />
    </div>
  );
} 