const mapContainerStyle = {
  width: '100%',
  height: 'calc(100vh - 64px)', // Use viewport height minus header height
  position: 'relative' as const,
};

// Import necessary components
import { useState, useRef } from 'react';
import { Spinner } from '@/components/ui/spinner'; // Adjust import path as needed

// Component implementation
export function SimpleGoogleMap() {
  const mapContainerRef = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  return (
    <div 
      id="map" 
      ref={mapContainerRef} 
      style={mapContainerStyle}
      className="w-full rounded-lg overflow-hidden shadow-lg"
    >
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-2 text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
} 