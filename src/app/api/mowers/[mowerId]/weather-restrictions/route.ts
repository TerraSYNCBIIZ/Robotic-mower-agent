import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { HusqvarnaClient } from '@/lib/husqvarna/api';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

interface WeatherRestriction {
  rainIntensity: 'light' | 'moderate' | 'heavy' | 'all';
  temperatureBelow: number | null;
  temperatureAbove: number | null;
  windSpeed: number | null;
}

// Firebase config for server-side initialization if needed
const firebaseConfig = {
  apiKey: "AIzaSyAq3lL6rcXVyp152uO5TMb4L3oMsPU11oU",
  authDomain: "robotic-mower-agent.firebaseapp.com",
  projectId: "robotic-mower-agent",
  storageBucket: "robotic-mower-agent.firebasestorage.app",
  messagingSenderId: "457311456480",
  appId: "1:457311456480:web:d71b1ca004a50009fbd485",
  measurementId: "G-642084TXE8"
};

// Make sure we have a Firestore instance even on the server
const getFirestoreDb = () => {
  if (db) return db;
  
  // Initialize Firebase on server
  const app = initializeApp(firebaseConfig);
  return getFirestore(app);
};

// GET endpoint to retrieve weather restrictions for a specific mower
export async function GET(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    // Check for authentication header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', authRequired: true },
        { status: 401 }
      );
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required', authRequired: true },
        { status: 401 }
      );
    }

    // Create Husqvarna client to verify token
    const client = new HusqvarnaClient(token);
    if (!client.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Invalid authentication token', authRequired: true },
        { status: 401 }
      );
    }

    try {
      // Use Firestore to get the weather restrictions
      const firestore = getFirestoreDb();
      
      // Reference to the mower's document in Firestore
      const docRef = doc(firestore, 'mowerWeatherRestrictions', params.mowerId);
      
      // Get the document
      const docSnap = await getDoc(docRef);
  
      if (docSnap.exists()) {
        return NextResponse.json(docSnap.data());
      } 
      
      // Return default values if no restrictions are set
      const defaultRestrictions: WeatherRestriction = {
        rainIntensity: 'moderate',
        temperatureBelow: 5,
        temperatureAbove: 30,
        windSpeed: 20
      };
      return NextResponse.json(defaultRestrictions);
    } catch (firestoreError) {
      console.error('Firestore operation error:', firestoreError);
      return NextResponse.json(
        { error: 'Failed to access Firestore database', details: String(firestoreError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching weather restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather restrictions', details: String(error) },
      { status: 500 }
    );
  }
}

// POST endpoint to save weather restrictions for a specific mower
export async function POST(
  request: NextRequest,
  { params }: { params: { mowerId: string } }
) {
  try {
    // Check for authentication header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', authRequired: true },
        { status: 401 }
      );
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required', authRequired: true },
        { status: 401 }
      );
    }

    // Create Husqvarna client to verify token
    const client = new HusqvarnaClient(token);
    if (!client.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Invalid authentication token', authRequired: true },
        { status: 401 }
      );
    }
    
    // Get the weather restrictions data from the request body
    const weatherData: WeatherRestriction = await request.json();
    
    // Basic validation
    if (!weatherData || typeof weatherData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid weather restriction data' },
        { status: 400 }
      );
    }

    try {
      // Use Firestore to save the weather restrictions
      const firestore = getFirestoreDb();
      
      // Reference to the mower's document in Firestore
      const docRef = doc(firestore, 'mowerWeatherRestrictions', params.mowerId);
      
      // Save to Firestore
      await setDoc(docRef, weatherData, { merge: true });
  
      return NextResponse.json({
        success: true,
        message: 'Weather restrictions saved successfully'
      });
    } catch (firestoreError) {
      console.error('Firestore operation error:', firestoreError);
      return NextResponse.json(
        { error: 'Failed to save to Firestore database', details: String(firestoreError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error saving weather restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to save weather restrictions', details: String(error) },
      { status: 500 }
    );
  }
} 