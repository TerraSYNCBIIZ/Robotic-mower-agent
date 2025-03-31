'use client';

import { useEffect } from 'react';
import { initializeMowerDataService } from '@/lib/husqvarna/mower-data-service-provider';
import { initializeApi } from '@/lib/husqvarna/api-client';

export function ServiceInitializer() {
  useEffect(() => {
    // Initialize API with token from localStorage
    initializeApi();
    
    // Initialize mower data service
    initializeMowerDataService();
    
    // Clean up function for unmount
    return () => {
      // Any cleanup if needed
    };
  }, []);
  
  return null;
} 