import React, { useEffect, useState } from 'react';
import { useMowerData } from '@/contexts/MowerDataContext';
import { ScheduleView } from './ScheduleView';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface MowerScheduleContainerProps {
  mowerId: string;
}

export function MowerScheduleContainer({ mowerId }: MowerScheduleContainerProps) {
  const { dataService } = useMowerData();
  const [schedule, setSchedule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dataService || !mowerId) return;

    const fetchScheduleData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch mower data from Firebase (which has been collected from the API)
        const mowerData = await dataService.getMowerData(mowerId);
        
        if (!mowerData) {
          throw new Error('No data available for this mower');
        }
        
        // Extract schedule data
        const scheduleData = mowerData.mowerData?.attributes?.calendar?.tasks || [];
        
        // Process schedule for visualization
        // Note: This should match the format expected by ScheduleView
        setSchedule(scheduleData);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching schedule data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchScheduleData();
    
    // Set up event listener for updates
    const handleMowerUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      
      // Only process events for this mower
      if (detail.mowerId === mowerId) {
        fetchScheduleData();
      }
    };
    
    // Add event listener
    window.addEventListener('mower-data-updated', handleMowerUpdate);
    
    // Clean up
    return () => {
      window.removeEventListener('mower-data-updated', handleMowerUpdate);
    };
  }, [dataService, mowerId]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error.message || 'Failed to load mower schedule'}
        </AlertDescription>
      </Alert>
    );
  }

  // Render schedule
  return <ScheduleView schedule={schedule} />;
} 