import { ai, AGENT_SYSTEM_INSTRUCTIONS, TOOLS } from './config';
import { Flow } from '@genkit-ai/ai';
import { HusqvarnaClient } from '../husqvarna/api';

// Implementation of tool callbacks
const toolCallbacks = {
  getMowerStatus: async (params: { mowerId: string }, context: any) => {
    const { auth } = context;
    
    if (!auth?.accessToken) {
      return {
        error: 'Authentication required. Please link your Husqvarna account first.'
      };
    }
    
    try {
      const client = new HusqvarnaClient(auth.accessToken, auth.refreshToken);
      const mower = await client.getMower(params.mowerId);
      
      return {
        system: mower.attributes.system,
        battery: mower.attributes.battery,
        status: {
          mode: mower.attributes.mower.mode,
          activity: mower.attributes.mower.activity,
          state: mower.attributes.mower.state,
          errorCode: mower.attributes.mower.errorCode,
        },
        location: mower.attributes.positions[0] || null,
      };
    } catch (error) {
      console.error('Error fetching mower status:', error);
      return {
        error: 'Failed to fetch mower status. Please try again later.'
      };
    }
  },
  
  sendMowerCommand: async (params: { mowerId: string, command: string, duration?: number }, context: any) => {
    const { auth } = context;
    
    if (!auth?.accessToken) {
      return {
        error: 'Authentication required. Please link your Husqvarna account first.'
      };
    }
    
    try {
      const client = new HusqvarnaClient(auth.accessToken, auth.refreshToken);
      
      // For commands that accept duration
      const attributes = params.duration && ['Start', 'Park'].includes(params.command) 
        ? { duration: params.duration } 
        : undefined;
      
      await client.sendCommand(params.mowerId, params.command, attributes);
      
      return {
        success: true,
        message: `Command ${params.command} sent successfully to mower.`
      };
    } catch (error) {
      console.error('Error sending command to mower:', error);
      return {
        error: 'Failed to send command to mower. Please try again later.'
      };
    }
  },
  
  getWeatherForecast: async (params: { latitude: number, longitude: number, days?: number }) => {
    try {
      // Note: In a real implementation, we would call a weather API here
      // For now, we'll return mock data
      return {
        current: {
          temp_c: 22,
          condition: {
            text: 'Sunny',
          },
          precip_mm: 0,
          wind_kph: 15,
        },
        forecast: {
          forecastday: Array(params.days || 3).fill(null).map((_, i) => ({
            date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
            day: {
              maxtemp_c: 24 + Math.floor(Math.random() * 4),
              mintemp_c: 16 + Math.floor(Math.random() * 3),
              daily_chance_of_rain: Math.floor(Math.random() * 30),
              condition: {
                text: ['Sunny', 'Partly cloudy', 'Cloudy', 'Light rain'][Math.floor(Math.random() * 4)],
              },
            },
          })),
        },
      };
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      return {
        error: 'Failed to fetch weather forecast. Please try again later.'
      };
    }
  },
  
  // New tool implementation: Get mower schedule
  getMowerSchedule: async (params: { mowerId: string }, context: any) => {
    const { auth } = context;
    
    if (!auth?.accessToken) {
      return {
        error: 'Authentication required. Please link your Husqvarna account first.'
      };
    }
    
    try {
      // Fetch the mower's current schedule and zones
      const scheduleResponse = await fetch(`/api/mowers/${params.mowerId}/schedule`);
      
      if (!scheduleResponse.ok) {
        throw new Error('Failed to fetch mower schedule');
      }
      
      const schedule = await scheduleResponse.json();
      
      const zonesResponse = await fetch(`/api/mowers/${params.mowerId}/zones`);
      
      if (!zonesResponse.ok) {
        throw new Error('Failed to fetch mower zones');
      }
      
      const zones = await zonesResponse.json();
      
      // Return both schedule and zones information
      return {
        success: true,
        schedule: schedule,
        zones: zones,
        summary: generateScheduleSummary(schedule, zones)
      };
    } catch (error) {
      console.error('Error fetching mower schedule:', error);
      return {
        error: 'Failed to fetch mower schedule. Please try again later.'
      };
    }
  },
  
  // New tool implementation: Update schedule restrictions
  updateScheduleRestriction: async (params: {
    mowerId: string;
    zoneId?: string;
    zoneName?: string;
    day: string;
    startHour?: number;
    endHour?: number;
    restrictionType: string;
  }, context: any) => {
    const { auth } = context;
    
    if (!auth?.accessToken) {
      return {
        error: 'Authentication required. Please link your Husqvarna account first.'
      };
    }
    
    try {
      // 1. Fetch current zone data for the mower
      const zonesResponse = await fetch(`/api/mowers/${params.mowerId}/zones`);
      
      if (!zonesResponse.ok) {
        throw new Error('Failed to fetch zones');
      }
      
      const zones = await zonesResponse.json();
      
      // 2. Find the target zone (either by ID or name)
      let targetZone = null;
      
      if (params.zoneId) {
        targetZone = zones.find((z: any) => z.id === params.zoneId);
      } else if (params.zoneName) {
        // Try to find by name - case insensitive search
        targetZone = zones.find((z: any) => 
          z.name.toLowerCase() === params.zoneName?.toLowerCase()
        );
      }
      
      if (!targetZone) {
        return {
          error: params.zoneId 
            ? `Zone with ID ${params.zoneId} not found` 
            : `Zone with name "${params.zoneName}" not found`
        };
      }
      
      // 3. Update the zone restrictions
      if (!targetZone.restrictions) {
        targetZone.restrictions = [];
      }
      
      // Handle different restriction types
      if (params.restrictionType === 'no-mow') {
        // Add specific time-based restrictions for the given day(s)
        if (params.day === 'all') {
          // Add for all days
          for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            for (let hour = params.startHour || 0; hour <= (params.endHour || 23); hour++) {
              const restrictionKey = `${dayIndex}-${hour}`;
              if (!targetZone.restrictions.includes(restrictionKey)) {
                targetZone.restrictions.push(restrictionKey);
              }
            }
          }
        } else {
          // Add for specific day
          const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(params.day);
          for (let hour = params.startHour || 0; hour <= (params.endHour || 23); hour++) {
            const restrictionKey = `${dayIndex}-${hour}`;
            if (!targetZone.restrictions.includes(restrictionKey)) {
              targetZone.restrictions.push(restrictionKey);
            }
          }
        }
      } else if (!targetZone.restrictions.includes(params.restrictionType)) {
        // Add named period restrictions (morning, afternoon, evening)
        targetZone.restrictions.push(params.restrictionType);
      }
      
      // 4. Save the updated zone data
      const updatedZones = zones.map((z: any) => {
        if (z.id === targetZone.id) {
          return targetZone;
        }
        return z;
      });
      
      const saveResponse = await fetch(`/api/mowers/${params.mowerId}/zones`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ zones: updatedZones }),
      });
      
      if (!saveResponse.ok) {
        throw new Error('Failed to save zone restrictions');
      }
      
      // 5. Trigger a schedule regeneration
      const regenerateResponse = await fetch(`/api/mowers/${params.mowerId}/schedule/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ respectRestrictions: true }),
      });
      
      if (!regenerateResponse.ok) {
        throw new Error('Failed to regenerate schedule');
      }
      
      // 6. Get the updated schedule to return
      const scheduleResponse = await fetch(`/api/mowers/${params.mowerId}/schedule`);
      const updatedSchedule = await scheduleResponse.json();
      
      return {
        success: true,
        message: `Added ${params.restrictionType} restriction to ${targetZone.name} zone${params.day !== 'all' ? ` on ${params.day}` : ' on all days'}${params.startHour !== undefined ? ` from ${params.startHour}:00 to ${params.endHour}:00` : ''}.`,
        restrictionsAdded: true,
        updatedZone: targetZone,
        updatedSchedule: updatedSchedule
      };
    } catch (error) {
      console.error('Error updating schedule restrictions:', error);
      return {
        error: 'Failed to update schedule restrictions. Please try again later.'
      };
    }
  },
  
  // New tool implementation: Update mower schedule
  updateMowerSchedule: async (params: {
    mowerId: string;
    schedule?: any;
    regenerate?: boolean;
  }, context: any) => {
    const { auth } = context;
    
    if (!auth?.accessToken) {
      return {
        error: 'Authentication required. Please link your Husqvarna account first.'
      };
    }
    
    try {
      // If regenerate flag is true or no schedule provided, regenerate the schedule
      if (params.regenerate || !params.schedule) {
        const regenerateResponse = await fetch(`/api/mowers/${params.mowerId}/schedule/regenerate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ respectRestrictions: true }),
        });
        
        if (!regenerateResponse.ok) {
          throw new Error('Failed to regenerate schedule');
        }
        
        const regeneratedSchedule = await regenerateResponse.json();
        
        return {
          success: true,
          message: 'Mower schedule has been regenerated successfully.',
          schedule: regeneratedSchedule
        };
      }
      
      // If a schedule is provided, update it
      if (params.schedule) {
        const saveResponse = await fetch(`/api/mowers/${params.mowerId}/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ schedule: params.schedule }),
        });
        
        if (!saveResponse.ok) {
          throw new Error('Failed to update schedule');
        }
        
        // Submit the schedule to the mower
        const submitResponse = await fetch(`/api/mowers/${params.mowerId}/calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ schedule: params.schedule }),
        });
        
        if (!submitResponse.ok) {
          throw new Error('Failed to submit schedule to mower');
        }
        
        return {
          success: true,
          message: 'Mower schedule has been updated and applied successfully.',
          schedule: params.schedule
        };
      }
      
      return {
        error: 'Invalid parameters. Either provide a schedule or set regenerate to true.'
      };
    } catch (error) {
      console.error('Error updating mower schedule:', error);
      return {
        error: 'Failed to update mower schedule. Please try again later.'
      };
    }
  }
};

