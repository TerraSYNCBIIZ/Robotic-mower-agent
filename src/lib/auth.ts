/**
 * Authentication utilities for the application
 */

// Token storage key - ensure consistent naming throughout the app
const AUTH_TOKEN_KEY = 'mowerAccessToken';

/**
 * Get the authentication token from localStorage
 * @returns The authentication token or null if not found/not on client
 */
export function getAuthToken(): string | null {
  // Only access localStorage on the client
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Get the token from localStorage
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
}

/**
 * Save the authentication token to localStorage
 * @param token The token to save
 */
export function saveAuthToken(token: string): void {
  // Only access localStorage on the client
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
}

/**
 * Remove the authentication token from localStorage
 */
export function removeAuthToken(): void {
  // Only access localStorage on the client
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
}

/**
 * Check if the user is authenticated (has a token)
 * @returns True if the user has a token, false otherwise
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Check if token is expired
 * @returns True if token is expired or missing
 */
export function isTokenExpired(): boolean {
  try {
    const token = getAuthToken();
    if (!token) return true;
    
    // For JWT tokens, we could decode and check expiration
    // This is a simplified version that just checks if token exists
    return false;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
} 