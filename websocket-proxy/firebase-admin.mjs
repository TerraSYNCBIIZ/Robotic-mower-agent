// Firebase Admin SDK initialization - ESM version
import admin from 'firebase-admin';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Logging helpers
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);
const logError = (message) => console.error(`[${new Date().toISOString()}] [ERROR] ${message}`);

// Initialize Firebase with progressive fallbacks
function initializeFirebase() {
  try {
    // Try to load from service account file first
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
      resolve(__dirname, '../robotic-mower-agent-firebase-adminsdk-fbsvc-7b5370108d.json');
    
    log(`Looking for service account file at: ${serviceAccountPath}`);
    
    if (fs.existsSync(serviceAccountPath)) {
      // File exists, load it as JSON
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      // Initialize Firebase Admin with the service account
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      
      log('Firebase Admin initialized successfully with service account file');
      return admin;
    } else {
      // File not found, try environment variables
      log('Service account file not found, trying environment variables');
      
      if (process.env.FIREBASE_PROJECT_ID && 
          process.env.FIREBASE_CLIENT_EMAIL && 
          process.env.FIREBASE_PRIVATE_KEY) {
        
        // Initialize with environment variables
        if (admin.apps.length === 0) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
          });
        }
        
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

// Initialize and export
const firebaseAdmin = initializeFirebase();
export default firebaseAdmin; 