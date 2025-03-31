import { HusqvarnaClient } from './api';
import { getAuthToken } from '@/lib/auth';

// Create a singleton instance of the HusqvarnaClient
// This ensures we use the same client (and token) throughout the application
const husqvarnaApi = new HusqvarnaClient();

// Add debugging info
console.log('🔑 Husqvarna API client initialized, checking authentication status...');
setTimeout(() => {
  console.log(`🔑 Husqvarna API authentication status: ${husqvarnaApi.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}`);
}, 2000); // Small delay to allow potential token loading

// Function to initialize the API with the stored token
export function initializeApi() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('mowerAccessToken');
    if (token) {
      console.log('🔑 Initializing Husqvarna API with stored token');
      husqvarnaApi.setAccessToken(token);
      console.log(`🔑 Husqvarna API authentication status after initialization: ${husqvarnaApi.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}`);
    }
  }
}

// Try to initialize on module load in browser
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'complete') {
    initializeApi();
  } else {
    window.addEventListener('DOMContentLoaded', initializeApi);
  }
}

export { husqvarnaApi }; 