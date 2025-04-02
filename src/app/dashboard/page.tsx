'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { toast } from 'react-hot-toast';
import { MowerCard } from '@/components/dashboard/MowerCard';
import { GoogleMapView } from '@/components/dashboard/GoogleMapView';
import WeatherWidget from '@/components/dashboard/WeatherWidget';
import { MowerStatusDisplay } from '@/components/dashboard/MowerStatusDisplay';
import { MowerControlPanel } from '@/components/dashboard/MowerControlPanel';
import { MowerZoneManager } from '@/components/dashboard/MowerZoneManager';
import { ConnectionStatusIcons } from '@/components/dashboard/ConnectionStatusIcons';
import { MowerStats } from '@/components/dashboard/mower-stats/MowerStats';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, RefreshCw, X, Tag } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { WebSocketStatus } from '@/lib/husqvarna/websocket';
import { SystemStatsWidget } from '@/components/dashboard/SystemStatsWidget';
import { triggerComprehensiveDataRefresh } from './actions';
import { Category } from '@/components/dashboard/MowerCard';
import CategoryManagement from '@/components/dashboard/CategoryManagementDialog';
import { getLocationFromMowers } from '@/lib/weather/location-utils';

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
  // Use our dashboard hook
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
  
  // Set mounted to true after initial render
  useEffect(() => {
    setMounted(true);
    
    // Set initial last updated time
    if (dashboard.mowerData.length > 0) {
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
    
    return () => {
      // Clear any timers when component unmounts
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      setMounted(false);
    };
  }, [dashboard.mowerData.length]);

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
    if (dashboard.isLoading) return;
    
    try {
      // Show loading notification
      const loadingToast = toast.loading('Refreshing mower data...');
      
      // 1. First trigger comprehensive data refresh from the Husqvarna API
      const refreshResult = await triggerComprehensiveDataRefresh();
      
      // 2. Then fetch the latest data from our API/database
      await dashboard.fetchMowers();
      
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
  const filteredMowers = dashboard.mowerData.filter(mower => {
    const matchesStatus = statusFilter === 'all' || mower.status === statusFilter;
    
    // For category filtering, if selectedCategory is 'all', show all mowers
    // Otherwise, check if the mower has this category assigned
    // For this example, we'll assume each mower has a categories array property
    // This would need to be implemented in your backend or data fetching logic
    const matchesCategory = selectedCategory === 'all' || 
      (mower.categories && mower.categories.includes(selectedCategory));
      
    return matchesStatus && matchesCategory;
  });
  
  // Convert mowers to the format expected by GoogleMapView
  const mowerLocations = filteredMowers.map(mower => ({
    id: mower.id,
    name: mower.name,
    lat: mower.coordinates?.latitude || 0,
    lng: mower.coordinates?.longitude || 0,
    direction: mower.direction || 0,
    batteryLevel: mower.batteryLevel,
    areaComplete: mower.areaComplete,
    status: mower.status as MowerStatus,
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
    return dashboard.mowerData.find(mower => mower.id === selectedMower) || null;
  };
  
  // Selected mower
  const mowerDetails = getSelectedMowerDetails();
  
  // Handle mower command
  const handleMowerCommand = async (command: string, duration?: number) => {
    if (!selectedMower) return null;
    
    try {
      // Show toast notification that command is being sent
      toast.loading(`Sending ${command} command to mower...`);
      
      // Get token from auth
      const token = dashboard.token;
      if (!token) {
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
        const errorData = await response.json();
        toast.error(errorData.message || `Failed to send ${command} command`);
        return null;
      }
      
      const data = await response.json();
      
      // On success, refresh the mower data after a short delay to let status update on server
      toast.success(`${command.charAt(0).toUpperCase() + command.slice(1)} command sent successfully`);
      
      // Wait 2 seconds for the command to take effect on the server
      setTimeout(async () => {
        await dashboard.fetchMowers();
        setLastUpdated(new Date().toLocaleTimeString());
      }, 2000);
      
      return { success: true, message: 'Command sent successfully' };
    } catch (error) {
      console.error('Error sending command:', error);
      toast.error(`Failed to send ${command} command`);
      return null;
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
  if (dashboard.isLoading) {
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
              connectedMowers: dashboard.mowerData.filter(m => m.status !== 'offline').length,
              totalMowers: dashboard.mowerData.length,
              servicesStatus: {
                api: true,
                websocket: true,
                database: true
              }
            }}
            // Pass the mower data for the widget to calculate status distribution
            mowerData={dashboard.mowerData}
            // Calculate fleet status from real dashboard data
            fleetStatus={{
              // Count mowers in each status
              statusCounts: dashboard.mowerData.reduce((counts, mower) => {
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
              totalMowers: dashboard.mowerData.length,
              // Calculate efficiency - percentage of mowers that are not in error, paused, or offline states
              efficiency: (() => {
                const total = dashboard.mowerData.length;
                if (total === 0) return 100;
                const problemMowers = dashboard.mowerData.filter(m => 
                  m.status === 'error' || m.status === 'paused' || m.status === 'offline'
                ).length;
                return Math.round(((total - problemMowers) / total) * 100);
              })(),
              // Blade change days removed
              bladeChangeDaysRemaining: 14, // This is no longer used but kept for interface compatibility
              // Collect all mowers with errors, including proper error data
              errors: dashboard.mowerData
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
                dashboard.mowerData.forEach(mower => {
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
                dashboard.mowerData.forEach(mower => {
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
              {...getLocationFromMowers(dashboard.mowerData)}
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
              areaComplete={mower.areaComplete}
              nextMaintenance={14}
              errorMessage={mower.errorMessage}
              imageSrc={`/images/mower-${mower.status === 'error' ? 'red' : 'gray'}.png`}
              isSelected={selectedMower === mower.id}
              onSelect={handleMowerSelect}
              lastUpdated={mower.lastUpdated}
              dataSource={mower.dataSource || 'unknown'}
              categories={categories.filter(cat => 
                mower.categories && mower.categories.includes(cat.id)
              )}
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
      
      {/* Additional controls section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4 border-t border-border">
        <div className="bg-card p-4 rounded-lg">
          <MowerControlPanel 
            mowerId={selectedMower || (dashboard.mowerData[0]?.id || '')}
            onCommand={handleMowerCommand}
          />
        </div>
        <div className="bg-card p-4 rounded-lg">
          <MowerZoneManager mowerId={selectedMower || (dashboard.mowerData[0]?.id || '')} />
        </div>
      </div>
      
      {/* Mower Details Dialog - Using existing MowerStats component */}
      <Dialog 
        open={mowerDialogOpen} 
        onOpenChange={setMowerDialogOpen}
      >
        <DialogContent 
          className="w-[85%] max-w-5xl mx-auto max-h-[90vh] bg-background border border-border text-foreground p-0 overflow-hidden rounded-lg"
          onInteractOutside={(e) => e.preventDefault()} // Prevent closing on outside click
          onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing on Escape key
        >
          <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden px-0 py-0 mower-stats-container">
            {mowerDetails && (
              <MowerStats
                mowerName={mowerDetails.name}
                mowerModel={mowerDetails.model || "HUSQVARNA AUTOMOWER® 315X"}
                mowerImage={`/images/mower-${mowerDetails.status === 'error' ? 'red' : 'gray'}.png`}
                mowerId={mowerDetails.id}
                batteryLevel={mowerDetails.batteryLevel}
                areaComplete={mowerDetails.areaComplete}
                status={mowerDetails.status as MowerStatus}
                currentZone={mowerDetails.categories?.[0] ? mowerDetails.categories[0] : "Default Zone"}
                hideTopCard={false}
                onCommand={handleMowerCommand}
                supportsAreaCompletion={mowerDetails.supportsAreaCompletion}
                zones={mowerDetails.zones || [
                  { name: "Front Yard", color: "#3b82f6" },
                  { name: "Side Path", color: "#6366f1" },
                  { name: "Garden Edges", color: "#f59e0b" },
                  { name: "Back Yard", color: "#ef4444" },
                  { name: "Patio Area", color: "#8b5cf6" },
                  { name: "Garden", color: "#06b6d4" },
                  { name: "Driveway", color: "#d946ef" }
                ]}
                schedule={mowerDetails.schedule || [
                  {
                    day: "Mon",
                    timeSlots: [
                      { 
                        startTime: "09:00", 
                        endTime: "11:30", 
                        zones: [
                          { name: "Front Yard", color: "#3b82f6" },
                          { name: "Back Yard", color: "#ef4444" }
                        ] 
                      },
                      { 
                        startTime: "14:00", 
                        endTime: "15:30", 
                        zones: [
                          { name: "Garden Edges", color: "#f59e0b" }
                        ] 
                      }
                    ]
                  },
                  {
                    day: "Tue",
                    timeSlots: [
                      { 
                        startTime: "10:30", 
                        endTime: "14:00", 
                        zones: [
                          { name: "Side Path", color: "#6366f1" },
                          { name: "Patio Area", color: "#8b5cf6" }
                        ] 
                      }
                    ]
                  },
                  { day: "Wed", timeSlots: [] },
                  {
                    day: "Thu",
                    timeSlots: [
                      { 
                        startTime: "08:00", 
                        endTime: "11:30", 
                        zones: [
                          { name: "Garden", color: "#06b6d4" }
                        ] 
                      }
                    ]
                  },
                  {
                    day: "Fri",
                    timeSlots: [
                      { 
                        startTime: "16:00", 
                        endTime: "18:00", 
                        zones: [
                          { name: "Patio Area", color: "#8b5cf6" },
                          { name: "Side Path", color: "#6366f1" }
                        ] 
                      }
                    ]
                  },
                  {
                    day: "Sat",
                    timeSlots: [
                      { 
                        startTime: "15:00", 
                        endTime: "17:00", 
                        zones: [
                          { name: "Garden", color: "#06b6d4" }
                        ] 
                      }
                    ]
                  },
                  { day: "Sun", timeSlots: [] }
                ]}
                className="dark"
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