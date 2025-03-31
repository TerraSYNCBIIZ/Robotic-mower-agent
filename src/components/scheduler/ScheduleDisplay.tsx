import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Layers } from 'lucide-react';
import { Zone } from './MowerScheduler';

interface ScheduleDisplayProps {
  selectedMower: any;
  zones: Zone[];
  schedule: Record<string, Array<{
    zoneId: string;
    zoneName: string;
    startTime: string;
    endTime: string;
    cycleNumber: number;
  }>>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ScheduleDisplay({ 
  selectedMower,
  zones, 
  schedule 
}: ScheduleDisplayProps) {
  const [activeTab, setActiveTab] = React.useState('daily');
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);
  const mowerName = selectedMower?.name || "Mower";

  // Get all zones included in the schedule
  const scheduledZones = React.useMemo(() => {
    const zoneIds = new Set<string>();
    Object.values(schedule).forEach(daySchedule => {
      daySchedule.forEach(item => zoneIds.add(item.zoneId));
    });
    return zones.filter(zone => zoneIds.has(zone.id));
  }, [schedule, zones]);

  // Format time from 24h to 12h format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Calculate total mowing time per day
  const calculateTotalMowingTime = (day: string) => {
    const daySchedule = schedule[day] || [];
    let totalMinutes = 0;
    
    daySchedule.forEach(item => {
      const [startHours, startMinutes] = item.startTime.split(':').map(Number);
      const [endHours, endMinutes] = item.endTime.split(':').map(Number);
      
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      totalMinutes += endTotalMinutes - startTotalMinutes;
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  // Get color for a zone
  const getZoneColor = (index: number) => {
    const colors = [
      'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700',
      'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700',
      'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700',
      'bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700',
      'bg-pink-100 border-pink-300 dark:bg-pink-900/30 dark:border-pink-700',
      'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700',
    ];
    return colors[index % colors.length];
  };

  // Find zone name by ID
  const getZoneName = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : 'Unknown Zone';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Review Mowing Schedule</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Review the optimal schedule for {mowerName}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden md:inline">Daily View</span>
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden md:inline">Weekly Overview</span>
          </TabsTrigger>
          <TabsTrigger value="zones" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden md:inline">By Zone</span>
          </TabsTrigger>
        </TabsList>

        {/* Daily Schedule View */}
        <TabsContent value="daily">
          <div className="space-y-4">
            {DAYS.map(day => {
              const daySchedule = schedule[day] || [];
              return (
                <Card key={day} className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium">{day}</h3>
                    {daySchedule.length > 0 && (
                      <span className="text-sm text-gray-600">
                        Total: {calculateTotalMowingTime(day)}
                      </span>
                    )}
                  </div>
                  
                  {daySchedule.length === 0 ? (
                    <p className="text-gray-500 text-center py-3">No mowing scheduled</p>
                  ) : (
                    <div className="space-y-3">
                      {daySchedule.map((item, idx) => {
                        const zoneName = getZoneName(item.zoneId);
                        const zoneIndex = zones.findIndex(z => z.id === item.zoneId);
                        return (
                          <div 
                            key={`${day}-${idx}`}
                            className={`border rounded-md p-3 ${getZoneColor(zoneIndex)}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{zoneName}</span>
                              <span>
                                {formatTime(item.startTime)} - {formatTime(item.endTime)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Weekly Overview */}
        <TabsContent value="weekly">
          <Card className="p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Day
                    </th>
                    <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Hours
                    </th>
                    <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zones Covered
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => {
                    const daySchedule = schedule[day] || [];
                    const uniqueZones = new Set(daySchedule.map(item => item.zoneId));
                    const zoneNames = Array.from(uniqueZones).map(id => getZoneName(id));
                    
                    return (
                      <tr key={day} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b border-gray-200 text-sm font-medium text-gray-900">
                          {day}
                        </td>
                        <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-500">
                          {daySchedule.length === 0 
                            ? 'None' 
                            : calculateTotalMowingTime(day)
                          }
                        </td>
                        <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-500">
                          {zoneNames.length === 0 
                            ? 'None' 
                            : zoneNames.join(', ')
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* By Zone View */}
        <TabsContent value="zones">
          <div className="space-y-4">
            {scheduledZones.length === 0 ? (
              <Card className="p-4">
                <p className="text-center text-gray-500">No zones scheduled</p>
              </Card>
            ) : scheduledZones.map((zone, index) => {
              // Find all schedule items for this zone
              const zoneSchedule: Array<{day: string; startTime: string; endTime: string}> = [];
              DAYS.forEach(day => {
                const daySchedule = schedule[day] || [];
                daySchedule.forEach(item => {
                  if (item.zoneId === zone.id) {
                    zoneSchedule.push({
                      day,
                      startTime: item.startTime,
                      endTime: item.endTime
                    });
                  }
                });
              });
              
              return (
                <Card key={zone.id} className="p-4">
                  <div className={`border-l-4 pl-3 mb-3 ${getZoneColor(index).split(' ')[1]}`}>
                    <h3 className="text-lg font-medium">{zone.name}</h3>
                    <p className="text-sm text-gray-600">
                      {zone.acreage} acres, {zone.frequency} times per week
                    </p>
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    {zoneSchedule.map((item, idx) => (
                      <div 
                        key={`${zone.id}-${idx}`}
                        className="flex justify-between items-center p-2 rounded-md bg-gray-50"
                      >
                        <span className="font-medium">{item.day}</span>
                        <span>
                          {formatTime(item.startTime)} - {formatTime(item.endTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 border-t pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox 
            id="terms" 
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
          />
          <Label htmlFor="terms" className="text-sm text-gray-700">
            I understand that this schedule is optimized based on my inputs and may need adjustment based on actual lawn conditions.
          </Label>
        </div>
        
        <div className="flex justify-between">
          <Button variant="outline">
            Go Back
          </Button>
          <Button 
            disabled={!agreedToTerms} 
            onClick={() => {}}
          >
            Apply Schedule
          </Button>
        </div>
      </div>
    </div>
  );
} 