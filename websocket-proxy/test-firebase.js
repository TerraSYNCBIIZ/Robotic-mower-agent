// Simple test script to verify Firebase Admin SDK initialization
const admin = require('./firebase-admin.js');

if (admin) {
  console.log('Firebase Admin SDK initialized successfully');
  
  // Test writing to Firestore
  const db = admin.firestore();
  db.collection('system').doc('test').set({
    test: true,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    console.log('Successfully wrote to Firestore!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error writing to Firestore:', error);
    process.exit(1);
  });
} else {
  console.error('Firebase Admin SDK failed to initialize');
  process.exit(1);
} 