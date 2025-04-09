'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

interface FirebaseContextType {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  functions: Functions | null;
  analytics: Analytics | null;
}

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  db: null,
  auth: null,
  functions: null,
  analytics: null
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  // Initialize Firebase
  let app: FirebaseApp | null = null;
  let db: Firestore | null = null;
  let auth: Auth | null = null;
  let functions: Functions | null = null;
  let analytics: Analytics | null = null;

  if (typeof window !== 'undefined') {
    try {
      // Only initialize Firebase if it hasn't been initialized yet
      if (!getApps().length) {
        console.log('Initializing Firebase');
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      // Initialize Firebase services
      // @ts-ignore - Firebase services typing
      db = getFirestore(app);
      // @ts-ignore - Firebase services typing
      auth = getAuth(app);
      // @ts-ignore - Firebase services typing
      functions = getFunctions(app);
      
      // Only initialize Analytics on client-side
      if (typeof window !== 'undefined') {
        // @ts-ignore - Firebase services typing
        analytics = getAnalytics(app);
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }

  return (
    <FirebaseContext.Provider value={{ app, db, auth, functions, analytics }}>
      {children}
    </FirebaseContext.Provider>
  );
}; 