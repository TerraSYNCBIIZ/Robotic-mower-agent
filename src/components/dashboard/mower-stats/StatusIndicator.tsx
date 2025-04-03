"use client";

import React from "react";
import { Battery, BatteryCharging, AlertCircle, Home, Pause, Play, PowerOff, RefreshCw, MoveDownLeft, MoveUpRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatusIndicatorProps {
  status?: string;
  isPending?: boolean;
  pendingDescription?: string;
  batteryLevel?: number;
  isChargingWhileParked?: boolean;
  nextStartTime?: string;
}

// Create a component for the pulsing dot
function PulsingDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-3 w-3", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
    </span>
  );
}

export function StatusIndicator({ 
  status = 'offline', 
  isPending = false, 
  pendingDescription = 'Processing command...', 
  batteryLevel = 0,
  isChargingWhileParked = false,
  nextStartTime
}: StatusIndicatorProps) {
  // Update the offline status configuration
  const getStatusConfig = () => {
    switch (status) {
      case "mowing":
        return { 
          label: "Mowing", 
          color: "bg-emerald-500", 
          textColor: "text-emerald-500", 
          icon: Play,
          className: "border-emerald-500 bg-emerald-500/10 text-emerald-500"
        };
      case "charging":
        return { 
          label: "Charging", 
          color: "bg-blue-500", 
          textColor: "text-blue-500", 
          icon: BatteryCharging,
          className: "border-blue-500 bg-blue-500/10 text-blue-500"
        };
      case "parked":
        return { 
          label: "Parked", 
          color: "bg-slate-500", 
          textColor: "text-slate-500", 
          icon: Home,
          className: "border-slate-500 bg-slate-500/10 text-slate-500"
        };
      case "returning":
        return { 
          label: "Returning Home", 
          color: "bg-indigo-500", 
          textColor: "text-indigo-500", 
          icon: MoveDownLeft,
          className: "border-indigo-500 bg-indigo-500/10 text-indigo-500"
        };
      case "leaving":
        return { 
          label: "Leaving Station", 
          color: "bg-cyan-500", 
          textColor: "text-cyan-500", 
          icon: MoveUpRight,
          className: "border-cyan-500 bg-cyan-500/10 text-cyan-500"
        };
      case "idle":
        return { 
          label: "Idle", 
          color: "bg-gray-400", 
          textColor: "text-gray-400", 
          icon: Pause,
          className: "border-gray-400 bg-gray-400/10 text-gray-400"
        };
      case "error":
        return { 
          label: "Error", 
          color: "bg-red-500", 
          textColor: "text-red-500", 
          icon: AlertCircle,
          className: "border-red-500 bg-red-500/10 text-red-500"
        };
      case "offline":
        return { 
          label: "Offline", 
          color: "bg-red-500", 
          textColor: "text-red-500", 
          icon: PowerOff,
          className: "border-red-500 bg-red-500/10 text-red-500",
          pulsing: true
        };
      case "online":
        return { 
          label: "Online", 
          color: "bg-emerald-500", 
          textColor: "text-emerald-500", 
          icon: Play,
          className: "border-emerald-500 bg-emerald-500/10 text-emerald-500"
        };
      case "paused":
        return { 
          label: "Paused", 
          color: "bg-amber-500", 
          textColor: "text-amber-500", 
          icon: Pause,
          className: "border-amber-500 bg-amber-500/10 text-amber-500"
        };
      default:
        return { 
          label: "Unknown", 
          color: "bg-gray-400", 
          textColor: "text-gray-400", 
          icon: AlertCircle,
          className: "border-gray-400 bg-gray-400/10 text-gray-400"
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const isOffline = status === 'offline';

  return (
    <div className="space-y-2">
      <Badge
        variant="outline"
        className={cn(
          "font-semibold w-full justify-center py-2 text-sm",
          isPending ? "border-amber-500 bg-amber-500/10 text-amber-500" : statusConfig.className
        )}
      >
        {isPending ? (
          <>
            <div className="animate-spin mr-2">
              <RefreshCw className="h-4 w-4" />
            </div>
            {pendingDescription}
          </>
        ) : (
          <>
            {statusConfig.pulsing ? (
              <span className="relative flex h-3 w-3 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
            ) : (
              <StatusIcon className="mr-2 h-4 w-4" />
            )}
            {statusConfig.label}
            
            {/* Show charging indicator for parked mowers with battery < 100% */}
            {status === "parked" && isChargingWhileParked && (
              <span className="ml-2 text-blue-500 flex items-center">
                <BatteryCharging className="h-3 w-3 mr-0.5 animate-pulse" />
                <span className="text-xs">(Charging)</span>
              </span>
            )}
          </>
        )}
      </Badge>
      
      {/* Only show the warning message when offline */}
      {isOffline && !isPending && (
        <div className="text-xs flex items-center justify-center text-red-500 mt-2 gap-1.5 p-1.5 bg-red-500/10 rounded-md border border-red-500/20">
          <AlertCircle className="h-3 w-3" />
          <span>Connection lost - Controls disabled</span>
        </div>
      )}
      
      {/* Show next start time info for parked, charging, or other inactive states */}
      {nextStartTime && !isPending && !isOffline && (status === 'parked' || status === 'charging' || status === 'idle') && (
        <div className="text-xs flex items-center justify-center text-muted-foreground mt-1 gap-1.5">
          <Clock className="h-3 w-3" />
          <span>Next start: <span className="font-medium text-primary">{nextStartTime}</span></span>
        </div>
      )}
    </div>
  );
} 