import { HusqvarnaClient } from './api';
import { getAuthToken } from '@/lib/auth';

// Create a singleton instance of the HusqvarnaClient
// This ensures we use the same client (and token) throughout the application
const husqvarnaApi = new HusqvarnaClient();

// Add debugging info
console.log('🔑 Husqvarna API client initialized, checking authentication status...');

// Function to initialize the API with the stored token
export function initializeApi() {
  if (typeof window !== 'undefined') {
    // Try to get the token from multiple sources
    const localStorageToken = localStorage.getItem('mowerAccessToken');
    const cookieToken = document.cookie.split('; ').find(row => row.startsWith('mowerAccessToken='))?.split('=')[1];
    
    const token = localStorageToken || cookieToken;
    
    if (token) {
      console.log('🔑 Initializing Husqvarna API with token from storage');
      husqvarnaApi.setAccessToken(token);
      console.log(`🔑 Husqvarna API authentication status after initialization: ${husqvarnaApi.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}`);
      
      // If the API client is not authenticated, try once more with the token
      if (!husqvarnaApi.isAuthenticated()) {
        console.log('🔑 First authentication attempt failed, trying again...');
        setTimeout(() => {
          husqvarnaApi.setAccessToken(token);
          console.log(`🔑 Husqvarna API re-initialization result: ${husqvarnaApi.isAuthenticated() ? 'Success' : 'Failed'}`);
        }, 100);
      }
      
      return true;
    } else {
      console.log('🔑 No token found in storage during initialization');
      return false;
    }
  }
  return false;
}

// Try to initialize on module load in browser
if (typeof window !== 'undefined') {
  // Initialize immediately but also wait for DOM to be fully ready
  initializeApi();
  
  // Also initialize on DOM ready to ensure we catch tokens set during page load
  if (document.readyState === 'complete') {
    initializeApi();
  } else {
    window.addEventListener('DOMContentLoaded', initializeApi);
  }
  
  // Also check authentication status a bit later 
  setTimeout(() => {
    console.log(`🔑 Delayed API authentication check: ${husqvarnaApi.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}`);
    if (!husqvarnaApi.isAuthenticated()) {
      console.log('🔑 Not authenticated in delayed check, trying to re-initialize');
      initializeApi();
    }
  }, 2000);
}

/**
 * Get calendar/schedule data for a mower
 * @param mowerId ID of the mower
 * @param model Optional model name for optimized fetching
 * @param workAreaId Optional work area ID for EPOS models
 * @returns Promise with calendar data
 */
export async function getMowerCalendar(mowerId: string, model?: string, workAreaId?: number) {
  try {
    // Make sure API is initialized before calling
    if (!husqvarnaApi.isAuthenticated()) {
      console.log('🔑 API not authenticated before calendar call, attempting to initialize');
      initializeApi();
    }
    
    console.log(`Fetching calendar data for mower ${mowerId} through the API client`);
    // Use the specialized calendar method from the client
    return await husqvarnaApi.getMowerCalendar(mowerId, model, workAreaId);
  } catch (error) {
    console.error(`Failed to fetch calendar data for mower ${mowerId}:`, error);
    return { tasks: [] };
  }
}

/**
 * Get calendar data for a specific work area
 * @param mowerId ID of the mower
 * @param workAreaId ID of the work area
 * @returns Promise with calendar data for the specific work area
 */
export async function getMowerWorkAreaCalendar(mowerId: string, workAreaId: number) {
  try {
    // Make sure API is initialized before calling
    if (!husqvarnaApi.isAuthenticated()) {
      console.log('🔑 API not authenticated before work area calendar call, attempting to initialize');
      initializeApi();
    }
    
    console.log(`Fetching calendar data for work area ${workAreaId} of mower ${mowerId}`);
    // Use the specialized method from the client
    return await husqvarnaApi.getMowerWorkAreaCalendar(mowerId, workAreaId);
  } catch (error) {
    console.error(`Failed to fetch calendar data for work area ${workAreaId}:`, error);
    return { workAreaId, workAreaName: `Area ${workAreaId}`, tasks: [] };
  }
}

// Add a re-initialization method that can be called after login
export function refreshApiAuthentication() {
  console.log('🔄 Explicitly refreshing API authentication');
  return initializeApi();
}

export { husqvarnaApi }; 