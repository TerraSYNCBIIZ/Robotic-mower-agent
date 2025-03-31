/**
 * Utility functions for authentication
 */

import { getAuthToken } from '@/lib/auth';

/**
 * Validates a token by checking if it matches the current auth token
 * @param token The token to validate
 * @returns True if the token is valid, false otherwise
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    // Get the current auth token for comparison
    const currentToken = await getAuthToken();
    
    // If we don't have a current token, we can't validate
    if (!currentToken) {
      return false;
    }
    
    // Compare the tokens
    return token === currentToken;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
} 