"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MessageSquare, 
  MoveDownLeft, 
  MoveUpRight, 
  Wrench,
  Play,
  Pause,
  Home,
  BatteryFull,
  PowerOff,
  Crop,
  Battery,
  Cog,
  Tag,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

// Import components from the same directory
import { BatteryLevel } from "./BatteryLevel";
import { AreaCompletion } from "./AreaCompletion";
import { StatusIndicator } from "./StatusIndicator";
import { Toast } from "./Toast";
import { ZoneSelectionDialog } from "./ZoneSelectionDialog";
import { MiniMap } from "./MiniMap";
import { DurationSelectionDialog } from "./DurationSelectionDialog";
import { MowerScheduleButton } from "./MowerScheduleDialog";

// Import types and mock data
import type { MowerStatsProps } from "./types";
import { 
  defaultServiceHistory, 
  defaultAlerts, 
  defaultChatHistory, 
  defaultUpcomingMaintenance
} from "./mockData";

// Add a new import for getting auth token
import { getAuthToken } from "@/lib/auth";

// Add this import at the top of the file
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';
import { MowerAreaCompletion } from '@/components/dashboard/MowerAreaCompletion';

// Create a service instance for direct access
const mowerDataService = new MowerDataService();

interface ButtonLoadingState {
  home: boolean;
  play: boolean;
  pause: boolean;
  restart: boolean;
}

