import React, { useState } from 'react';
import MowerSelector from './MowerSelector';
import ZoneManager from './ZoneManager';
import ScheduleDisplay from './ScheduleDisplay';
import RestrictionsInput from './RestrictionsInput';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Check, MapPin, AlertCircle, Clock } from 'lucide-react';

export interface MowerData {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  battery: number;
  status: string;
}

export interface ZoneData {
  id: string;
  name: string;
  acreage?: number; // Manual input needed
}

export interface ScheduleEntry {
  zoneId: string;
  dayOfWeek: number; // 0-6 (Sunday to Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

interface MowerSchedulerProps {
  mowers: MowerData[];
  onSubmit: (mowerId: string, schedule: ScheduleEntry[]) => Promise<void>;
  isLoading?: boolean;
}

type Step = 'mower' | 'zones' | 'restrictions' | 'schedule';

const MowerScheduler: React.FC<MowerSchedulerProps> = ({ 
  mowers, 
  onSubmit,
  isLoading = false
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('mower');
  const [selectedMower, setSelectedMower] = useState<MowerData | null>(null);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const steps: Step[] = ['mower', 'zones', 'restrictions', 'schedule'];
  const stepLabels: Record<Step, string> = {
    mower: 'Select Mower',
    zones: 'Configure Zones',
    restrictions: 'Set Restrictions',
    schedule: 'Create Schedule'
  };

  const stepIcons: Record<Step, React.ReactNode> = {
    mower: <Check className="h-5 w-5" />,
    zones: <MapPin className="h-5 w-5" />,
    restrictions: <AlertCircle className="h-5 w-5" />,
    schedule: <Clock className="h-5 w-5" />
  };

  const handleSelectMower = (mower: MowerData) => {
    setSelectedMower(mower);
    setZones([]);
    setSchedule([]);
    setError(null);
    setSuccess(false);
  };

  const handleZonesUpdate = (updatedZones: ZoneData[]) => {
    setZones(updatedZones);
    // Clear schedule when zones change
    setSchedule([]);
  };

  const handleScheduleUpdate = (newSchedule: ScheduleEntry[]) => {
    setSchedule(newSchedule);
  };

  const goToNextStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      handleSubmit();
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 'mower') {
      return !!selectedMower;
    }
    if (currentStep === 'zones') {
      return zones.length > 0;
    }
    if (currentStep === 'restrictions') {
      return true; // Restrictions are optional
    }
    if (currentStep === 'schedule') {
      return schedule.length > 0;
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!selectedMower) {
      setError('No mower selected');
      return;
    }

    if (schedule.length === 0) {
      setError('Schedule is empty');
      return;
    }

    try {
      setError(null);
      await onSubmit(selectedMower.id, schedule);
      setSuccess(true);
    } catch (err) {
      setError(`Failed to save schedule: ${err instanceof Error ? err.message : String(err)}`);
      setSuccess(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <InfoCircledIcon className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Schedule saved successfully</AlertDescription>
        </Alert>
      )}

      {/* Step Progress */}
      <div className="flex mb-8">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div 
              className={`flex flex-col items-center ${index <= steps.indexOf(currentStep) ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step === currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : index < steps.indexOf(currentStep)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {stepIcons[step]}
              </div>
              <span className="mt-2 text-sm font-medium hidden md:block">{stepLabels[step]}</span>
            </div>
            {index < steps.length - 1 && (
              <div 
                className={`h-[2px] flex-1 mx-2 ${
                  index < steps.indexOf(currentStep) ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="border rounded-lg p-6 bg-card">
        {currentStep === 'mower' && (
          <MowerSelector 
            mowers={mowers} 
            selectedMower={selectedMower} 
            onSelect={handleSelectMower} 
          />
        )}

        {currentStep === 'zones' && selectedMower && (
          <ZoneManager 
            mower={selectedMower}
            zones={zones}
            onZonesUpdate={handleZonesUpdate}
          />
        )}

        {currentStep === 'restrictions' && selectedMower && zones.length > 0 && (
          <RestrictionsInput 
            zones={zones} 
            setZones={setZones} 
          />
        )}

        {currentStep === 'schedule' && selectedMower && zones.length > 0 && (
          <ScheduleDisplay 
            zones={zones}
            schedule={schedule}
            onScheduleUpdate={handleScheduleUpdate}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={goToPreviousStep}
          disabled={currentStep === 'mower'}
        >
          Previous
        </Button>
        
        <Button 
          onClick={goToNextStep}
          disabled={!canProceedToNextStep() || (currentStep === 'schedule' && isLoading)}
        >
          {currentStep === 'schedule' ? (isLoading ? 'Saving...' : 'Save Schedule') : 'Next'}
        </Button>
      </div>
    </div>
  );
};

export default MowerScheduler; 