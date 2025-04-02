// Polling service for Husqvarna API
// This service fetches mower data via REST API and updates Firebase
import axios from 'axios';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { randomUUID } from 'crypto';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from parent directory's .env.local file
config({ path: join(__dirname, '..', '.env.local') });

// Configuration
const POLLING_INTERVAL = 60000; // Poll every minute
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes in ms (tokens last 60 min)
const HUSQVARNA_API_BASE = 'https://api.amc.husqvarna.dev/v1';
const PROXY_URL = process.env.URL || 'http://localhost:3000';
const MOWERS_COLLECTION = 'mowers';

// Known mower IDs from logs
const KNOWN_MOWER_IDS = [
  'f4c7e370-73eb-42ad-8c8c-3cd47292ed51',
  '32776424-f5f5-408a-bb7b-38e90ae99bc9',
  'c69ca5ca-ed61-418c-8a3b-8fa23fd17e6b',
  '8cf95a07-6ae2-4722-a337-7c6491070d5a'
];

// Firebase integration
let db = null;
let token = null;
let tokenExpiry = 0;

// Initialize Firebase
function initializeFirebase() {
  try {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    
    if (!firebaseConfig.apiKey) {
      console.warn('❌ Firebase configuration missing, data will not be stored persistently');
      return null;
    }
    
    // Initialize Firebase app
    const app = initializeApp(firebaseConfig);
    
    // Initialize Firestore
    db = getFirestore(app);
    console.log('✅ Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    return null;
  }
}

/**
 * Get a fresh OAuth token using client credentials
 */
async function getAccessToken() {
  try {
    const appKey = process.env.HUSQVARNA_APP_KEY;
    const appSecret = process.env.HUSQVARNA_CLIENT_SECRET;
    
    if (!appKey || !appSecret) {
      throw new Error('Missing API credentials in environment variables');
    }
    
    console.log('🔑 Getting fresh OAuth token from Husqvarna API...');
    
    const response = await axios({
      method: 'POST',
      url: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      data: `grant_type=client_credentials&client_id=${appKey}&client_secret=${appSecret}`
    });
    
    if (response.status === 200 && response.data && response.data.access_token) {
      console.log('✅ Successfully obtained new OAuth token');
      token = response.data.access_token;
      // Set token expiry to 45 minutes from now (tokens last 60 minutes)
      tokenExpiry = Date.now() + TOKEN_REFRESH_INTERVAL;
      return token;
    } else {
      throw new Error('Invalid response from Husqvarna authentication API');
    }
  } catch (error) {
    console.error('❌ Error getting OAuth token:', error.message);
    throw error;
  }
}

/**
 * Ensure we have a valid token
 */
async function ensureValidToken() {
  if (!token || Date.now() >= tokenExpiry) {
    return await getAccessToken();
  }
  return token;
}

/**
 * Get work areas data for a mower using the Next.js proxy
 */
async function getMowerWorkAreas(mowerId) {
  try {
    const currentToken = await ensureValidToken();
    
    console.log(`🔍 Getting work areas for mower ${mowerId} via proxy...`);
    
    // Use the Next.js proxy endpoint instead of direct API access
    const response = await axios({
      method: 'GET',
      url: `${PROXY_URL}/api/proxy/mowers/${mowerId}/workAreas`,
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'X-Api-Key': process.env.HUSQVARNA_APP_KEY
      }
    });
    
    if (response.status === 200 && response.data && response.data.data) {
      console.log(`✅ Successfully got work areas for mower ${mowerId}`);
      return response.data.data;
    } else {
      throw new Error(`Invalid response for mower ${mowerId}`);
    }
  } catch (error) {
    console.error(`❌ Error getting work areas for mower ${mowerId}:`, error.message);
    return null;
  }
}

/**
 * Get mower status using a different endpoint
 */
async function getMowerStatus(mowerId) {
  try {
    // We're not able to access the main mower endpoint directly,
    // but we know the mowers exist based on the workAreas response.
    // Let's create a minimal status object with the data we have.
    return {
      id: mowerId,
      lastChecked: new Date().toISOString(),
      // Add other derived properties as needed
    };
  } catch (error) {
    console.error(`❌ Error getting status for mower ${mowerId}:`, error.message);
    return null;
  }
}

/**
 * Update Firebase with mower data from work areas
 */
async function updateMowerWorkAreasInFirebase(mowerId, workAreas) {
  if (!db || !workAreas) return;
  
  try {
    console.log(`🔥 Updating Firebase for mower ${mowerId}...`);
    
    const mowerRef = doc(db, MOWERS_COLLECTION, mowerId);
    
    // Create update with work areas data
    const update = {
      lastUpdated: serverTimestamp(),
      workAreas: workAreas,
      status: {
        lastChecked: serverTimestamp()
      }
    };
    
    // Update Firestore
    await setDoc(mowerRef, update, { merge: true });
    
    // Add history record
    const historyData = {
      timestamp: serverTimestamp(),
      type: 'workAreas',
      data: workAreas
    };
    
    // Add to history collection
    await setDoc(
      doc(collection(db, MOWERS_COLLECTION, mowerId, 'history'), randomUUID()),
      historyData
    );
    
    console.log(`📜 Added work areas history record for mower ${mowerId}`);
    console.log(`✅ Successfully updated Firebase for mower ${mowerId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating Firebase for mower ${mowerId}:`, error);
    return false;
  }
}

/**
 * Poll for all known mowers and update Firebase with what we can access
 */
async function pollMowers() {
  console.log('🔄 Starting mower polling...');
  
  let successCount = 0;
  
  for (const mowerId of KNOWN_MOWER_IDS) {
    try {
      // Get work areas via the Next.js proxy
      const workAreasData = await getMowerWorkAreas(mowerId);
      
      if (workAreasData && workAreasData.length > 0) {
        // This endpoint works, so update Firebase with this data
        await updateMowerWorkAreasInFirebase(mowerId, workAreasData);
        successCount++;
      } else {
        console.log(`⚠️ No work areas data available for mower ${mowerId}`);
      }
    } catch (error) {
      console.error(`❌ Error processing mower ${mowerId}:`, error);
    }
  }
  
  console.log(`✅ Polling cycle completed with ${successCount} successful updates`);
}

// Main function
async function start() {
  console.log('🚀 Starting Husqvarna API polling service...');
  console.log(`Using proxy URL: ${PROXY_URL}`);
  
  // Initialize Firebase
  initializeFirebase();
  
  // Get initial token
  await getAccessToken();
  
  // Make sure the Next.js server is running
  try {
    await axios.get(`${PROXY_URL}/api/health`);
    console.log('✅ Next.js server is available');
  } catch (error) {
    console.warn('⚠️ Next.js server may not be running. Proxy requests might fail.');
    console.warn('   Make sure to start the Next.js app with: run-nextjs-app.bat');
  }
  
  // Run initial poll
  await pollMowers();
  
  // Set up polling interval
  setInterval(pollMowers, POLLING_INTERVAL);
  
  console.log(`⏱️ Polling service running, will poll every ${POLLING_INTERVAL / 1000} seconds`);
}

// Start the service
start().catch(error => {
  console.error('❌ Error starting polling service:', error);
}); 