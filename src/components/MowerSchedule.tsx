import React, { useState, useEffect } from 'react';
import { useMowerData } from '@/contexts/MowerDataContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, Save, Plus, Trash } from 'lucide-react';

// Days of the week for schedule
const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

interface ScheduleTask {
  id?: string;
  start: number;
  duration: number;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  zones?: Array<{ name?: string; id?: number }>;
}

export default function MowerSchedule({ mowerId }: { mowerId: string }) {
  const { dataService, isLoading } = useMowerData();
  const { toast } = useToast();

  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load the schedule data from our enhanced data service
  useEffect(() => {
    if (!mowerId || !dataService) return;
    
    const loadSchedule = async () => {
      setIsLoadingSchedule(true);
      try {
        // Use our optimized data flow to get schedule data
        const tasks = await dataService.getMowerSchedule(mowerId);
        setScheduleTasks(tasks || []);
      } catch (error) {
        console.error('Error loading schedule:', error);
        toast({
          title: 'Error loading schedule',
          description: 'Failed to load the mower schedule. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingSchedule(false);
      }
    };
    
    loadSchedule();
  }, [mowerId, dataService, toast]);
  
  // Add a new empty schedule task
  const addScheduleTask = () => {
    // Default task from 8:00 AM for 180 minutes (3 hours)
    const newTask: ScheduleTask = {
      start: 8 * 60 * 60, // 8:00 AM in seconds
      duration: 180 * 60, // 3 hours in seconds
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    };
    
    setScheduleTasks([...scheduleTasks, newTask]);
  };
  
  // Remove a schedule task
  const removeScheduleTask = (index: number) => {
    const updatedTasks = [...scheduleTasks];
    updatedTasks.splice(index, 1);
    setScheduleTasks(updatedTasks);
  };
  
  // Update a schedule task property
  const updateTaskProperty = (index: number, property: string, value: any) => {
    const updatedTasks = [...scheduleTasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      [property]: value,
    };
    setScheduleTasks(updatedTasks);
  };
  
  // Toggle a day of the week for a task
  const toggleDay = (index: number, day: string) => {
    const updatedTasks = [...scheduleTasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      [day]: !updatedTasks[index][day as keyof ScheduleTask],
    };
    setScheduleTasks(updatedTasks);
  };
  
  // Convert time string to seconds (for API)
  const timeToSeconds = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60 * 60) + (minutes * 60);
  };
  
  // Convert seconds to time string (for UI)
  const secondsToTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  
  // Handle time input change
  const handleTimeChange = (index: number, field: 'start' | 'duration', value: string) => {
    if (field === 'start') {
      // Convert HH:MM to seconds for the API
      const seconds = timeToSeconds(value);
      updateTaskProperty(index, 'start', seconds);
    } else {
      // For duration, convert hours to seconds
      const hours = parseFloat(value);
      const seconds = Math.round(hours * 60 * 60); // Convert hours to seconds
      updateTaskProperty(index, 'duration', seconds);
    }
  };
  
  // Save the updated schedule to the server using API
  const saveSchedule = async () => {
    if (!dataService) {
      toast({
        title: "Error",
        description: "Data service not available. Please try again later.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Use our direct API call for updating the schedule
      const success = await dataService.updateMowerSchedule(mowerId, scheduleTasks);
      
      if (success) {
        toast({
          title: 'Schedule saved',
          description: 'Your mower schedule has been updated successfully.',
        });
      } else {
        throw new Error('Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Error saving schedule',
        description: 'Failed to update the mower schedule. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading || isLoadingSchedule) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Mowing Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {scheduleTasks.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No schedule tasks configured</p>
              <Button onClick={addScheduleTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </div>
          ) : (
            <>
              {scheduleTasks.map((task, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Schedule #{index + 1}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeScheduleTask(index)}
                    >
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`start-time-${index}`}>Start Time</Label>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <Input
                          id={`start-time-${index}`}
                          type="time"
                          value={secondsToTime(task.start)}
                          onChange={(e) => handleTimeChange(index, 'start', e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`duration-${index}`}>Duration (hours)</Label>
                      <Input
                        id={`duration-${index}`}
                        type="number"
                        min="0.5"
                        step="0.5"
                        max="12"
                        value={(task.duration / 3600).toFixed(1)}
                        onChange={(e) => handleTimeChange(index, 'duration', e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex flex-wrap gap-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.id}
                          variant={task[day.id as keyof ScheduleTask] ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleDay(index, day.id)}
                          className="flex-1 min-w-[3rem]"
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between items-center">
                <Button onClick={addScheduleTask} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
                
                <Button onClick={saveSchedule} disabled={isSaving}>
                  {isSaving ? (
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Schedule
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 