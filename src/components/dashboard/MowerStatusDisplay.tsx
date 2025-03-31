"use client";

import React from "react";
import { 
  Battery, 
  Wifi, 
  Thermometer, 
  Clock, 
  AlertTriangle, 
  Home, 
  MapPin,
  Power,
  RotateCw,
  Settings
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// Define types based on Husqvarna API response
interface MowerStatusProps {
  name: string;
  model?: string;
  battery: {
    batteryPercent: number;
  };
  mower: {
    mode: "MAIN_AREA" | "SECONDARY_AREA" | "HOME" | "DEMO" | "UNKNOWN";
    activity: "UNKNOWN" | "NOT_APPLICABLE" | "MOWING" | "GOING_HOME" | 
              "CHARGING" | "LEAVING" | "PARKED_IN_CS" | "STOPPED_IN_GARDEN";
    state: "UNKNOWN" | "NOT_APPLICABLE" | "PAUSED" | "IN_OPERATION" | 
           "WAIT_UPDATING" | "WAIT_POWER_UP" | "RESTRICTED" | "OFF" | 
           "STOPPED" | "ERROR" | "FATAL_ERROR" | "ERROR_AT_POWER_UP";
    errorCode: number;
    errorCodeTimestamp: number;
  };
  positions?: {
    latitude: number;
    longitude: number;
  }[];
  connectivity?: {
    signalStrength?: number;
    connectionStatus?: "CONNECTED" | "DISCONNECTED";
  };
  lastSeen?: string;
  className?: string;
}

// Map error codes to readable messages
const getErrorMessage = (errorCode: number): string => {
  const errorMessages: Record<number, string> = {
    0: "No error",
    1: "Outside working area",
    2: "No loop signal",
    3: "Wrong loop signal",
    9: "Trapped",
    10: "Upside down",
    11: "Low battery",
    12: "Empty battery",
    13: "No drive",
    14: "Mower lifted",
    15: "Lifted",
    16: "Stuck in charging station",
    17: "Charging station blocked",
    // Add more error codes as needed
    // This is just a subset of the most common errors
  };

  return errorMessages[errorCode] || `Unknown error (Code: ${errorCode})`;
};

export function MowerStatusDisplay({
  name,
  model,
  battery,
  mower,
  positions,
  connectivity,
  lastSeen,
  className,
}: MowerStatusProps) {
  const isError = mower.state.includes("ERROR") || mower.errorCode > 0;
  
  // Get simplified status for display
  const getSimplifiedStatus = (): "mowing" | "charging" | "parked" | "returning" | "idle" | "error" => {
    if (isError) return "error";
    if (mower.activity === "MOWING") return "mowing";
    if (mower.activity === "CHARGING") return "charging";
    if (mower.activity === "PARKED_IN_CS") return "parked";
    if (mower.activity === "GOING_HOME") return "returning";
    return "idle";
  };

  const status = getSimplifiedStatus();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "mowing":
        return "bg-emerald-500 text-emerald-50";
      case "charging":
        return "bg-blue-500 text-blue-50";
      case "parked":
        return "bg-slate-500 text-slate-50";
      case "returning":
        return "bg-amber-500 text-amber-50";
      case "idle":
        return "bg-yellow-500 text-yellow-50";
      case "error":
        return "bg-red-500 text-red-50";
      default:
        return "bg-slate-500 text-slate-50";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "mowing": return "Mowing";
      case "charging": return "Charging";
      case "parked": return "Parked";
      case "returning": return "Returning";
      case "idle": return "Idle";
      case "error": return "Error";
      default: return "Unknown";
    }
  };

  const getBatteryIcon = (level: number) => {
    return (
      <div className="flex items-center gap-1.5">
        <Battery className={cn(
          "h-4 w-4",
          level < 20 ? "text-red-500" : level < 50 ? "text-amber-500" : "text-emerald-500"
        )} />
        <span>{level}%</span>
      </div>
    );
  };

  const getSignalIcon = (strength?: number) => {
    if (strength === undefined) return null;
    
    return (
      <div className="flex items-center gap-1.5">
        <Wifi className={cn(
          "h-4 w-4",
          strength < 30 ? "text-red-500" : strength < 70 ? "text-amber-500" : "text-emerald-500"
        )} />
        <span>{strength}%</span>
      </div>
    );
  };

  const getModeDescription = (mode: string): string => {
    const modeDescriptions: Record<string, string> = {
      "MAIN_AREA": "Mowing main area according to schedule",
      "SECONDARY_AREA": "Mowing secondary area",
      "HOME": "Staying in charging station",
      "DEMO": "Demo mode (no blade operation)",
      "UNKNOWN": "Unknown mode"
    };
    return modeDescriptions[mode] || mode;
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg font-medium">{name}</CardTitle>
            {model && <p className="text-sm text-muted-foreground">{model}</p>}
          </div>
          <Badge className={getStatusColor(status)}>
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            {getBatteryIcon(battery.batteryPercent)}
          </div>
          {connectivity?.signalStrength && (
            <div className="flex items-center gap-2 text-sm">
              {getSignalIcon(connectivity.signalStrength)}
            </div>
          )}
          {positions && positions.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-foreground/70" />
              <span>Position available</span>
            </div>
          )}
          {lastSeen && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-foreground/70" />
              <span>Last seen: {lastSeen}</span>
            </div>
          )}
        </div>
        
        <Separator className="my-2" />
        
        <div className="space-y-3">
          <TooltipProvider>
            <div className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Mode:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium">{mower.mode}</span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{getModeDescription(mower.mode)}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Power className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Activity:</span>
              <span className="font-medium">{mower.activity.replace(/_/g, " ")}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <RotateCw className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">State:</span>
              <span className="font-medium">{mower.state.replace(/_/g, " ")}</span>
            </div>
          </TooltipProvider>
        </div>
        
        {isError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {getErrorMessage(mower.errorCode)}
                </p>
                {mower.errorCodeTimestamp > 0 && (
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                    Error occurred: {new Date(mower.errorCodeTimestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-1 pb-3">
        <div className="w-full text-xs text-muted-foreground">
          {mower.activity === "MOWING" && "Currently mowing lawn"}
          {mower.activity === "CHARGING" && "Connected to charging station"}
          {mower.activity === "PARKED_IN_CS" && "Parked at charging station"}
          {mower.activity === "GOING_HOME" && "Returning to charging station"}
          {mower.activity === "STOPPED_IN_GARDEN" && "Stopped and waiting for action"}
          {isError && "Requires attention: check error details"}
        </div>
      </CardFooter>
    </Card>
  );
}

// Usage example
export default function MowerStatusDisplayExample() {
  return (
    <div className="p-4 space-y-4">
      <MowerStatusDisplay
        name="Front Yard Mower"
        model="Husqvarna Automower 450X"
        battery={{ batteryPercent: 78 }}
        mower={{
          mode: "MAIN_AREA",
          activity: "MOWING",
          state: "IN_OPERATION",
          errorCode: 0,
          errorCodeTimestamp: 0
        }}
        connectivity={{ signalStrength: 92 }}
        lastSeen="10 minutes ago"
      />
      
      <MowerStatusDisplay
        name="Back Yard Mower"
        model="Husqvarna Automower 315X"
        battery={{ batteryPercent: 42 }}
        mower={{
          mode: "HOME",
          activity: "CHARGING",
          state: "IN_OPERATION",
          errorCode: 0,
          errorCodeTimestamp: 0
        }}
        connectivity={{ signalStrength: 85 }}
        lastSeen="5 minutes ago"
      />
      
      <MowerStatusDisplay
        name="Garden Bot"
        model="Husqvarna Automower 310"
        battery={{ batteryPercent: 15 }}
        mower={{
          mode: "UNKNOWN",
          activity: "UNKNOWN",
          state: "ERROR",
          errorCode: 10,
          errorCodeTimestamp: Date.now() - 1000 * 60 * 30 // 30 minutes ago
        }}
        connectivity={{ signalStrength: 28 }}
        lastSeen="30 minutes ago"
      />
    </div>
  );
} 