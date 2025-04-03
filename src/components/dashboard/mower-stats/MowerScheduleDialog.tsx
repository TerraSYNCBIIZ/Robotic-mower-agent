import { MowerScheduleGrid } from './MowerSchedule';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw } from 'lucide-react';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';

// Create service instance for debugging
const mowerDataService = new MowerDataService();

interface MowerScheduleDialogProps {
  mowerId: string;
  workAreaColors?: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
}

export function MowerScheduleDialog({
  mowerId,
  workAreaColors = {},
  isOpen,
  onClose
}: MowerScheduleDialogProps) {
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  // Log the mowerId for debugging
  useEffect(() => {
    if (isOpen) {
      console.log(`[MowerScheduleDialog] Opening dialog for mower: ${mowerId}`);
    }
  }, [isOpen, mowerId]);

  const checkScheduleData = async () => {
    try {
      console.log(`[MowerScheduleDialog] Checking schedule data with Firebase-first approach for mower: ${mowerId}`);
      
      // Use mowerDataService instead of direct Firebase access
      const mowerData = await mowerDataService.getMowerData(mowerId);
      
      if (mowerData) {
        // Check if we have calendar data in Firebase
        if (mowerData.calendar && mowerData.calendar.tasks) {
          const tasksCount = mowerData.calendar.tasks.length;
          console.log(`[MowerScheduleDialog] Found ${tasksCount} tasks in Firebase calendar data`);
          setDebugInfo(`Found ${tasksCount} tasks in Firebase cache`);
          
          // Show detailed task information
          const taskSummary = mowerData.calendar.tasks.map((task: any, index: number) => {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              .filter((_, i) => task[['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i]])
              .join(', ');
              
            // Convert minutes to hours and minutes
            const startHours = Math.floor(task.start / 60);
            const startMinutes = task.start % 60;
            const durationHours = Math.floor(task.duration / 60);
            const durationMinutes = task.duration % 60;
            
            return `Task ${index+1}: ${days} at ${startHours}:${startMinutes.toString().padStart(2, '0')} for ${durationHours}h${durationMinutes ? durationMinutes + 'm' : ''}`;
          }).join('\n');
          
          console.log(`[MowerScheduleDialog] Tasks:\n${taskSummary}`);
          
          // Wait 10 seconds and clear the debug info
          setTimeout(() => setDebugInfo(null), 10000);
          return;
        }
        
        console.log(`[MowerScheduleDialog] No calendar data found in Firebase, checking mowerData attributes`);
        
        // Check if we have it in the mowerData attributes
        if (mowerData.mowerData?.attributes?.calendar?.tasks) {
          const tasksCount = mowerData.mowerData.attributes.calendar.tasks.length;
          console.log(`[MowerScheduleDialog] Found ${tasksCount} tasks in mowerData attributes`);
          setDebugInfo(`Found ${tasksCount} tasks in mowerData attributes`);
          
          // Wait 5 seconds and clear the debug info
          setTimeout(() => setDebugInfo(null), 5000);
          return;
        }
      }
      
      // If we get here, we need to fetch from the API
      console.log(`[MowerScheduleDialog] No schedule found in Firebase, fetching from API`);
      const calendarData = await mowerDataService.getScheduleForMowerAsync(mowerId);
      console.log(`[MowerScheduleDialog] Raw schedule data from API:`, JSON.stringify(calendarData, null, 2));
      
      setDebugInfo(`Found ${calendarData?.tasks?.length || 0} tasks in API data`);
      
      // Wait 5 seconds and clear the debug info
      setTimeout(() => setDebugInfo(null), 5000);
    } catch (error) {
      console.error(`[MowerScheduleDialog] Error fetching schedule data:`, error);
      setDebugInfo('Error fetching schedule data');
      
      // Wait 5 seconds and clear the debug info
      setTimeout(() => setDebugInfo(null), 5000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle>Mowing Schedule</DialogTitle>
          <DialogDescription>
            Your Husqvarna Automower mowing plan
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 flex justify-end mb-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex gap-1 items-center"
            onClick={checkScheduleData}
          >
            <RefreshCw size={14} />
            <span>Debug Schedule Data</span>
          </Button>
        </div>
        
        {debugInfo && (
          <div className="px-6 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-2 rounded-md mb-2 text-sm">
            {debugInfo}
          </div>
        )}
        
        <div className="pt-0 px-0">
          <MowerScheduleGrid mowerId={mowerId} workAreaColors={workAreaColors} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for a schedule button that triggers the dialog
export function MowerScheduleButton({ mowerId, workAreaColors }: { mowerId: string; workAreaColors?: Record<string, string> }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        className="flex gap-2 items-center" 
        onClick={() => setIsDialogOpen(true)}
      >
        <Calendar size={16} />
        <span>View Schedule</span>
      </Button>
      
      {isDialogOpen && (
        <MowerScheduleDialog
          mowerId={mowerId}
          workAreaColors={workAreaColors}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
} 