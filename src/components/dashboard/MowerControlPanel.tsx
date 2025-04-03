"use client"

import * as React from "react"
import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Home, Pause, Play, Power, PowerOff, RefreshCw, Timer, TimerOff } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffect, useState } from "react"

interface MowerStatus {
  status: 'mowing' | 'paused' | 'parked' | 'charging' | 'idle' | 'error' | 'offline'
  batteryLevel: number
  lastActive: string
  nextScheduled: string | null
  errorMessage?: string
}

interface MowerControlPanelProps {
  mowerName: string
  status: MowerStatus
  onStart: () => void
  onPause: () => void
  onParkUntilNext: () => void
  onParkUntilFurtherNotice: () => void
  onResumeSchedule: () => void
  onRefresh: () => void
  className?: string
}

// New interface for props coming from the dashboard
interface MowerControlPanelAdapterProps {
  mowerId: string
  onCommand: (command: string, duration?: number) => Promise<{success: boolean, message: string} | null>
  className?: string
}

const getBatteryIcon = (level: number) => {
  if (level <= 20) return <BatteryWarning className="h-5 w-5 text-destructive" />
  if (level <= 40) return <BatteryLow className="h-5 w-5 text-amber-500" />
  if (level <= 70) return <BatteryMedium className="h-5 w-5 text-amber-400" />
  if (level <= 99) return <Battery className="h-5 w-5 text-emerald-500" />
  return <BatteryFull className="h-5 w-5 text-emerald-500" />
}

const getStatusBadge = (status: MowerStatus['status']) => {
  switch (status) {
    case 'mowing':
      return <Badge variant="default" className="bg-emerald-600">Mowing</Badge>
    case 'paused':
      return <Badge variant="outline" className="border-amber-500 text-amber-500">Paused</Badge>
    case 'parked':
      return <Badge variant="secondary">Parked</Badge>
    case 'charging':
      return <Badge variant="outline" className="border-blue-500 text-blue-500">Charging</Badge>
    case 'idle':
      return <Badge variant="outline">Idle</Badge>
    case 'error':
      return <Badge variant="destructive">Error</Badge>
    case 'offline':
      return <Badge variant="outline" className="border-gray-500 text-gray-500">Offline</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

const statusAnimations = {
  container: {
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },
  item: {
    hidden: { y: 10, opacity: 0 },
    show: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        damping: 15
      }
    }
  },
  batteryPulse: {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [1, 0.8, 1],
      transition: {
        repeat: Number.POSITIVE_INFINITY,
        duration: 2,
        ease: "easeInOut"
      }
    }
  }
}

// Adapter component to make the dashboard props compatible with the MowerControlPanel
export function MowerControlPanel({
  mowerId,
  onCommand,
  className
}: MowerControlPanelAdapterProps) {
  const [mowerData, setMowerData] = useState<{
    name: string;
    status: MowerStatus;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch mower data when mowerId changes
  useEffect(() => {
    // Import the mowerDataService here to prevent circular dependencies
    import('@/lib/mowerDataService').then(({ mowerDataService }) => {
      const fetchMowerData = async () => {
        if (!mowerId) {
          setLoading(false);
          return;
        }
  
        try {
          setLoading(true);
          
          // Try to get real mower data from the mowerDataService
          const data = mowerDataService.getMowerData(mowerId);
          
          if (data) {
            console.log(`[MowerControlPanel] Got data for mower ${mowerId}:`, data);
            
            // Map the status using the correct helper
            const { uiStatus } = mowerDataService.updateMowerUIStatus(mowerId, data);
            
            // Create properly formatted data for the component
            const formattedData = {
              name: data.system?.name || `Mower ${mowerId.substring(0, 4)}`,
              status: {
                // Convert the UI status to MowerStatus format
                status: (uiStatus === 'offline' || uiStatus === 'returning' || 
                  uiStatus === 'leaving') 
                  ? (uiStatus === 'returning' ? 'parked' : 
                     uiStatus === 'leaving' ? 'idle' : 
                     uiStatus === 'offline' ? 'offline' as MowerStatus['status'] : 'idle' as MowerStatus['status']) 
                  : uiStatus as MowerStatus['status'],
                batteryLevel: data.battery?.batteryPercent || 0,
                lastActive: data.lastUpdated 
                  ? new Date(data.lastUpdated).toLocaleString() 
                  : 'Unknown',
                nextScheduled: null,
                errorMessage: data.mower?.errorCode && data.mower.errorCode > 0 
                  ? `Error code: ${data.mower.errorCode}` 
                  : undefined
              }
            };
            
            // Check for schedule data and add next scheduled time if available
            if (data.planner && typeof data.planner === 'object' && 'nextStartTimestamp' in data.planner) {
              formattedData.status.nextScheduled = new Date(data.planner.nextStartTimestamp as number).toLocaleString();
            }
            
            setMowerData(formattedData);
          } else {
            // Fallback to mock data if real data is not available
            console.log(`[MowerControlPanel] No data found for mower ${mowerId}, using mock data`);
            const mockData = {
              name: `Automower ${mowerId.substring(0, 4)}`,
              status: {
                status: 'parked' as MowerStatus['status'],
                batteryLevel: 85,
                lastActive: new Date().toLocaleString(),
                nextScheduled: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString(),
              }
            };
            setMowerData(mockData);
          }
        } catch (error) {
          console.error("[MowerControlPanel] Failed to fetch mower data:", error);
          
          // Fallback to a simple offline state
          setMowerData({
            name: `Mower ${mowerId.substring(0, 4)}`,
            status: {
              status: 'offline' as MowerStatus['status'],
              batteryLevel: 0,
              lastActive: 'Unknown',
              nextScheduled: null,
            }
          });
        } finally {
          setLoading(false);
        }
      };
  
      fetchMowerData();
      
      // Set up a listener for mower data updates
      const handleMowerDataUpdate = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (!customEvent.detail) return;
        
        const { mowerId: updatedMowerId } = customEvent.detail;
        if (updatedMowerId === mowerId) {
          console.log(`[MowerControlPanel] Received update for mower ${mowerId}`);
          fetchMowerData();
        }
      };
      
      // Add listener for mower data updates
      window.addEventListener('mower-data-updated', handleMowerDataUpdate);
      
      // Clean up listener when component unmounts
      return () => {
        window.removeEventListener('mower-data-updated', handleMowerDataUpdate);
      };
    });
  }, [mowerId]);

  if (loading || !mowerData) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-20 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </div>
      </Card>
    );
  }

  // Handler functions that map to the onCommand prop
  const handleStart = () => onCommand('Start');
  const handlePause = () => onCommand('Pause');
  const handleParkUntilNext = () => onCommand('ParkUntilNextSchedule');
  const handleParkUntilFurtherNotice = () => onCommand('ParkUntilFurtherNotice');
  const handleResumeSchedule = () => onCommand('ResumeSchedule');
  const handleRefresh = () => onCommand('refresh');

  // Render the original component with the adapted props
  return (
    <MowerControlPanelOriginal
      mowerName={mowerData.name}
      status={mowerData.status}
      onStart={handleStart}
      onPause={handlePause}
      onParkUntilNext={handleParkUntilNext}
      onParkUntilFurtherNotice={handleParkUntilFurtherNotice}
      onResumeSchedule={handleResumeSchedule}
      onRefresh={handleRefresh}
      className={className}
    />
  );
}

