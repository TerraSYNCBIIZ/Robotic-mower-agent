import React, { useState } from 'react';
import { ZoneData } from './MowerScheduler';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RestrictionsInputProps {
  zones: ZoneData[];
  setZones: (zones: ZoneData[]) => void;
}

interface TimeRestriction {
  startTime: string;
  endTime: string;
  days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface WeatherRestriction {
  rainIntensity: 'light' | 'moderate' | 'heavy' | 'all';
  temperatureBelow: number | null;
  temperatureAbove: number | null;
  windSpeed: number | null;
}

const RestrictionsInput: React.FC<RestrictionsInputProps> = ({ zones, setZones }) => {
  const [selectedZone, setSelectedZone] = useState<string>(zones[0]?.id || '');
  const [timeRestrictions, setTimeRestrictions] = useState<TimeRestriction[]>([]);
  const [weatherRestrictions, setWeatherRestrictions] = useState<WeatherRestriction>({
    rainIntensity: 'moderate',
    temperatureBelow: null,
    temperatureAbove: null,
    windSpeed: null
  });
  const [newTimeRestriction, setNewTimeRestriction] = useState<TimeRestriction>({
    startTime: '22:00',
    endTime: '06:00',
    days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    }
  });

  const handleAddTimeRestriction = () => {
    setTimeRestrictions([...timeRestrictions, newTimeRestriction]);
    setNewTimeRestriction({
      startTime: '22:00',
      endTime: '06:00',
      days: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true
      }
    });
  };

  const handleRemoveTimeRestriction = (index: number) => {
    const updatedRestrictions = [...timeRestrictions];
    updatedRestrictions.splice(index, 1);
    setTimeRestrictions(updatedRestrictions);
  };

  const handleDayToggle = (day: keyof TimeRestriction['days']) => {
    setNewTimeRestriction({
      ...newTimeRestriction,
      days: {
        ...newTimeRestriction.days,
        [day]: !newTimeRestriction.days[day]
      }
    });
  };

  const handleWeatherRestrictionChange = (
    key: keyof WeatherRestriction,
    value: string | number | null
  ) => {
    setWeatherRestrictions({
      ...weatherRestrictions,
      [key]: value
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Zone Restrictions</CardTitle>
          <CardDescription>
            Set restrictions for when your mower should not operate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Zone selector */}
          <div className="mb-4">
            <Label htmlFor="zone-select">Select Zone</Label>
            <Select
              value={selectedZone}
              onValueChange={setSelectedZone}
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
              {/* Time restriction form */}
              <div className="space-y-4 border p-4 rounded-md">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-time">Don't mow from</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={newTimeRestriction.startTime}
                      onChange={(e) => setNewTimeRestriction({
                        ...newTimeRestriction,
                        startTime: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time">Until</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={newTimeRestriction.endTime}
                      onChange={(e) => setNewTimeRestriction({
                        ...newTimeRestriction,
                        endTime: e.target.value
                      })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>On these days:</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(newTimeRestriction.days) as Array<keyof TimeRestriction['days']>).map(day => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day}`}
                          checked={newTimeRestriction.days[day]}
                          onCheckedChange={() => handleDayToggle(day)}
                        />
                        <Label
                          htmlFor={`day-${day}`}
                          className="capitalize text-sm cursor-pointer"
                        >
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button 
                  onClick={handleAddTimeRestriction}
                  className="w-full mt-2"
                >
                  Add Time Restriction
                </Button>
              </div>
              
              {/* Existing time restrictions */}
              {timeRestrictions.length > 0 ? (
                <div className="space-y-2">
                  <Label>Current Restrictions:</Label>
                  {timeRestrictions.map((restriction, index) => (
                    <div key={index} className="flex justify-between items-center border p-3 rounded-md">
                      <div>
                        <p className="font-medium">
                          {restriction.startTime} - {restriction.endTime}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(restriction.days)
                            .filter(([_, enabled]) => enabled)
                            .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))
                            .join(', ')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTimeRestriction(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No time restrictions added yet
                </div>
              )}
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
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestrictionsInput; 