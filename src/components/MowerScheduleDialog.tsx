import { MowerScheduleGrid } from './MowerSchedule';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Mower Schedule</DialogTitle>
          <DialogDescription>
            Weekly mowing schedule for your Husqvarna Automower
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
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