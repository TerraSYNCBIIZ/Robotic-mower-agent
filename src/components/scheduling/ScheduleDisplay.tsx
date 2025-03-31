import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ZoneData, ScheduleEntry } from './MowerScheduler';
import { X, Plus, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleDisplayProps {
  zones: ZoneData[];
  schedule: ScheduleEntry[];
  onScheduleUpdate: (schedule: ScheduleEntry[]) => void;
}

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({
  zones,
  schedule,
  onScheduleUpdate
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id || '');
  const [selectedDay, setSelectedDay] = useState<string>('1'); // Default to Monday
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('10:00');

  const addScheduleEntry = () => {
    if (!selectedZoneId || !selectedDay || !startTime || !endTime) {
      return;
    }

    // Simple validation to ensure end time is after start time
    if (startTime >= endTime) {
      toast.error('End time must be after start time');
      return;
    }

    const newEntry: ScheduleEntry = {
      zoneId: selectedZoneId,
      dayOfWeek: parseInt(selectedDay),
      startTime,
      endTime
    };

    // Check for overlapping schedules for the same zone on the same day
    const hasOverlap = schedule.some(entry => 
      entry.zoneId === selectedZoneId && 
      entry.dayOfWeek === parseInt(selectedDay) &&
      ((entry.startTime <= startTime && entry.endTime > startTime) || 
       (entry.startTime < endTime && entry.endTime >= endTime) ||
       (entry.startTime >= startTime && entry.endTime <= endTime))
    );

    if (hasOverlap) {
      toast.error('This schedule overlaps with an existing schedule for this zone and day');
      return;
    }

    onScheduleUpdate([...schedule, newEntry]);
  };

  const removeScheduleEntry = (indexToRemove: number) => {
    onScheduleUpdate(schedule.filter((_, index) => index !== indexToRemove));
  };

  const getZoneName = (zoneId: string): string => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : 'Unknown Zone';
  };

  const getDayName = (dayOfWeek: number): string => {
    const day = DAYS_OF_WEEK.find(d => parseInt(d.value) === dayOfWeek);
    return day ? day.label : 'Unknown Day';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Create Mowing Schedule</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define when each zone should be mowed during the week
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Schedule Entry</CardTitle>
          <CardDescription>
            Select a zone, day, and time range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zone-select">Zone</Label>
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
              <div className="space-y-2">
                <Label htmlFor="day-select">Day of Week</Label>
                <Select
                  value={selectedDay}
                  onValueChange={setSelectedDay}
                >
                  <SelectTrigger id="day-select">
                    <SelectValue placeholder="Select Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input 
                  id="start-time" 
                  type="time" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input 
                  id="end-time" 
                  type="time" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <Button 
              onClick={addScheduleEntry}
              className="w-full mt-2 sm:mt-0 sm:w-auto sm:self-end"
            >
              <Plus className="h-4 w-4 mr-2" /> Add to Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      {schedule.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>
              Your mower's weekly schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                  .map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {getDayName(entry.dayOfWeek)}
                      </TableCell>
                      <TableCell>
                        {getZoneName(entry.zoneId)}
                      </TableCell>
                      <TableCell className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        {entry.startTime}
                      </TableCell>
                      <TableCell>
                        {entry.endTime}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeScheduleEntry(index)} 
                          className="h-8 w-8 text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <h3 className="font-medium text-muted-foreground">No Schedule Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add at least one schedule entry to create your mowing plan
          </p>
        </div>
      )}
    </div>
  );
};

export default ScheduleDisplay; 