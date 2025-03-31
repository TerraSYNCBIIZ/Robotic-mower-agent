import React from 'react';
import { MowerData } from './MowerScheduler';
import { Card, CardContent } from '@/components/ui/card';
import { Battery, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MowerSelectorProps {
  mowers: MowerData[];
  selectedMower: MowerData | null;
  onSelect: (mower: MowerData) => void;
}

const MowerSelector: React.FC<MowerSelectorProps> = ({ 
  mowers, 
  selectedMower, 
  onSelect 
}) => {
  if (mowers.length === 0) {
    return (
      <div className="text-center p-10 border rounded-lg">
        <h3 className="font-medium">No mowers found</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Please make sure your mowers are connected to your account
        </p>
      </div>
    );
  }

  const getBatteryColor = (level: number): string => {
    if (level >= 70) return 'text-green-500';
    if (level >= 30) return 'text-amber-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('charging') || statusLower.includes('parked')) return 'bg-blue-500';
    if (statusLower.includes('mowing') || statusLower.includes('active')) return 'bg-green-500';
    if (statusLower.includes('error') || statusLower.includes('fault')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Select a Mower</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a mower to create a schedule for
        </p>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mowers.map(mower => (
          <Card 
            key={mower.id} 
            className={cn(
              "cursor-pointer hover:border-primary transition-colors",
              selectedMower?.id === mower.id && "border-primary"
            )}
            onClick={() => onSelect(mower)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{mower.name}</h3>
                  <p className="text-sm text-muted-foreground">{mower.model}</p>
                  <p className="text-xs text-muted-foreground mt-1">SN: {mower.serialNumber}</p>
                </div>
                
                {selectedMower?.id === mower.id && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <div className={`h-2.5 w-2.5 rounded-full ${getStatusColor(mower.status)}`} />
                  <span className="text-xs capitalize">{mower.status.toLowerCase()}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Battery className={`h-4 w-4 ${getBatteryColor(mower.battery)}`} />
                  <span className="text-xs">{mower.battery}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MowerSelector; 