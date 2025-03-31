'use client';

/**
 * AcreageMapper Component
 * 
 * Fixed Issues:
 * 1. Point Placement: Modified polygon drawing to allow placing points within filled areas
 *    - Added handlePolygonClick to forward clicks from the polygon to the map
 *    - Reduced polygon opacity for better visibility
 * 2. Acreage Updates: Fixed calculation on polygon edits by getting fresh coordinates from the polygon path
 * 3. Mower Icon: Updated to use consistent icon with dashboard (/images/monochrome_large.webp)
 * 4. Existing Map Data: Added support for loading existing polygon data for a zone
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PenLine, Trash2, MapPin } from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF, PolygonF } from '@react-google-maps/api';

interface Location {
  lat: number;
  lng: number;
}

interface AcreageMapperProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAcreage: (acreage: number, polygon: Location[]) => void;
  zoneName: string;
  initialLocation: Location;
  existingPolygon?: Location[]; // Add prop for existing polygon data
  existingAcreage?: number; // Add prop for existing acreage
}

// Convert square meters to acres
const sqMetersToAcres = (sqMeters: number) => sqMeters * 0.000247105;

// Google Maps container styles
const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '12px',  // Round the corners of the map
  overflow: 'hidden'
};

// Control panel styles - make it smaller and less obtrusive
const controlContainerStyle = {
  position: 'absolute' as const,
  top: '10px',
  right: '10px', // Move to right side
  zIndex: 10,
  backgroundColor: 'white',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  padding: '6px'
};

// Libraries for Google Maps
const libraries = ['drawing', 'geometry'] as ['drawing', 'geometry'];

// Google Maps API key
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function AcreageMapper({ 
  isOpen, 
  onClose, 
  onSaveAcreage, 
  zoneName,
  initialLocation,
  existingPolygon = [],
  existingAcreage = 0
}: AcreageMapperProps) {
  // State for polygon coordinates
  const [polygonCoords, setPolygonCoords] = useState<Location[]>(existingPolygon);
  // State for the calculated acreage
  const [acreage, setAcreage] = useState<number>(existingAcreage || 0);
  // State for custom acreage input (user override)
  const [customAcreage, setCustomAcreage] = useState<string>(existingAcreage ? existingAcreage.toString() : '');
  // State for drawing mode
  const [isDrawing, setIsDrawing] = useState(false);
  // Temporary points for current drawing
  const [tempPoints, setTempPoints] = useState<Location[]>([]);
  // Map reference
  const mapRef = useRef<google.maps.Map | null>(null);
  // Reference to the active polygon for edits
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  
  // Load the Google Maps API using useJsApiLoader hook
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey,
    libraries
  });
  
  // Calculate acreage from polygon points
  const calculateAcreage = useCallback((path: Location[]) => {
    if (!window.google?.maps?.geometry || path.length < 3) return 0;
    
    try {
      // Convert to LatLng objects
      const googlePath = path.map(point => new google.maps.LatLng(point.lat, point.lng));
      
      // Calculate area
      const area = google.maps.geometry.spherical.computeArea(googlePath);
      const acres = sqMetersToAcres(area);
      const roundedAcres = Math.round(acres * 100) / 100;
      
      console.log(`Calculated area: ${roundedAcres} acres from ${path.length} points`);
      setAcreage(roundedAcres);
      return roundedAcres;
    } catch (error) {
      console.error("Error calculating area:", error);
      return 0;
    }
  }, []);
  
  // Load existing polygon data when component mounts or props change
  useEffect(() => {
    if (existingPolygon && existingPolygon.length >= 3) {
      setPolygonCoords(existingPolygon);
      
      // Calculate the acreage for the existing polygon if Google Maps is loaded
      if (window.google?.maps?.geometry) {
        calculateAcreage(existingPolygon);
      }
    }
    
    if (existingAcreage && existingAcreage > 0) {
      setAcreage(existingAcreage);
      setCustomAcreage(existingAcreage.toString());
    }
  }, [existingPolygon, existingAcreage, calculateAcreage]);
  
  // Handle map clicks for drawing
  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (!isDrawing || !event.latLng) return;
    
    // Get clicked position
    const clickedPos = event.latLng.toJSON();
    console.log("Map clicked at:", clickedPos);
    
    // Add point to temporary points - no restriction on placement
    const newPoints = [...tempPoints, clickedPos];
    setTempPoints(newPoints);
    
    // Calculate acreage if we have enough points
    if (newPoints.length >= 3) {
      calculateAcreage(newPoints);
    }
  }, [isDrawing, tempPoints, calculateAcreage]);
  
  // Handle polygon click - forward to map click
  const handlePolygonClick = useCallback((event: google.maps.PolyMouseEvent) => {
    if (!isDrawing || !event.latLng) return;
    
    // Forward the click to the map handler
    console.log("Polygon clicked, forwarding to map handler");
    handleMapClick(event as google.maps.MapMouseEvent);
  }, [isDrawing, handleMapClick]);
  
  // Handle map load
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    console.log("Map loaded successfully");
    mapRef.current = map;
    
    // Set up map
    map.setOptions({
      zoom: 20,
      center: initialLocation,
      draggableCursor: 'pointer',
      mapTypeControl: false, // Remove map type control
      streetViewControl: false // Remove street view controls
    });
  }, [initialLocation]);
  
  // Toggle drawing mode
  const toggleDrawingMode = useCallback(() => {
    if (isDrawing) {
      // Complete drawing
      if (tempPoints.length >= 3) {
        setPolygonCoords(tempPoints);
        calculateAcreage(tempPoints);
        toast.success("Zone drawn successfully");
      } else if (tempPoints.length > 0) {
        toast.error("Need at least 3 points to create a zone");
      }
      
      // Exit drawing mode
      setIsDrawing(false);
    } else {
      // Start new drawing
      setTempPoints([]);
      setIsDrawing(true);
      toast.info("Click on the map to draw your zone");
    }
  }, [isDrawing, tempPoints, calculateAcreage]);
  
  // Clear drawing
  const clearDrawing = useCallback(() => {
    setTempPoints([]);
    setPolygonCoords([]);
    setAcreage(0);
  }, []);
  
  // Center map on mower
  const centerOnMower = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(initialLocation);
      mapRef.current.setZoom(20);
    }
  }, [initialLocation]);
  
  // Handle save
  const handleSave = () => {
    const finalAcreage = customAcreage ? Number.parseFloat(customAcreage) : acreage;
    
    if (Number.isNaN(finalAcreage) || finalAcreage <= 0) {
      toast.error('Please enter a valid acreage');
      return;
    }
    
    if (polygonCoords.length < 3) {
      toast.error('Please draw a valid area on the map');
      return;
    }
    
    onSaveAcreage(finalAcreage, polygonCoords);
    toast.success(`Zone "${zoneName}" acreage saved`);
    onClose();
  };
  
  // Reset drawing when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsDrawing(false);
    }
  }, [isOpen]);
  
  // Function to update polygon coordinates and acreage
  const updatePolygonData = useCallback(() => {
    if (!polygonRef.current) return;
    
    const path = polygonRef.current.getPath();
    const updatedCoords: Location[] = [];
    
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      updatedCoords.push({ lat: point.lat(), lng: point.lng() });
    }
    
    console.log("Updated polygon coords:", updatedCoords);
    setPolygonCoords(updatedCoords);
    calculateAcreage(updatedCoords);
  }, [calculateAcreage]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Map Zone Acreage: {zoneName}</DialogTitle>
          <DialogDescription>
            Draw the outline of your zone on the map
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {loadError ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-md mb-4">
              <p className="font-medium">Error Loading Map</p>
              <p className="text-sm">Failed to load Google Maps. Please refresh and try again.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          ) : !isLoaded ? (
            <div className="flex justify-center items-center h-[400px] bg-gray-100 rounded-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="relative">
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={initialLocation}
                zoom={20}
                options={{
                  mapTypeId: 'satellite',
                  disableDefaultUI: true,
                  zoomControl: false,
                  scrollwheel: true,
                  streetViewControl: false,
                  fullscreenControl: false,
                  tilt: 0 // Top-down view
                }}
                onLoad={handleMapLoad}
                onClick={handleMapClick}
              >
                {/* Mower marker - using image icon from dashboard */}
                <MarkerF
                  position={initialLocation}
                  icon={{
                    url: '/images/monochrome_large.webp',
                    scaledSize: new google.maps.Size(20, 20),
                    anchor: new google.maps.Point(10, 10),
                    origin: new google.maps.Point(0, 0),
                  }}
                  zIndex={2}
                />
                
                {/* Drawing points markers */}
                {isDrawing && tempPoints.map((point, index) => (
                  <MarkerF
                    key={`temp-point-${point.lat}-${point.lng}`}
                    position={point}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 5,
                      fillColor: '#3b82f6',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2
                    }}
                    zIndex={3}
                  />
                ))}
                
                {/* Temporary polygon during drawing */}
                {isDrawing && tempPoints.length >= 2 && (
                  <PolygonF
                    paths={tempPoints}
                    options={{
                      fillColor: '#10b981',
                      fillOpacity: 0.2,
                      strokeColor: '#3b82f6',
                      strokeOpacity: 1.0,
                      strokeWeight: 2
                    }}
                    onClick={handlePolygonClick}
                  />
                )}
                
                {/* Final polygon */}
                {!isDrawing && polygonCoords.length >= 3 && (
                  <PolygonF
                    paths={polygonCoords}
                    options={{
                      fillColor: '#10b981',
                      fillOpacity: 0.5,
                      strokeColor: '#1976D2',
                      strokeOpacity: 1.0,
                      strokeWeight: 3,
                      editable: true,
                      draggable: true
                    }}
                    onLoad={(polygon) => {
                      // Save reference for later
                      console.log("Polygon loaded:", polygon);
                      polygonRef.current = polygon;
                    }}
                    onEdit={() => {
                      console.log("Polygon edited");
                      updatePolygonData();
                    }}
                    onDragEnd={() => {
                      console.log("Polygon drag ended");
                      updatePolygonData();
                    }}
                    // When a vertex is moved, update coordinates
                    onMouseUp={() => {
                      console.log("Mouse up on polygon");
                      updatePolygonData();
                    }}
                  />
                )}
              </GoogleMap>
                
              {/* Controls */}
              <div style={controlContainerStyle}>
                <div className="flex flex-col gap-2">
                  <Button 
                    size="sm"
                    variant="default"
                    className={`flex items-center justify-center gap-1 w-full font-medium ${
                      isDrawing 
                        ? "bg-red-500 hover:bg-red-600 animate-pulse"  
                        : "bg-green-500 hover:bg-green-600"
                    } text-white px-2 py-1 h-8`}
                    onClick={toggleDrawingMode}
                  >
                    <PenLine size={14} />
                    <span className="text-xs">{isDrawing ? "Complete" : "Draw"}</span>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex items-center justify-center gap-1 w-full font-medium px-2 py-1 h-8" 
                    onClick={clearDrawing}
                    disabled={polygonCoords.length === 0 && tempPoints.length === 0}
                  >
                    <Trash2 size={14} />
                    <span className="text-xs">Clear</span>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex items-center justify-center gap-1 w-full font-medium px-2 py-1 h-8" 
                    onClick={centerOnMower}
                  >
                    <MapPin size={14} />
                    <span className="text-xs">Mower</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="calculated-acreage" className="text-gray-700">Calculated Acreage</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="calculated-acreage" 
                  value={acreage.toString()} 
                  readOnly
                  className="bg-gray-100 text-gray-800 border-gray-300" // Ensure good contrast
                />
                <span className="text-gray-700">acres</span>
              </div>
            </div>
            
            <div className="flex-1">
              <Label htmlFor="custom-acreage" className="text-gray-700">Custom Acreage (optional)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="custom-acreage" 
                  value={customAcreage} 
                  onChange={(e) => setCustomAcreage(e.target.value)}
                  placeholder="Override acreage"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="text-gray-800 border-gray-300" // Ensure good contrast
                />
                <span className="text-gray-700">acres</span>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Acreage</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 