export function MowerStats({
  mowerId,
  mowerName = 'Unnamed Mower',
  mowerModel = 'Unknown Model',
  mowerImage = '/images/mower-placeholder.svg',
  mowerStatus: initialStatus = 'offline',
  batteryLevel: initialBatteryLevel = 0,
  areaComplete = '0%',
  currentZone = '',
  schedule = [],
  metrics = [],
  serviceHistory = [],
  recentAlerts = [],
  chatHistory = [],
  upcomingMaintenance = [],
  mowerZones = [],
  className = '',
  hideTopCard = false,
  onCommand,
  supportsAreaCompletion = false,
  workAreas = [],
  customScheduleComponent
}: MowerStatsProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ show: false, message: '', type: 'info' });

  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [showHomeOptionsDialog, setShowHomeOptionsDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState<{ name: string; workAreaId?: number } | null>(null);
  const [mowerStatus, setMowerStatus] = useState<MowerStatsProps['mowerStatus']>(initialStatus || 'offline');
  const [batteryLevel, setBatteryLevel] = useState<number>(initialBatteryLevel);
  
  const [buttonLoading, setButtonLoading] = useState<ButtonLoadingState>({
    home: false,
    play: false, 
    pause: false,
    restart: false,
  });

  // Add this immediately after other state declarations
  const [commandPending, setCommandPending] = useState(false);
  
  // Add a new state for tracking last change time
  const [lastChangedTime, setLastChangedTime] = useState<Date | null>(null);
  
  // Add a new state for tracking pending commands
  const [pendingCommand, setPendingCommand] = useState<{
    command: string;
    sentAt: Date;
    description?: string;
  } | null>(null);

  // Add this state for tracking next start time
  const [nextStartTime, setNextStartTime] = useState<string | undefined>(undefined);

  // Add this state for zone selection
  const [selectableZones, setSelectableZones] = useState<Array<{name: string, workAreaId?: number, color: string}>>([]);

  // Modified useEffect to better leverage cached data and update efficiently
  useEffect(() => {
    if (!mowerId) return;
    
    // Start listening for updates from the mower data service
    console.log(`MowerStats: Starting to listen for updates for mower: ${mowerId}`);
    mowerDataService.startListening(mowerId);
    
    // Also attempt to proactively load enhanced work areas
    loadZones();
    
    // Create handler for mower data updates
    const handleMowerDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      if (!customEvent.detail || !customEvent.detail.mowerId || customEvent.detail.mowerId !== mowerId) return;
      
      console.log(`MowerStats: Received data update for mower ${mowerId}`, customEvent.detail.type || 'unknown update type');
      
      const { data, type, isSignificantChange, lastChangeTimestamp, fromCache } = customEvent.detail;
      
      // Check for area completion data and update if present
      let updatedAreaComplete = null;
      if (data?.areaComplete) {
        console.log(`MowerStats: Found area completion data: ${data.areaComplete}`);
        updatedAreaComplete = data.areaComplete;
      } else if (data?.consolidated?.areaComplete) {
        console.log(`MowerStats: Found consolidated area completion data: ${data.consolidated.areaComplete}`);
        updatedAreaComplete = data.consolidated.areaComplete;
      } else if (data?.workAreaProgress?.areaComplete) {
        console.log(`MowerStats: Found workAreaProgress area completion data: ${data.workAreaProgress.areaComplete}`);
        updatedAreaComplete = data.workAreaProgress.areaComplete;
      }
      
      // Broadcast area completion update if found
      if (updatedAreaComplete) {
        console.log(`MowerStats: Broadcasting area completion update: ${updatedAreaComplete}`);
        // Dispatch an event for area completion update
        const areaCompleteEvent = new CustomEvent('mower-area-completion-updated', {
          detail: { 
            mowerId,
            areaComplete: updatedAreaComplete
          }
        });
        window.dispatchEvent(areaCompleteEvent);
      }
      
      // Handle different update types
      if (type === 'work_areas_update' && data?.workAreas) {
        // Update zones from work areas update
        handleWorkAreasUpdate(data.workAreas);
      } else if (type === 'workAreaProgress' || data?.workAreaProgress) {
        // Set area completion data if available
        console.log('MowerStats: Processing work area progress data');
        const areaComplete = data?.workAreaProgress?.areaComplete || data?.areaComplete;
        if (areaComplete) {
          console.log(`MowerStats: Setting area complete to ${areaComplete}`);
        }
      } else if (data) {
        // Update UI based on the data
        // Use the centralized helper method for consistent state mapping
        const { uiStatus, isChargingWhileParked } = mowerDataService.updateMowerUIStatus(mowerId, data);
        // Cast to the correct type for mowerStatus
        setMowerStatus(uiStatus as MowerStatsProps['mowerStatus']);
        
        // Get next start time if available
        if (data.planner && data.planner.nextStartTimestamp !== undefined) {
          const nextStartInfo = mowerDataService.getNextStartTime(data);
          setNextStartTime(nextStartInfo.formatted);
        }
        
        // Log charging while parked status
        if (isChargingWhileParked) {
          console.log(`Mower ${mowerId} is parked but also charging (battery: ${data.battery?.batteryPercent}%)`);
        }
        
        // Update battery level if available
        if (data.battery && typeof data.battery.batteryPercent === 'number') {
          setBatteryLevel(data.battery.batteryPercent);
        }
      }
      
      // Update lastChangedTime if this was a significant change
      if (isSignificantChange && lastChangeTimestamp) {
        setLastChangedTime(new Date(lastChangeTimestamp));
        
        // If we have a significant change, we should clear any pending commands
        // as the command has likely been processed
        if (pendingCommand) {
          // Check if the significant change matches what we would expect from our pending command
          const activity = data?.mower?.activity;
          const state = data?.mower?.state;
          
          let shouldClearPending = false;
          
          // If we're waiting for a Start command and the mower is now MOWING
          if (pendingCommand.command === 'Start' || pendingCommand.command === 'StartInWorkArea') {
            if (activity === 'MOWING') {
              shouldClearPending = true;
            }
          } 
          // If we're waiting for a Pause command and the mower is now PAUSED
          else if (pendingCommand.command === 'Pause') {
            if (state === 'PAUSED' || activity === 'STOPPED_IN_GARDEN') {
              shouldClearPending = true;
            }
          }
          // If we're waiting for a Park command and the mower is GOING_HOME or PARKED
          else if (pendingCommand.command.includes('Park')) {
            if (activity === 'GOING_HOME' || activity === 'PARKED_IN_CS') {
              shouldClearPending = true;
            }
          }
          
          if (shouldClearPending) {
            console.log('Clearing pending command as significant change was detected:', pendingCommand.command);
            setPendingCommand(null);
          }
        }
      }
    };
    
    // Listen for mower data updates
    window.addEventListener('mower-data-updated', handleMowerDataUpdate);
    
    // Cleanup
    return () => {
      console.log(`MowerStats: Stopping listener for mower: ${mowerId}`);
      mowerDataService.stopListening(mowerId);
      window.removeEventListener('mower-data-updated', handleMowerDataUpdate);
    };
  }, [mowerId, pendingCommand]);

  // Function to handle work areas updates
  const handleWorkAreasUpdate = (workAreas: any[]) => {
    if (!workAreas || !Array.isArray(workAreas)) return;
    
    console.log(`MowerStats: Received ${workAreas.length} work areas`);
    
    // Format work areas into zones
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#84cc16', '#14b8a6'];
    
    const formattedZones = workAreas.map((area, index) => {
      // Check if this is already in the right format
      if (area.attributes) {
        return {
          name: area.attributes.name || `Area ${area.attributes.workAreaId || index}`,
          workAreaId: area.attributes.workAreaId,
          color: area.attributes.color || colors[index % colors.length]
        };
      }
      
      // Otherwise create from basic data
      return {
        name: area.name || `Area ${area.workAreaId || index}`,
        workAreaId: area.workAreaId,
        color: area.color || colors[index % colors.length]
      };
    });
    
    setSelectableZones(formattedZones);
  };

  // Proactively load zones on component mount
  const loadZones = async () => {
    try {
      if (!mowerId || !mowerDataService) return;
      
      console.log(`MowerStats: Proactively loading zones for mower ${mowerId}`);
      
      // Use the enhanced work areas function to get better zone names
      const enhancedAreas = await mowerDataService.getEnhancedWorkAreas(mowerId);
      if (enhancedAreas && Array.isArray(enhancedAreas)) {
        handleWorkAreasUpdate(enhancedAreas);
      }
    } catch (error) {
      console.error("Error loading zones:", error);
      // Use fallback zones if there's an error
      setSelectableZones([
        { name: 'Main Yard', workAreaId: 0, color: '#10b981' },
        { name: 'Front Yard', workAreaId: 1, color: '#3b82f6' },
        { name: 'Back Yard', workAreaId: 2, color: '#8b5cf6' }
      ]);
    }
  };

  // Generate metrics based on real data if metrics not provided
  const mowerMetrics = React.useMemo(() => {
    if (metrics) return metrics;
    
    // Calculate derived metrics if not provided but we have some data
    return [
      {
        title: "Total Area Mowed",
        value: "12,450 m²", // This would ideally come from API data
        change: "+15.3% from last month",
        trend: "up",
        icon: <Crop className="h-4 w-4" />,
      },
      {
        title: "Battery Efficiency",
        value: `${batteryLevel}%`,
        change: batteryLevel > 80 ? "+2.5% from last month" : "-1.2% from last month",
        trend: batteryLevel > 80 ? "up" : "down",
        icon: <Battery className="h-4 w-4" />,
      },
      {
        title: "Mowing Hours",
        value: "187.5 hrs", // This would ideally come from API data
        change: "-3.2% from last month",
        trend: "down",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        title: "Maintenance Score",
        value: "86/100", // This would ideally be calculated based on various factors
        change: "No change",
        trend: "neutral",
        icon: <Cog className="h-4 w-4" />,
      },
    ];
  }, [metrics, batteryLevel]);

  // Add this new function after the allZones useMemo hook
  const ensureAuthenticated = async () => {
    const token = getAuthToken();
    
    if (!token) {
      setToast({
        show: true,
        message: 'Please connect your Husqvarna account to control your mowers.',
        type: 'error'
      });
      return false;
    }
    
    // For a real implementation, we would check token expiration and refresh if needed
    // This is a simplified version that just checks if token exists
    return true;
  };

  const handleCommand = async (command: string, duration?: number, workAreaId?: number) => {
    if (!mowerId || !onCommand) {
      setToast({
        show: true,
        message: 'Cannot control mower: Mower ID or onCommand is missing.',
        type: 'error'
      });
      return;
    }

    // Set command pending flag and track command details
    setCommandPending(true);
    
    // Create a description based on the command
    let commandDescription = '';
    switch (command) {
      case 'Start':
        commandDescription = duration ? `Starting mower for ${duration} minutes...` : 'Starting mower...';
        break;
      case 'StartInWorkArea':
        const zoneName = selectedZone?.name || 'selected zone';
        commandDescription = `Starting mower in ${zoneName}${duration ? ` for ${duration} minutes` : ''}...`;
        break;
      case 'Pause':
        commandDescription = 'Pausing mower...';
        break;
      case 'Park':
        commandDescription = duration ? `Sending mower home for ${duration} minutes...` : 'Sending mower home...';
        break;
      case 'ParkUntilNextSchedule':
        commandDescription = 'Sending mower home until next scheduled task...';
        break;
      case 'ParkUntilFurtherNotice':
        commandDescription = 'Sending mower home until further notice...';
        break;
      case 'ResumeSchedule':
        commandDescription = 'Resuming scheduled operation...';
        break;
      default:
        commandDescription = `Sending ${command} command...`;
    }
    
    // Set the pending command with description
    console.log(`Setting pending command for ${mowerId}: ${command} - ${commandDescription}`);
    setPendingCommand({
      command,
      sentAt: new Date(),
      description: commandDescription
    });
    
    // Update UI status immediately for better user feedback
    updateUiStatusForCommand(command);

    try {
      // Check authentication first
      const isAuthenticated = await ensureAuthenticated();
      if (!isAuthenticated) {
        setCommandPending(false);
        setPendingCommand(null);
        return null;
      }
      
      const token = getAuthToken();

      // Prepare the request body according to the Husqvarna API
      let requestBody: any = {
        data: {
          type: command
        }
      };
      
      // Add attributes based on the command type
      if (command === 'Start' && duration) {
        requestBody.data.attributes = { duration };
      } 
      else if (command === 'StartInWorkArea' && duration && workAreaId !== undefined) {
        requestBody.data.attributes = { 
          duration,
          workAreaId 
        };
      }
      else if (command === 'Park' && duration) {
        requestBody.data.attributes = { duration };
      }
      
      // Don't add attributes for commands that don't need them
      // ResumeSchedule, ParkUntilNextSchedule, ParkUntilFurtherNotice, Pause
      
      console.log('Sending command to mower:', requestBody);

      const response = await fetch(`/api/mowers/${mowerId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        // If authentication error, show special message
        if (response.status === 401) {
          throw new Error('Authentication failed. Please reconnect your account.');
        }
        
        throw new Error(data.error || 'Failed to send command to mower');
      }

      // Command was successful - update Firebase with the new state
      try {
        // Prepare data for Firebase update based on the command
        const updateData: any = {
          mower: {},
          lastUpdated: new Date()
        };
        
        // Update state based on command, using the exact Husqvarna API activity and state values
        if (command === 'Start' || command === 'StartInWorkArea' || command === 'ResumeSchedule') {
          updateData.mower.activity = 'MOWING';
          updateData.mower.state = 'IN_OPERATION';
          updateData.mower.mode = 'MAIN_AREA';
        } 
        else if (command === 'Pause') {
          updateData.mower.activity = 'STOPPED_IN_GARDEN';
          updateData.mower.state = 'PAUSED';
        }
        else if (command === 'Park' || command === 'ParkUntilNextSchedule') {
          updateData.mower.activity = 'GOING_HOME';
          updateData.mower.state = 'IN_OPERATION';
        }
        else if (command === 'ParkUntilFurtherNotice') {
          updateData.mower.activity = 'PARKED_IN_CS';
          updateData.mower.state = 'IN_OPERATION';
          updateData.mower.mode = 'HOME';
        }
        
        // Add work area ID if specified
        if (workAreaId !== undefined) {
          updateData.mower.workAreaId = workAreaId;
        }
        
        // Update data in Firebase
        await mowerDataService.updateMowerData(mowerId, updateData);
        console.log(`Updated mower state in Firebase after command: ${command}`, updateData.mower);
      } catch (firebaseError) {
        console.error('Error updating mower data in Firebase:', firebaseError);
        // Continue - the API command was still successful
      }
      
      // Command was successful, but keep pending state until status update is received
      setCommandPending(false);
      
      // Set a timeout to clear the pending command after 2 minutes (failsafe)
      setTimeout(() => {
        setPendingCommand(null);
      }, 2 * 60 * 1000);
      
      return data;
    } catch (error) {
      console.error('Error sending mower command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Reset UI status on error
      setMowerStatus(initialStatus);
      setCommandPending(false);
      setPendingCommand(null);
      
      setToast({
        show: true,
        message: `Failed to control mower: ${errorMessage}`,
        type: 'error'
      });
      
      return null;
    }
  };

  // Helper function to update UI immediately based on command
  const updateUiStatusForCommand = (command: string) => {
    if (command === 'Start' || command === 'StartInWorkArea' || command === 'ResumeSchedule') {
      setMowerStatus('mowing');
      console.log(`[Command] Status updated to mowing for ${command}`);
    } else if (command === 'Pause') {
      setMowerStatus('idle');
      console.log(`[Command] Status updated to idle for ${command}`);
    } else if (command === 'Park' || command === 'ParkUntilNextSchedule' || command === 'ParkUntilFurtherNotice') {
      setMowerStatus('returning');
      console.log(`[Command] Status updated to returning for ${command}`);
    }
  };

  const handlePlay = async () => {
    setButtonLoading({ ...buttonLoading, play: true });
    
    // If we already have zones loaded, use them
    if (selectableZones.length > 0) {
      console.log(`Using ${selectableZones.length} pre-loaded zones`);
      setShowZoneDialog(true);
      return;
    }
    
    // Otherwise load them now
    try {
      await loadZones();
      setShowZoneDialog(true);
    } catch (error) {
      console.error("Error preparing zones:", error);
      // Use fallback zones if there's an error
      setSelectableZones([
        { name: 'Main Yard', workAreaId: 0, color: '#10b981' },
        { name: 'Front Yard', workAreaId: 1, color: '#3b82f6' },
        { name: 'Back Yard', workAreaId: 2, color: '#8b5cf6' }
      ]);
      setShowZoneDialog(true);
    }
  };

  const handlePause = async () => {
    setButtonLoading({ ...buttonLoading, pause: true });
    
    const result = await handleCommand('Pause');
    
    if (result?.success) {
      setMowerStatus('idle');
      setToast({
        show: true,
        message: 'Mower paused. Current operation interrupted.',
        type: 'warning'
      });
    }
    
    setButtonLoading({ ...buttonLoading, pause: false });
  };

  const handleGoHome = async () => {
    setButtonLoading({ ...buttonLoading, home: true });
    // Show home options dialog
    setShowHomeOptionsDialog(true);
  };

  const handleReturnHome = async (option: string) => {
    setButtonLoading({ ...buttonLoading, home: true });
    
    let command = 'Park';
    let duration: number | undefined;
    let message = 'Mower returning to charging station.';
    let targetStatus: 'returning' | 'parked' = 'returning';
    
    switch (option) {
      case '24h':
        command = 'Park';
        duration = 24 * 60; // 24 hours in minutes
        message = 'Mower returning home and will stay for 24 hours.';
        targetStatus = 'parked';
        break;
      case '72h':
        command = 'Park';
        duration = 72 * 60; // 72 hours in minutes
        message = 'Mower returning home and will stay for 72 hours.';
        targetStatus = 'parked';
        break;
      case 'until-charged':
        command = 'ParkUntilNextSchedule';
        message = 'Mower returning home until charged.';
        targetStatus = 'parked';
        break;
      case 'indefinite':
        command = 'ParkUntilFurtherNotice';
        message = 'Mower returning home until further notice.';
        targetStatus = 'parked';
        break;
      default:
        command = 'Park';
    }
    
    const result = await handleCommand(command, duration);
    
    if (result?.success) {
      setMowerStatus(targetStatus);
      setToast({
        show: true,
        message,
        type: 'info'
      });
    }
    
    setShowHomeOptionsDialog(false);
    setButtonLoading({ ...buttonLoading, home: false });
  };

  const handleSelectZone = async (zoneName: string, workAreaId?: number) => {
    // Store the selected zone and show duration dialog
    setSelectedZone({ name: zoneName, workAreaId });
    setShowZoneDialog(false);
    setShowDurationDialog(true);
  };

  const handleSelectDuration = async (duration: number, commandType: 'Start' | 'StartInWorkArea' | 'ResumeSchedule' | 'ParkUntilNextSchedule' | 'ParkUntilFurtherNotice') => {
    setButtonLoading({ ...buttonLoading, play: true });
    
    let result;
    let message = '';
    
    if (commandType === 'Start') {
      result = await handleCommand('Start', duration);
      message = `Mower started for ${duration} minutes.`;
    } 
    else if (commandType === 'StartInWorkArea' && selectedZone?.workAreaId) {
      result = await handleCommand('StartInWorkArea', duration, selectedZone.workAreaId);
      message = `Mower started in ${selectedZone.name} for ${duration} minutes.`;
    }
    else if (commandType === 'ResumeSchedule') {
      result = await handleCommand('ResumeSchedule');
      message = 'Mower resumed regular schedule.';
    }
    else if (commandType === 'ParkUntilNextSchedule') {
      result = await handleCommand('ParkUntilNextSchedule');
      message = 'Mower will park until next scheduled task.';
    }
    else if (commandType === 'ParkUntilFurtherNotice') {
      result = await handleCommand('ParkUntilFurtherNotice');
      message = 'Mower parked until further notice.';
    }
    
    if (result?.success) {
      if (commandType === 'Start' || commandType === 'StartInWorkArea' || commandType === 'ResumeSchedule') {
        setMowerStatus('mowing');
      } else {
        setMowerStatus('parked');
      }
      
      setToast({
        show: true,
        message,
        type: 'success'
      });
    }
    
    // Close duration dialog
    setShowDurationDialog(false);
    setButtonLoading({ ...buttonLoading, play: false });
  };

  const handleContinueChat = (sender: string, initialMessage: string) => {
    // Navigate to the chat page instead of opening a dialog
    const query = new URLSearchParams();
    
    if (mowerId) {
      query.set('mower', mowerId);
    }
    
    if (sender !== 'User') {
      query.set('agent', sender);
    }
    
    if (initialMessage) {
      query.set('context', initialMessage);
    }
    
    router.push(`/chat?${query.toString()}`);
  };

  const closeToast = () => {
    setToast({ ...toast, show: false });
  };

  const renderHomeOptionsDialog = () => {
    return (
      <Dialog open={showHomeOptionsDialog} onOpenChange={setShowHomeOptionsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return Home Options</DialogTitle>
            <DialogDescription>
              Select how you want to send the mower back to the charging station.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleReturnHome('until-charged')}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">Until Next Schedule</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Return to the charging station and stay until the next scheduled task. 
                    Command: ParkUntilNextSchedule
                  </span>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleReturnHome('24h')}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">For 24 Hours</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Return to the charging station and stay for 24 hours.
                    Command: Park with duration=1440 minutes
                  </span>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleReturnHome('72h')}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">For 72 Hours</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Return to the charging station and stay for 72 hours.
                    Command: Park with duration=4320 minutes
                  </span>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => handleReturnHome('indefinite')}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">Until Further Notice</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Return to the charging station and stay until manually commanded to resume.
                    Command: ParkUntilFurtherNotice
                  </span>
                </div>
              </Button>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground border-t border-border pt-3 mt-3">
            <p className="mb-1">⚠️ Note: In all cases, the mower will be in "Returning" state while in transit
            and "Parked" state when at the charging station.</p>
            <p>If the battery is not full, it will charge while parked, but the state will still show as "Parked"
            and not "Charging" (unless the mower went home on its own due to low battery).</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Add the OfflineIndicator component
  const OfflineIndicator = () => {
    return (
      <div className="flex items-center gap-1.5 bg-red-900/20 px-2 py-1 rounded-md border border-red-900/30">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-700"></span>
        </span>
        <span className="text-sm font-medium text-red-500">Offline</span>
      </div>
    );
  };

  return (
    <div className={cn("w-full space-y-3", className)} data-mower-id={mowerId}>
      {/* Top card with mower image, controls and mini map */}
      {!hideTopCard && (
        <Card className="overflow-hidden border">
          <div className="flex flex-col md:flex-row md:h-[360px]">
            {/* Mower Image and Controls */}
            <div className="w-full md:w-1/2 p-4 relative flex flex-col h-auto justify-between">
              {/* Header with mower name and model */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium truncate">{mowerName}</h3>
                <div className="flex flex-col items-end">
                  <p className="text-sm text-muted-foreground">{mowerModel}</p>
                  {lastChangedTime && (
                    <p className="text-xs text-muted-foreground">Last change: {lastChangedTime.toLocaleTimeString()}</p>
                  )}
                </div>
              </div>
              
              {/* Two-column layout for mower image and status */}
              <div className="flex items-start gap-4 mb-3">
                {/* Larger mower image on the left */}
                <div className="relative h-32 w-32 flex-shrink-0">
                  <Image 
                    src={mowerImage} 
                    alt={mowerName}
                    className="object-contain"
                    fill
                    priority
                    sizes="128px"
                  />
                </div>
                
                {/* Status indicators on the right */}
                <div className="flex-1 space-y-2">
                  {/* Status badge */}
                  <StatusIndicator 
                    status={mowerStatus} 
                    isPending={commandPending || !!pendingCommand}
                    pendingDescription={pendingCommand?.description || 'Processing...'}
                    isChargingWhileParked={mowerStatus === 'parked' && batteryLevel < 100}
                    batteryLevel={batteryLevel}
                    nextStartTime={nextStartTime}
                  />
                  
                  {/* Error message if any */}
                  {mowerStatus === "error" && (
                    <div className="py-1 px-2 bg-red-500/10 border border-red-500/20 rounded-md mt-1">
                      <div className="flex items-start">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 mr-1.5 flex-shrink-0" />
                        <p className="text-xs text-red-500 font-medium">
                          Error detected - Check mower status
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Full-width battery and area completion */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <BatteryLevel level={batteryLevel} />
                {supportsAreaCompletion ? (
                  <MowerAreaCompletion mowerId={mowerId || ''} initialValue={areaComplete} />
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Area Complete</span>
                      <span className="text-muted-foreground">N/A</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-600/20 flex items-center justify-center">
                      <span className="text-[8px] text-muted-foreground">Not Available</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Current zone indicator */}
              {currentZone && (
                <div className="flex items-center gap-1 mb-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Current zone:</span>
                  <Badge variant="secondary" className="text-xs py-0 h-5">
                    {currentZone}
                  </Badge>
                </div>
              )}
              
              {/* Control Buttons - Spaced evenly at bottom */}
              <div className="flex items-center justify-around gap-2 py-2 mt-auto">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full w-12 h-12 p-0 border-2 border-emerald-500/70 hover:bg-emerald-500/10 transition-colors"
                  onClick={handlePlay}
                  data-action="play"
                  disabled={buttonLoading.play || mowerStatus === 'offline'}
                >
                  {buttonLoading.play ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-r-transparent" />
                  ) : (
                    <Play className="h-5 w-5 text-emerald-500" />
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full w-12 h-12 p-0 border-2 border-amber-500/70 hover:bg-amber-500/10 transition-colors"
                  onClick={handlePause}
                  data-action="pause"
                  disabled={buttonLoading.pause || mowerStatus === 'offline'}
                >
                  {buttonLoading.pause ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-r-transparent" />
                  ) : (
                    <Pause className="h-5 w-5 text-amber-500" />
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full w-12 h-12 p-0 border-2 border-blue-500/70 hover:bg-blue-500/10 transition-colors"
                  onClick={handleGoHome}
                  data-action="home"
                  disabled={buttonLoading.home || mowerStatus === 'offline'}
                >
                  {buttonLoading.home ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-r-transparent" />
                  ) : (
                    <Home className="h-5 w-5 text-blue-500" />
                  )}
                </Button>
              </div>
              
              {/* Home options dialog */}
              {renderHomeOptionsDialog()}
            </div>
            
            {/* Mini Map */}
            <div className="w-full md:w-1/2 h-[250px] md:h-full bg-background/50">
              <MiniMap 
                mowerId={mowerId} 
                currentZone={currentZone} 
                batteryLevel={batteryLevel}
                areaComplete={areaComplete}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Weekly Schedule */}
      <Card className="overflow-hidden border-0 p-0 shadow-none bg-transparent">
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="schedule">
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="service-history">
              <Wrench className="h-4 w-4 mr-2" />
              Service
            </TabsTrigger>
            <TabsTrigger value="recent-alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="chat-history">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="upcoming-maintenance">
              <Clock className="h-4 w-4 mr-2" />
              Upcoming
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedule" className="space-y-4">
            {customScheduleComponent || (
              <div className="border rounded-md p-4">
                {mowerId ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <div className="flex gap-2">
                      <MowerScheduleButton 
                        mowerId={mowerId} 
                        workAreaColors={
                          workAreas?.reduce((colors: Record<string, string>, area) => {
                            if (area.workAreaId !== undefined) {
                              // Use a color palette for work areas
                              const colorPalette = [
                                '#10b981', // emerald
                                '#3b82f6', // blue
                                '#8b5cf6', // violet  
                                '#f59e0b', // amber
                                '#ef4444', // red
                                '#06b6d4', // cyan
                                '#ec4899'  // pink
                              ];
                              const index = typeof area.workAreaId === 'number' ? 
                                area.workAreaId % colorPalette.length : 
                                0;
                              colors[area.workAreaId.toString()] = colorPalette[index];
                            }
                            return colors;
                          }, {}) || {}
                        }
                      />
                      <Button 
                        variant="outline" 
                        className="flex gap-1"
                        onClick={() => {
                          // This will call the API directly to debug schedule data
                          console.log("Debug: Manually checking schedule data from API");
                          
                          // Check if mowerDataService is available
                          if (mowerDataService) {
                            // Get the model first to help with proper API endpoint selection
                            mowerDataService.getMowerData(mowerId)
                              .then(mowerData => {
                                const modelName = mowerData?.mowerData?.attributes?.system?.model || '';
                                console.log(`Debug: Got mower data, model is: ${modelName}`);
                                
                                // Now get the calendar data
                                return mowerDataService.getScheduleForMowerAsync(mowerId);
                              })
                              .then(calendarData => {
                                console.log("Debug: Raw schedule data from API:", JSON.stringify(calendarData, null, 2));
                                setToast({
                                  show: true,
                                  message: `Schedule check complete. Found ${calendarData?.tasks?.length || 0} tasks.`,
                                  type: 'info'
                                });
                              })
                              .catch(error => {
                                console.error("Debug: Error fetching schedule:", error);
                                setToast({
                                  show: true,
                                  message: "Failed to fetch schedule data. Check console for details.",
                                  type: 'error'
                                });
                              });
                          }
                        }}
                      >
                        <RefreshCw size={16} />
                        <span>Check Schedule Data</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <p className="text-sm text-muted-foreground">No mowing schedule available</p>
                    <p className="text-xs text-muted-foreground mt-1">Schedule information may be unavailable for this mower</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="service-history" className="space-y-4">
            <div className="space-y-4">
              {serviceHistory.map((service, i) => (
                <div key={`service-${service.service}-${i}`} className="flex">
                  <div className="flex flex-col items-center">
                    {service.isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-primary/70" />
                    ) : (
                      <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />
                    )}
                    {i < serviceHistory.length - 1 && (
                      <div className="w-[1.5px] h-12 bg-muted-foreground/30" />
                    )}
                  </div>
                  <div className="ml-3 pb-6">
                    <p className="text-sm font-medium">{service.service}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.date} • {service.technician}
                    </p>
                  </div>
                </div>
              ))}
              {serviceHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">No service history available.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="recent-alerts" className="space-y-4">
            <div className="space-y-3">
              {recentAlerts.map((alert, i) => (
                <Card key={`alert-${alert.message}-${i}`} className="p-4 border">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={cn(
                      "h-5 w-5 shrink-0 mt-0.5",
                      alert.severity === "error" ? "text-destructive" : 
                      alert.severity === "warning" ? "text-amber-500" : "text-blue-500"
                    )} />
                    <div>
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">{alert.date}</p>
                    </div>
                  </div>
                </Card>
              ))}
              {recentAlerts.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent alerts.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="chat-history" className="space-y-4">
            <div className="space-y-4">
              {chatHistory.map((chat, i) => (
                <Card key={`chat-${chat.message.substring(0,10)}-${i}`} className="p-4 border">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">{chat.sender}</p>
                      <p className="text-xs text-muted-foreground">{chat.date}</p>
                    </div>
                    <Separator className="my-2" />
                    <p className="text-sm">{chat.message}</p>
                    <div className="flex justify-end mt-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs h-7 gap-1"
                        type="button"
                        onClick={() => handleContinueChat(chat.sender, chat.message)}
                      >
                        <MessageSquare className="h-3 w-3" />
                        Continue Chat
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {chatHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">No chat history available.</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="upcoming-maintenance" className="space-y-4">
            <div className="space-y-3">
              {upcomingMaintenance.map((task, i) => (
                <Card key={`task-${task.task}-${i}`} className="p-4 border">
                  <div className="flex items-start gap-3">
                    <Wrench className={cn(
                      "h-5 w-5 shrink-0 mt-0.5",
                      task.priority === "high" ? "text-destructive" : 
                      task.priority === "medium" ? "text-amber-500" : "text-primary"
                    )} />
                    <div>
                      <p className="text-sm font-medium">{task.task}</p>
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {task.date} • 
                        <span className={cn(
                          "ml-1 font-medium",
                          task.priority === "high" ? "text-destructive" : 
                          task.priority === "medium" ? "text-amber-500" : "text-primary"
                        )}>
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                        </span>
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              {upcomingMaintenance.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming maintenance scheduled.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mowerMetrics.map((metric, index) => (
          <Card 
            key={`metric-${metric.title}-${index}`} 
            className={cn(
              "overflow-hidden relative group border",
              metric.trend === "up" ? "hover:border-emerald-500/50" : 
              metric.trend === "down" ? "hover:border-red-500/50" : 
              "hover:border-blue-500/50"
            )}
          >
            <div className={cn(
              "absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity",
              metric.trend === "up" ? "bg-gradient-to-br from-emerald-500/30 to-emerald-700/30" : 
              metric.trend === "down" ? "bg-gradient-to-br from-red-500/30 to-red-700/30" : 
              "bg-gradient-to-br from-blue-500/30 to-blue-700/30"
            )} />
            
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className={cn(
                  "h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg",
                  metric.trend === "up" ? "bg-emerald-500/10 text-emerald-500" : 
                  metric.trend === "down" ? "bg-red-500/10 text-red-500" : 
                  "bg-blue-500/10 text-blue-500"
                )}>
                  {metric.icon}
                </div>
                
                <div className={cn(
                  "h-10 flex items-center gap-1.5 px-3 rounded-lg ml-auto",
                  metric.trend === "up" ? "bg-emerald-500/10 text-emerald-500" : 
                  metric.trend === "down" ? "bg-red-500/10 text-red-500" : 
                  "bg-blue-500/10 text-blue-500"
                )}>
                  {metric.trend === "up" && <MoveUpRight className="h-3.5 w-3.5" />}
                  {metric.trend === "down" && <MoveDownLeft className="h-3.5 w-3.5" />}
                  {metric.trend === "neutral" && <Circle className="h-3.5 w-3.5" />}
                  <span className="text-xs font-medium">{metric.change}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
                <p className="text-2xl font-semibold">{metric.value}</p>
              </div>
              
              {/* Mini chart */}
              <div className="mt-4 h-10">
                {metric.trend === "up" && (
                  <div className="flex items-end h-full w-full gap-[2px]">
                    {[0.3, 0.5, 0.45, 0.6, 0.5, 0.7, 0.8, 0.75, 0.85, 0.9].map((height, i) => (
                      <div 
                        key={`up-bar-${metric.title}-${i}`} 
                        className="flex-1 rounded-sm bg-emerald-500/20"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                )}
                
                {metric.trend === "down" && (
                  <div className="flex items-end h-full w-full gap-[2px]">
                    {[0.8, 0.7, 0.75, 0.6, 0.65, 0.5, 0.55, 0.45, 0.4, 0.3].map((height, i) => (
                      <div 
                        key={`down-bar-${metric.title}-${i}`} 
                        className="flex-1 rounded-sm bg-red-500/20"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                )}
                
                {metric.trend === "neutral" && (
                  <div className="flex items-end h-full w-full gap-[2px]">
                    {[0.5, 0.55, 0.5, 0.6, 0.5, 0.45, 0.5, 0.55, 0.5, 0.55].map((height, i) => (
                      <div 
                        key={`neutral-bar-${metric.title}-${i}`} 
                        className="flex-1 rounded-sm bg-blue-500/20"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Zone selection dialog */}
      <ZoneSelectionDialog 
        isOpen={showZoneDialog}
        onClose={() => {
          setShowZoneDialog(false);
          setButtonLoading({ ...buttonLoading, play: false });
        }}
        zones={selectableZones} 
        onSelectZone={handleSelectZone}
      />

      {/* Duration selection dialog */}
      <DurationSelectionDialog
        isOpen={showDurationDialog}
        onClose={() => {
          setShowDurationDialog(false);
          setButtonLoading({ ...buttonLoading, play: false });
        }}
        selectedZone={selectedZone}
        onSelectDuration={handleSelectDuration}
      />

      {/* Toast notifications */}
      {toast.show && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
    </div>
  );
} 