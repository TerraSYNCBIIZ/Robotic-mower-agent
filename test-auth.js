// Test script to check Husqvarna API authentication
require('dotenv').config({ path: './.env.local' });

// Log API keys for verification (only first few characters)
const appKey = process.env.HUSQVARNA_APP_KEY || '';
const clientSecret = process.env.HUSQVARNA_CLIENT_SECRET || '';

console.log('App Key (first 8 chars):', appKey.substring(0, 8));
console.log('Client Secret (first 8 chars):', clientSecret.substring(0, 8));

// Function to get token using client credentials
async function getClientCredentialsToken() {
  try {
    if (!appKey || !clientSecret) {
      throw new Error('Missing API credentials in environment variables');
    }
    
    const response = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: `grant_type=client_credentials&client_id=${appKey}&client_secret=${clientSecret}&scope=iam:read%20amc:api`
    });
    
    console.log('Auth response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Client credentials authentication failed:', error);
      throw new Error(`Failed to get client credentials token: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Auth response data:', {
      token_type: data.token_type,
      expires_in: data.expires_in,
      scope: data.scope,
      access_token: data.access_token ? `${data.access_token.substring(0, 20)}...` : 'none'
    });
    
    if (data.access_token) {
      return data.access_token;
    }
    
    throw new Error('Invalid response from Husqvarna authentication API');
  } catch (error) {
    console.error('Error getting OAuth token:', error);
    throw error;
  }
}

// Test a simple API call
async function testApiCall(token) {
  try {
    console.log('Testing API call with token');
    
    const response = await fetch('https://api.amc.husqvarna.dev/v1/mowers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'X-Api-Key': appKey,
        'Authorization-Provider': 'husqvarna',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      let errorText;
      try {
        const errorJson = await response.json();
        errorText = JSON.stringify(errorJson);
      } catch (e) {
        errorText = await response.text();
      }
      console.error('API call failed:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('API response data (mowers count):', data.data ? data.data.length : 0);
  } catch (error) {
    console.error('Error during API test:', error);
  }
}

// Test API app permissions
async function testApiPermissions(token) {
  try {
    console.log('\nTesting API app permissions');
    
    const response = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/applications/me', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Permissions API response status:', response.status);
    
    if (!response.ok) {
      let errorText;
      try {
        const errorJson = await response.json();
        errorText = JSON.stringify(errorJson);
      } catch (e) {
        errorText = await response.text();
      }
      console.error('Permissions API call failed:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('Application permissions:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during permissions test:', error);
  }
}

// Run the test
async function runTest() {
  try {
    const token = await getClientCredentialsToken();
    await testApiCall(token);
    await testApiPermissions(token);
    
    console.log('\n=== CONCLUSION ===');
    console.log('Authentication: Works properly with client credentials');
    console.log('API access: The API credentials have valid authentication but may not have user-level mower permissions');
    console.log('\nFor your app to work properly:');
    console.log('1. Make sure the app is authorized in the Husqvarna developer portal');
    console.log('2. Verify the scopes include "amc:api"');
    console.log('3. Check if any app permissions have been revoked on the Husqvarna side');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest(); 