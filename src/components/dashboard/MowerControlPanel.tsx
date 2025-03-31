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
  status: 'mowing' | 'paused' | 'parked' | 'charging' | 'idle' | 'error'
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
    const fetchMowerData = async () => {
      if (!mowerId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // This would typically be an API call, but for simplicity we'll create mock data
        // In a real implementation, you would fetch this data from your API
        
        // Mock data for demonstration
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
      } catch (error) {
        console.error("Failed to fetch mower data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMowerData();
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
  const handleStart = () => onCommand('start');
  const handlePause = () => onCommand('pause');
  const handleParkUntilNext = () => onCommand('park_until_next_task');
  const handleParkUntilFurtherNotice = () => onCommand('park_until_further_notice');
  const handleResumeSchedule = () => onCommand('resume_schedule');
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
                disabled={isMowing || isCharging || isError}
              >
                <Play className="h-4 w-4" />
                Start
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={onPause}
                disabled={isPaused || isParked || isCharging || isError}
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={onParkUntilNext}
                disabled={isParked || isCharging || isError}
              >
                <Home className="h-4 w-4" />
                Park Until Next
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={onParkUntilFurtherNotice}
                disabled={isParked || isCharging || isError}
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
                disabled={isMowing || isCharging || isError}
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
            <Power className="h-3 w-3" />
            <span>Connected</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
} 