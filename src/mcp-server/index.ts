import { husqvarnaApi } from '../lib/husqvarna/api-client';

// Types for our mower data
interface MowerData {
  id: string;
  battery: {
    batteryPercent: number;
  };
  mower: {
    activity: string;
    state: string;
  };
  metadata: {
    connected: boolean;
    lastUpdated: Date;
  };
  system: {
    name: string;
    model: string;
  };
}

interface ScheduleTask {
  start: number;
  duration: number;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

// Simple mock data service for development until the API client is fully implemented
const dataService = {
  getMowerData: async (mowerId: string): Promise<MowerData> => {
    console.log(`Getting data for mower ${mowerId}`);
    
    // Mock implementation for testing
    return {
      id: mowerId,
      battery: { batteryPercent: 85 },
      mower: { activity: 'CHARGING', state: 'OK' },
      metadata: { connected: true, lastUpdated: new Date() },
      system: { name: 'Mock Mower', model: 'Automower 450X' }
    };
  },
  
  getMowerSchedule: async (mowerId: string): Promise<ScheduleTask[]> => {
    console.log(`Getting schedule for mower ${mowerId}`);
    
    // Mock implementation with some example schedules
    return [
      {
        start: 480, // 8:00 AM in minutes
        duration: 120, // 2 hours in minutes
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      },
      {
        start: 900, // 3:00 PM in minutes
        duration: 90, // 1.5 hours in minutes
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: true,
        sunday: true
      }
    ];
  },
  
  updateMowerSchedule: async (mowerId: string, schedule: ScheduleTask[]): Promise<boolean> => {
    console.log(`Updating schedule for mower ${mowerId}`);
    console.log('Schedule:', JSON.stringify(schedule, null, 2));
    
    // Mock implementation always succeeds
    return true;
  },
  
  getMowerPositionHistory: async (mowerId: string): Promise<any> => {
    console.log(`Getting position history for mower ${mowerId}`);
    
    // Mock implementation with some example positions
    const mockCurrentPosition = {
      latitude: 37.7749,
      longitude: -122.4194
    };
    
    const mockHistory = [
      mockCurrentPosition,
      { latitude: 37.7748, longitude: -122.4193 },
      { latitude: 37.7747, longitude: -122.4192 },
      { latitude: 37.7746, longitude: -122.4191 }
    ];
    
    return {
      current: mockCurrentPosition,
      history: mockHistory
    };
  },
  
  getMowerErrorHistory: async (mowerId: string): Promise<any[]> => {
    console.log(`Getting error history for mower ${mowerId}`);
    
    // Mock implementation with some example errors
    return [
      {
        time: Date.now() - 86400000, // 1 day ago
        code: 8,
        severity: 'WARNING',
        latitude: 37.7749,
        longitude: -122.4194
      },
      {
        time: Date.now() - 172800000, // 2 days ago
        code: 10,
        severity: 'ERROR',
        latitude: 37.7748,
        longitude: -122.4193
      }
    ];
  },
  
  getAllMowersData: async (): Promise<MowerData[]> => {
    console.log('Getting all mower data');
    
    // Mock implementation with 2 example mowers
    return [
      {
        id: 'mower-1',
        battery: { batteryPercent: 85 },
        mower: { activity: 'CHARGING', state: 'OK' },
        metadata: { connected: true, lastUpdated: new Date() },
        system: { name: 'Front Yard Mower', model: 'Automower 450X' }
      },
      {
        id: 'mower-2',
        battery: { batteryPercent: 67 },
        mower: { activity: 'MOWING', state: 'IN_OPERATION' },
        metadata: { connected: true, lastUpdated: new Date() },
        system: { name: 'Back Yard Mower', model: 'Automower 430X' }
      }
    ];
  },
  
  // Mock command handling functions
  sendCommand: async (mowerId: string, command: string, duration?: number): Promise<boolean> => {
    console.log(`Sending command to mower ${mowerId}: ${command}${duration ? ` for ${duration} minutes` : ''}`);
    return true;
  }
};

// MCP server implementation with rich tools
class MowerMcpServer {
  private tools: any[];
  
  constructor() {
    this.tools = [
      {
        name: 'getMowerStatus',
        description: 'Get the current status of a mower including battery level, activity, and state',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to get status for'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'getMowerSchedule',
        description: 'Get the current mowing schedule for a mower',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to get schedule for'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'updateMowerSchedule',
        description: 'Update the mowing schedule for a mower',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to update schedule for'
            },
            schedule: {
              type: 'array',
              description: 'The schedule tasks to set',
              items: {
                type: 'object',
                properties: {
                  start: {
                    type: 'integer',
                    description: 'Start time in minutes after midnight'
                  },
                  duration: {
                    type: 'integer',
                    description: 'Duration in minutes'
                  },
                  monday: { type: 'boolean' },
                  tuesday: { type: 'boolean' },
                  wednesday: { type: 'boolean' },
                  thursday: { type: 'boolean' },
                  friday: { type: 'boolean' },
                  saturday: { type: 'boolean' },
                  sunday: { type: 'boolean' }
                }
              }
            }
          },
          required: ['mowerId', 'schedule']
        }
      },
      
