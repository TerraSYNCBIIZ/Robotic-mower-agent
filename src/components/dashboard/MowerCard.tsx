'use client';

import React, { useEffect, useState } from "react";
import { Battery, Clock, Gauge, AlertCircle, Play, Pause, Wrench, RefreshCw, Tag, AlertTriangle, BatteryCharging, Home, CornerDownLeft, CornerUpRight, Wifi } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { getTimeAgo } from '@/lib/utils';
import { MowerAreaCompletion } from "./MowerAreaCompletion";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface MowerCardProps {
  name: string;
  status: "idle" | "mowing" | "charging" | "error" | "offline" | "returning" | "parked" | "online" | "paused" | "leaving";
  batteryLevel: number;
  areaComplete: string;
  nextMaintenance: number;
  errorMessage?: string | null;
  imageSrc?: string;
  className?: string;
  id?: string;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  lastUpdated?: Date;
  lastChanged?: Date | number;
  showChangedTimeOnly?: boolean;
  dataSource?: 'websocket' | 'api_poll' | 'dashboard_refresh' | string;
  categories?: Category[];
  pendingCommand?: {
    command: string;
    sentAt: Date;
    description?: string;
  };
  isChargingWhileParked?: boolean;
  nextStartTime?: string;
}

// Add this ChargingIndicator component
const ChargingIndicator = ({ batteryLevel }: { batteryLevel: number }) => {
  return (
    <div className="mt-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center">
      <div className="mr-2 relative">
        <BatteryCharging className="h-4 w-4 text-blue-500" />
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
      </div>
      <div className="flex-1">
        <p className="text-xs text-blue-500 font-medium">Charging</p>
        <p className="text-xs text-muted-foreground">Battery at {batteryLevel}%</p>
      </div>
    </div>
  );
};

// Add this component for the red offline dot
const OfflineIndicator = () => {
  return (
    <div className="flex items-center">
      <span className="relative flex h-3 w-3 mr-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
      </span>
      <span className="text-xs font-medium text-red-600">Offline</span>
    </div>
  );
};

