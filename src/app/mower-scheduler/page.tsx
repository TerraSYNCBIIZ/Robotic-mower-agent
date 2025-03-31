"use client";

import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/auth';
import { Container } from '@/components/ui/container';
import MowerScheduler, { Mower, Zone } from '@/components/scheduler/MowerScheduler';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Original mower capabilities data from SCHEDULING-TOOLV2 - EXACT COPY
const AVAILABLE_MOWERS = [
  {
    id: 'ceora',
    name: 'CEORA',
    cyclesPerDay: 3.56,
    acresPerCycle: 1.89,
    acresPerDay: 6.73,
    acresPerWeek: 47.11,
    cycleTime: 405
  },
  {
    id: '550-epos',
    name: '550 EPOS',
    cyclesPerDay: 4.8,
    acresPerCycle: 0.19,
    acresPerDay: 0.9,
    acresPerWeek: 6.32,
    cycleTime: 300
  },
  {
    id: '550',
    name: '550',
    cyclesPerDay: 4.8,
    acresPerCycle: 0.095,
    acresPerDay: 0.45,
    acresPerWeek: 3.16,
    cycleTime: 300
  },
  {
    id: '535-epos',
    name: '535 EPOS',
    cyclesPerDay: 9,
    acresPerCycle: 0.071,
    acresPerDay: 0.64,
    acresPerWeek: 4.48,
    cycleTime: 156
  },
  {
    id: '535',
    name: '535',
    cyclesPerDay: 10,
    acresPerCycle: 0.035,
    acresPerDay: 0.35,
    acresPerWeek: 2.45,
    cycleTime: 140
  },
  {
    id: '520-epos',
    name: '520 EPOS',
    cyclesPerDay: 10,
    acresPerCycle: 0.046,
    acresPerDay: 0.46,
    acresPerWeek: 3.22,
    cycleTime: 145
  },
  {
    id: '520',
    name: '520',
    cyclesPerDay: 10,
    acresPerCycle: 0.023,
    acresPerDay: 0.23,
    acresPerWeek: 1.61,
    cycleTime: 145
  },
  {
    id: 'kr-236',
    name: 'KR 236',
    cyclesPerDay: 13.7,
    acresPerCycle: 0.16,
    acresPerDay: 2.21,
    acresPerWeek: 15.47,
    cycleTime: 105
  },
  {
    id: 'kr-233',
    name: 'KR 233',
    cyclesPerDay: 7.8,
    acresPerCycle: 0.16,
    acresPerDay: 1.25,
    acresPerWeek: 8.75,
    cycleTime: 185
  },
  {
    id: 'kr-174',
    name: 'KR 174',
    cyclesPerDay: 8.4,
    acresPerCycle: 0.06,
    acresPerDay: 0.50,
    acresPerWeek: 3.5,
    cycleTime: 172
  }
];

// Map Husqvarna model names to ids in AVAILABLE_MOWERS
const MODEL_MAPPING: Record<string, string> = {
  // 435 models map to 535
  '435': '535',
  '435X': '535',
  '435X AWD': '535',
  'AM435X AWD': '535', // Add explicit AM prefix version
  
  // 450XH models map to standard 550 (not EPOS)
  '450XH': '550',
  'AM450XH': '550', // Add explicit AM prefix version
  // 450XH EPOS still maps to 550 EPOS
  '450XH EPOS': '550-epos',
  'AM450XH EPOS': '550-epos', // Add explicit AM prefix version
  '550XH': '550-epos',
  '550H EPOS': '550-epos',
  // Add more specific match for the DEMO version
  '550H EPOS DEMO': '550-epos',
  
  // Other known models
  '315X': '520',
  '550 EPOS': '550-epos',
  '550': '550',
  '535 EPOS': '535-epos',
  '535': '535',
  '535 AWD': '535',
  '520 EPOS': '520-epos',
  '520': '520',
  
  // Default
  'default': '520'
};

