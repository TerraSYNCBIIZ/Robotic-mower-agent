// Firebase Admin SDK initialization
// This file uses CommonJS syntax for best compatibility with Firebase Admin SDK

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Logging helpers
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);
const logError = (message) => console.error(`[${new Date().toISOString()}] [ERROR] ${message}`);

// Initialize Firebase with progressive fallbacks
function initializeFirebase() {
  try {
    // Try to load from service account file first
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
      path.resolve(__dirname, '../robotic-mower-agent-firebase-adminsdk-fbsvc-7b5370108d.json');
    
    log(`Looking for service account file at: ${serviceAccountPath}`);
    
    if (fs.existsSync(serviceAccountPath)) {
      // File exists, load it using require() for JSON parsing
      const serviceAccount = require(serviceAccountPath);
      
      // Initialize Firebase Admin with the service account
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      log('Firebase Admin initialized successfully with service account file');
      return admin;
    } else {
      // File not found, try environment variables
      log('Service account file not found, trying environment variables');
      
      if (process.env.FIREBASE_PROJECT_ID && 
          process.env.FIREBASE_CLIENT_EMAIL && 
          process.env.FIREBASE_PRIVATE_KEY) {
        
        // Initialize with environment variables
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        
        log('Firebase Admin initialized successfully with environment variables');
        return admin;
      } else {
        throw new Error('No Firebase credentials found in service account file or environment variables');
      }
    }
  } catch (error) {
    logError(`Failed to initialize Firebase Admin: ${error.message}`);
    if (error.stack) {
      logError(error.stack);
    }
    return null;
  }
}

// Export the initialized Admin SDK
module.exports = initializeFirebase(); 