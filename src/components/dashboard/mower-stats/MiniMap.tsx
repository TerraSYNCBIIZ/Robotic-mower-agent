"use client";

import React, { useState } from "react";
import { Maximize2, Minimize2, Battery, Crop } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { GoogleMapView } from "@/components/dashboard/GoogleMapView";
import type { MiniMapProps } from "./types";

export function MiniMap({ mowerId, currentZone, batteryLevel, areaComplete }: MiniMapProps) {
  const [fullScreen, setFullScreen] = useState(false);
  
  // Mock mower location for the map using the format expected by GoogleMapView
  const mowerLocation = {
    id: mowerId || "default-mower",
    name: "Mower",
    lat: 40.712776, // Default coordinates
    lng: -74.005974,
    direction: 45,
    batteryLevel: batteryLevel || 75,
    areaComplete: areaComplete || "65%",
    status: "mowing" as const,
  };

  // Calculate battery color based on level
  const getBatteryColor = (level: number) => {
    if (level > 60) return "bg-emerald-500";
    if (level > 30) return "bg-amber-500";
    return "bg-red-500";
  };

  // Parse percentage from areaComplete
  const parsePercentage = (value?: string) => {
    return value ? Number.parseInt(value.replace('%', '').trim()) : 0;
  };

  return (
    <>
      <div className="w-full h-full bg-slate-900 relative">
        {/* Use GoogleMapView component directly now */}
        <GoogleMapView 
          height="100%"
          mowers={[mowerLocation]}
          className="w-full h-full"
        />
        
        {/* Zone label */}
        {currentZone && (
          <div className="absolute top-1 right-1 bg-background/80 text-[10px] rounded px-1 py-0.5 text-foreground font-medium">
            {currentZone}
          </div>
        )}
        
        {/* Fullscreen button - overlaid directly on map */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute bottom-2 right-2 h-7 w-7 bg-background/50 backdrop-blur-sm hover:bg-background/80 rounded-full"
          onClick={() => setFullScreen(true)}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="sr-only">Fullscreen</span>
        </Button>
      </div>
      
      {/* Fullscreen map dialog */}
      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent className="max-w-5xl h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Property Map</DialogTitle>
            <DialogDescription>View your mower location on the property map</DialogDescription>
          </DialogHeader>
          <div className="relative w-full h-full">
            <GoogleMapView 
              height="100%" 
              mowers={[mowerLocation]}
              className="w-full h-full"
            />
            
            {/* Minimize button - overlaid directly on map */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1 h-8 w-8 bg-background/50 backdrop-blur-sm hover:bg-background/80 rounded-full z-10 border-none shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setFullScreen(false)}
            >
              <Minimize2 className="h-4 w-4" />
              <span className="sr-only">Minimize</span>
            </Button>
            
            {/* Title and status indicators - overlaid directly on map */}
            <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-md px-3 py-2 z-10 w-64">
              <h3 className="text-sm font-medium mb-2">{mowerLocation.name}</h3>
              
              {/* Battery Level */}
              <div className="space-y-1 mb-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Battery className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Battery</span>
                  </div>
                  <span className={(batteryLevel || 0) > 60 ? "text-emerald-500" : (batteryLevel || 0) > 30 ? "text-amber-500" : "text-red-500"}>
                    {batteryLevel || 0}%
                  </span>
                </div>
                <Progress 
                  value={batteryLevel || 0} 
                  className={cn("h-1.5", getBatteryColor(batteryLevel || 0))}
                />
              </div>
              
              {/* Area Completion */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Crop className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Area Complete</span>
                  </div>
                  <span className="text-muted-foreground">{areaComplete}</span>
                </div>
                <Progress 
                  value={parsePercentage(areaComplete)} 
                  className="h-1.5 bg-primary/20"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 