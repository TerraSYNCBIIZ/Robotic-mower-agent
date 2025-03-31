import { MowerDataService } from './mowerDataService';

// Global instance
let mowerDataServiceInstance: MowerDataService | null = null;

/**
 * Initialize the mower data service
 */
export function initializeMowerDataService(): MowerDataService {
  if (!mowerDataServiceInstance) {
    mowerDataServiceInstance = new MowerDataService();
    console.log('MowerDataService initialized');
  }
  return mowerDataServiceInstance;
}

/**
 * Get the mower data service instance
 */
export function getMowerDataService(): MowerDataService | null {
  return mowerDataServiceInstance;
}

/**
 * Clean up the mower data service
 */
export function disposeMowerDataService(): void {
  if (mowerDataServiceInstance) {
    mowerDataServiceInstance.dispose();
    mowerDataServiceInstance = null;
    console.log('MowerDataService disposed');
  }
} 