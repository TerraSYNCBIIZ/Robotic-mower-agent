/**
 * Utility functions for working with location data for weather
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Gets the location from a collection of mowers
 * Prioritizes active mowers (mowing/returning) and falls back to an average location
 * Returns data in format compatible with WeatherWidget component
 */
export function getLocationFromMowers(mowers: any[]): { 
  city?: string;
  latitude?: number;
  longitude?: number;
  isFromMowerLocation?: boolean;
} {
  if (!mowers || mowers.length === 0) {
    return { city: "New York" }; // Default fallback
  }
  
  // First try to find any mower with valid coordinates
  const mowersWithCoords = mowers.filter(m => 
    m.coordinates?.latitude !== undefined && m.coordinates?.longitude !== undefined
  );
  
  // If no mowers have coordinates, fall back to default city
  if (mowersWithCoords.length === 0) {
    return { city: "New York" };
  }
  
  // Prioritize active mowers (mowing or returning)
  const activeMower = mowersWithCoords.find(m => 
    m.status === 'mowing' || m.status === 'returning'
  );
  
  if (activeMower?.coordinates) {
    return {
      latitude: activeMower.coordinates.latitude,
      longitude: activeMower.coordinates.longitude,
      isFromMowerLocation: true
    };
  }
  
  // Fall back to average location of all mowers with coordinates
  const totalLat = mowersWithCoords.reduce((sum, m) => sum + (m.coordinates?.latitude || 0), 0);
  const totalLng = mowersWithCoords.reduce((sum, m) => sum + (m.coordinates?.longitude || 0), 0);
  
  return {
    latitude: totalLat / mowersWithCoords.length,
    longitude: totalLng / mowersWithCoords.length,
    isFromMowerLocation: true
  };
}

/**
 * Gets a location name from coordinates using reverse geocoding
 * Uses OpenStreetMap's Nominatim service to convert coordinates to a readable place name
 */
export async function getLocationNameFromCoordinates(
  latitude: number, 
  longitude: number
): Promise<string> {
  try {
    // Use OpenStreetMap Nominatim for reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
      {
        headers: {
          'Accept-Language': 'en', // Ensure results are in English
          'User-Agent': 'RoboticMowerDashboard/1.0' // Identify your app to comply with usage policy
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the most appropriate location name
    // Try city first, then town, then village, then county - in that order of preference
    const locationName = data.address?.city || 
                         data.address?.town || 
                         data.address?.village || 
                         data.address?.county ||
                         "Unknown Location";
    
    return locationName;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return "Unknown Location";
  }
}

/**
 * Creates a cache key for storing geocoded results
 */
export function createGeocodeCacheKey(latitude: number, longitude: number): string {
  // Round to 3 decimal places (approx. 100 meters precision) to avoid too many cache entries
  // while still providing accuracy appropriate for weather data
  const roundedLat = Math.round(latitude * 1000) / 1000;
  const roundedLng = Math.round(longitude * 1000) / 1000;
  return `geocode_${roundedLat}_${roundedLng}`;
}

/**
 * Wrapper function that implements caching for reverse geocoding
 * to reduce API calls and improve performance
 */
export async function getCachedLocationName(
  latitude: number, 
  longitude: number
): Promise<string> {
  // Create a cache key for this location
  const cacheKey = createGeocodeCacheKey(latitude, longitude);
  
  // Check if we have a cached result (if running in browser)
  if (typeof window !== 'undefined') {
    const cachedResult = localStorage.getItem(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }
  
  // If no cached result, perform the geocoding
  const locationName = await getLocationNameFromCoordinates(latitude, longitude);
  
  // Cache the result (if running in browser)
  if (typeof window !== 'undefined') {
    localStorage.setItem(cacheKey, locationName);
    // Set an expiration for the cache (7 days)
    const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`${cacheKey}_exp`, expiration.toString());
  }
  
  return locationName;
} 