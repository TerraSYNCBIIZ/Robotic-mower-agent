"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Clock, ShieldAlert } from "lucide-react";
import * as React from "react";

interface TimeRestrictionSchedulerProps {
  restrictions: Set<string>;
  toggleRestriction: (day: number, hour: number) => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const TimeRestrictionScheduler: React.FC<TimeRestrictionSchedulerProps> = ({
  restrictions,
  toggleRestriction,
}) => {
  const isRestricted = React.useCallback((day: number, hour: number) => {
    return restrictions.has(`${day}-${hour}`);
  }, [restrictions]);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  const handleKeyDown = (event: React.KeyboardEvent, day: number, hour: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      toggleRestriction(day, hour);
      event.preventDefault();
    }
  };

  // Track recently toggled cells to provide visual feedback
  const [recentlyToggled, setRecentlyToggled] = React.useState<Set<string>>(new Set());
  
  const handleCellClick = (day: number, hour: number) => {
    const cellKey = `${day}-${hour}`;
    
    // Add to recently toggled set
    setRecentlyToggled(prev => {
      const newSet = new Set(prev);
      newSet.add(cellKey);
      return newSet;
    });
    
    // Call the toggle function
    toggleRestriction(day, hour);
    
    // Remove from recently toggled after animation
    setTimeout(() => {
      setRecentlyToggled(prev => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }, 300);
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-4 bg-destructive/20 border border-destructive rounded" />
        <span className="text-sm font-medium">Restricted (mower will not operate)</span>
        <div className="w-4 h-4 bg-background border border-border rounded ml-2" />
        <span className="text-sm font-medium">Available (mower can operate)</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[auto_repeat(7,1fr)]">
            {/* Time header */}
            <div className="sticky left-0 bg-background z-10 border-r border-border pr-2">
              <div className="h-10 flex items-center justify-end font-medium text-sm text-muted-foreground">
                Hour
              </div>
            </div>
            {/* Day headers */}
            {DAYS.map((day, index) => (
              <div key={day} className="h-10 flex items-center justify-center font-medium text-sm">
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.substring(0, 3)}</span>
              </div>
            ))}

            {/* Time rows */}
            {HOURS.map((hour) => (
              <React.Fragment key={hour}>
                {/* Hour label */}
                <div className="sticky left-0 bg-background z-10 border-r border-border pr-2">
                  <div className="h-10 flex items-center justify-end text-sm text-muted-foreground">
                    {formatHour(hour)}
                  </div>
                </div>
                {/* Day cells */}
                {DAYS.map((_, dayIndex) => {
                  const cellKey = `${dayIndex}-${hour}`;
                  const restricted = isRestricted(dayIndex, hour);
                  const wasRecentlyToggled = recentlyToggled.has(cellKey);
                  
                  return (
                    <button
                      key={cellKey}
                      type="button"
                      className={cn(
                        "h-10 border m-[1px] rounded cursor-pointer transition-all duration-150",
                        restricted 
                          ? "bg-destructive/20 hover:bg-destructive/30 border-destructive" 
                          : "bg-background hover:bg-accent border-border",
                        wasRecentlyToggled && "scale-95 opacity-80"
                      )}
                      onClick={() => handleCellClick(dayIndex, hour)}
                      onKeyDown={(e) => handleKeyDown(e, dayIndex, hour)}
                      aria-label={`${DAYS[dayIndex]} at ${formatHour(hour)} ${
                        restricted ? "restricted" : "available"
                      }`}
                      aria-pressed={restricted}
                    >
                      {restricted && (
                        <div className="h-full w-full flex items-center justify-center">
                          <ShieldAlert className="h-4 w-4 text-destructive" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 