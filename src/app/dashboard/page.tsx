'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { toast } from 'react-hot-toast';
import { MowerCard } from '@/components/dashboard/MowerCard';
import { GoogleMapView } from '@/components/dashboard/GoogleMapView';
import WeatherWidget from '@/components/dashboard/WeatherWidget';
import { MowerStatusDisplay } from '@/components/dashboard/MowerStatusDisplay';
import { ConnectionStatusIcons } from '@/components/dashboard/ConnectionStatusIcons';
import { MowerStats } from '@/components/dashboard/mower-stats/MowerStats';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, RefreshCw, X, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { SystemStatsWidget } from '@/components/dashboard/SystemStatsWidget';
import { triggerComprehensiveDataRefresh } from './actions';
import { Category } from '@/components/dashboard/MowerCard';
import CategoryManagement from '@/components/dashboard/CategoryManagementDialog';
import { getLocationFromMowers } from '@/lib/weather/location-utils';
import { husqvarnaApi, getMowerCalendar } from '@/lib/husqvarna/api-client';
import { Mower, MowerCapabilities } from '@/lib/types';
import MowerSchedule from '@/components/dashboard/mower-stats/MowerSchedule';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';
import { useFirebaseMowers } from '@/hooks/useFirebaseMowers';

// Create an instance of the MowerDataService for direct usage
// This is for components that need direct access outside the context
const mowerDataService = new MowerDataService();

// Define mower status type
export type MowerStatus = 'mowing' | 'charging' | 'idle' | 'error' | 'offline' | 'returning' | 'parked' | 'online' | 'paused';

// Define status filters
export const STATUS_FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'mowing', name: 'Mowing' },
  { id: 'charging', name: 'Charging' },
  { id: 'parked', name: 'Parked' },
  { id: 'idle', name: 'Idle' },
  { id: 'returning', name: 'Returning' },
  { id: 'online', name: 'Online' },
  { id: 'paused', name: 'Paused' },
  { id: 'error', name: 'Error' },
  { id: 'offline', name: 'Offline' }
];