// Helper function to generate a human-readable summary of the schedule
function generateScheduleSummary(schedule: any, zones: any[]): string {
  // Create a mapping of zone IDs to names for easier access
  const zoneNames: {[key: string]: string} = {};
  for (const zone of zones) {
    zoneNames[zone.id] = zone.name;
  }
  
  // Generate summary for each day
  const summaries = [];
  
  for (const [day, slots] of Object.entries(schedule)) {
    if (!slots || (Array.isArray(slots) && slots.length === 0)) {
      continue; // Skip days with no schedule
    }
    
    const slotsArray = slots as Array<{
      zoneId: string;
      startTime: string;
      endTime: string;
    }>;
    
    // Group by zone
    const zoneSlots: {[key: string]: string[]} = {};
    
    for (const slot of slotsArray) {
      const zoneName = zoneNames[slot.zoneId] || 'Unknown Zone';
      if (!zoneSlots[zoneName]) {
        zoneSlots[zoneName] = [];
      }
      zoneSlots[zoneName].push(`${slot.startTime}-${slot.endTime}`);
    }
    
    // Format zone schedules
    const zoneSummaries = [];
    for (const [zoneName, times] of Object.entries(zoneSlots)) {
      zoneSummaries.push(`${zoneName}: ${times.join(', ')}`);
    }
    
    summaries.push(`${day}: ${zoneSummaries.join('; ')}`);
  }
  
  if (summaries.length === 0) {
    return "No scheduled mowing sessions found.";
  }
  
  return summaries.join('\n');
}

// Define the agent flow
export const chatFlow: Flow = ai
  .flow('mowerAgentChat')
  .setSystemInstruction(AGENT_SYSTEM_INSTRUCTIONS)
  .setTools(TOOLS, toolCallbacks)
  .onUserMessage(async (message, { context, session }) => {
    // Process the user message
    const response = await session.generate({
      messages: [...context.history, { role: 'user', content: message }],
    });

    return response;
  });

// Export the chat flow and storage functions
const agentExports = {
  chatFlow,
};

export default agentExports; 