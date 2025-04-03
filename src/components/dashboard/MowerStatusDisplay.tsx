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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDashboard } from "@/hooks/useDashboard";
import { GpsIcon, MapPinIcon, MowerTypeIcon } from "@/components/icons";
import { TabbedView } from "./TabbedView";
import { MapView } from "./mower-stats/MapView";
import { StatisticsView } from "./mower-stats/StatisticsView";
import { MowerName } from "./MowerName";
import { ErrorCodeBadge } from "./ErrorCodeBadge";
import { Button } from "@/components/ui/button";
import { PlayCircle, PauseCircle, HomeIcon, MoreHorizontal, Zap } from "lucide-react";
import { MowerBatteryIndicator } from "./MowerBatteryIndicator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "react-hot-toast";
import { sendMowerCommand } from "@/lib/husqvarna/commands";
import { CommandButton } from "./CommandButton";
import { MowerMoreActions } from "./MowerMoreActions";
import { MowerAlertBanner } from "./MowerAlertBanner";

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
  isOffline?: boolean;
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

export function MowerStatusDisplay() {
  const { selectedMowerId, mowerData, refreshSchedule } = useDashboard();
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  const selectedMower = React.useMemo(() => {
    if (!selectedMowerId || !mowerData || !Array.isArray(mowerData)) {
      console.log('[MowerStatusDisplay] No mower selected or mower data not available');
      return null;
    }
    
    const mower = mowerData.find(m => m.id === selectedMowerId);
    if (!mower) {
      console.log(`[MowerStatusDisplay] Mower with ID ${selectedMowerId} not found in mowerData`);
      return null;
    }
    
    console.log(`[MowerStatusDisplay] Selected mower: ${mower.name}, has schedule:`, 
      mower.schedule && Array.isArray(mower.schedule) && mower.schedule.length > 0);
    
    return mower;
  }, [selectedMowerId, mowerData]);

  const renderTabContent = React.useCallback((tab: string) => {
    switch (tab) {
      case "schedule":
        return (
          <div className="p-4 border rounded-md text-center">
            <p className="text-sm text-muted-foreground">Schedule view has been moved to the new unified MowerSchedule component.</p>
          </div>
        );
      case "map":
        return (
          <MapView
            position={selectedMower?.position}
            zones={selectedMower?.zones || []}
            isConnected={selectedMower?.isConnected} 
          />
        );
      case "statistics":
        return <StatisticsView statistics={selectedMower?.statistics} />;
      default:
        return <div>Select a tab to view content</div>;
    }
  }, [selectedMower]);

  return (
    <Card className={cn("w-full")}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg font-medium">{selectedMower?.name}</CardTitle>
            {selectedMower?.model && <p className="text-sm text-muted-foreground">{selectedMower?.model}</p>}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        {/* Two-column layout with mower on left, status on right */}
        <div className="flex gap-4 mb-3">
          {/* Mower Image */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <Image 
              src={`/images/mower-${selectedMower?.status === 'error' ? 'red' : 'gray'}.png`}
              alt={selectedMower?.name}
              className="object-contain"
              fill
              sizes="96px"
            />
          </div>
          
          {/* Status info */}
          <div className="flex-1">
            <Badge className={cn(
              "bg-emerald-500 text-emerald-50",
              selectedMower?.status === "offline" && "bg-red-500 text-red-50",
              selectedMower?.status === "error" && "bg-red-500 text-red-50"
            )}>
              {selectedMower?.status === "offline" && (
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
              )}
              {selectedMower?.status === "error" && (
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
              {selectedMower?.status === "mowing" && "Mowing"}
              {selectedMower?.status === "charging" && "Charging"}
              {selectedMower?.status === "parked" && "Parked"}
              {selectedMower?.status === "returning" && "Returning"}
              {selectedMower?.status === "idle" && "Idle"}
              {selectedMower?.status === "paused" && "Paused"}
              {selectedMower?.status === "online" && "Online"}
            </Badge>
            
            {selectedMower?.isOffline && (
              <div className="mt-2 text-xs text-red-500 flex items-center">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Connection lost - Controls disabled
              </div>
            )}
          </div>
        </div>
        
        {/* Battery and positioning info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MowerBatteryIndicator level={selectedMower?.batteryPercent || 0} />
          </div>
          {selectedMower?.errorCode > 0 && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-red-500 font-medium">
                    {getErrorMessage(selectedMower?.errorCode || 0)} (Code: {selectedMower?.errorCode})
                  </p>
                  {selectedMower?.errorCodeTimestamp > 0 && (
                    <p className="text-xs text-red-500/80 mt-1">
                      Error occurred: {new Date(selectedMower?.errorCodeTimestamp || 0).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <Separator className="my-2" />
        
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Mode:</span>
            <span className="font-medium">{selectedMower?.mode}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Activity:</span>
            <span className="font-medium">{selectedMower?.activity.replace(/_/g, " ")}</span>
          </div>
          
          {selectedMower?.lastSeen && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Last seen:</span>
              <span className="font-medium">{selectedMower?.lastSeen}</span>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-1 pb-3">
        <div className="w-full text-xs text-muted-foreground">
          {selectedMower?.isOffline && "Mower is currently offline and not connected"}
          {!selectedMower?.isOffline && selectedMower?.activity === "MOWING" && "Currently mowing lawn"}
          {!selectedMower?.isOffline && selectedMower?.activity === "CHARGING" && "Connected to charging station"}
          {!selectedMower?.isOffline && selectedMower?.activity === "PARKED_IN_CS" && "Parked at charging station"}
          {!selectedMower?.isOffline && selectedMower?.activity === "GOING_HOME" && "Returning to charging station"}
          {!selectedMower?.isOffline && selectedMower?.activity === "STOPPED_IN_GARDEN" && "Stopped and waiting for action"}
          {!selectedMower?.isOffline && selectedMower?.status === "error" && "Requires attention: check error details"}
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