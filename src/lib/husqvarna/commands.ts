/**
 * Husqvarna Mower Commands with Firebase Integration
 * This file provides functions to send commands to Husqvarna mowers
 * with optimized Firebase cache updates to ensure UI consistency.
 */
import { husqvarnaApi } from './api-client';
import { MowerDataService } from './mowerDataService';

const mowerDataService = new MowerDataService();

/**
 * Send command to mower with integrated Firebase updates
 * @param mowerId The ID of the mower
 * @param command The command to send: 'start', 'pause', 'park', etc.
 * @param options Optional parameters like duration
 * @returns A promise that resolves to the API response
 */
export async function sendMowerCommand(
  mowerId: string, 
  command: string, 
  options: { duration?: number, workAreaId?: number } = {}
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`🚀 Sending command "${command}" to mower ${mowerId}`, options);
    
    // Map user-friendly commands to API commands
    const apiCommand = mapToApiCommand(command);
    const attributes: Record<string, any> = {};
    
    // Add duration if provided
    if (options.duration && ['Start', 'Park'].includes(apiCommand)) {
      attributes.duration = options.duration;
    }
    
    // Add workAreaId if provided for StartInWorkArea command
    if (options.workAreaId && apiCommand === 'StartInWorkArea') {
      attributes.workAreaId = options.workAreaId;
    }
    
    // Send the command to Husqvarna API
    const response = await husqvarnaApi.sendCommand(mowerId, apiCommand, 
      Object.keys(attributes).length > 0 ? attributes : undefined);
    
    // Eagerly update UI state to show the command effect immediately
    // This prevents UI from appearing out of sync with actual mower state
    await updateMowerStateForCommand(mowerId, command);
    
    console.log(`✅ Command sent successfully: ${command}`, response);
    return {
      success: true,
      message: `Command '${command}' sent successfully`
    };
  } catch (error) {
    console.error(`❌ Error sending command ${command} to mower ${mowerId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Map user-friendly command to Husqvarna API command
 */
function mapToApiCommand(command: string): string {
  switch (command.toLowerCase()) {
    case 'start':
    case 'play':
    case 'mow':
      return 'Start';
    case 'start_area':
    case 'start_in_area':
    case 'mow_area':
      return 'StartInWorkArea';
    case 'pause':
      return 'Pause';
    case 'resume':
    case 'resume_schedule':
      return 'ResumeSchedule';
    case 'park':
    case 'home':
      return 'Park';
    case 'park_until_next':
    case 'until_next':
      return 'ParkUntilNextSchedule';
    case 'park_until_further':
    case 'until_further':
      return 'ParkUntilFurtherNotice';
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}

/**
 * Update mower state in Firebase based on command
 * This provides instant UI feedback even before WebSocket events arrive
 */
async function updateMowerStateForCommand(mowerId: string, command: string): Promise<void> {
  try {
    // Determine the anticipated new state and activity based on the command
    let state = 'IN_OPERATION';
    let activity = 'NOT_APPLICABLE';
    let mode = 'MAIN_AREA';
    
    switch (command.toLowerCase()) {
      case 'start':
      case 'play':
      case 'mow':
      case 'start_area':
      case 'start_in_area':
      case 'mow_area':
        state = 'IN_OPERATION';
        activity = 'MOWING';
        break;
      case 'pause':
        state = 'PAUSED';
        activity = 'STOPPED_IN_GARDEN';
        break;
      case 'park':
      case 'home':
      case 'park_until_next':
      case 'until_next':
      case 'park_until_further':
      case 'until_further':
        state = 'IN_OPERATION';
        activity = 'GOING_HOME';
        break;
      case 'resume':
      case 'resume_schedule':
        state = 'IN_OPERATION';
        activity = 'MOWING'; // Assume it will start mowing
        break;
    }
    
    // Update Firestore document immediately to reflect anticipated state
    await mowerDataService.updateMowerData(mowerId, {
      mower: {
        state,
        activity,
        mode
      },
      lastCommandSent: {
        command,
        timestamp: new Date().toISOString(),
        anticipated: {
          state,
          activity,
          mode
        }
      }
    });
    
    console.log(`🔄 Updated mower state in Firebase for command ${command}:`, {
      state, activity, mode
    });
    
    // Dispatch an event so UI can update immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mower-command-sent', {
        detail: {
          mowerId,
          command,
          anticipated: {
            state,
            activity,
            mode
          }
        }
      }));
    }
  } catch (error) {
    console.error('Error updating mower state for command:', error);
    // Non-blocking - the WebSocket will eventually update the state correctly
  }
} 