// Helper function to get mower capabilities based on model
function getMowerCapabilities(model: string): Mower | null {
  // Extract model number from the full model string
  // Handle common formats like "HUSQVARNA AUTOMOWER® 450XH" or "Husqvarna Automower® 435X AWD"
  const normalizedModel = model.replace(/husqvarna\s+automower®?\s+/i, '').trim();
  
  console.log(`Normalizing model "${model}" to "${normalizedModel}"`);
  
  // 1. Look for exact ID match in MODEL_MAPPING
  if (MODEL_MAPPING[normalizedModel]) {
    const mappedId = MODEL_MAPPING[normalizedModel];
    const matchedMower = AVAILABLE_MOWERS.find(m => m.id === mappedId);
    
    if (matchedMower) {
      console.log(`Found exact mapping for ${normalizedModel} -> ${mappedId}`);
      return matchedMower;
    }
  }
  
  // Remove "AM" prefix if present for additional matching
  const withoutAMPrefix = normalizedModel.replace(/^AM/, '');
  if (MODEL_MAPPING[withoutAMPrefix]) {
    const mappedId = MODEL_MAPPING[withoutAMPrefix];
    const matchedMower = AVAILABLE_MOWERS.find(m => m.id === mappedId);
    
    if (matchedMower) {
      console.log(`Found mapping after removing AM prefix: ${normalizedModel} -> ${withoutAMPrefix} -> ${mappedId}`);
      return matchedMower;
    }
  }
  
  // Special case for EPOS models - prioritize EPOS mapping if the name contains "EPOS"
  if (normalizedModel.includes("EPOS")) {
    // First check if it's a 450XH EPOS or 550H EPOS variant
    if (normalizedModel.includes("450") || normalizedModel.includes("450XH") || 
        normalizedModel.includes("550") || normalizedModel.includes("550H")) {
      const matchedMower = AVAILABLE_MOWERS.find(m => m.id === "550-epos");
      if (matchedMower) {
        console.log(`Special EPOS handling: ${normalizedModel} -> 550-epos`);
        return matchedMower;
      }
    }
    
    // Handle other EPOS models
    for (const prefix of ["535", "520"]) {
      if (normalizedModel.includes(prefix)) {
        const eposId = `${prefix}-epos`;
        const matchedMower = AVAILABLE_MOWERS.find(m => m.id === eposId);
        if (matchedMower) {
          console.log(`Special EPOS handling: ${normalizedModel} -> ${eposId}`);
          return matchedMower;
        }
      }
    }
  }
  
  // 2. Try to find the model by partial name match
  for (const mower of AVAILABLE_MOWERS) {
    if (normalizedModel.includes(mower.name)) {
      console.log(`Found by name match: ${normalizedModel} -> ${mower.name}`);
      return mower;
    }
  }
  
  // 3. Look for partial matches in mapping keys
  for (const key of Object.keys(MODEL_MAPPING)) {
    if (normalizedModel.includes(key)) {
      const mappedId = MODEL_MAPPING[key];
      const matchedMower = AVAILABLE_MOWERS.find(m => m.id === mappedId);
      
      if (matchedMower) {
        console.log(`Found by partial key match: ${normalizedModel} contains ${key} -> ${mappedId}`);
        return matchedMower;
      }
    }
  }
  
  // 4. Fall back to default
  const defaultMower = AVAILABLE_MOWERS.find(m => m.id === MODEL_MAPPING.default);
  console.log(`No match found for: ${model}, using default: ${defaultMower?.name}`);
  return defaultMower || null;
}

