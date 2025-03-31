import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { toast } from 'react-hot-toast';
import { ScheduleItem, TimeSlot } from '@/components/dashboard/mower-stats/types';

// Simple types to replace WebSocket types
export enum MowerActivity {
  UNKNOWN = 'UNKNOWN',
  MOWING = 'MOWING',
  GOING_HOME = 'GOING_HOME',
  CHARGING = 'CHARGING',
  LEAVING = 'LEAVING',
  PARKED_IN_CS = 'PARKED_IN_CS',
  STOPPED_IN_GARDEN = 'STOPPED_IN_GARDEN'
}

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

// API mower data interface
interface ApiMower {
  id: string;
  attributes?: {
    system?: {
      name?: string;
      model?: string;
    };
    battery?: {
      batteryPercent?: number;
    };
    mower?: {
      mode?: string;
      activity?: string;
      state?: string;
      errorCode?: number;
      errorCodeTimestamp?: number;
    };
    positions?: Array<{
      latitude: number;
      longitude: number;
    }>;
    statistics?: {
      numberOfChargingCycles?: number;
      numberOfCollisions?: number;
      totalChargingTime?: number;
      totalCuttingTime?: number;
      totalRunningTime?: number;
      totalSearchingTime?: number;
    };
    calendar?: {
      tasks?: Array<{
        start: number;
        duration: number;
        monday?: boolean;
        tuesday?: boolean;
        wednesday?: boolean;
        thursday?: boolean;
        friday?: boolean;
        saturday?: boolean;
        sunday?: boolean;
        zones?: Array<{
          name?: string;
          id?: number;
        }>;
      }>;
    };
    zones?: Array<{
      name: string;
      id: number;
    }>;
  };
}

// Types for mower data
interface Mower {
  id: string;
  name: string;
  model: string;
  status: string;
  batteryLevel: number;
  areaComplete: string;
  imageSrc?: string;
  categories: string[];
  errorMessage: string | null;
  x?: number;
  y?: number;
  direction?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  statistics?: {
    chargingCycles: number;
    collisions: number;
    chargingTime: number;
    cuttingTime: number;
    runningTime: number;
    searchingTime: number;
  };
  schedule?: ScheduleItem[];
  zones?: Array<{ name: string, color: string, workAreaId?: number }>;
  supportsAreaCompletion: boolean;
}