// Rename the original component to avoid conflicts
export function MowerControlPanelOriginal({
  mowerName,
  status,
  onStart,
  onPause,
  onParkUntilNext,
  onParkUntilFurtherNotice,
  onResumeSchedule,
  onRefresh,
  className
}: MowerControlPanelProps) {
  const isCharging = status.status === 'charging'
  const isError = status.status === 'error'
  const isMowing = status.status === 'mowing'
  const isPaused = status.status === 'paused'
  const isParked = status.status === 'parked'
  const isOffline = status.status === 'offline'
  
  // Disable all buttons if mower is offline
  const disableAllControls = isOffline || isError;
  
  return (
    <Card className={`overflow-hidden border-border bg-background text-foreground shadow-lg ${className}`}>
      <CardHeader className="bg-muted/50 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">{mowerName}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onRefresh}
                  className="h-8 w-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh status</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {getStatusBadge(status.status)}
            {isError && (
              <span className="text-xs text-destructive">{status.errorMessage}</span>
            )}
            {isOffline && (
              <span className="text-xs text-gray-500">Not connected</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isCharging ? (
              <motion.div
                animate={statusAnimations.batteryPulse.animate}
                className="text-blue-500"
              >
                <BatteryCharging className="h-5 w-5" />
              </motion.div>
            ) : (
              getBatteryIcon(status.batteryLevel)
            )}
            <span className="text-sm font-medium">{status.batteryLevel}%</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            variants={statusAnimations.container}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            <motion.div variants={statusAnimations.item} className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Timer className="h-4 w-4" />
                <span>Last active: {status.lastActive}</span>
              </div>
              {status.nextScheduled && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  <span>Next scheduled: {status.nextScheduled}</span>
                </div>
              )}
            </motion.div>
            
            <Separator className="my-4" />
            
            <motion.div variants={statusAnimations.item} className="grid grid-cols-2 gap-3">
              <Button
                variant={isMowing ? "secondary" : "default"}
                className="flex items-center gap-2"
                onClick={onStart}
                disabled={isMowing || isCharging || disableAllControls}
              >
                <Play className="h-4 w-4" />
                Start
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={onPause}
                disabled={isPaused || isParked || isCharging || disableAllControls}
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={onParkUntilNext}
                disabled={isParked || isCharging || disableAllControls}
              >
                <Home className="h-4 w-4" />
                Park Until Next
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={onParkUntilFurtherNotice}
                disabled={isParked || isCharging || disableAllControls}
              >
                <PowerOff className="h-4 w-4" />
                Park Until Notice
              </Button>
            </motion.div>
            
            <motion.div variants={statusAnimations.item}>
              <Button
                variant="secondary"
                className="w-full flex items-center justify-center gap-2"
                onClick={onResumeSchedule}
                disabled={isMowing || isCharging || disableAllControls}
              >
                <RefreshCw className="h-4 w-4" />
                Resume Schedule
              </Button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
      
      <CardFooter className="bg-muted/30 px-4 py-3">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>Husqvarna Automower</span>
          <div className="flex items-center gap-1">
            <Power className={`h-3 w-3 ${isOffline ? 'text-gray-400' : ''}`} />
            <span>{isOffline ? 'Disconnected' : 'Connected'}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
} 