export default function MowerSchedulerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mowers, setMowers] = useState<Mower[]>([]);
  const [authenticated, setAuthenticated] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadMowers() {
      try {
        setLoading(true);
        setError(null);
        
        // Get auth token
        const token = getAuthToken();
        
        // Check if authenticated
        if (!token) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }
        
        // Fetch mowers from API with auth token
        const response = await fetch('/api/mowers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch mowers');
        }
        
        const data = await response.json();
        
        // Transform mowers to the format expected by MowerScheduler using EXACT mower data
        // Also fetch detailed mower data for each mower to get position and other attributes
        const schedulerMowers = await Promise.all(data.mowers.map(async (mower: any) => {
          // Get capabilities from the fixed mower data in SCHEDULING-TOOLV2
          const mowerData = getMowerCapabilities(mower.model);
          
          // Try to fetch detailed mower data to get more accurate position
          let detailedMower = mower;
          try {
            const mowerResponse = await fetch(`/api/mowers/${mower.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (mowerResponse.ok) {
              const mowerDetails = await mowerResponse.json();
              if (mowerDetails.success && mowerDetails.mower) {
                detailedMower = mowerDetails.mower;
                console.log(`Fetched detailed data for mower ${mower.name}`);
              }
            }
          } catch (error) {
            console.error(`Error fetching detailed data for mower ${mower.id}:`, error);
            // Continue with the original mower data
          }
          
          // Extract location data from the mower if available
          let location = undefined;
          if (detailedMower.coordinates && detailedMower.coordinates.latitude && detailedMower.coordinates.longitude) {
            location = {
              lat: detailedMower.coordinates.latitude,
              lng: detailedMower.coordinates.longitude
            };
            console.log(`Mower ${detailedMower.name} has coordinates:`, location);
          }
          
          if (!mowerData) {
            console.error(`Could not find capabilities for model: ${detailedMower.model}`);
            // Create a default mower entry if no match is found
            return {
              id: detailedMower.id,
              name: detailedMower.name,
              model: detailedMower.model,
              cyclesPerDay: 4,
              acresPerCycle: 0.25,
              acresPerDay: 1.0,
              acresPerWeek: 7.0,
              cycleTime: 60,
              zones: detailedMower.zones,
              location, // Add location if available
              attributes: detailedMower.attributes, // Preserve original attributes
              coordinates: detailedMower.coordinates // Preserve coordinates
            };
          }
          
          // Use the exact data from SCHEDULING-TOOLV2
          return {
            id: detailedMower.id,
            name: detailedMower.name,
            model: detailedMower.model,
            cyclesPerDay: mowerData.cyclesPerDay,
            acresPerCycle: mowerData.acresPerCycle,
            acresPerDay: mowerData.acresPerDay,
            acresPerWeek: mowerData.acresPerWeek,
            cycleTime: mowerData.cycleTime,
            zones: detailedMower.zones,
            location, // Add location if available
            attributes: detailedMower.attributes, // Preserve original attributes
            coordinates: detailedMower.coordinates // Preserve coordinates
          };
        }));
        
        setMowers(schedulerMowers);
      } catch (err) {
        console.error('Error loading mowers:', err);
        setError('Failed to load mowers. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    loadMowers();
  }, []);

  async function handleScheduleSubmit(schedule: any, mowerId: string) {
    try {
      // Format the schedule data for the API
      const formattedTasks = [];
      
      // Convert from our app's schedule format to Husqvarna API format
      for (const day in schedule) {
        // Get the schedule blocks for this day
        const daySchedule = schedule[day];
        
        // Skip empty days
        if (!daySchedule || daySchedule.length === 0) continue;
        
        // Map each block to a calendar task
        for (const block of daySchedule) {
          // Convert time format from HH:MM to minutes since midnight
          const startMinutes = convertTimeToMinutes(block.startTime);
          const endMinutes = convertTimeToMinutes(block.endTime);
          const duration = endMinutes - startMinutes;
          
          if (duration <= 0) continue; // Skip invalid durations
          
          // Create task with days enabled based on current day
          const task = {
            start: startMinutes,
            duration,
            monday: day === 'Monday',
            tuesday: day === 'Tuesday',
            wednesday: day === 'Wednesday',
            thursday: day === 'Thursday',
            friday: day === 'Friday',
            saturday: day === 'Saturday',
            sunday: day === 'Sunday',
            workAreaId: block.zoneId
          };
          
          formattedTasks.push(task);
        }
      }
      
      // Send the calendar data to the API
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`/api/mowers/${mowerId}/calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tasks: formattedTasks }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update schedule');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error submitting schedule:', error);
      throw error;
    }
  }

  function convertTimeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  // Add rendering for not authenticated state
  if (!authenticated) {
    return (
      <Container className="py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You need to connect your Husqvarna account to view your mowers.
            <div className="mt-4">
              <Button asChild>
                <Link href="/mowers/add">Connect Husqvarna Account</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="bg-transparent">
      <div className="py-8">
        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <div className="w-12 sm:w-14 md:w-16 h-auto flex-shrink-0 relative">
              <div className="absolute inset-0 bg-white dark:bg-white rounded-full"></div>
              <img 
                src="/Black_on_Transparent_Logo 1.png" 
                alt="TerraSync Logo" 
                className="w-full h-auto relative z-10"
              />
            </div>
            <div className="ml-3 flex flex-col justify-center">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-wide leading-none">TERRASYNC</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center leading-tight">
                Scheduler Tool
                <span className="text-xs align-top ml-0.5">™</span>
              </p>
            </div>
          </div>
        </div>
        
        {loading ? (
          <Card className="p-8 flex justify-center items-center bg-background/60 backdrop-blur-sm border-border">
            <Loader2 className="h-8 w-8 animate-spin mr-2 text-primary" />
            <p>Loading mowers...</p>
          </Card>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : mowers.length === 0 ? (
          <Card className="p-8 bg-background/60 backdrop-blur-sm border-border">
            <p className="text-center text-muted-foreground">
              No mowers found. Please make sure you have connected mowers in your account.
            </p>
          </Card>
        ) : (
          <MowerScheduler 
            availableMowers={mowers} 
            onScheduleSubmit={handleScheduleSubmit}
          />
        )}
      </div>
    </Container>
  );
} 