// Get a random color for a zone
const getRandomColor = () => {
  const colors = [
    "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", 
    "#ef4444", "#06b6d4", "#ec4899", "#84cc16"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Clean dashboard hook without WebSocket connections
export const useDashboard = () => {
  // All state hooks here - these must be called unconditionally
  const [selectedMower, setSelectedMower] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState({ show: false, message: '', type: 'info' });
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showHomeOptionsDialog, setShowHomeOptionsDialog] = useState(false);
  const [mowerStatus, setMowerStatus] = useState(null);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [isReady, setIsReady] = useState(false);
  
  // State for real mower data
  const [mowerData, setMowerData] = useState<Mower[]>([]);
  
  // Categories management
  const [selectedCategories, setSelectedCategories] = useState(["all"]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", color: "#64748b" });
  const [userCategories, setUserCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [buttonLoading, setButtonLoading] = useState({
    play: false,
    pause: false,
    home: false
  });

  // Context hooks
  const router = useRouter();
  const { token, refreshToken } = useAuth();
  
  // Get the authentication token for API calls
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('mowerAccessToken') : null;
  
  // Helper function to close toast after delay
  const closeToast = useCallback(() => {
    setTimeout(() => {
      setToastMessage(prev => ({ ...prev, show: false }));
    }, 3000);
  }, []);
  
  // Maps API mower data to our application's format
  const mapApiMowerToAppMower = useCallback((apiMower: ApiMower): Mower => {
    // Map status from activity
    const activity = apiMower.attributes?.mower?.activity?.toLowerCase() || 'unknown';
    let status: string;
    
    switch (activity) {
      case 'mowing':
        status = 'mowing';
        break;
      case 'charging':
        status = 'charging';
        break;
      case 'going_home':
      case 'going home':
        status = 'returning';
        break;
      case 'parked_in_cs':
      case 'parked in cs':
        status = 'parked';
        break;
      case 'stopped_in_garden':
      case 'stopped in garden':
        status = 'idle';
        break;
      case 'error':
        status = 'error';
        break;
      case 'offline':
        status = 'offline';
        break;
      default:
        status = 'idle';
    }

    // Extract statistics if available
    const statistics = apiMower.attributes?.statistics ? {
      chargingCycles: apiMower.attributes.statistics.numberOfChargingCycles || 0,
      collisions: apiMower.attributes.statistics.numberOfCollisions || 0,
      chargingTime: apiMower.attributes.statistics.totalChargingTime || 0,
      cuttingTime: apiMower.attributes.statistics.totalCuttingTime || 0,
      runningTime: apiMower.attributes.statistics.totalRunningTime || 0,
      searchingTime: apiMower.attributes.statistics.totalSearchingTime || 0
    } : undefined;

    // Check if the model supports area completion
    // Note: This is a simplified check - in production you'd have a proper list of models
    const modelName = apiMower.attributes?.system?.model || '';
    const supportsAreaCompletion = 
      modelName.toLowerCase().includes('epos') || 
      modelName.toLowerCase().includes('450') || 
      modelName.toLowerCase().includes('500');
    
    // Only calculate area completion if supported and mower is in active cycle
    let areaComplete = 'N/A';
    if (supportsAreaCompletion && status === 'mowing') {
      // In a real implementation, you would use actual area completion data from the API
      // For now, we'll use battery level as a proxy
      const areaCompletionValue = Math.min(100 - (apiMower.attributes?.battery?.batteryPercent || 0), 100);
      areaComplete = `${areaCompletionValue}%`;
    }

    // Map zone data if available
    const zones = apiMower.attributes?.zones?.map(zone => ({
      name: zone.name,
      color: getRandomColor(),
      workAreaId: zone.id
    }));

    // Map schedule data from calendar tasks
    let schedule: ScheduleItem[] = [];

    if (apiMower.attributes?.calendar?.tasks) {
      const tasks = apiMower.attributes.calendar.tasks;
      
      // Create a schedule for each day of the week
      const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const weekDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      // Initialize the schedule with empty days
      schedule = weekDays.map((day, index) => ({
        day: day.substring(0, 3), // Use abbreviations: Mon, Tue, etc.
        timeSlots: []
      }));
      
      // Process each task
      for (const task of tasks) {
        // Calculate start and end times from the task data
        const startMinutes = task.start;
        const endMinutes = task.start + task.duration;
        
        // Convert minutes to HH:MM format
        const formatTime = (minutes: number) => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        };
        
        const startTime = formatTime(startMinutes);
        const endTime = formatTime(endMinutes);
        
        // Associate zones with this task
        const taskZones = task.zones?.map(zone => {
          // Find the full zone data or use a default color if not found
          const matchedZone = zones?.find(z => z.workAreaId === zone.id);
          return {
            name: zone.name || (matchedZone?.name || 'Unknown Zone'),
            color: matchedZone?.color || getRandomColor()
          };
        }) || [];
        
        // Add time slot to each applicable day
        for (let i = 0; i < weekDayKeys.length; i++) {
          const dayKey = weekDayKeys[i];
          if (task[dayKey as keyof typeof task]) {
            schedule[i].timeSlots.push({
              startTime,
              endTime,
              zones: taskZones.length > 0 ? taskZones : [{ name: 'Entire Yard', color: '#10b981' }]
            });
          }
        }
      }
      
      // Sort time slots by start time
      for (const day of schedule) {
        day.timeSlots.sort((a: TimeSlot, b: TimeSlot) => {
          return a.startTime.localeCompare(b.startTime);
        });
      }
      
      console.log("Processed mower schedule:", JSON.stringify(schedule, null, 2));
    }

    return {
      id: apiMower.id,
      name: apiMower.attributes?.system?.name || 'Unnamed Mower',
      model: apiMower.attributes?.system?.model || 'Unknown Model',
      status,
      batteryLevel: apiMower.attributes?.battery?.batteryPercent || 0,
      areaComplete,
      categories: ['all'], // Default category
      errorMessage: apiMower.attributes?.mower?.errorCode ? 
        `Error code: ${apiMower.attributes?.mower?.errorCode}` : null,
      coordinates: apiMower.attributes?.positions?.length ? {
        latitude: apiMower.attributes.positions[0].latitude,
        longitude: apiMower.attributes.positions[0].longitude
      } : undefined,
      statistics,
      schedule,
      zones: zones || [
        { name: "Front Yard", color: "#3b82f6" },
        { name: "Back Yard", color: "#ef4444" },
        { name: "Side Yard", color: "#f59e0b" }
      ],
      supportsAreaCompletion
    };
  }, []);
  
  // Fetch mowers from the API
  const fetchMowers = useCallback(async () => {
    if (!token) {
      return [];
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/mowers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await refreshToken();
          if (!refreshed) {
            setAuthRequired(true);
            toast.error('Your session has expired. Please log in again.');
            return [];
          }
          // Retry with new token
          return fetchMowers();
        }
        
        throw new Error(`Failed to fetch mowers: ${response.status}`);
      }

      const apiMowers = await response.json();
      
      // Debug log to verify we're getting calendar data
      if (Array.isArray(apiMowers) && apiMowers.length > 0) {
        console.log('First mower has calendar?', 
          !!apiMowers[0]?.attributes?.calendar,
          'Calendar sample:',
          JSON.stringify(apiMowers[0]?.attributes?.calendar, null, 2)
        );
      }
      
      if (Array.isArray(apiMowers)) {
        const formattedMowers = apiMowers.map(mapApiMowerToAppMower);
        setMowerData(formattedMowers);
        return formattedMowers;
      }
      
      setMowerData([]);
      return [];
    } catch (error) {
      toast.error('Failed to load mower data');
      setMowerData([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [token, refreshToken, mapApiMowerToAppMower]);
  
  // Simple initialization effect
  useEffect(() => {
    // Only fetch data once on initial mount when token is available
    const shouldFetch = token && !isLoading;
    
    if (shouldFetch) {
      setIsReady(true);
      
      // Use a ref to track if we've already fetched data
      const initialFetch = async () => {
        try {
          await fetchMowers();
        } catch {
          // Error already handled in fetchMowers
        }
      };
      
      initialFetch();
    } else {
      setIsReady(false);
    }
    // Removing fetchMowers and isLoading from the dependency array to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  
  return {
    // State
    selectedMower,
    showStatsModal,
    toastMessage,
    showZoneDialog,
    showHomeOptionsDialog,
    mowerStatus,
    showFullscreenMap,
    currentTime,
    isLoading,
    authRequired,
    showZones,
    isReady,
    mowerData,
    selectedCategories,
    showCategoryDialog,
    newCategory,
    userCategories,
    statusFilter,
    buttonLoading,
    token,
    authToken,
    connectionStatus: ConnectionStatus.DISCONNECTED, // Always return disconnected
    isConnected: false, // Always return false
    lastEvent: null,
    sseConnected: false,
    sseEvent: null,
    
    // Setters
    setSelectedMower,
    setShowStatsModal,
    setToastMessage,
    setShowZoneDialog,
    setShowHomeOptionsDialog,
    setMowerStatus,
    setShowFullscreenMap,
    setCurrentTime,
    setIsLoading,
    setAuthRequired,
    setShowZones,
    setIsReady,
    setMowerData,
    setSelectedCategories,
    setShowCategoryDialog,
    setNewCategory,
    setUserCategories,
    setStatusFilter,
    setButtonLoading,
    
    // Functions
    closeToast,
    fetchMowers,
    subscribeToMower: () => () => {} // Dummy function
  };
}; 