      {
        name: 'startMower',
        description: 'Start the mower and begin mowing',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to start'
            },
            duration: {
              type: 'integer',
              description: 'Optional duration in minutes to mow for'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'parkMower',
        description: 'Park the mower at the charging station',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to park'
            },
            untilNext: {
              type: 'boolean',
              description: 'If true, parks until next scheduled time'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'pauseMower',
        description: 'Pause the currently running mower',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to pause'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'resumeMower',
        description: 'Resume mowing after being paused',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to resume'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'getMowerLocation',
        description: 'Get the current location of the mower and recent history',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to get location for'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'getErrorHistory',
        description: 'Get the error history for a mower',
        parameters: {
          type: 'object',
          properties: {
            mowerId: {
              type: 'string',
              description: 'The ID of the mower to get errors for'
            }
          },
          required: ['mowerId']
        }
      },
      
      {
        name: 'getUserMowers',
        description: 'Get the list of mowers associated with the user',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }
  
  async handleRequest(request: any): Promise<any> {
    console.log('MCP request:', JSON.stringify(request, null, 2));
    
    try {
      // Validate the request has required fields
      if (!request || !request.name) {
        throw new Error('Invalid MCP request: missing name field');
      }
      
      // Extract the tool name and parameters
      const { name, parameters = {} } = request;
      let result;
      
      // Handle the request based on the tool name
      switch (name) {
        case 'getMowerStatus':
          result = await this.handleGetMowerStatus(parameters);
          break;
        case 'getMowerSchedule':
          result = await this.handleGetMowerSchedule(parameters);
          break;
        case 'updateMowerSchedule':
          result = await this.handleUpdateMowerSchedule(parameters);
          break;
        case 'startMower':
          result = await this.handleStartMower(parameters);
          break;
        case 'parkMower':
          result = await this.handleParkMower(parameters);
          break;
        case 'pauseMower':
          result = await this.handlePauseMower(parameters);
          break;
        case 'resumeMower':
          result = await this.handleResumeMower(parameters);
          break;
        case 'getMowerLocation':
          result = await this.handleGetMowerLocation(parameters);
          break;
        case 'getErrorHistory':
          result = await this.handleGetErrorHistory(parameters);
          break;
        case 'getUserMowers':
          result = await this.handleGetUserMowers();
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      
      const response = { result };
      console.log('MCP response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Error handling MCP request:', error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  getTools(): any[] {
    return this.tools;
  }
  
  private async handleGetMowerStatus(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId } = parameters;
    const mowerData = await dataService.getMowerData(mowerId);
    
    // Format the activity to be more human-readable
    let activityDescription = mowerData.mower.activity;
    switch (mowerData.mower.activity) {
      case 'MOWING':
        activityDescription = 'Currently mowing the lawn';
        break;
      case 'GOING_HOME':
        activityDescription = 'Returning to charging station';
        break;
      case 'CHARGING':
        activityDescription = 'Currently charging at the station';
        break;
      case 'PARKED_IN_CS':
        activityDescription = 'Parked at the charging station';
        break;
      case 'LEAVING':
        activityDescription = 'Leaving the charging station';
        break;
      case 'STOPPED_IN_GARDEN':
        activityDescription = 'Stopped in the garden';
        break;
      case 'PAUSED':
        activityDescription = 'Paused temporarily';
        break;
      default:
        activityDescription = mowerData.mower.activity || 'Status unknown';
    }
    
    return {
      battery: mowerData.battery,
      activity: mowerData.mower.activity,
      activityDescription,
      state: mowerData.mower.state,
      connected: mowerData.metadata.connected,
      lastUpdated: mowerData.metadata.lastUpdated,
      mowerName: mowerData.system.name,
      mowerModel: mowerData.system.model
    };
  }
  
  private async handleGetMowerSchedule(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId } = parameters;
    const schedule = await dataService.getMowerSchedule(mowerId);
    
    // Add human-readable time format
    const formattedSchedule = schedule.map(task => {
      const startHours = Math.floor(task.start / 60);
      const startMinutes = task.start % 60;
      const durationHours = Math.floor(task.duration / 60);
      const durationMinutes = task.duration % 60;
      
      const startTimeStr = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
      const durationStr = durationHours > 0 
        ? `${durationHours}h ${durationMinutes > 0 ? durationMinutes + 'm' : ''}`
        : `${durationMinutes}m`;
      
      const days = [];
      if (task.monday) days.push('Monday');
      if (task.tuesday) days.push('Tuesday');
      if (task.wednesday) days.push('Wednesday');
      if (task.thursday) days.push('Thursday');
      if (task.friday) days.push('Friday');
      if (task.saturday) days.push('Saturday');
      if (task.sunday) days.push('Sunday');
      
      return {
        ...task,
        startTimeFormatted: startTimeStr,
        durationFormatted: durationStr,
        daysFormatted: days.join(', '),
        activeDays: days
      };
    });
    
    return { 
      schedule: formattedSchedule,
      hasSchedule: formattedSchedule.length > 0
    };
  }
  
  private async handleUpdateMowerSchedule(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    if (!parameters.schedule || !Array.isArray(parameters.schedule)) {
      throw new Error('Missing or invalid required parameter: schedule');
    }
    
    const { mowerId, schedule } = parameters;
    
    // Validate each schedule item
    for (const item of schedule) {
      if (typeof item.start !== 'number') {
        throw new Error('Invalid schedule item: start must be a number');
      }
      
      if (typeof item.duration !== 'number') {
        throw new Error('Invalid schedule item: duration must be a number');
      }
      
      if (item.start < 0 || item.start >= 1440) { // 24 hours in minutes
        throw new Error('Invalid schedule item: start must be between 0 and 1439 minutes');
      }
      
      if (item.duration <= 0 || item.duration > 1440) {
        throw new Error('Invalid schedule item: duration must be between 1 and 1440 minutes');
      }
    }
    
    const success = await dataService.updateMowerSchedule(mowerId, schedule);
    
    return { 
      success,
      scheduleCount: schedule.length,
      message: success 
        ? `Successfully updated schedule with ${schedule.length} tasks` 
        : 'Failed to update mower schedule'
    };
  }
  
  private async handleStartMower(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId, duration = 240 } = parameters;
    
    // Validate duration is reasonable
    const durationMinutes = Number(duration);
    if (isNaN(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      throw new Error('Invalid duration: must be between 1 and 1440 minutes (24 hours)');
    }
    
    try {
      await dataService.sendCommand(mowerId, 'start', durationMinutes);
      
      return { 
        success: true, 
        mowerId,
        duration: durationMinutes,
        message: `Mower started successfully for ${durationMinutes} minutes`
      };
    } catch (error) {
      console.error(`Error starting mower ${mowerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to start mower. Please check if the mower is connected and try again."
      };
    }
  }
  
  private async handleParkMower(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId, untilNext = false } = parameters;
    const command = untilNext ? 'parkUntilNext' : 'park';
    
    try {
      await dataService.sendCommand(mowerId, command);
      
      return { 
        success: true, 
        mowerId,
        untilNext,
        message: `Mower is returning to charging station${untilNext ? ' until next scheduled time' : ''}`
      };
    } catch (error) {
      console.error(`Error parking mower ${mowerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to park mower. Please check if the mower is connected and try again."
      };
    }
  }
  
  private async handlePauseMower(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId } = parameters;
    
    try {
      await dataService.sendCommand(mowerId, 'pause');
      
      return { 
        success: true, 
        mowerId,
        message: "Mower paused successfully"
      };
    } catch (error) {
      console.error(`Error pausing mower ${mowerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to pause mower. Please check if the mower is connected and try again."
      };
    }
  }
  
  private async handleResumeMower(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId } = parameters;
    
    try {
      await dataService.sendCommand(mowerId, 'resume');
      
      return { 
        success: true, 
        mowerId,
        message: "Mower resumed operation successfully"
      };
    } catch (error) {
      console.error(`Error resuming mower ${mowerId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to resume mower. Please check if the mower is connected and try again."
      };
    }
  }
  
  private async handleGetMowerLocation(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId } = parameters;
    const positionData = await dataService.getMowerPositionHistory(mowerId);
    
    return { 
      currentPosition: positionData.current,
      history: positionData.history,
      historyCount: positionData.history.length,
      hasCurrentPosition: positionData.current !== null
    };
  }
  
  private async handleGetErrorHistory(parameters: any): Promise<any> {
    if (!parameters.mowerId) {
      throw new Error('Missing required parameter: mowerId');
    }
    
    const { mowerId } = parameters;
    const errorHistory = await dataService.getMowerErrorHistory(mowerId);
    
    // Format errors to be more readable if available
    const formattedErrors = errorHistory.map((error: any) => ({
      ...error,
      timestampFormatted: error.time 
        ? new Date(error.time).toLocaleString() 
        : 'Unknown',
      severity: error.severity || 'UNKNOWN',
      code: error.code || 0
    }));
    
    return { 
      errorHistory: formattedErrors,
      errorCount: formattedErrors.length,
      hasErrors: formattedErrors.length > 0 
    };
  }
  
  private async handleGetUserMowers(): Promise<any> {
    const mowers = await dataService.getAllMowersData();
    
    return { 
      mowers: mowers.map(m => ({
        id: m.id,
        name: m.system.name,
        model: m.system.model,
        battery: m.battery.batteryPercent,
        activity: m.mower.activity,
        state: m.mower.state,
        connected: m.metadata.connected
      })),
      mowerCount: mowers.length
    };
  }
}

const server = new MowerMcpServer();
export default server; 