import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import type { Zone } from './MowerScheduler';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Calendar, ShieldAlert, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TimeRestrictionScheduler } from './TimeRestrictionScheduler';
import { Button } from '@/components/ui/button';
import { getAuthToken } from '@/lib/auth';
import { toast } from '@/components/ui/use-toast';

interface RestrictionsInputProps {
  zones: Zone[];
  setZones: (zones: Zone[]) => void;
  onNext?: () => void;
  onBack?: () => void;
  mowerId?: string;
}

interface WeatherRestriction {
  rainIntensity: 'light' | 'moderate' | 'heavy' | 'all';
  temperatureBelow: number | null;
  temperatureAbove: number | null;
  windSpeed: number | null;
}

const RestrictionsInput: FC<RestrictionsInputProps> = ({ zones, setZones, onNext, onBack, mowerId }) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id || '');
  const [weatherRestrictions, setWeatherRestrictions] = useState<WeatherRestriction>(() => {
    return {
      rainIntensity: 'moderate',
      temperatureBelow: 5,
      temperatureAbove: 30,
      windSpeed: 20
    };
  });
  const [isLoading, setIsLoading] = useState(false);

  // Keep track of restrictions in a simple format: 'day-hour'
  const [restrictions, setRestrictions] = useState<Set<string>>(new Set());

  // Load weather restrictions from API
  useEffect(() => {
    const fetchWeatherRestrictions = async () => {
      if (!mowerId) return;
      
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch(`/api/mowers/${mowerId}/weather-restrictions`, {
          headers: {
            'authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setWeatherRestrictions(data);
        }
      } catch (error) {
        console.error('Error fetching weather restrictions:', error);
      }
    };

    fetchWeatherRestrictions();
  }, [mowerId]);

  // Load restrictions for the selected zone
  useEffect(() => {
    const currentZone = zones.find(z => z.id === selectedZoneId);
    if (currentZone?.restrictions) {
      setRestrictions(new Set(currentZone.restrictions));
    } else {
      setRestrictions(new Set());
    }
  }, [selectedZoneId, zones]); // This will only update when the zone changes or zones array changes

  // Update the zone with the current restrictions
  const saveRestrictions = useCallback(() => {
    setZones(
      zones.map(zone => {
        if (zone.id === selectedZoneId) {
          return { ...zone, restrictions: Array.from(restrictions) };
        }
        return zone;
      })
    );
  }, [selectedZoneId, zones, restrictions, setZones]);

  // Toggle a restriction for a specific day and hour
  const toggleRestriction = useCallback((day: number, hour: number) => {
    const key = `${day}-${hour}`;
    const newRestrictions = new Set(restrictions);
    
    if (newRestrictions.has(key)) {
      newRestrictions.delete(key);
      console.log(`Removed restriction for day ${day}, hour ${hour}`);
    } else {
      newRestrictions.add(key);
      console.log(`Added restriction for day ${day}, hour ${hour}`);
    }
    
    // Update local state
    setRestrictions(newRestrictions);
    
    // Make a deep copy of the zones array
    const updatedZones = JSON.parse(JSON.stringify(zones));
    
    // Find and update the selected zone with the new restrictions
    const updatedZonesArray = updatedZones.map((zone: Zone) => {
      if (zone.id === selectedZoneId) {
        return { 
          ...zone, 
          restrictions: Array.from(newRestrictions)
        };
      }
      return zone;
    });
    
    // Update zones state with the new array
    setZones(updatedZonesArray);
    
    // Show confirmation toast
    const selectedZone = zones.find(z => z.id === selectedZoneId);
    if (selectedZone) {
      const hourFormatted = hour === 0 ? '12 AM' : 
                           hour === 12 ? '12 PM' : 
                           hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
      
      toast({
        title: `${newRestrictions.has(key) ? "Added" : "Removed"} restriction`,
        description: `Updated restrictions for ${selectedZone.name} zone at ${hourFormatted}`,
      });
    }
  }, [restrictions, selectedZoneId, zones, setZones]);

  // Format hour for display
  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  // Handle weather restriction changes
  const handleWeatherRestrictionChange = (
    key: keyof WeatherRestriction,
    value: string | number | null
  ) => {
    setWeatherRestrictions({
      ...weatherRestrictions,
      [key]: value
    });
  };

  // Save weather restrictions to the API
  const saveWeatherRestrictions = async () => {
    if (!mowerId) {
      console.error('No mower ID provided');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/mowers/${mowerId}/weather-restrictions`, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(weatherRestrictions)
      });

      if (!response.ok) {
        throw new Error('Failed to save weather restrictions');
      }

      toast({
        title: "Success",
        description: "Weather restrictions saved successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Error saving weather restrictions:', error);
      toast({
        title: "Error",
        description: "Failed to save weather restrictions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle navigation with save
  const handleNext = () => {
    if (mowerId) {
      saveWeatherRestrictions();
    }
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Zone Restrictions</CardTitle>
          <CardDescription>
            Set restrictions for when your mower should not operate. Click on a time block to mark it as restricted, click again to remove the restriction.
            <div className="mt-2 p-3 bg-destructive/10 rounded-md text-sm font-medium text-destructive border border-destructive/20">
              <div className="flex items-center">
                <ShieldAlert className="h-4 w-4 mr-2" />
                <span>Important:</span>
              </div>
              <p className="pl-6 mt-1">
                The scheduler will <strong>never</strong> schedule any zone during its restricted times. 
                This ensures your mower only operates when you want it to.
              </p>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="zone-select">Select Zone</Label>
            <Select
              value={selectedZoneId}
              onValueChange={setSelectedZoneId}
            >
              <SelectTrigger id="zone-select">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="time">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Restrictions
              </TabsTrigger>
              <TabsTrigger value="weather" className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Weather Restrictions
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="time" className="space-y-4 pt-4">
              <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="py-2 px-3 bg-background border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground flex items-center">
                      <ShieldAlert className="h-4 w-4 mr-2 text-destructive" />
                      <span>Click on time blocks to mark when the mower should NOT operate</span>
                    </h3>
                  </div>
                </CardHeader>
                
                {/* New calendar view using TimeRestrictionScheduler */}
                <div className="time-restriction-calendar-container p-2">
                  <TimeRestrictionScheduler 
                    restrictions={restrictions}
                    toggleRestriction={toggleRestriction}
                  />
                </div>
                
                <CardContent className="py-2 px-3 border-t bg-background">
                  <div className="flex items-center justify-between text-xs text-foreground">
                    <div className="flex items-center">
                      <div className="bg-destructive w-3 h-3 rounded mr-1" />
                      <span>= Restricted time (no mowing)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="italic">Click again to remove restriction</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="weather" className="space-y-4 pt-4">
              <div className="space-y-4 border p-4 rounded-md">
                <div>
                  <Label htmlFor="rain-intensity">Don't mow when rain is</Label>
                  <Select
                    value={weatherRestrictions.rainIntensity}
                    onValueChange={(value) => 
                      handleWeatherRestrictionChange('rainIntensity', value as WeatherRestriction['rainIntensity'])
                    }
                  >
                    <SelectTrigger id="rain-intensity">
                      <SelectValue placeholder="Select rain intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light or heavier</SelectItem>
                      <SelectItem value="moderate">Moderate or heavier</SelectItem>
                      <SelectItem value="heavy">Heavy only</SelectItem>
                      <SelectItem value="all">Any rain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="temp-below">Don't mow below (°C)</Label>
                    <Input
                      id="temp-below"
                      type="number"
                      placeholder="e.g., 5°C"
                      value={weatherRestrictions.temperatureBelow?.toString() || ''}
                      onChange={(e) => 
                        handleWeatherRestrictionChange(
                          'temperatureBelow', 
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="temp-above">Don't mow above (°C)</Label>
                    <Input
                      id="temp-above"
                      type="number"
                      placeholder="e.g., 30°C"
                      value={weatherRestrictions.temperatureAbove?.toString() || ''}
                      onChange={(e) => 
                        handleWeatherRestrictionChange(
                          'temperatureAbove', 
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="wind-speed">Don't mow when wind exceeds (km/h)</Label>
                  <Input
                    id="wind-speed"
                    type="number"
                    placeholder="e.g., 20 km/h"
                    value={weatherRestrictions.windSpeed?.toString() || ''}
                    onChange={(e) => 
                      handleWeatherRestrictionChange(
                        'windSpeed', 
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </div>
                {mowerId && (
                  <Button 
                    onClick={saveWeatherRestrictions}
                    disabled={isLoading}
                    className="w-full mt-2"
                  >
                    {isLoading ? 'Saving...' : 'Save Weather Restrictions'}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        {(onNext || onBack) && (
          <CardFooter className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={!onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={!onNext || isLoading}
              className="flex items-center gap-2"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default RestrictionsInput; 