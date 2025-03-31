// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAq3lL6rcXVyp152uO5TMb4L3oMsPU11oU",
  authDomain: "robotic-mower-agent.firebaseapp.com",
  projectId: "robotic-mower-agent",
  storageBucket: "robotic-mower-agent.appspot.com",
  messagingSenderId: "457311456480",
  appId: "1:457311456480:web:d71b1ca004a50009fbd485",
  measurementId: "G-642084TXE8"
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let analytics: Analytics | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

// Only initialize on client side, not during SSR
if (typeof window !== 'undefined' && !getApps().length) {
  try {
    console.log("Initializing Firebase");
    app = initializeApp(firebaseConfig);
    
    try {
      analytics = getAnalytics(app);
      console.log("Firebase Analytics initialized successfully");
    } catch (analyticsError) {
      console.warn("Firebase Analytics initialization error:", analyticsError);
      // Continue even if analytics fails
    }
    
    try {
      db = getFirestore(app);
      console.log("Firestore initialized successfully");
    } catch (firestoreError) {
      console.error("Firestore initialization error:", firestoreError);
    }
    
    try {
      auth = getAuth(app);
      console.log("Firebase Auth initialized successfully");
    } catch (authError) {
      console.error("Firebase Auth initialization error:", authError);
    }
    
    console.log("Firebase initialization completed");
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
}

export { app, analytics, db, auth }; 