export function MowerCard({
  name,
  status,
  batteryLevel,
  areaComplete,
  nextMaintenance,
  errorMessage,
  imageSrc,
  className,
  id,
  isSelected = false,
  onSelect,
  lastUpdated,
  lastChanged,
  showChangedTimeOnly = true,
  dataSource,
  categories = [],
  pendingCommand,
  isChargingWhileParked,
  nextStartTime,
}: MowerCardProps) {
  // Add state to track area completion locally for better persistence
  const [localAreaComplete, setLocalAreaComplete] = useState<string>(areaComplete || 'N/A');
  
  // Update local state when prop changes
  useEffect(() => {
    if (areaComplete && areaComplete !== 'N/A') {
      setLocalAreaComplete(areaComplete);
    }
  }, [areaComplete]);
  
  // Listen for area completion update events
  useEffect(() => {
    if (!id) return;
    
    const handleAreaCompletionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === id) {
        setLocalAreaComplete(customEvent.detail.areaComplete);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mower-area-completion-updated', handleAreaCompletionUpdate);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mower-area-completion-updated', handleAreaCompletionUpdate);
      }
    };
  }, [id]);

  const getStatusConfig = () => {
    switch (status) {
      case "mowing":
        return {
          label: "Mowing",
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          icon: Gauge
        };
      case "charging":
        return {
          label: "Charging",
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
          icon: BatteryCharging
        };
      case "parked":
        return {
          label: "Parked",
          color: "text-slate-500",
          bgColor: "bg-slate-500/10",
          borderColor: "border-slate-500/20",
          icon: Home
        };
      case "returning":
        return {
          label: "Returning Home",
          color: "text-indigo-500",
          bgColor: "bg-indigo-500/10",
          borderColor: "border-indigo-500/20",
          icon: CornerDownLeft
        };
      case "leaving":
        return {
          label: "Leaving Station",
          color: "text-cyan-500",
          bgColor: "bg-cyan-500/10",
          borderColor: "border-cyan-500/20",
          icon: CornerUpRight
        };
      case "error":
        return {
          label: "Error",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
          icon: AlertTriangle
        };
      case "offline":
        return {
          label: "Offline",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
          icon: Wifi,
          pulsing: true // Add pulsing flag for offline status
        };
      case "online":
        return {
          label: "Online",
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          icon: Gauge
        };
      case "paused":
        return {
          label: "Paused",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/20",
          icon: Pause
        };
      default:
        return {
          label: "Idle",
          color: "text-gray-400",
          bgColor: "bg-gray-400/10",
          borderColor: "border-gray-400/20",
          icon: Pause
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const batteryColorClass = 
    batteryLevel > 60 
      ? "bg-emerald-500" 
      : batteryLevel > 30 
      ? "bg-amber-500" 
      : "bg-red-500";

  const batteryTextClass = 
    batteryLevel > 60 
      ? "text-emerald-500" 
      : batteryLevel > 30 
      ? "text-amber-500" 
      : "text-red-500";

  const batteryBgClass = 
    batteryLevel > 60 
      ? "bg-emerald-500/20" 
      : batteryLevel > 30 
      ? "bg-amber-500/20" 
      : "bg-red-500/20";

  const handleClick = () => {
    if (id && onSelect) {
      onSelect(id);
    }
  };

  // Map color names to actual Tailwind classes
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "bg-red-500",
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      pink: "bg-pink-500",
      gray: "bg-gray-500",
    };
    return colorMap[color] || "bg-gray-500";
  };

  // Helper function to determine which timestamp to display
  const getDisplayTimestamp = () => {
    if (showChangedTimeOnly) {
      return lastChanged ? lastChanged : lastUpdated;
    }
    return lastUpdated;
  };
  
  // Format the timestamp for display
  const formattedTime = () => {
    const timestamp = getDisplayTimestamp();
    if (!timestamp) return null;
    
    // Format as "X minutes/hours ago"
    return getTimeAgo(timestamp);
  };
  
  // Get timestamp caption
  const getTimeCaption = () => {
    if (showChangedTimeOnly && lastChanged) {
      return 'Changed:';
    }
    return 'Updated:';
  };

  // Add this function to get a description of the pending command
  const getPendingCommandDescription = () => {
    if (!pendingCommand) return null;
    
    console.log(`[MowerCard ${name}] Processing pendingCommand:`, pendingCommand);
    
    if (pendingCommand.description) {
      return pendingCommand.description;
    }
    
    // Generate a standard description if none provided
    switch (pendingCommand.command) {
      case 'Start':
      case 'StartInWorkArea':
        return 'Starting mower...';
      case 'Pause':
        return 'Pausing mower...';
      case 'Park':
      case 'ParkUntilNextSchedule':
      case 'ParkUntilFurtherNotice':
        return 'Sending mower home...';
      case 'ResumeSchedule':
        return 'Resuming schedule...';
      default:
        return `Command "${pendingCommand.command}" sent...`;
    }
  };

  // Add this function to get time elapsed since command was sent
  const getCommandWaitTime = () => {
    if (!pendingCommand?.sentAt) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - pendingCommand.sentAt.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) {
      return `${diffSec}s ago`;
    }
    
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ${diffSec % 60}s ago`;
  };

  // Add debugging for pendingCommand prop
  React.useEffect(() => {
    console.log(`[MowerCard ${name}] pendingCommand status:`, pendingCommand ? `${pendingCommand.command} (${pendingCommand.description})` : 'none');
  }, [pendingCommand, name]);

  // Check for charging while parked
  const isChargingParked = (status === 'parked' && batteryLevel < 100) || 
    // @ts-ignore - This might be a custom field from the dashboard
    (status === 'parked' && typeof isChargingWhileParked === 'boolean' && isChargingWhileParked);

  return (
    <Card 
      className={cn(
        "overflow-hidden border-border h-full", 
        isSelected && "ring-2 ring-primary",
        id && onSelect && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      onClick={handleClick}
    >
      {imageSrc && (
        <div className="relative w-full h-32">
          <Image
            src={imageSrc}
            alt={name}
            className="object-contain"
            fill
            priority={id === "m1"}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
        </div>
      )}

      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium truncate">{name}</h3>
        </div>
        
        {/* Status badge - updated for offline with pulse effect */}
        <Badge
          variant="outline"
          className={cn(
            "font-normal whitespace-nowrap",
            pendingCommand ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : statusConfig.color,
            pendingCommand ? "bg-amber-500/10" : statusConfig.bgColor,
            pendingCommand ? "border-amber-500/20" : statusConfig.borderColor,
            "w-full justify-center py-1.5 my-1 flex items-center"
          )}
        >
          {pendingCommand ? (
            <>
              <span className="h-2 w-2 mr-2 rounded-full bg-amber-500 animate-pulse"></span>
              {getPendingCommandDescription()}
            </>
          ) : (
            <>
              {statusConfig.pulsing ? (
                // Add pulsing dot for offline status
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
              ) : (
                <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
              )}
              {statusConfig.label}
              
              {/* Show charging indicator for parked mowers with battery < 100% */}
              {status === "parked" && (
                <>
                  {isChargingParked ? (
                    <span className="ml-1 text-blue-500 flex items-center">
                      <BatteryCharging className="h-3 w-3 mr-0.5 animate-pulse" />
                      <span className="text-xs">(Charging)</span>
                    </span>
                  ) : null}
                </>
              )}
            </>
          )}
        </Badge>
        
        {/* Ensure error message shows the code if available */}
        {status === "error" && errorMessage && (
          <div className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-md mt-2">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-1.5 flex-shrink-0" />
              <p className="text-xs text-red-500">{errorMessage}</p>
            </div>
          </div>
        )}
        
        {/* Pending command wait time */}
        {pendingCommand && (
          <div className="text-xs text-center text-muted-foreground mt-1">
            Command sent {getCommandWaitTime()} - Waiting for confirmation
          </div>
        )}
        
        {/* Zones/Categories section - more prominent display */}
        {categories.length > 0 ? (
          <div className="flex flex-col mt-2">
            <div className="flex items-center text-xs text-muted-foreground mb-1">
              <Tag className="h-3.5 w-3.5 mr-1" />
              <span>Work Areas:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <Badge
                  key={category.id}
                  variant="outline"
                  className="py-0.5 px-2 h-6 flex items-center gap-1.5 bg-secondary/50"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium text-xs">{category.name}</span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-4 pt-0 pb-0 space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Battery</span>
            <span className={batteryTextClass}>
              {batteryLevel}%
            </span>
          </div>
          <div className={cn("w-full h-1.5 rounded-full overflow-hidden", batteryBgClass)}>
            <div
              className={cn("h-full rounded-full", batteryColorClass)}
              style={{ width: `${batteryLevel}%` }}
            />
          </div>
        </div>

        {/* Use the new MowerAreaCompletion component */}
        {id ? (
          <MowerAreaCompletion mowerId={id} initialValue={areaComplete} />
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Area Complete</span>
              <span className="text-muted-foreground">{areaComplete}</span>
            </div>
            {areaComplete && areaComplete !== 'N/A' ? (
              <div className={cn("w-full h-1.5 rounded-full overflow-hidden", "bg-emerald-500/20")}>
                <div
                  className={cn("h-full rounded-full", "bg-emerald-500")}
                  style={{ 
                    width: `${Math.min(Math.max(parseInt(areaComplete.replace('%', ''), 10) || 0, 1), 100)}%` 
                  }}
                />
              </div>
            ) : (
              <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-600/20">
                <div className="h-full bg-gray-300 dark:bg-gray-500/20 rounded-full w-full text-[8px] flex items-center justify-center overflow-hidden">
                  <span className="text-muted-foreground truncate px-1">Not Available</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next start time */}
        {nextStartTime && status !== 'mowing' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                Next start
              </span>
              <span className="text-primary">{nextStartTime}</span>
            </div>
          </div>
        )}
        
        {/* Show charging indicator for parked mowers with battery < 100% */}
        {status === "parked" && isChargingParked && (
          <ChargingIndicator batteryLevel={batteryLevel} />
        )}
      </CardContent>

      <CardFooter className="p-4 pt-2 flex-col space-y-3">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center text-xs text-muted-foreground">
            <Wrench className="mr-1 h-3 w-3" />
            <span>Maintenance in {nextMaintenance} days</span>
          </div>
          
          <Link href={`/chat?mower=${name}`}>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-2 text-primary"
            >
              Chat
            </Button>
          </Link>
        </div>
        
        {formattedTime() && (
          <div className="w-full flex items-center justify-between border-t border-border pt-2">
            <div className="flex items-center text-xs text-muted-foreground">
              <span>{getTimeCaption()}</span> {formattedTime()}
            </div>
            
            {dataSource && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-secondary/30 hover:bg-secondary/40">
                      {dataSource === 'websocket' ? 'Live' : 
                       dataSource === 'api_poll' ? 'API' : 
                       dataSource === 'dashboard_refresh' ? 'Full Refresh' : 
                       dataSource}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover border border-border text-popover-foreground">
                    <p className="text-xs">
                      {dataSource === 'websocket' ? 'Live WebSocket data' : 
                       dataSource === 'api_poll' ? 'Regular API poll' : 
                       dataSource === 'dashboard_refresh' ? 'Full dashboard refresh' : 
                       `Source: ${dataSource}`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 