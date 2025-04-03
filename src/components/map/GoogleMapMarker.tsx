/**
 * GoogleMapMarker Component
 * Displays a mower marker on the Google Map with a popup showing current state
 */
import { useState, useEffect } from 'react';
import { InfoWindow, MarkerF } from '@react-google-maps/api';
import { MowerStatusIndicator } from '../dashboard/MowerStatusIndicator';
import { MowerActionButton } from '../dashboard/MowerActionButton';
import { useMowerData } from '@/hooks/useMowerData';
import { Progress } from "@/components/ui/progress";
import { MowerAreaCompletion } from '@/components/dashboard/MowerAreaCompletion';

interface GoogleMapMarkerProps {
  mowerId: string;
  position: { lat: number; lng: number };
  onClick?: () => void;
  selected?: boolean;
}

export function GoogleMapMarker({ 
  mowerId, 
  position, 
  onClick,
  selected = false 
}: GoogleMapMarkerProps) {
  const [showInfo, setShowInfo] = useState(selected);
  
  // Use our hook to ensure consistent data with the rest of the app
  const { 
    data, 
    isLoading, 
    refresh, 
    getBatteryLevel, 
    getActivity, 
    getState, 
    getName, 
    getErrorCode,
    getAreaComplete,
    supportsAreaCompletion
  } = useMowerData(mowerId, {
    realtime: true,
    debug: false
  });
  
  // Handle selection change
  useEffect(() => {
    setShowInfo(selected);
  }, [selected]);
  
  // Determine icon based on mower state
  const determineIcon = () => {
    const activity = getActivity();
    const state = getState();
    const isError = state === 'ERROR' || state === 'FATAL_ERROR' || getErrorCode() > 0;
    
    if (isError) {
      return '/images/mower-marker-red.png';
    }
    
    if (activity === 'MOWING') {
      return '/images/mower-marker-green.png';
    }
    
    if (activity === 'CHARGING' || activity === 'PARKED_IN_CS') {
      return '/images/mower-marker-blue.png';
    }
    
    if (activity === 'GOING_HOME') {
      return '/images/mower-marker-yellow.png';
    }
    
    return '/images/mower-marker-gray.png';
  };
  
  // Handle marker click
  const handleMarkerClick = () => {
    setShowInfo(true);
    if (onClick) onClick();
  };
  
  // Handle close info window
  const handleCloseInfo = () => {
    setShowInfo(false);
  };
  
  // Handle refresh data
  const handleRefresh = () => {
    refresh();
  };
  
  // Parse area completion percentage
  const getAreaCompletionPercentage = () => {
    const areaComplete = getAreaComplete();
    if (!areaComplete || areaComplete === 'N/A') return 0;
    
    return Math.min(Math.max(parseInt(areaComplete.replace('%', ''), 10) || 0, 0), 100);
  };
  
  return (
    <MarkerF
      position={position}
      onClick={handleMarkerClick}
      icon={{
        url: determineIcon(),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      }}
    >
      {showInfo && (
        <InfoWindow onCloseClick={handleCloseInfo}>
          <div className="p-1 max-w-[200px]">
            <h3 className="font-medium text-sm mb-1">{getName()}</h3>
            
            <div className="mb-2">
              <MowerStatusIndicator 
                activity={getActivity()}
                state={getState()}
                errorCode={getErrorCode()}
                batteryLevel={getBatteryLevel()}
                showLastUpdate={true}
                lastUpdated={data?.lastUpdated}
                variant="small"
              />
            </div>
            
            {/* Add battery indicator */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Battery</span>
                <span>{getBatteryLevel()}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-secondary">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${getBatteryLevel()}%`,
                    backgroundColor: getBatteryLevel() > 60 ? 'var(--green-500)' : 
                      getBatteryLevel() > 30 ? 'var(--amber-500)' : 'var(--red-500)'
                  }}
                />
              </div>
            </div>
            
            {/* Add area completion if available */}
            {supportsAreaCompletion() && (
              <div className="mb-2">
                <MowerAreaCompletion mowerId={mowerId} initialValue={getAreaComplete()} />
              </div>
            )}
            
            <div className="flex justify-between items-center mt-2">
              <MowerActionButton
                mowerId={mowerId}
                activity={getActivity()}
                state={getState()}
                batteryLevel={getBatteryLevel()}
                size="sm"
                refreshData={handleRefresh}
                showRefresh={true}
              />
            </div>
          </div>
        </InfoWindow>
      )}
    </MarkerF>
  );
} 