/**
 * Google Maps API Loader
 * Implements a singleton pattern to ensure Google Maps script is loaded only once
 */

// Module constants
// Store a global promise reference to track loading status
let loadingPromise: Promise<void> | null = null;

/**
 * Loads the Google Maps API script with proper async pattern
 * Ensures the script is loaded only once per page session
 */
export function loadGoogleMapsApi(): Promise<void> {
  // Return existing promise if already loading
  if (loadingPromise) {
    console.log("Google Maps API already loading, reusing existing promise");
    return loadingPromise;
  }

  // Check if already loaded in window
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    console.log("Google Maps API already loaded, skipping loader");
    return Promise.resolve();
  }

  console.log("Starting new Google Maps API load sequence");
  
  // Create new loading promise
  loadingPromise = new Promise<void>((resolve, reject) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        const error = new Error("Google Maps API key not found in environment variables");
        console.error(error);
        loadingPromise = null;
        reject(error);
        return;
      }

      // Check if there's already a script with this API key in the document
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"][src*="${apiKey}"]`);
      if (existingScript) {
        console.log("Found existing Google Maps script tag, waiting for it to load");
        
        // If the script exists but Google Maps isn't available yet, we need to wait
        const checkGoogleMaps = () => {
          if (window.google?.maps) {
            console.log("Google Maps API loaded from existing script");
            resolve();
          } else {
            setTimeout(checkGoogleMaps, 100);
          }
        };
        
        setTimeout(checkGoogleMaps, 100);
        return;
      }

      // Create a unique callback name
      const callbackName = `googleMapsCallback_${Date.now()}`;
      
      // Add the callback to window scope
      window[callbackName] = () => {
        console.log("Google Maps initialized successfully");
        delete window[callbackName];
        resolve();
      };

      // Create script tag and set attributes according to Google's best practices
      const script = document.createElement('script');
      
      // The proper way to async load Google Maps is with the callback parameter
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing&callback=${callbackName}`;
      script.async = true; // This is important for proper async loading
      script.defer = true; 
      script.id = 'google-maps-script';
      
      // Handle script load error
      script.onerror = () => {
        console.error("Failed to load Google Maps script");
        delete window[callbackName];
        loadingPromise = null;
        reject(new Error("Failed to load Google Maps script"));
      };
      
      // Append the script to head
      document.head.appendChild(script);
      console.log("Google Maps script added to document");
    } catch (err) {
      console.error("Error setting up Google Maps script:", err);
      loadingPromise = null;
      reject(err);
    }
  });

  return loadingPromise;
}

// Extend Window interface to allow callback
declare global {
  interface Window {
    [key: string]: unknown;
  }
} 