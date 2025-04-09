/**
 * Husqvarna Authentication Utilities
 * Functions to handle authentication with the Husqvarna API
 */

/**
 * Gets an access token from Husqvarna API using client credentials flow
 * @param apiKey Husqvarna API key
 * @param secret Husqvarna client secret
 * @returns Access token
 */
export async function getHusqvarnaToken(apiKey: string, secret: string): Promise<string> {
  const authUrl = 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token';
  
  try {
    console.log('Getting Husqvarna access token...');
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: secret,
        scope: 'iam:read amc:api'
      }).toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get token: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }
    
    console.log('Successfully obtained Husqvarna access token');
    return data.access_token;
  } catch (error) {
    console.error('Error getting Husqvarna token:', error);
    throw error;
  }
}

/**
 * Checks if a token is valid by making a test API call
 * @param token Access token to validate
 * @param apiKey Husqvarna API key
 * @returns Whether the token is valid
 */
export async function isTokenValid(token: string, apiKey: string): Promise<boolean> {
  const testUrl = 'https://api.amc.husqvarna.dev/v1/mowers';
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Authorization-Provider': 'husqvarna',
        'X-Api-Key': apiKey,
        'Accept': 'application/vnd.api+json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
} 