"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ScheduleViewProps } from "./types";

export function ScheduleView({ schedule = [] }: ScheduleViewProps) {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [expandedDay, setExpandedDay] = React.useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = React.useState(false);

  // Debug log to verify the schedule data received by the component
  React.useEffect(() => {
    console.log("ScheduleView received schedule:", 
      JSON.stringify(schedule.map(day => ({
        day: day.day,
        hasTimeSlots: day.timeSlots.length > 0,
        firstSlot: day.timeSlots[0] ? {
          startTime: day.timeSlots[0].startTime,
          endTime: day.timeSlots[0].endTime,
          zones: day.timeSlots[0].zones.map(z => z.name)
        } : null
      })), null, 2)
    );
  }, [schedule]);

  const toggleDay = (day: string) => {
    setExpandedDay(expandedDay === day ? null : day);
  };
  
  const toggleDetailedView = () => {
    setShowDetailedView(!showDetailedView);
    setExpandedDay(null);
  };

  // Extract all unique zones for visual overview
  const allZones = React.useMemo(() => {
    const zonesSet = new Set<string>();
    for (const day of schedule) {
      for (const slot of day.timeSlots) {
        for (const zone of slot.zones) {
          zonesSet.add(zone.name);
        }
      }
    }
    return Array.from(zonesSet);
  }, [schedule]);

  // Count how many days each zone is scheduled
  const zoneScheduleCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    
    for (const zone of allZones) {
      counts[zone] = 0;
      
      for (const day of schedule) {
        const hasZone = day.timeSlots.some(slot => 
          slot.zones.some(z => z.name === zone)
        );
        
        if (hasZone) counts[zone]++;
      }
    }
    
    return counts;
  }, [allZones, schedule]);

  // Get zone color map
  const zoneColorMap = React.useMemo(() => {
    const colorMap: Record<string, string> = {};
    
    for (const day of schedule) {
      for (const slot of day.timeSlots) {
        for (const zone of slot.zones) {
          colorMap[zone.name] = zone.color;
        }
      }
    }
    
    return colorMap;
  }, [schedule]);

  // Check if schedule has any data
  const hasScheduledData = React.useMemo(() => {
    return schedule.some(day => day.timeSlots.length > 0);
  }, [schedule]);

  // Find the schedule data for a specific day
  const getScheduleForDay = (dayAbbrev: string) => {
    return schedule.find(s => s.day === dayAbbrev);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-wrap gap-2">
          {allZones.map(zone => (
            <div 
              key={zone} 
              className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded-md"
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: zoneColorMap[zone] }}
              />
              <span className="text-xs font-medium">{zone}</span>
              <Badge variant="secondary" className="ml-0.5 text-[9px] px-1 py-0 h-4">
                {zoneScheduleCounts[zone]} {zoneScheduleCounts[zone] === 1 ? 'day' : 'days'}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 gap-1"
            onClick={toggleDetailedView}
            type="button"
          >
            {showDetailedView ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="text-xs">Compact</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="text-xs">Detailed</span>
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1" type="button">
            <Edit className="h-3.5 w-3.5" />
            <span className="text-xs">Edit</span>
          </Button>
        </div>
      </div>

      {!hasScheduledData && (
        <div className="border rounded-md p-4 flex flex-col items-center justify-center h-36 text-center">
          <p className="text-sm text-muted-foreground mb-2">No mowing schedule defined yet</p>
          <Button variant="outline" size="sm" className="gap-1" type="button">
            <Edit className="h-3.5 w-3.5" />
            <span>Create Schedule</span>
          </Button>
        </div>
      )}

      {hasScheduledData && !showDetailedView && (
        <div className="border rounded-md pb-1 px-1 pt-0.5">
          {/* Calendar view */}
          <div className="grid grid-cols-7 gap-x-1 auto-rows-auto">
            <div className="col-span-7 grid grid-cols-7 mb-0.5">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-center text-xs font-medium h-5 flex items-center justify-center">{day}</div>
              ))}
            </div>
            <div className="col-span-7 grid grid-cols-7 gap-1">
              {daysOfWeek.map((day) => {
                const daySchedule = getScheduleForDay(day);
                const hasSchedule = daySchedule && daySchedule.timeSlots.length > 0;
                
                return (
                  <button 
                    key={`schedule-${day}`} 
                    className={cn(
                      "min-h-[70px] rounded-md p-1.5 flex flex-col justify-between text-xs cursor-pointer",
                      hasSchedule 
                        ? "bg-primary/10 border border-primary/30 hover:bg-primary/20" 
                        : "bg-muted/30 border border-border",
                      expandedDay === day && "bg-primary/20 border-primary ring-1 ring-primary"
                    )}
                    onClick={() => hasSchedule && toggleDay(day)}
                    disabled={!hasSchedule}
                    type="button"
                    aria-label={`${day} schedule`}
                  >
                    {hasSchedule ? (
                      <>
                        <div className="flex flex-col w-full">
                          <div className="flex justify-between items-center w-full">
                            {daySchedule.timeSlots.length > 1 && (
                              <Badge variant="outline" className="p-0 h-4 text-[9px] px-1.5 rounded-sm ml-auto">
                                {daySchedule.timeSlots.length} slots
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-col space-y-0.5 mt-0.5">
                            {daySchedule.timeSlots.slice(0, 2).map((slot, idx) => (
                              <div key={`time-${day}-${slot.startTime}-${idx}`} className="flex flex-col">
                                <span className="font-medium text-[10px] text-center bg-background/60 rounded-sm px-1 py-0.5 mx-auto">
                                  {slot.startTime.substring(0, 5)}-{slot.endTime.substring(0, 5)}
                                </span>
                                <div className="flex gap-1 mt-0.5 justify-center">
                                  {slot.zones.slice(0, 3).map((zone, i) => (
                                    <div 
                                      key={`${day}-${zone.name}-${i}`}
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: zone.color }}
                                      title={zone.name}
                                    />
                                  ))}
                                  {slot.zones.length > 3 && (
                                    <span className="text-[8px] font-medium">+{slot.zones.length - 3}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {daySchedule.timeSlots.length > 2 && (
                              <div className="text-center text-[8px] text-muted-foreground">
                                +{daySchedule.timeSlots.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <span className="opacity-50 text-[10px]">No schedule</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expanded Day View */}
          {expandedDay && (
            <div className="mt-4 p-4 border rounded-md bg-background">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-base font-medium">
                  {expandedDay} Schedule
                </h4>
                <div className="flex items-center gap-2">
                  {(() => {
                    const daySchedule = getScheduleForDay(expandedDay);
                    if (daySchedule && daySchedule.timeSlots.length > 1) {
                      return (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                          {daySchedule.timeSlots.length} sessions
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0" 
                    onClick={() => setExpandedDay(null)}
                    type="button"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(() => {
                  // Find the schedule entry for this day
                  const daySchedule = getScheduleForDay(expandedDay);
                  
                  // If no schedule is found, or there are no time slots, return null
                  if (!daySchedule || daySchedule.timeSlots.length === 0) {
                    return null;
                  }
                  
                  // Map over all time slots for this day
                  return daySchedule.timeSlots.map((slot, idx) => (
                    <div 
                      key={`slot-${slot.startTime}-${idx}`} 
                      className={cn(
                        "flex flex-col p-3 rounded-md border",
                        daySchedule.timeSlots.length > 1 
                          ? "bg-primary/5 border-primary/10" 
                          : "bg-muted/30 border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {(() => {
                            const startParts = slot.startTime.split(':');
                            const endParts = slot.endTime.split(':');
                            if (startParts.length < 2 || endParts.length < 2) return '0 min';
                            
                            const start = new Date();
                            start.setHours(parseInt(startParts[0]), parseInt(startParts[1]), 0);
                            
                            const end = new Date();
                            end.setHours(parseInt(endParts[0]), parseInt(endParts[1]), 0);
                            
                            // Handle times spanning midnight
                            let diff = (end.getTime() - start.getTime()) / (1000 * 60);
                            if (diff < 0) diff += 24 * 60;
                            
                            return `${diff} min`;
                          })()}
                        </Badge>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {slot.zones.map((zone, zoneIdx) => (
                          <Badge 
                            key={`zone-${zone.name}-${zoneIdx}`} 
                            variant="outline" 
                            className="text-[10px] flex items-center gap-1 h-6 bg-muted/30"
                          >
                            <div 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: zone.color }}
                            />
                            {zone.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Schedule View */}
      {hasScheduledData && showDetailedView && (
        <div className="border rounded-md p-4 space-y-4">
          {schedule.filter(day => day.timeSlots.length > 0).map((day) => (
            <Card key={`detailed-${day.day}`} className="p-3 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-medium">{day.day}</h4>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  day.timeSlots.length > 1 ? "bg-primary/10 text-primary border-primary/30" : ""
                )}>
                  {day.timeSlots.length} {day.timeSlots.length === 1 ? 'session' : 'sessions'}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {day.timeSlots.map((slot, slotIdx) => (
                  <div 
                    key={`timeslot-${day.day}-${slot.startTime}-${slotIdx}`} 
                    className={cn(
                      "flex flex-col p-3 rounded-md border", 
                      day.timeSlots.length > 1 ? "bg-primary/5 border-primary/10" : "bg-muted/20 border-border"
                    )}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        {slot.startTime} - {slot.endTime}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          const startParts = slot.startTime.split(':');
                          const endParts = slot.endTime.split(':');
                          if (startParts.length < 2 || endParts.length < 2) return '0 min';
                          
                          const start = new Date();
                          start.setHours(parseInt(startParts[0]), parseInt(startParts[1]), 0);
                          
                          const end = new Date();
                          end.setHours(parseInt(endParts[0]), parseInt(endParts[1]), 0);
                          
                          // Handle times spanning midnight
                          let diff = (end.getTime() - start.getTime()) / (1000 * 60);
                          if (diff < 0) diff += 24 * 60;
                          
                          return `${diff} min`;
                        })()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {slot.zones.map((zone, zoneIdx) => (
                        <Badge 
                          key={`zone-detail-${zone.name}-${zoneIdx}`} 
                          variant="outline" 
                          className="text-[10px] flex items-center gap-1"
                        >
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: zone.color }}
                          />
                          {zone.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 