export default function DashboardPage() {
  // Use Firebase for real-time mower data (new architecture)
  const firebaseMowers = useFirebaseMowers();
  // Keep existing dashboard for authentication and other functions
  const dashboard = useDashboard();
  const [mounted, setMounted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  
  // State for category and status filtering
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showZones, setShowZones] = useState(true);
  const [selectedMower, setSelectedMower] = useState<string | null>(null);
  const [mowerDialogOpen, setMowerDialogOpen] = useState(false);
  
  // Add state to track pending commands
  const [pendingCommands, setPendingCommands] = useState<{[mowerId: string]: {
    command: string;
    sentAt: Date;
    description?: string;
  }}>({}); 
  
  // Add a state to store work areas data from API
  const [workAreasData, setWorkAreasData] = useState<{[mowerId: string]: any[]}>({});
  
  // Set mounted to true after initial render
  useEffect(() => {
    setMounted(true);
    
    // Set initial last updated time
    if (firebaseMowers.mowers.length > 0) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
    
    // Load saved categories from localStorage
    const savedCategories = localStorage.getItem('mowerCategories');
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error('Error loading saved categories:', e);
      }
    }
    
    // Start listening for updates for each mower
    firebaseMowers.mowers.forEach(mower => {
      if (mower.id) {
        console.log(`Starting to listen for updates for mower: ${mower.id}`);
        mowerDataService.startListening(mower.id);
      }
    });
    
    return () => {
      // Clear any timers when component unmounts
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      setMounted(false);
      
      // Cleanup when component unmounts
      firebaseMowers.mowers.forEach(mower => {
        if (mower.id) {
          mowerDataService.stopListening(mower.id);
        }
      });
    };
  }, [firebaseMowers.mowers.length]);

  // Save categories to localStorage when they change
  useEffect(() => {
    if (categories.length > 0) {
      localStorage.setItem('mowerCategories', JSON.stringify(categories));
    }
  }, [categories]);
  
  // Handle adding/updating categories
  const handleCategoriesChange = (updatedCategories: Category[]) => {
    setCategories(updatedCategories);
    // If all categories were selected, keep it that way
    if (selectedCategory !== 'all' && !updatedCategories.some(c => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  };
  
  // Refresh mower data with debounce
  const handleRefresh = async () => {
    // Prevent multiple rapid refreshes
    if (firebaseMowers.isLoading) return;
    
    try {
      // Show loading notification
      const loadingToast = toast.loading('Refreshing mower data...');
      
      // 1. First trigger comprehensive data refresh from the Husqvarna API
      const refreshResult = await triggerComprehensiveDataRefresh();
      
      // 2. Then fetch the latest data from Firebase
      await firebaseMowers.fetchMowers();
      
      // Update last updated time and show success message
      const currentTime = new Date();
      setLastUpdated(currentTime.toLocaleTimeString());
      
      // Store the time of the comprehensive refresh in localStorage 
      // so the SystemStatsWidget can display it
      if (refreshResult.success) {
        localStorage.setItem('lastComprehensiveRefresh', currentTime.toISOString());
      }
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show appropriate success message
      if (refreshResult.success) {
        toast.success('Complete data refresh initiated');
      } else {
        // Still show success for the basic refresh even if comprehensive failed
        toast.success('Basic mower data refreshed');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error('Failed to refresh data');
    }
  };
  
  // Filter mowers based on selected category and status
  const filteredMowers = firebaseMowers.mowers.filter(mower => 
    // Filter by selected category
    (selectedCategory === 'all' || 
     // Check if mower has zones and if any zone matches the selected category
     (mower.zones && mower.zones.some(zone => 
       zone.name === selectedCategory || zone.workAreaId?.toString() === selectedCategory
     ))) &&
    // Filter by selected status
    (statusFilter === 'all' || mower.status === statusFilter)
  );
  
  // Convert mowers to the format expected by GoogleMapView
  const mowerLocations = filteredMowers.map(mower => ({
    id: mower.id,
    name: mower.name,
    lat: mower.coordinates?.latitude || 0,
    lng: mower.coordinates?.longitude || 0,
    direction: 0, // Hardcoded since we don't have direction data
    batteryLevel: mower.batteryLevel,
    // Use a type assertion to handle the status type
    status: (mower.status === 'leaving' ? 'idle' : mower.status) as MowerStatus,
    areaComplete: mower.areaComplete || 'N/A'
  }));
  
  // Handle mower selection on the map
  const handleMowerSelect = (mowerId: string | null) => {
    if (mowerId) {
      setSelectedMower(mowerId);
      setMowerDialogOpen(true);
    } else {
      setSelectedMower(null);
    }
  };
  
  // Get the selected mower details
  const getSelectedMowerDetails = () => {
    if (!selectedMower) return null;
    return firebaseMowers.mowers.find(mower => mower.id === selectedMower) || null;
  };
  
  // Selected mower
  const mowerDetails = getSelectedMowerDetails();
  
  // Handle mower command with offline check
  const handleMowerCommand = async (command: string, duration?: number) => {
    if (!selectedMower) return null;
    
    // Get the mower details
    const mower = firebaseMowers.mowers.find(m => m.id === selectedMower);
    
    // Prevent sending commands to offline mowers
    if (mower?.status === 'offline') {
      toast.error('Cannot send commands to offline mowers');
      console.log(`[Dashboard] Command ${command} rejected - mower ${selectedMower} is offline`);
      return null;
    }
    
    try {
      // Set pending command state
      const pendingDescription = getPendingCommandDescription(command, duration);
      console.log(`[Dashboard] Setting pending command for ${selectedMower}: ${command} - ${pendingDescription}`);
      
      setPendingCommands(prev => {
        const newState = {
          ...prev,
          [selectedMower]: {
            command,
            sentAt: new Date(),
            description: pendingDescription
          }
        };
        console.log('[Dashboard] Updated pendingCommands state:', newState);
        return newState;
      });
      
      // Update the mower's status in the dashboard immediately to reflect the pending command
      // This ensures mower cards show pending state right away
      updateMowerStatusImmediate(selectedMower, command);
      
      // Show toast notification that command is being sent
      toast.loading(`Sending ${command} command to mower...`);
      
      // Get token from auth
      const token = dashboard.token;
      if (!token) {
        // Clear pending state on error
        setPendingCommands(prev => {
          const newState = {...prev};
          delete newState[selectedMower];
          return newState;
        });
        
        toast.error('Authentication required');
        return null;
      }
      
      // Real implementation calling the API
      const response = await fetch(`/api/mowers/${selectedMower}/actions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command, duration })
      });
      
      // Clear loading toast
      toast.dismiss();
      
      if (!response.ok) {
        // Clear pending state on error
        setPendingCommands(prev => {
          const newState = {...prev};
          delete newState[selectedMower];
          return newState;
        });
        
        const errorData = await response.json();
        toast.error(errorData.message || `Failed to send ${command} command`);
        return null;
      }
      
      const data = await response.json();
      
      // On success, refresh the mower data after a short delay to let status update on server
      toast.success(`${command.charAt(0).toUpperCase() + command.slice(1)} command sent successfully`);
      
      // Wait 2 seconds for the command to take effect on the server
      setTimeout(async () => {
        await firebaseMowers.fetchMowers();
        setLastUpdated(new Date().toLocaleTimeString());
        
        // Keep pending state for up to 2 minutes as a failsafe
        setTimeout(() => {
          setPendingCommands(prev => {
            // Only clear if it's the same command (to avoid clearing a newer command)
            if (prev[selectedMower]?.command === command) {
              const newState = {...prev};
              delete newState[selectedMower];
              return newState;
            }
            return prev;
          });
        }, 2 * 60 * 1000);
      }, 2000);
      
      return { success: true, message: 'Command sent successfully' };
    } catch (error) {
      console.error('Error sending command:', error);
      
      // Clear pending state on error
      setPendingCommands(prev => {
        const newState = {...prev};
        delete newState[selectedMower];
        return newState;
      });
      
      toast.error(`Failed to send ${command} command`);
      return null;
    }
  };
  
  // Helper function to get a description for the pending command
  const getPendingCommandDescription = (command: string, duration?: number): string => {
    switch (command) {
      case 'start':
      case 'Start':
        return duration ? `Starting mower for ${duration} minutes...` : 'Starting mower...';
      case 'pause':
      case 'Pause':
        return 'Pausing mower...';
      case 'park':
      case 'Park':
      case 'home':
        return duration ? `Sending mower home for ${duration} minutes...` : 'Sending mower home...';
      case 'parkUntilNext':
      case 'ParkUntilNextSchedule':
        return 'Sending mower home until next task...';
      case 'ParkUntilFurtherNotice':
        return 'Sending mower home until further notice...';
      case 'resumeSchedule':
      case 'ResumeSchedule':
        return 'Resuming scheduled operation...';
      default:
        return `Sending ${command} command...`;
    }
  };
  
  // Add handler for realtime updates to clear pending commands
  useEffect(() => {
    // Set up event handler for mower data updates
    const handleMowerDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      if (!customEvent.detail) return;
      
      const { mowerId, data, isSignificantChange } = customEvent.detail;
      
      console.log(`[Dashboard] Received data update for mower ${mowerId}:`, 
        isSignificantChange ? 'SIGNIFICANT CHANGE' : 'minor update',
        'Has pending command:', pendingCommands[mowerId] ? 'YES' : 'NO'
      );
      
      // Update mower's UI status if the mower is in our data
      if (firebaseMowers.mowers && data) {
        const mowerIndex = firebaseMowers.mowers.findIndex(m => m.id === mowerId);
        if (mowerIndex !== -1) {
          // Check if mower is disconnected
          const isDisconnected = data.metadata?.connected === false;
          
          // Use the centralized helper for UI status mapping
          const { uiStatus, isChargingWhileParked } = mowerDataService.updateMowerUIStatus(mowerId, data);
          
          // Clone and update the mower data
          const updatedMowerData = [...firebaseMowers.mowers];
          const updatedMower = {...updatedMowerData[mowerIndex]};
          
          // Update status - override with offline if disconnected
          updatedMower.status = isDisconnected ? 'offline' : uiStatus;
          
          // Update battery level
          if (data.battery?.batteryPercent !== undefined) {
            updatedMower.batteryLevel = data.battery.batteryPercent;
          }
          
          // Add charging indicator metadata as a custom field
          // @ts-ignore - This is a custom field we're adding
          updatedMower.isChargingWhileParked = isChargingWhileParked;
          
          // Update the mower in the array
          updatedMowerData[mowerIndex] = updatedMower;
          
          // Update dashboard data
          firebaseMowers.setMowers(updatedMowerData);
          
          console.log(`[Dashboard] Updated mower ${mowerId} UI status to:`, 
            isDisconnected ? 'offline (disconnected)' : uiStatus);
        }
      }
      
      // Clear pending commands if appropriate
      if (isSignificantChange && pendingCommands[mowerId] && data?.mower) {
        const pendingCommand = pendingCommands[mowerId];
        const activity = data.mower.activity;
        const state = data.mower.state;
        
        console.log(`[Dashboard] Checking if pending command "${pendingCommand.command}" should be cleared based on activity="${activity}" state="${state}"`);
        
        let shouldClearPending = false;
        
        // If we're waiting for a Start command and the mower is now MOWING
        if (pendingCommand.command.includes('Start') || pendingCommand.command === 'ResumeSchedule') {
          if (activity === 'MOWING') {
            shouldClearPending = true;
            console.log('[Dashboard] Clearing Start/Resume command - mower is now MOWING');
          }
        } 
        // If we're waiting for a Pause command and the mower is now PAUSED
        else if (pendingCommand.command === 'Pause') {
          if (state === 'PAUSED' || activity === 'STOPPED_IN_GARDEN') {
            shouldClearPending = true;
            console.log('[Dashboard] Clearing Pause command - mower is now PAUSED or STOPPED_IN_GARDEN');
          }
        }
        // If we're waiting for a Park command and the mower is GOING_HOME or PARKED
        else if (pendingCommand.command.includes('Park')) {
          if (activity === 'GOING_HOME' || activity === 'PARKED_IN_CS') {
            shouldClearPending = true;
            console.log('[Dashboard] Clearing Park command - mower is now GOING_HOME or PARKED_IN_CS');
          }
        }
        
        if (shouldClearPending) {
          console.log(`[Dashboard] Clearing pending command "${pendingCommand.command}" for mower ${mowerId}`);
          setPendingCommands(prev => {
            const newState = {...prev};
            delete newState[mowerId];
            return newState;
          });
        }
      }
    };
    
    // Listen for mower data updates
    window.addEventListener('mower-data-updated', handleMowerDataUpdate);
    
    // Cleanup
    return () => {
      window.removeEventListener('mower-data-updated', handleMowerDataUpdate);
    };
  }, [pendingCommands]);
  
  // Update mower status immediate with proper offline handling
  const updateMowerStatusImmediate = (mowerId: string, command: string) => {
    // Only update if we have dashboard.mowerData and the specific mower exists
    if (!firebaseMowers.mowers || !firebaseMowers.mowers.length) return;
    
    // Find the mower in the dashboard data
    const mowerIndex = firebaseMowers.mowers.findIndex(m => m.id === mowerId);
    if (mowerIndex === -1) return;
    
    // Clone the current mower data
    const updatedMowerData = [...firebaseMowers.mowers];
    const mower = {...updatedMowerData[mowerIndex]};
    
    // If mower is already offline, don't change its status
    if (mower.status === 'offline') {
      console.log(`[Dashboard] Mower ${mowerId} is offline, not updating status after ${command} command`);
      return;
    }
    
    // Map command to expected activity
    let expectedActivity: string | undefined;
    let expectedState: string | undefined;
    
    if (command === 'Start' || command === 'StartInWorkArea' || command === 'ResumeSchedule') {
      expectedActivity = 'MOWING';
      expectedState = 'IN_OPERATION';
    } else if (command === 'Pause') {
      expectedActivity = 'STOPPED_IN_GARDEN';
      expectedState = 'PAUSED';
    } else if (command === 'Park' || command === 'ParkUntilNextSchedule') {
      expectedActivity = 'GOING_HOME';
      expectedState = 'IN_OPERATION';
    } else if (command === 'ParkUntilFurtherNotice') {
      expectedActivity = 'PARKED_IN_CS';
      expectedState = 'IN_OPERATION';
    }
    
    // Use the centralized helper for consistent mapping
    const newStatus = mowerDataService.mapMowerStateToUIState(
      expectedActivity, 
      expectedState,
      mower.batteryLevel
    );
    
    // Update the mower status
    mower.status = newStatus;
    updatedMowerData[mowerIndex] = mower;
    
    // This will trigger a re-render of the dashboard, including the MowerCards
    firebaseMowers.setMowers(updatedMowerData);
    
    console.log(`[Dashboard] Immediately updated mower ${mowerId} status to ${newStatus} after ${command} command`);
  };
  
  // Fetch work areas for each mower when dashboard loads
  useEffect(() => {
    const fetchWorkAreasForMowers = async () => {
      if (!dashboard.token || !firebaseMowers.mowers.length) return;
      
      console.log("[Dashboard] Fetching zone data for all mowers...");
      const workAreasMap: {[mowerId: string]: any[]} = {};
      
      // Fetch zone data for each mower
      for (const mower of firebaseMowers.mowers) {
        if (!mower.id) continue;
        
        try {
          // Check if mower supports work areas
          const supportsWorkAreas = mower.capabilities?.workAreas !== false;
          console.log(`[Dashboard] Mower ${mower.id} supports work areas: ${supportsWorkAreas ? 'Yes' : 'No'}`);
          
          // First, try to get work areas for all mowers
          const workAreas = await husqvarnaApi.getMowerWorkAreas(mower.id);
          if (workAreas && workAreas.length > 0) {
            console.log(`[DEBUG] Raw work areas data for ${mower.id}:`, JSON.stringify(workAreas, null, 2));
            
            // Check if any work areas have progress information
            const hasProgressInfo = workAreas.some(area => 
              area && area.attributes && typeof area.attributes.progress === 'number'
            );
            
            console.log(`[DEBUG] Has progress info: ${hasProgressInfo}`);
            
            if (hasProgressInfo) {
              console.log(`[Dashboard] Found progress information for mower ${mower.id}`);
              
              // Calculate average progress
              const workAreasWithProgress = workAreas.filter(area => 
                area && area.attributes && typeof area.attributes.progress === 'number'
              );
              
              console.log(`[DEBUG] Work areas with progress:`, JSON.stringify(workAreasWithProgress.map(area => ({
                id: area.id,
                progress: area.attributes.progress
              }))));
              
              const totalProgress = workAreasWithProgress.reduce(
                (sum, area) => sum + (area.attributes.progress || 0),
                0
              );
              
              const avgProgress = workAreasWithProgress.length > 0
                ? Math.round(totalProgress / workAreasWithProgress.length)
                : 0;
                
              console.log(`[Dashboard] Average progress for mower ${mower.id}: ${avgProgress}%`);
              
              // Update mower data with progress information
              const updatedMowerData = [...firebaseMowers.mowers];
              const mowerIndex = updatedMowerData.findIndex(m => m.id === mower.id);
              
              if (mowerIndex !== -1) {
                // Get existing area completion data to preserve it
                let existingAreaComplete: string | undefined;
                let existingWorkAreaProgress: any[] | undefined;
                
                if (updatedMowerData[mowerIndex]?.areaComplete) {
                  existingAreaComplete = updatedMowerData[mowerIndex].areaComplete;
                }
                
                if (updatedMowerData[mowerIndex]?.workAreaProgress) {
                  existingWorkAreaProgress = updatedMowerData[mowerIndex].workAreaProgress;
                }
                
                // Only update if the progress value has actually changed or we don't have it
                if (!existingAreaComplete || !existingAreaComplete.includes(`${avgProgress}%`)) {
                  console.log(`[Dashboard] Updating area completion for mower ${mower.id}: ${avgProgress}%`);
                  
                  updatedMowerData[mowerIndex] = {
                    ...updatedMowerData[mowerIndex],
                    areaComplete: `${avgProgress}%`,
                    workAreaProgress: workAreasWithProgress.map(area => ({
                      workAreaId: area.attributes.workAreaId || parseInt(area.id, 10),
                      name: area.attributes.name || `Work Area ${area.attributes.workAreaId || area.id}`,
                      progress: area.attributes.progress || 0,
                      lastCompleted: area.attributes.lastTimeCompleted
                    }))
                  };
                  
                  console.log(`[DEBUG] Updated mower data with progress:`, updatedMowerData[mowerIndex].areaComplete);
                } else {
                  console.log(`[Dashboard] Area completion unchanged for mower ${mower.id}: ${existingAreaComplete}`);
                }
                
                firebaseMowers.setMowers(updatedMowerData);
              }
            }
            
            workAreasMap[mower.id] = workAreas;
            
            // Update the mower's zones data
            updateMowerZonesData(mower, workAreas);
          } else {
            console.log(`[Dashboard] No work areas found for mower ${mower.id}, fetching calendar data...`);
            
            // For older models or when no work areas found, extract zones from calendar data
            const mowerData = await husqvarnaApi.getMower(mower.id);
            const calendarTasks = mowerData?.data?.attributes?.calendar?.tasks || [];
            
            if (calendarTasks && calendarTasks.length > 0) {
              console.log(`[Dashboard] Found ${calendarTasks.length} calendar tasks for mower ${mower.id}`);
              
              // Extract unique zones from calendar tasks
              const uniqueZones = extractZonesFromCalendarTasks(calendarTasks);
              if (uniqueZones.length > 0) {
                console.log(`[Dashboard] Extracted ${uniqueZones.length} zones from calendar for mower ${mower.id}`);
                
                // Convert to format similar to work areas
                const fakeWorkAreas = uniqueZones.map(zone => ({
                  id: zone.id?.toString() || "default",
                  attributes: {
                    name: zone.name,
                    workAreaId: zone.id,
                    color: zone.color
                  }
                }));
                
                workAreasMap[mower.id] = fakeWorkAreas;
                
                // Update mower data with these zones
                updateMowerZonesData(mower, fakeWorkAreas);
              } else {
                console.log(`[Dashboard] No zones found in calendar for mower ${mower.id}`);
                workAreasMap[mower.id] = [];
              }
            } else {
              console.log(`[Dashboard] No calendar tasks found for mower ${mower.id}`);
              workAreasMap[mower.id] = [];
            }
          }
        } catch (error) {
          console.error(`[Dashboard] Error fetching zone data for mower ${mower.id}:`, error);
          workAreasMap[mower.id] = [];
        }
      }
      
      setWorkAreasData(workAreasMap);
    };
    
    if (firebaseMowers.mowers.length > 0) {
      fetchWorkAreasForMowers();
    }
  }, [dashboard.token, firebaseMowers.mowers.length]);
  
  // Helper function to map work areas to categories format
  const getWorkAreasAsCategories = (mowerId: string): Category[] => {
    const mower = firebaseMowers.mowers.find(m => m.id === mowerId);
    if (!mower) return [{ id: "default", name: "Default Zone", color: "#3b82f6" }];
    
    // First try to use the real work areas from API
    if (workAreasData[mowerId] && workAreasData[mowerId].length > 0) {
      console.log(`[Dashboard] Using ${workAreasData[mowerId].length} work areas from API for mower ${mowerId}`);
      
      // Map work area data to categories format
      return workAreasData[mowerId].map(workArea => {
        // Generate a consistent color based on the workArea ID
        const colorOptions = ["#3b82f6", "#ef4444", "#f59e0b", "#6366f1", "#8b5cf6", "#06b6d4", "#d946ef"];
        const workAreaId = workArea.id.toString();
        const colorIndex = parseInt(workAreaId.substring(workAreaId.length - 2), 10) % colorOptions.length;
        
        return {
          id: workArea.id.toString(),
          name: workArea.attributes.name || `Work Area ${workArea.attributes.workAreaId || workArea.id}`,
          color: workArea.attributes.color || colorOptions[colorIndex]
        };
      });
    }
    
    // If no work areas from API, try to use zones from mower data
    if (mower.zones && mower.zones.length > 0) {
      console.log(`[Dashboard] Using ${mower.zones.length} zones from mower data for mower ${mowerId}`);
      return mower.zones.map(zone => ({
        id: zone.workAreaId?.toString() || zone.name,
        name: zone.name,
        color: zone.color || '#3b82f6'
      }));
    }
    
    // If still no zones, create a single "Default Zone" instead of using mock data
    console.log(`[Dashboard] No zones found for mower ${mowerId}, using default zone`);
    return [{
      id: "default",
      name: "Default Zone",
      color: "#3b82f6"
    }];
  };
  
  // Add helper function to extract zones from calendar tasks
  const extractZonesFromCalendarTasks = (calendarTasks: any[]): Array<{name: string, id?: number, color?: string}> => {
    const zonesMap = new Map<string, {name: string, id?: number, color?: string}>();
    
    // Color palette for consistent colors
    const colorOptions = ["#3b82f6", "#ef4444", "#f59e0b", "#6366f1", "#8b5cf6", "#06b6d4", "#d946ef"];
    
    calendarTasks.forEach(task => {
      // Check for zones array in task
      if (task.zones && task.zones.length > 0) {
        task.zones.forEach((zone: any, index: number) => {
          const zoneName = zone.name || `Zone ${zone.id || index}`;
          
          if (!zonesMap.has(zoneName)) {
            zonesMap.set(zoneName, {
              name: zoneName,
              id: zone.id,
              color: colorOptions[index % colorOptions.length]
            });
          }
        });
      } 
      // Check for workAreaId in task
      else if (task.workAreaId) {
        const workAreaName = `Work Area ${task.workAreaId}`;
        
        if (!zonesMap.has(workAreaName)) {
          zonesMap.set(workAreaName, {
            name: workAreaName,
            id: task.workAreaId,
            color: colorOptions[task.workAreaId % colorOptions.length]
          });
        }
      }
    });
    
    // If no zones were found but we have tasks, create at least a "Default Zone"
    if (zonesMap.size === 0 && calendarTasks.length > 0) {
      zonesMap.set("Default Zone", {
        name: "Default Zone",
        color: colorOptions[0]
      });
    }
    
    return Array.from(zonesMap.values());
  };
  
  // Helper to update mower zones data
  const updateMowerZonesData = (mower: any, zonesData: any[]) => {
    if (!mower || !zonesData || zonesData.length === 0) return;
    
    // Only update if mower zones are empty or fewer than what we found
    if (!mower.zones || mower.zones.length === 0 || mower.zones.length < zonesData.length) {
      const zones = zonesData.map((zone, index) => {
        // Generate consistent colors
        const colorOptions = ["#3b82f6", "#ef4444", "#f59e0b", "#6366f1", "#8b5cf6", "#06b6d4", "#d946ef"];
        
        return {
          name: zone.attributes?.name || zone.name || `Zone ${index}`,
          color: zone.attributes?.color || zone.color || colorOptions[index % colorOptions.length],
          workAreaId: zone.attributes?.workAreaId || zone.id || null
        };
      });
      
      // Update mower data
      const updatedMowerData = [...firebaseMowers.mowers];
      const mowerIndex = updatedMowerData.findIndex(m => m.id === mower.id);
      if (mowerIndex !== -1) {
        updatedMowerData[mowerIndex] = {
          ...updatedMowerData[mowerIndex],
          zones: zones
        };
        firebaseMowers.setMowers(updatedMowerData);
        console.log(`[Dashboard] Updated mower ${mower.id} with ${zones.length} zones`);
      }
    }
  };
  
  // Show loading state while not mounted or not authenticated
  if (!mounted || !dashboard.token) {
    return (
      <div className="p-8 flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <h2 className="text-2xl font-medium">Loading dashboard...</h2>
          <p className="text-muted-foreground">Please wait while we prepare your dashboard</p>
        </div>
      </div>
    );
  }
  
  // Show loading overlay while fetching data
  if (firebaseMowers.isLoading) {
    return (
      <div className="p-8 flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <h2 className="text-2xl font-medium">Loading mower data...</h2>
        </div>
      </div>
    );
  }
  
  // Render the dashboard content
  return (
    <div className="bg-background min-h-screen">
      {/* Combined filters bar - categories and statuses in one bar */}
      <div className="flex flex-wrap justify-between items-center px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-3">
            <button
              key="all"
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-3 py-1 text-sm flex items-center ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              All
            </button>
            
            {categories.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-full px-3 py-1 text-sm flex items-center ${
                  selectedCategory === category.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <span 
                  className="w-2 h-2 rounded-full mr-2" 
                  style={{ backgroundColor: category.color }}
                />
                {category.name}
              </button>
            ))}
            
            <button
              type="button"
              onClick={() => setCategoryManagementOpen(true)}
              className="rounded-full px-3 py-1 text-sm flex items-center bg-secondary text-secondary-foreground"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Category
            </button>
          </div>
          
          <div className="h-6 w-px bg-border mx-2 hidden md:block" />
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground mr-2">Status:</div>
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-md px-3 py-1 text-sm mr-1 ${
                  statusFilter === filter.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto mt-2 md:mt-0">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            Last update: {lastUpdated || "N/A"}
          </div>
        
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center justify-center px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Category Management Dialog */}
      <Dialog open={categoryManagementOpen} onOpenChange={setCategoryManagementOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Category Management</DialogTitle>
          </DialogHeader>
          <CategoryManagement 
            initialCategories={categories}
            onChange={handleCategoriesChange}
          />
        </DialogContent>
      </Dialog>
      
      {/* Map and widgets section */}
      <div className="grid grid-cols-1 md:grid-cols-12 px-4 py-4 gap-4">
        {/* Map container - takes up left side */}
        <div className="md:col-span-6 h-[350px] md:h-[500px]">
          <div className="h-full w-full rounded-lg overflow-hidden bg-card shadow-sm flex" style={{ flexDirection: 'column' }}>
            <GoogleMapView 
              mowers={mowerLocations}
              className="w-full h-full flex-1"
              onMowerSelect={handleMowerSelect}
              showZones={showZones}
              onToggleZones={(show) => setShowZones(show)}
            />
          </div>
        </div>
        
        {/* System stats widget - middle */}
        <div className="md:col-span-3 h-[350px] md:h-[500px]">
          <SystemStatsWidget 
            lastUpdated={lastUpdated} 
            onRefresh={handleRefresh}
            systemData={{
              apiResponseTime: 320,
              networkLatency: 56,
              connectedMowers: firebaseMowers.mowers.filter(m => m.status !== 'offline').length,
              totalMowers: firebaseMowers.mowers.length,
              servicesStatus: {
                api: true,
                websocket: true,
                database: true
              }
            }}
            // Pass the mower data for the widget to calculate status distribution
            mowerData={firebaseMowers.mowers}
            // Calculate fleet status from real dashboard data
            fleetStatus={{
              // Count mowers in each status
              statusCounts: firebaseMowers.mowers.reduce((counts, mower) => {
                const status = mower.status as MowerStatus;
                if (!counts[status]) counts[status] = 0;
                counts[status] += 1;
                return counts;
              }, {
                'mowing': 0,
                'charging': 0,
                'idle': 0,
                'error': 0,
                'offline': 0,
                'returning': 0,
                'parked': 0,
                'online': 0,
                'paused': 0
              } as Record<MowerStatus, number>),
              totalMowers: firebaseMowers.mowers.length,
              // Calculate efficiency - percentage of mowers that are not in error, paused, or offline states
              efficiency: (() => {
                const total = firebaseMowers.mowers.length;
                if (total === 0) return 100;
                const problemMowers = firebaseMowers.mowers.filter(m => 
                  m.status === 'error' || m.status === 'paused' || m.status === 'offline'
                ).length;
                return Math.round(((total - problemMowers) / total) * 100);
              })(),
              // Blade change days removed
              bladeChangeDaysRemaining: 14, // This is no longer used but kept for interface compatibility
              // Collect all mowers with errors, including proper error data
              errors: firebaseMowers.mowers
                .filter(m => m.status === 'error')
                .map(mower => ({
                  mowerId: mower.id,
                  mowerName: mower.name,
                  errorCode: (mower as any).attributes?.mower?.errorCode || 
                    parseInt(mower.errorMessage?.replace('Error code: ', '') || '0', 10),
                  errorTimestamp: (mower as any).attributes?.mower?.errorCodeTimestamp || 
                    (mower.lastUpdated ? mower.lastUpdated.getTime() : Date.now() - 3600000),
                  status: mower.status as MowerStatus
                })),
              // Calculate zone completion using actual API data where available
              totalZones: (() => {
                // Sum all work areas across mowers
                let zoneCount = 0;
                firebaseMowers.mowers.forEach(mower => {
                  if (mower.zones && mower.zones.length > 0) {
                    zoneCount += mower.zones.length;
                  } else if ((mower as any).attributes?.zones && (mower as any).attributes.zones.length > 0) {
                    zoneCount += (mower as any).attributes.zones.length;
                  } else {
                    // If no zones defined, assume at least 1 zone per mower
                    zoneCount += 1;
                  }
                });
                return Math.max(zoneCount, 1); // Ensure at least 1 zone exists
              })(),
              completedZones: (() => {
                let completedCount = 0;
                firebaseMowers.mowers.forEach(mower => {
                  // Consider zones complete when:
                  // 1. Mower is in parked/charging state with areaComplete >= 90%
                  // 2. Mower has attributes.workAreas with progress 100
                  if ((mower.status === 'parked' || mower.status === 'charging') && 
                      parseInt(mower.areaComplete || '0', 10) >= 90) {
                    // Add all zones from this mower as completed
                    completedCount += mower.zones?.length || 1;
                  } else if ((mower as any).attributes?.workAreas) {
                    // Count work areas marked as 100% complete
                    ((mower as any).attributes.workAreas as any[]).forEach((area: any) => {
                      if (area.attributes?.progress === 100) {
                        completedCount += 1;
                      }
                    });
                  } else if (parseInt(mower.areaComplete || '0', 10) > 0) {
                    // Partial completion based on areaComplete percentage
                    const zoneCount = mower.zones?.length || 1;
                    const percent = parseInt(mower.areaComplete || '0', 10) / 100;
                    completedCount += Math.round(zoneCount * percent);
                  }
                });
                return completedCount;
              })()
            }}
            className="h-full"
          />
        </div>
        
        {/* Weather widget - right side */}
        <div className="md:col-span-3 h-[350px] md:h-[500px]">
          <div className="h-full bg-card rounded-lg overflow-hidden shadow-sm">
            <WeatherWidget 
              // Get location from mowers if available
              {...getLocationFromMowers(firebaseMowers.mowers)}
              className="h-full"
            />
          </div>
        </div>
      </div>
      
      {/* Mower cards section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 px-4 py-4 border-t border-border">
        {filteredMowers.length > 0 ? (
          filteredMowers.map(mower => (
            <MowerCard
              key={mower.id}
              id={mower.id}
              name={mower.name}
              status={mower.status as MowerStatus}
              batteryLevel={mower.batteryLevel}
              areaComplete={mower.areaComplete || 'N/A'}
              nextMaintenance={7}
              errorMessage={mower.errorMessage || (mower.status === 'error' ? `Error code: ${(mower as any).errorCode || 'Unknown'}` : null)}
              imageSrc={`/images/mower-${mower.status === 'error' ? 'red' : 'gray'}.png`}
              isSelected={mower.id === selectedMower}
              onSelect={handleMowerSelect}
              lastUpdated={mower.lastUpdated}
              lastChanged={mowerDataService.getLastChangeTimestamp(mower.id) ? new Date(mowerDataService.getLastChangeTimestamp(mower.id)!) : undefined}
              dataSource={mower.dataSource || 'unknown'}
              categories={mower.id ? getWorkAreasAsCategories(mower.id) : []}
              pendingCommand={pendingCommands[mower.id]}
              isChargingWhileParked={mower.isChargingWhileParked}
              nextStartTime={mower.nextStartTime}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8 bg-card rounded-lg">
            <p className="text-muted-foreground">No mowers match the selected filters</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => {
                setSelectedCategory('all');
                setStatusFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
      
      {/* Mower Details Dialog - Using existing MowerStats component with schedule integration */}
      <Dialog 
        open={mowerDialogOpen} 
        onOpenChange={setMowerDialogOpen}
      >
        <DialogContent 
          className="w-[85%] max-w-5xl mx-auto max-h-[90vh] bg-background border border-border text-foreground p-0 overflow-hidden rounded-lg"
          onInteractOutside={(e) => e.preventDefault()} // Prevent closing on outside click
          onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing on Escape key
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{mowerDetails?.name || 'Mower Details'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden px-0 py-0 mower-stats-container">
            {mowerDetails && (
              <MowerStats
                mowerName={mowerDetails.name}
                mowerModel={mowerDetails.model}
                mowerImage={`/images/mower-${mowerDetails.status === 'error' ? 'red' : 'gray'}.png`}
                mowerId={mowerDetails.id}
                batteryLevel={mowerDetails.batteryLevel}
                areaComplete={mowerDetails.areaComplete || 'N/A'}
                mowerStatus={mowerDetails.status as MowerStatus}
                currentZone={mowerDetails.zones?.[0]?.name || "Default Zone"}
                hideTopCard={false}
                onCommand={handleMowerCommand}
                supportsAreaCompletion={true}
                zones={mowerDetails.zones || [
                  { name: "Default Zone", color: "#3b82f6" }
                ]}
                className="dark"
                nextStartTime={mowerDetails.nextStartTime}
                // Add our custom schedule component for the MowerStats tabs
                customScheduleComponent={
                  <div className="border rounded-lg p-4">
                    {mowerDetails.id && (
                      <MowerSchedule mowerId={mowerDetails.id} />
                    )}
                  </div>
                }
                // Pass real work areas to MowerStats
                workAreas={mowerDetails.id ? workAreasData[mowerDetails.id] || [] : []}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Custom scrollbar styling */}
      <style jsx global>{`
        .mower-stats-container {
          scrollbar-width: thin;
          scrollbar-color: #4b5563 #1f2937;
        }
        .mower-stats-container::-webkit-scrollbar {
          width: 8px;
        }
        .mower-stats-container::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 10px;
        }
        .mower-stats-container::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 10px;
        }

        /* Fix Google Maps display */
        .gm-style {
          position: absolute !important;
          height: 100% !important;
          width: 100% !important;
        }
        
        /* Ensure the map canvas takes the full space */
        .gm-style > div:first-child {
          height: 100% !important;
          width: 100% !important;
        }
        
        /* Make sure the map container has correct position */
        .gm-style-pbc {
          z-index: 2;
          position: absolute;
          height: 100%;
          width: 100%;
          top: 0;
          left: 0;
        }
      `}</style>
    </div>
  );
} 