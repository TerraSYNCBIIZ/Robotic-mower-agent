/**
 * MowerActionButton Component
 * A button for controlling mower actions with immediate UI feedback
 */
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlayCircle, PauseCircle, HomeIcon, RotateCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sendMowerCommand } from '@/lib/husqvarna/commands';

interface MowerActionButtonProps {
  mowerId: string;
  activity: string;
  state: string;
  batteryLevel?: number;
  isDisabled?: boolean;
  refreshData?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showRefresh?: boolean;
}

export function MowerActionButton({
  mowerId,
  activity,
  state,
  batteryLevel = 100,
  isDisabled = false,
  refreshData,
  size = 'md',
  showRefresh = false
}: MowerActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  
  // Button sizes
  const buttonSizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };
  
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };
  
  // Determine what actions are available based on current state
  const isMowing = activity === 'MOWING';
  const isParked = activity === 'PARKED_IN_CS';
  const isCharging = activity === 'CHARGING';
  const isGoingHome = activity === 'GOING_HOME';
  const isPaused = state === 'PAUSED';
  const isError = state === 'ERROR' || state === 'FATAL_ERROR';
  const isLowBattery = batteryLevel < 20;
  
  // Handle refresh button click
  const handleRefresh = () => {
    if (refreshData) {
      refreshData();
      toast.success('Refreshing mower data...');
    }
  };
  
  // Handler for sending commands
  const handleCommand = async (command: string) => {
    try {
      setIsLoading(true);
      setLastCommand(command);
      
      const result = await sendMowerCommand(mowerId, command);
      
      if (result.success) {
        toast.success(`Command '${command}' sent successfully`);
        // The command's impact on the UI is handled in the sendMowerCommand function
        // which dispatches an event that our useMowerData hook listens for
      } else {
        toast.error(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      toast.error('Failed to send command to mower');
    } finally {
      // A short delay before allowing more commands
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  };
  
  // Render the appropriate button based on current state
  const renderActionButton = () => {
    if (isLoading) {
      return (
        <Button 
          size="icon" 
          variant="outline" 
          className={buttonSizes[size]}
          disabled
        >
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        </Button>
      );
    }
    
    if (isMowing) {
      return (
        <Button 
          size="icon" 
          variant="outline" 
          className={buttonSizes[size]}
          onClick={() => handleCommand('pause')}
          disabled={isDisabled}
          title="Pause mowing"
        >
          <PauseCircle className={iconSizes[size]} />
        </Button>
      );
    }
    
    if (isPaused) {
      return (
        <Button 
          size="icon" 
          variant="outline" 
          className={buttonSizes[size]}
          onClick={() => handleCommand('start')}
          disabled={isDisabled || isLowBattery}
          title="Resume mowing"
        >
          <PlayCircle className={iconSizes[size]} />
        </Button>
      );
    }
    
    if (isParked || isCharging) {
      return (
        <Button 
          size="icon" 
          variant="outline" 
          className={buttonSizes[size]}
          onClick={() => handleCommand('start')}
          disabled={isDisabled || isLowBattery}
          title="Start mowing"
        >
          <PlayCircle className={iconSizes[size]} />
        </Button>
      );
    }
    
    if (isGoingHome) {
      return (
        <Button 
          size="icon" 
          variant="outline" 
          className={buttonSizes[size]}
          onClick={() => handleCommand('pause')}
          disabled={isDisabled}
          title="Pause return to home"
        >
          <PauseCircle className={iconSizes[size]} />
        </Button>
      );
    }
    
    // Default action buttons - show play/pause based on activity
    return (
      <Button 
        size="icon" 
        variant="outline" 
        className={buttonSizes[size]}
        onClick={() => handleCommand(isMowing ? 'pause' : 'start')}
        disabled={isDisabled || (isLowBattery && !isMowing)}
        title={isMowing ? "Pause mowing" : "Start mowing"}
      >
        {isMowing ? <PauseCircle className={iconSizes[size]} /> : <PlayCircle className={iconSizes[size]} />}
      </Button>
    );
  };
  
  // Render the park (go home) button
  const renderParkButton = () => {
    // Don't show park button if already parked/charging/going home
    if (isParked || isCharging || isGoingHome) {
      return null;
    }
    
    return (
      <Button 
        size="icon" 
        variant="outline" 
        className={buttonSizes[size]}
        onClick={() => handleCommand('park')}
        disabled={isDisabled || isLoading}
        title="Return to charging station"
      >
        <HomeIcon className={iconSizes[size]} />
      </Button>
    );
  };
  
  // Render the refresh button
  const renderRefreshButton = () => {
    if (!showRefresh) return null;
    
    return (
      <Button 
        size="icon" 
        variant="outline" 
        className={buttonSizes[size]}
        onClick={handleRefresh}
        disabled={isLoading}
        title="Refresh mower data"
      >
        <RotateCw className={iconSizes[size]} />
      </Button>
    );
  };
  
  return (
    <div className="flex gap-2">
      {renderActionButton()}
      {renderParkButton()}
      {renderRefreshButton()}
    </div>
  );
} 