"use client";

import React, { useState, useEffect } from "react";
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
import { useAuth } from '@/components/layout/AuthProvider';
import { getMowerData } from '@/lib/firestoreDB';

export function MiniMap({ mowerId, currentZone, batteryLevel, areaComplete }: MiniMapProps) {
  const [fullScreen, setFullScreen] = useState(false);
  const [mowerLocation, setMowerLocation] = useState<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    direction: number;
    batteryLevel: number;
    areaComplete: string;
    status: "mowing" | "charging" | "idle" | "error" | "offline" | "returning" | "parked" | "online" | "paused";
  }>({
    id: mowerId || "default-mower",
    name: "Mower",
    lat: 40.712776, // Default coordinates
    lng: -74.005974,
    direction: 45,
    batteryLevel: batteryLevel || 75,
    areaComplete: areaComplete || "65%",
    status: "parked" as const, // Default status
  });
  
  const { token } = useAuth();
  
  // Use a ref to track whether we've already fetched data
  const hasFetchedRef = React.useRef(false);
  
  // Fetch mower data from Firebase instead of API - use stable dependency array
  useEffect(() => {
    if (!mowerId || hasFetchedRef.current) return;
    
    const fetchMowerFromFirebase = async () => {
      try {
        hasFetchedRef.current = true;
        
        // Use the utility function to get mower data from Firestore
        const result = await getMowerData(mowerId);
        
        if (result.success && result.data) {
          const mowerData = result.data;
          
          // Check if we have position data
          if (mowerData.position && mowerData.position.latitude && mowerData.position.longitude) {
            // Get mower activity and state for status determination
            let status: "mowing" | "charging" | "idle" | "error" | "offline" | "returning" | "parked" | "online" | "paused" = "parked";
            
            // Determine status based on mower data
            if (mowerData.mower) {
              const mowerState = mowerData.mower.state?.toLowerCase();
              const activity = mowerData.mower.activity?.toLowerCase();
              
              if (mowerData.mower.errorCode > 0) {
                status = 'error';
              } else if (activity === 'mowing') {
                status = 'mowing';
              } else if (activity === 'charging') {
                status = 'charging';
              } else if (activity === 'going_home' || activity === 'going home') {
                status = 'returning';
              } else if (activity === 'parked_in_cs' || activity === 'parked in cs') {
                status = 'parked';
              } else if (activity === 'stopped_in_garden' || activity === 'stopped in garden') {
                status = 'idle';
              } else if (mowerState === 'paused') {
                status = 'paused';
              } else if (activity === 'leaving') {
                status = 'online';
              } else {
                status = 'idle';
              }
            }
            
            // Update the mower location state with actual coordinates and status
            setMowerLocation({
              id: mowerId,
              name: mowerData.name || "Mower",
              lat: mowerData.position.latitude,
              lng: mowerData.position.longitude,
              direction: 45, // Direction is typically not provided
              // Use props value first, fall back to Firebase data
              batteryLevel: batteryLevel ?? (mowerData.battery?.batteryPercent || 75),
              areaComplete: areaComplete ?? "0%",
              status: status
            });
          }
        }
      } catch (error) {
        console.error('Error fetching mower data from Firebase:', error);
        // Keep using default values on error
      }
    };
    
    fetchMowerFromFirebase();
  }, [mowerId]);
  
  // Calculate battery color based on level - memoize to prevent recreation
  const getBatteryColor = React.useCallback((level: number) => {
    if (level > 60) return "bg-emerald-500";
    if (level > 30) return "bg-amber-500";
    return "bg-red-500";
  }, []);

  // Parse percentage from areaComplete - memoize to prevent recreation
  const parsePercentage = React.useCallback((value?: string) => {
    return value ? Number.parseInt(value.replace('%', '').trim()) : 0;
  }, []);
  
  // Update battery level and area complete when props change without refetching
  useEffect(() => {
    setMowerLocation(prev => ({
      ...prev,
      batteryLevel: batteryLevel ?? prev.batteryLevel,
      areaComplete: areaComplete ?? prev.areaComplete
    }));
  }, [batteryLevel, areaComplete]);

  // Memoize the mower data for GoogleMapView to prevent unnecessary rerenders
  const mowerData = React.useMemo(() => [mowerLocation], [mowerLocation]);

  return (
    <>
      <div className="w-full h-full bg-slate-900 relative">
        {/* Use GoogleMapView component directly now */}
        <GoogleMapView 
          height="100%"
          mowers={mowerData}
          className="w-full h-full"
          zoom={19} // Increase zoom level to see the mower better
          center={{ lat: mowerLocation.lat, lng: mowerLocation.lng }} // Center on the mower's location
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
            <DialogTitle>Mower Location Map</DialogTitle>
            <DialogDescription>View your mower location on the property map</DialogDescription>
          </DialogHeader>
          <div className="relative w-full h-full">
            <GoogleMapView 
              height="100%" 
              mowers={mowerData}
              className="w-full h-full"
              zoom={19} // Increase zoom level for fullscreen view too
              center={{ lat: mowerLocation.lat, lng: mowerLocation.lng }} // Center on the mower's location
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