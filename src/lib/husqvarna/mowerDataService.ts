import axios from 'axios';
import { db } from '@/lib/firebase/config';
import { 
  Timestamp, 
  doc, 
  setDoc, 
  collection, 
  writeBatch 
} from 'firebase/firestore';

// Create an API instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api'
});

export class MowerDataService {
  // Existing methods...

  /**
   * Fetch all mowers from the API and store them in Firebase
   * This should be called on login to refresh the initial data
   */
  async fetchAndStoreMowersToFirebase() {
    try {
      // Get mowers from API
      const response = await api.get('mowers');
      const mowers = response.data.data;
      
      // Store each mower in Firebase
      const batch = writeBatch(db);
      
      mowers.forEach((mower: any) => {
        const mowerId = mower.id;
        const mowerRef = doc(collection(db, 'mowers'), mowerId);
        
        // Store system data
        const systemData = mower.attributes?.system || {};
        const metaData = mower.attributes?.metadata || {};
        
        // Extract battery data if available
        const batteryData = mower.attributes?.battery || {};
        
        // Extract mower state data if available
        const mowerData = mower.attributes?.mower || {};
        
        // Create consolidated view for easier access
        const consolidated = {
          name: systemData.name || 'Unknown',
          model: systemData.model || 'Unknown',
          serialNumber: systemData.serialNumber,
          batteryPercent: batteryData.batteryPercent || 0,
          activity: mowerData.activity,
          state: mowerData.state,
          mode: mowerData.mode,
          errorCode: mowerData.errorCode,
          isConnected: metaData.connected !== false,
          lastRefreshedFromApi: new Date().toISOString()
        };
        
        // Set the data in Firebase with merge to preserve any existing fields
        batch.set(mowerRef, {
          mowerData: {
            attributes: {
              system: systemData,
              battery: batteryData,
              mower: mowerData,
              metadata: metaData
            }
          },
          consolidated,
          lastUpdated: Timestamp.now(),
          lastApiSync: Timestamp.now()
        }, { merge: true });
      });
      
      await batch.commit();
      console.log(`Saved ${mowers.length} mowers to Firebase`);
      
      return mowers;
    } catch (error) {
      console.error('Error fetching and storing mowers:', error);
      throw error;
    }
  }

  /**
   * Update a specific mower in Firebase with the latest API data
   * Useful for refreshing a single mower when viewing its details
   */
  async refreshMowerInFirebase(mowerId: string) {
    try {
      // Get mower from API
      const response = await api.get(`mowers/${mowerId}`);
      const mower = response.data.data;
      
      // Reference to the mower document
      const mowerRef = doc(collection(db, 'mowers'), mowerId);
      
      // Store system data
      const systemData = mower.attributes?.system || {};
      const metaData = mower.attributes?.metadata || {};
      const batteryData = mower.attributes?.battery || {};
      const mowerData = mower.attributes?.mower || {};
      
      // Create consolidated view for easier access
      const consolidated = {
        name: systemData.name || 'Unknown',
        model: systemData.model || 'Unknown',
        serialNumber: systemData.serialNumber,
        batteryPercent: batteryData.batteryPercent || 0,
        activity: mowerData.activity,
        state: mowerData.state,
        mode: mowerData.mode,
        errorCode: mowerData.errorCode,
        isConnected: metaData.connected !== false,
        lastRefreshedFromApi: new Date().toISOString()
      };
      
      // Set the data in Firebase with merge to preserve any existing fields
      await setDoc(mowerRef, {
        mowerData: {
          attributes: {
            system: systemData,
            battery: batteryData,
            mower: mowerData,
            metadata: metaData
          }
        },
        consolidated,
        lastUpdated: Timestamp.now(),
        lastApiSync: Timestamp.now()
      }, { merge: true });
      
      console.log(`Refreshed mower ${mowerId} in Firebase`);
      
      return mower;
    } catch (error) {
      console.error(`Error refreshing mower ${mowerId}:`, error);
      throw error;
    }
  }

  // Add helper methods for API communication
  async getAllMowers() {
    try {
      const response = await api.get('mowers');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching mowers:', error);
      throw error;
    }
  }

  async getMower(mowerId: string) {
    try {
      const response = await api.get(`mowers/${mowerId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching mower ${mowerId}:`, error);
      throw error;
    }
  }
} 