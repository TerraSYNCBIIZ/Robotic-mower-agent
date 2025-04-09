// Simple test script to verify Firebase Admin SDK initialization - ESM version
import firebaseAdmin from './firebase-admin.mjs';

if (firebaseAdmin) {
  console.log('Firebase Admin SDK initialized successfully');
  
  // Test writing to Firestore
  const db = firebaseAdmin.firestore();
  
  try {
    await db.collection('system').doc('test').set({
      test: true,
      timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Successfully wrote to Firestore!');
    process.exit(0);
  } catch (error) {
    console.error('Error writing to Firestore:', error);
    process.exit(1);
  }
} else {
  console.error('Firebase Admin SDK failed to initialize');
  process.exit(1);
} 