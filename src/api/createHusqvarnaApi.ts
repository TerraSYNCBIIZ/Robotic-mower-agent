import { HusqvarnaApi } from './husqvarnaApi';

/**
 * Creates a new Husqvarna API client
 * 
 * @param token Access token for authentication
 * @param apiKey API key from Husqvarna Developer Portal
 * @returns A configured Husqvarna API client
 */
export function createHusqvarnaApi(token: string, apiKey: string): HusqvarnaApi {
  return new HusqvarnaApi({ token, apiKey });
}

/**
 * Singleton API instance for server-side use
 */
let apiInstance: HusqvarnaApi | null = null;

/**
 * Gets a singleton API instance using environment variables
 * 
 * @returns Husqvarna API client singleton
 */
export function getApiInstance(): HusqvarnaApi {
  if (!apiInstance) {
    const token = process.env.HUSQVARNA_TOKEN || '';
    const apiKey = process.env.HUSQVARNA_API_KEY || '';
    
    if (!token || !apiKey) {
      throw new Error('Missing HUSQVARNA_TOKEN or HUSQVARNA_API_KEY environment variables');
    }
    
    apiInstance = createHusqvarnaApi(token, apiKey);
  }
  
  return apiInstance;
} 