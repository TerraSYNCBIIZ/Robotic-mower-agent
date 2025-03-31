import { useState } from 'react';
import { Mower } from './MowerScheduler';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Info } from 'lucide-react';

interface MowerSelectorProps {
  availableMowers: Mower[];
  selectedMower: Mower | null;
  onSelect: (mower: Mower) => void;
  onNext: () => void;
}

export default function MowerSelector({ availableMowers, selectedMower, onSelect, onNext }: MowerSelectorProps) {
  const [showMowerDetails, setShowMowerDetails] = useState<string | null>(null);

  // Toggle showing details for a specific mower
  const toggleDetails = (mowerId: string) => {
    if (showMowerDetails === mowerId) {
      setShowMowerDetails(null);
    } else {
      setShowMowerDetails(mowerId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Select Your Mower</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Choose the mower you want to schedule</p>
      </div>

      {availableMowers.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-gray-50">
          <p className="text-gray-500">No mowers available. Please make sure you have connected mowers in your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableMowers.map((mower) => (
            <Card
              key={mower.id}
              className={`p-4 cursor-pointer border-2 transition-all ${
                selectedMower?.id === mower.id
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-border hover:border-border/80 dark:border-border/70'
              }`}
              onClick={() => onSelect(mower)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">{mower.name}</h3>
                  <p className="text-sm text-muted-foreground">{mower.model || 'Automower'}</p>
                </div>
                {selectedMower?.id === mower.id && (
                  <span className="bg-primary/20 text-primary p-1 rounded-full">
                    <Check size={18} />
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity Per Day:</span>
                  <span className="font-medium">{mower.acresPerDay.toFixed(2)} acres</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity Per Week:</span>
                  <span className="font-medium">{mower.acresPerWeek.toFixed(2)} acres</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycles Per Day:</span>
                  <span className="font-medium">{mower.cyclesPerDay}</span>
                </div>
              </div>

              {showMowerDetails === mower.id && (
                <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
                  <h4 className="font-medium mb-2">Technical Details</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Acres Per Cycle:</span>
                      <span>{mower.acresPerCycle.toFixed(2)} acres</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cycle Time:</span>
                      <span>{mower.cycleTime} minutes</span>
                    </div>
                    {mower.zones && (
                      <div className="pt-2">
                        <span className="text-gray-600">Available Zones: </span>
                        <span>{mower.zones.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDetails(mower.id);
                  }}
                  className="text-xs flex items-center gap-1 text-gray-600 hover:text-gray-900"
                >
                  <Info size={14} />
                  {showMowerDetails === mower.id ? 'Hide Details' : 'View Details'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      <div className="flex justify-end mt-6">
        <Button 
          onClick={onNext}
          disabled={!selectedMower}
        >
          Next
        </Button>
      </div>
    </div>
  );
} 