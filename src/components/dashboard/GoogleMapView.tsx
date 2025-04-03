"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { loadGoogleMapsApi } from "@/lib/google-maps-loader";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MowerLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  direction: number; // 0-359 degrees
  batteryLevel: number;
  areaComplete?: string;
  status: "mowing" | "charging" | "idle" | "error" | "offline" | "returning" | "parked" | "online" | "paused";
  zones?: {
    name: string;
    color: string;
    boundaries?: {
      lat: number;
      lng: number;
    }[];
  }[];
}

// Extended marker interface to include our custom properties
interface EnhancedMarker extends google.maps.Marker {
  imageMarker?: google.maps.Marker;
  infoWindow?: google.maps.InfoWindow;
}

// New interface for zone polygons
interface ZonePolygon extends google.maps.Polygon {
  zoneName: string;
  zoneColor: string;
}

interface GoogleMapViewProps {
  mowers?: MowerLocation[];
  className?: string;
  width?: number;
  height?: number | string;
  onMowerSelect?: (mowerId: string | null) => void;
  onZoneSelect?: (zoneName: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  showZones?: boolean;
  onToggleZones?: (showZones: boolean) => void;
}

export function GoogleMapView({
  mowers = [],
  className,
  width = 800,
  height = 500,
  onMowerSelect,
  onZoneSelect,
  center = { lat: 40.712776, lng: -74.005974 }, // Default to NYC
  zoom = 18,
  showZones = true,
  onToggleZones,
}: GoogleMapViewProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'top-down' | 'angle'>('top-down');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('satellite');
  const [darkMode, setDarkMode] = useState<boolean>(true); // Default to dark mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zonePolygons, setZonePolygons] = useState<ZonePolygon[]>([]);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<{ [key: string]: EnhancedMarker }>({});
  const zonePolygonRefs = useRef<ZonePolygon[]>([]);
  const hasFitBoundsRef = useRef<boolean>(false); // Track if we've already fit to bounds

  // Check if we're displaying a single mower view and adjust zoom if needed
  const effectiveZoom = mowers.length === 1 ? Math.max(zoom, 18) : zoom;

  // Function to toggle between top-down and angled view
  const toggleViewMode = () => {
    if (!mapInstanceRef.current) return;
    
    if (viewMode === 'top-down') {
      // Switch to 45-degree angle view
      mapInstanceRef.current.setTilt(45);
      setViewMode('angle');
    } else {
      // Switch to top-down view
      mapInstanceRef.current.setTilt(0);
      setViewMode('top-down');
    }
  };

  // Function to change map type
  const changeMapType = (type: 'roadmap' | 'satellite') => {
    if (!mapInstanceRef.current) return;
    
    mapInstanceRef.current.setMapTypeId(type);
    setMapType(type);
  };

  // Function to toggle dark mode
  const toggleDarkMode = () => {
    if (!mapInstanceRef.current) return;
    
    setDarkMode(!darkMode);
    
    // Only apply theme if in roadmap view (satellite view doesn't support styling)
    if (mapType === 'roadmap') {
      applyMapStyles(mapInstanceRef.current, !darkMode);
    }
  };
  
  // Apply map styles based on dark mode setting
  const applyMapStyles = useCallback((map: google.maps.Map, isDark: boolean) => {
    const darkStyles = [
      // Dark theme base styles
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      
      // Administrative boundaries
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      
      // Roads
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
      
      // Points of interest
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "poi.park", stylers: [{ visibility: "on" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
      
      // Water
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
      
      // Transit
      { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
      
      // Hide business points of interest completely
      { featureType: "poi.business", stylers: [{ visibility: "off" }] }
    ];
    
    const lightStyles = [
      // Simple light theme with hidden POI
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
      { featureType: "poi.business", stylers: [{ visibility: "off" }] }
    ];
    
    map.setOptions({ styles: isDark ? darkStyles : lightStyles });
  }, []);

  // Function to toggle fullscreen mode
  const toggleFullscreen = () => {
    const mapContainer = mapRef.current;
    if (!mapContainer) return;

    if (!isFullscreen) {
      // Entering fullscreen - only for the map element
      if (mapContainer.requestFullscreen) {
        mapContainer.requestFullscreen();
      } else if ('webkitRequestFullscreen' in mapContainer) {
        // @ts-ignore: Vendor-specific fullscreen API
        mapContainer.webkitRequestFullscreen();
      } else if ('msRequestFullscreen' in mapContainer) {
        // @ts-ignore: Vendor-specific fullscreen API
        mapContainer.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Exiting fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ('webkitExitFullscreen' in document) {
        // @ts-ignore: Vendor-specific fullscreen API
        document.webkitExitFullscreen();
      } else if ('msExitFullscreen' in document) {
        // @ts-ignore: Vendor-specific fullscreen API
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes from browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement && 
          document.fullscreenElement === mapRef.current)
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Initialize the map
  useEffect(() => {
    let mounted = true;
    let mapInitTimer: NodeJS.Timeout | null = null;
    let retryTimer: NodeJS.Timeout | null = null;

    // Track initialization attempts
    const MAX_RETRIES = 2; // Reduce maximum retries to prevent potential infinite loops
    let initRetryCount = 0;

    // Check if DOM is ready
    const isDomReady = () => {
      return document.readyState === 'complete' || document.readyState === 'interactive';
    };

    // Initialize map
    const initMap = async () => {
      if (!mounted) return;

      try {
        console.log(`Starting Google Maps initialization attempt ${initRetryCount + 1}/${MAX_RETRIES}...`);
        
        // Function to add custom styles to hide Google UI elements
        const addGoogleMapStyles = () => {
          // Add custom styling to hide Google attribution and other elements
          const style = document.createElement('style');
          style.textContent = `
            /* Hide Google logo and terms text */
            .gmnoprint, .gm-style-cc { 
              display: none !important; 
            }
            
            /* Hide Google attribution (bottom elements) */
            a[href^="https://maps.google.com/maps"], .gmnoscreen {
              display: none !important;
            }
            
            /* Hide copyright text */
            .gm-style-moc, .gm-style-terms {
              display: none !important;
            }
          `;
          document.head.appendChild(style);
        };
        
        // Use the centralized loader 
        await loadGoogleMapsApi();
        
        // Add a shorter delay to ensure component is fully mounted
        await new Promise(resolve => {
          mapInitTimer = setTimeout(resolve, 400); // Reduced timeout
        });
        
        // Double-check DOM readiness after the timeout
        if (!isDomReady()) {
          console.log("DOM not ready after waiting period");
          
          // Only retry logic - only retry if we haven't exceeded max retries
          if (initRetryCount < MAX_RETRIES && mounted) {
            initRetryCount++;
            console.log(`Retrying map initialization in 1 second (attempt ${initRetryCount}/${MAX_RETRIES})`);
            
            retryTimer = setTimeout(() => {
              if (mounted) initMap();
            }, 1000);
            return;
          }
          
          console.error("Exceeded maximum retries for map initialization");
          if (mounted) {
            setError("Failed to initialize map after multiple attempts. Please try again.");
          }
          return;
        }

        console.log("Google Maps script loaded, DOM is ready, initializing map...");

        const mapOptions: google.maps.MapOptions = {
          // Only use the default center if there are no mowers
          center: mowers.length === 0 ? center : undefined,
          zoom: effectiveZoom,
          mapTypeId: mapType,
          disableDefaultUI: true,
          // Selectively disable individual controls
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          // Hide the copyright/terms text and Google logo
          mapTypeControlOptions: {
            mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP]
          },
          // Apply dark theme styles to the map if in roadmap view and dark mode is enabled
          styles: mapType === 'roadmap' && darkMode ? [
            // Dark theme base styles
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            
            // Administrative boundaries
            { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
            
            // Roads
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
            { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
            { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
            
            // Points of interest
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "poi.park", stylers: [{ visibility: "on" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
            
            // Water
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
            { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
            
            // Transit
            { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
            
            // Hide business points of interest completely
            { featureType: "poi.business", stylers: [{ visibility: "off" }] }
          ] : [
            // Simple light theme with hidden POI
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "poi.business", stylers: [{ visibility: "off" }] }
          ],
          // Set tilt based on viewMode
          tilt: viewMode === 'top-down' ? 0 : 45
        };

        try {
          // Final check before creating the map
          if (!isDomReady()) {
            console.log("DOM ready check failed during final map creation step");
            return;
          }
          
          // At this point we know mapRef.current is not null because of isDomReady() check
          const mapContainer = mapRef.current as HTMLElement;
          mapInstanceRef.current = new google.maps.Map(mapContainer, mapOptions);
          console.log("Map instance created successfully");
          
          // Apply custom styles to hide Google elements
          addGoogleMapStyles();
          
          // Set a slight delay before setting mapLoaded to ensure the map is fully rendered
          setTimeout(() => {
            if (mounted) {
              // Force the map to redraw by resizing the window
              if (typeof window !== 'undefined') {
                const resizeEvent = window.document.createEvent('UIEvents');
                resizeEvent.initUIEvent('resize', true, false, window, 0);
                window.dispatchEvent(resizeEvent);
              }
              
              // Ensure satellite tiles are fully loaded
              if (mapInstanceRef.current && mapType === 'satellite') {
                google.maps.event.addListenerOnce(mapInstanceRef.current, 'tilesloaded', () => {
                  console.log("Satellite tiles fully loaded");
                });
              }
              
              setMapLoaded(true);
              console.log("Map fully initialized and ready");
            }
          }, 800); // Increased timeout for satellite view to load
        } catch (mapError) {
          console.error("Error creating Map instance:", mapError);
          if (mounted) {
            setError("Failed to initialize Google Maps. Please try reloading the page.");
          }
        }
      } catch (error) {
        console.error("Error initializing Google Maps:", error);
        if (mounted) {
          setError("Failed to load Google Maps. Please check your internet connection and try again.");
        }
      }
    };

    // Start initialization
    if (mounted) {
      initMap();
    }

    // Cleanup function
    return () => {
      mounted = false;
      if (mapInitTimer) clearTimeout(mapInitTimer);
      if (retryTimer) clearTimeout(retryTimer);
      
      // Clean up map instance if it exists
      if (mapInstanceRef.current) {
        // Remove event listeners
        google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
    };
  }, [effectiveZoom, viewMode, darkMode, mapType]);

  // Helper function to render zones
  const renderZones = useCallback((mower: MowerLocation) => {
    if (!mower.zones?.length || !mapInstanceRef.current) return;
    
    // Create a bounds object for this function scope
    const zoneBounds = new google.maps.LatLngBounds();
    
    for (const zone of mower.zones) {
      // Skip zones without boundaries
      if (!zone.boundaries || zone.boundaries.length < 3) continue;
      
      // Create polygon for the zone
      const polygon = new google.maps.Polygon({
        paths: zone.boundaries,
        strokeColor: zone.color,
        strokeOpacity: 0.9,
        strokeWeight: 3,
        fillColor: zone.color,
        fillOpacity: 0.35,
        map: mapInstanceRef.current,
        zIndex: 50,
        clickable: true
      }) as ZonePolygon;
      
      // Add custom properties
      polygon.zoneName = zone.name;
      polygon.zoneColor = zone.color;
      
      // Add click listener to select zone
      polygon.addListener('click', () => {
        // Handle zone selection
        setActiveZone(zone.name);
        if (onZoneSelect) {
          onZoneSelect(zone.name);
        }
        
        // Highlight the selected zone
        highlightZone(polygon);
      });
      
      // Add hover effect
      polygon.addListener('mouseover', () => {
        polygon.setOptions({
          fillOpacity: 0.6,
          strokeWeight: 4,
          strokeOpacity: 1.0
        });
      });
      
      polygon.addListener('mouseout', () => {
        // Only reset if not the active zone
        if (activeZone !== zone.name) {
          polygon.setOptions({
            fillOpacity: 0.35,
            strokeWeight: 3,
            strokeOpacity: 0.9
          });
        }
      });
      
      // Store reference to the polygon
      zonePolygonRefs.current.push(polygon);
      
      // Expand bounds to include all zone vertices
      for (const point of zone.boundaries) {
        zoneBounds.extend(point);
      }
    }
    
    // If we have valid zone boundaries, adjust the map view
    if (!zoneBounds.isEmpty() && mapInstanceRef.current) {
      // We could use this to zoom to fit all zones
      // mapInstanceRef.current.fitBounds(zoneBounds);
    }
  }, [activeZone, onZoneSelect]);
  
  // Helper function to highlight a selected zone
  const highlightZone = useCallback((selectedPolygon: ZonePolygon) => {
    // Reset all zone polygons
    for (const polygon of zonePolygonRefs.current) {
      polygon.setOptions({
        fillOpacity: 0.35,
        strokeWeight: 3,
        strokeOpacity: 0.9
      });
    }
    
    // Highlight the selected polygon
    selectedPolygon.setOptions({
      fillOpacity: 0.7,
      strokeWeight: 4,
      strokeOpacity: 1.0,
      zIndex: 100 // Bring to front
    });
    
    // Pan to center of the polygon if possible
    if (mapInstanceRef.current) {
      const bounds = new google.maps.LatLngBounds();
      const path = selectedPolygon.getPath();
      
      // Use for...of instead of forEach
      for (const point of path.getArray()) {
        bounds.extend(point);
      }
      
      mapInstanceRef.current.panTo(bounds.getCenter());
    }
  }, []);

  // Update markers when mowers change
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    // Use a more descriptive log that doesn't log the full object every time
    console.log(`Updating map markers with ${mowers.length} mowers`);

    // Clear existing markers
    for (const marker of Object.values(markerRefs.current)) {
      marker.setMap(null);
    }
    markerRefs.current = {};
    
    // Clear existing zone polygons
    for (const polygon of zonePolygonRefs.current) {
      polygon.setMap(null);
    }
    zonePolygonRefs.current = [];

    // Don't proceed if there are no mowers
    if (mowers.length === 0) return;

    // Calculate bounds for all mowers and zones
    const bounds = new google.maps.LatLngBounds();
    for (const mower of mowers) {
      // Add mower position to bounds
      bounds.extend({ lat: mower.lat, lng: mower.lng });
      
      // Add zone boundaries to bounds if they exist
      if (mower.zones?.length) {
        for (const zone of mower.zones) {
          if (zone.boundaries?.length) {
            for (const point of zone.boundaries) {
              bounds.extend(point);
            }
          }
        }
      }
      
      // Draw zones for this mower if they exist
      if (showZones && mower.zones?.length) {
        renderZones(mower);
      }
    }
    
    // Add map click listener to close all info windows when clicking elsewhere on the map
    google.maps.event.clearListeners(mapInstanceRef.current, 'click');
    mapInstanceRef.current.addListener('click', () => {
      // Close all open info windows
      for (const id in markerRefs.current) {
        const currentMarker = markerRefs.current[id] as EnhancedMarker;
        if (currentMarker.infoWindow) {
          currentMarker.infoWindow.close();
        }
      }
    });
    
    // Prevent the map from zooming too far in on single points or small areas
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      // If all markers are at the same location, add a small offset
      const center = bounds.getCenter();
      bounds.extend(
        new google.maps.LatLng(
          center.lat() + 0.001,
          center.lng() + 0.001
        )
      );
      bounds.extend(
        new google.maps.LatLng(
          center.lat() - 0.001,
          center.lng() - 0.001
        )
      );
    }

    // Fit map to the bounds with padding
    mapInstanceRef.current.fitBounds(bounds, 50); // 50px padding
    hasFitBoundsRef.current = true; // Mark that we've fit bounds

    // For single mower, ensure appropriate zoom level
    if (mowers.length === 1) {
      // Set a timeout to let the fitBounds settle first
      setTimeout(() => {
        if (mapInstanceRef.current) {
          // Get current zoom after fitBounds
          const currentZoom = mapInstanceRef.current.getZoom() || 0;
          
          // If the zoom is too far out, set a minimum zoom level for better visibility
          if (currentZoom < 18) {
            mapInstanceRef.current.setZoom(Math.max(18, currentZoom));
          }
        }
      }, 100);
    }

    // Add new markers
    for (const mower of mowers) {
      // Get status color for this mower
      const statusColor = getStatusColor(mower.status);
      
      // Instead of using SVG, we'll create two separate marker objects:
      // 1. One for the colored background
      // 2. One for the mower icon overlay
      
      // Create the base colored marker (the background circle)
      const backgroundMarker = new google.maps.Marker({
        position: { lat: mower.lat, lng: mower.lng },
        map: mapInstanceRef.current,
        title: mower.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: statusColor,
          fillOpacity: 1.0,
          strokeWeight: 0,
          scale: 15  // Size of the circle
        },
        optimized: false,
        zIndex: 999,
        clickable: true,
      });
      
      // Create the overlay mower icon
      const imageIcon = {
        url: '/images/monochrome_large.webp',
        scaledSize: new google.maps.Size(20, 20),
        anchor: new google.maps.Point(10, 10), // Center the image
        origin: new google.maps.Point(0, 0),
      };
      
      const imageMarker = new google.maps.Marker({
        position: { lat: mower.lat, lng: mower.lng },
        map: mapInstanceRef.current,
        icon: imageIcon,
        optimized: false,
        zIndex: 1000, // Higher to appear on top
        clickable: false,
      });
      
      // Hover effect for the background marker
      backgroundMarker.addListener("mouseover", () => {
        backgroundMarker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: statusColor,
          fillOpacity: 1.0,
          strokeWeight: 0,
          scale: 17 // Slightly larger on hover
        });
      });
      
      backgroundMarker.addListener("mouseout", () => {
        backgroundMarker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: statusColor,
          fillOpacity: 1.0,
          strokeWeight: 0,
          scale: 15
        });
      });

      // Create info window with improved styling
      const infoContent = `
        <div style="padding: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" class="mower-info-window" data-mower-id="${mower.id}">
          <!-- Header with mower name -->
          <div style="background-color: #1e293b; color: white; padding: 12px 16px; display: flex; align-items: center; justify-content: center;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 500; text-align: center;">${mower.name}</h3>
          </div>
          
          <!-- Status indicator -->
          <div style="padding: 12px 16px 8px; background-color: #1e293b; border-bottom: 1px solid #2d3748;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; ${mower.status === 'mowing' ? `box-shadow: 0 0 0 4px ${statusColor}33;` : ''}"></div>
              <p style="margin: 0; font-size: 14px; color: #e2e8f0; text-transform: capitalize; font-weight: 500;">${mower.status}</p>
            </div>
          </div>
          
          <!-- Stats section -->
          <div style="background-color: #1e293b; padding: 8px 16px 12px;">
            <!-- Battery status -->
            <div style="margin-bottom: ${mower.areaComplete ? '12px' : '0'};">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8;">Battery</p>
                <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${mower.batteryLevel < 20 ? '#ef4444' : mower.batteryLevel < 50 ? '#f59e0b' : '#10b981'};">${mower.batteryLevel}%</p>
              </div>
              <div style="height: 6px; width: 100%; background-color: #334155; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${mower.batteryLevel}%; background-color: ${mower.batteryLevel < 20 ? '#ef4444' : mower.batteryLevel < 50 ? '#f59e0b' : '#10b981'}; border-radius: 3px;"></div>
              </div>
            </div>
            
            <!-- Area complete (if available) -->
            ${mower.areaComplete ? `
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <p style="margin: 0; font-size: 13px; color: #94a3b8;">Area Complete</p>
                  <p style="margin: 0; font-size: 13px; font-weight: 600; color: #e2e8f0;">${mower.areaComplete}</p>
                </div>
                <div style="height: 6px; width: 100%; background-color: #334155; border-radius: 3px; overflow: hidden;">
                  <div style="height: 100%; width: ${Number.parseInt(mower.areaComplete)}%; background-color: #8b5cf6; border-radius: 3px;"></div>
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- Action button -->
          <button style="width: 100%; padding: 10px 16px; background-color: #0f172a; color: white; border: none; font-size: 14px; font-weight: 500; cursor: pointer; text-align: center; transition: background-color 0.2s;">
            View Details
          </button>
        </div>
      `;
      
      const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
        disableAutoPan: false,
        maxWidth: 220,
        pixelOffset: new google.maps.Size(0, -15)
      });

      // First click just opens the info window without selecting the mower
      backgroundMarker.addListener("click", () => {
        // Close all other info windows before opening this one
        for (const id in markerRefs.current) {
          const currentMarker = markerRefs.current[id] as EnhancedMarker;
          if (id !== mower.id && currentMarker.infoWindow) {
            currentMarker.infoWindow.close();
          }
        }
        
        infoWindow.open(mapInstanceRef.current, backgroundMarker);
      });

      // Add event listener to the info window DOM element after it's opened
      google.maps.event.addListener(infoWindow, 'domready', () => {
        // Find the "View Details" button
        const infoWindowElements = document.getElementsByClassName('mower-info-window');
        if (infoWindowElements.length > 0) {
          const infoElement = infoWindowElements[0] as HTMLElement;
          
          // Add click handler to the entire info window content
          infoElement.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            // Check if the click was on the close button (×)
            if (target.classList.contains('info-close-btn')) {
              infoWindow.close();
              return;
            }
            
            // Otherwise trigger the mower selection
            if (onMowerSelect) {
              onMowerSelect(mower.id);
            }
          });
          
          // Find and add hover effect to the action button
          const actionButton = infoElement.querySelector('button');
          if (actionButton) {
            actionButton.addEventListener('mouseover', () => {
              actionButton.style.backgroundColor = '#0f172a';
            });
            actionButton.addEventListener('mouseout', () => {
              actionButton.style.backgroundColor = '#1e293b';
            });
          }
          
          // Add special styling to remove the default Google Maps info window appearance
          const iwOuter = document.querySelector('.gm-style-iw-a');
          if (iwOuter) {
            const iwBackground = iwOuter.previousElementSibling;
            // Remove the white background and shadow
            if (iwBackground) {
              // Access to the arrow elements
              const iwArrows = Array.from(iwBackground.children);
              // Hide the default arrow
              for (const arrow of iwArrows) {
                (arrow as HTMLElement).style.display = 'none';
              }
            }
            
            // Remove the default InfoWindow close button
            const closeButton = document.querySelector('.gm-ui-hover-effect');
            if (closeButton) {
              (closeButton as HTMLElement).style.display = 'none';
            }
            
            // Remove padding from the container - this is the white box causing issues
            const iwContainer = document.querySelector('.gm-style-iw-c');
            if (iwContainer) {
              (iwContainer as HTMLElement).style.padding = '0';
              (iwContainer as HTMLElement).style.margin = '0';
              (iwContainer as HTMLElement).style.boxShadow = 'none';
              (iwContainer as HTMLElement).style.borderRadius = '8px';
              (iwContainer as HTMLElement).style.overflow = 'hidden';
              (iwContainer as HTMLElement).style.backgroundColor = 'transparent';
              (iwContainer as HTMLElement).style.border = 'none';
              (iwContainer as HTMLElement).style.maxWidth = 'none';
              (iwContainer as HTMLElement).style.maxHeight = 'none';
            }
            
            // Fix the inner container that can cause scrollbars
            const iwInner = document.querySelector('.gm-style-iw-d');
            if (iwInner) {
              (iwInner as HTMLElement).style.padding = '0';
              (iwInner as HTMLElement).style.overflow = 'visible !important';
              (iwInner as HTMLElement).style.maxHeight = 'none !important';
              (iwInner as HTMLElement).style.maxWidth = 'none !important';
              
              // Force remove scrollbars
              (iwInner as HTMLElement).style.overflow = 'hidden';
              (iwInner as HTMLElement).style.overflowX = 'hidden';
              (iwInner as HTMLElement).style.overflowY = 'hidden';
            }
            
            // Also fix the iw-t3-* element that contains another white background
            const iwT3 = document.querySelector('[class*="gm-style-iw-t"]');
            if (iwT3) {
              (iwT3 as HTMLElement).style.backgroundColor = 'transparent';
            }
          }
        }
      });

      // Store markers and info window reference
      markerRefs.current[mower.id] = backgroundMarker as EnhancedMarker;
      (markerRefs.current[mower.id] as EnhancedMarker).imageMarker = imageMarker;
      (markerRefs.current[mower.id] as EnhancedMarker).infoWindow = infoWindow;
    }

    // Center the map if markers exist - but use a more stable approach
    let resizeTimer: NodeJS.Timeout;
    
    // Use a combination of fitBounds and explicit zoom constraints
    mapInstanceRef.current.fitBounds(bounds);
    
    // When bounds change, enforce zoom constraints
    google.maps.event.addListenerOnce(mapInstanceRef.current, 'bounds_changed', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const zoom = mapInstanceRef.current?.getZoom() || 0;
        console.log("Map bounds changed, current zoom:", zoom);
        
        // Set minimum and maximum zoom constraints
        if (zoom > 20) {
          console.log("Limiting zoom to 20");
          mapInstanceRef.current?.setZoom(20);
        } else if (zoom < 15 && mowers.length <= 2) {
          // For 1-2 mowers, don't zoom out too far
          console.log("Setting zoom to at least 15");
          mapInstanceRef.current?.setZoom(15);
        }
        
        // After setting zoom, add a marker visibility check
        for (const markerId in markerRefs.current) {
          const marker = markerRefs.current[markerId] as EnhancedMarker;
          const imageMarker = marker.imageMarker;
          
          // Ensure both markers are visible
          if (marker.getMap() !== mapInstanceRef.current) {
            console.log("Re-adding marker to map");
            marker.setMap(mapInstanceRef.current);
          }
          
          if (imageMarker && imageMarker.getMap() !== mapInstanceRef.current) {
            console.log("Re-adding image marker to map");
            imageMarker.setMap(mapInstanceRef.current);
          }
        }
      }, 300);
    });
    
    // Add a periodic check to ensure markers remain visible
    const visibilityInterval = setInterval(() => {
      if (!mapInstanceRef.current) {
        clearInterval(visibilityInterval);
        return;
      }
      
      for (const markerId in markerRefs.current) {
        const marker = markerRefs.current[markerId] as EnhancedMarker;
        const imageMarker = marker.imageMarker;
        
        if (marker.getMap() !== mapInstanceRef.current) {
          console.log("Marker disappeared, re-adding to map");
          marker.setMap(mapInstanceRef.current);
        }
        
        if (imageMarker && imageMarker.getMap() !== mapInstanceRef.current) {
          console.log("Image marker disappeared, re-adding to map");
          imageMarker.setMap(mapInstanceRef.current);
        }
      }
    }, 2000);
    
    // Clean up interval when component unmounts or mowers change
    return () => {
      clearInterval(visibilityInterval);
      clearTimeout(resizeTimer);
      
      // Clear all markers on cleanup
      for (const marker of Object.values(markerRefs.current)) {
        marker.setMap(null);
      }
      
      // Clear all polygons on cleanup
      for (const polygon of zonePolygonRefs.current) {
        polygon.setMap(null);
      }
    };
  }, [mapLoaded, mowers, mapInstanceRef.current, onMowerSelect, showZones]);

  // Helper function to get color based on mower status
  const getStatusColor = (status: MowerLocation["status"]): string => {
    switch (status) {
      case "mowing":
        return "#10b981"; // emerald-500
      case "charging":
        return "#3b82f6"; // blue-500
      case "idle":
        return "#94a3b8"; // gray-400
      case "offline":
        return "#6b7280"; // gray-500
      case "error":
        return "#ef4444"; // red-500
      case "returning":
        return "#6366f1"; // indigo-500
      case "parked":
        return "#64748b"; // slate-500
      case "online":
        return "#10b981"; // emerald-500
      case "paused":
        return "#f59e0b"; // amber-500
      default:
        return "#6b7280"; // gray-500
    }
  };

  // Cleanup function to properly dispose of map resources
  useEffect(() => {
    return () => {
      // Clear markers
      for (const markerId in markerRefs.current) {
        const marker = markerRefs.current[markerId] as EnhancedMarker;
        const imageMarker = marker.imageMarker;
        
        if (marker) marker.setMap(null);
        if (imageMarker) imageMarker.setMap(null);
      }
      markerRefs.current = {};
      
      // Clear map instance reference
      mapInstanceRef.current = null;
      
      console.log("GoogleMapView unmounted, resources cleaned up");
    };
  }, []);

  return (
    <Card
      className={cn(
        "overflow-hidden h-full w-full",
        isFullscreen ? "fixed inset-0 z-50" : "",
        className
      )}
      style={{
        width: isFullscreen ? "100vw" : "100%",
        height: isFullscreen ? "100vh" : "100%",
        position: "relative"
      }}
    >
      <CardContent className="p-0 relative h-full w-full">
        {/* Loading State */}
        {!mapLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10 p-4">
            <div className="text-center max-w-md">
              <div className="rounded-full bg-red-100 p-3 mx-auto w-fit mb-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-medium mb-1">Map Loading Error</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const mapInitTimer = setTimeout(() => {
                    setMapLoaded(false);
                    setError(null);
                    // Force reload Google Maps
                    loadGoogleMapsApi().then(() => {
                      if (mapRef.current) {
                        const mapOptions: google.maps.MapOptions = {
                          center,
                          zoom: effectiveZoom,
                          mapTypeId: mapType,
                          disableDefaultUI: true
                        };
                        mapInstanceRef.current = new google.maps.Map(mapRef.current, mapOptions);
                        setMapLoaded(true);
                      }
                    }).catch(err => {
                      console.error("Error reloading map:", err);
                      setError("Failed to reload map. Please try refreshing the page.");
                    });
                  }, 500);
                  return () => clearTimeout(mapInitTimer);
                }}
              >
                Retry Loading
              </Button>
                </div>
              </div>
        )}
        
        {/* Map Container */}
        <div 
          ref={mapRef}
          className="absolute inset-0 w-full h-full"
          aria-label="Map view of mower locations"
          role="application"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        
        {/* Map Controls - Only show when map is loaded */}
        {mapLoaded && !error && (
          <div className="absolute bottom-3 right-3 flex flex-col gap-2 z-20">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-sm"
                  onClick={toggleViewMode}
              title={viewMode === 'top-down' ? "Switch to angle view" : "Switch to top-down view"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                {viewMode === 'top-down' ? (
                  <path d="M3 7V5a2 2 0 0 1 2-2h2m4-1v6m4-6v6m4-5h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m14-4v2a2 2 0 0 1-2 2h-2" />
                ) : (
                  <path d="M21 3 9 15M15 3h6v6M9 21V9l6-6" />
                )}
              </svg>
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-sm"
              onClick={() => changeMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
              title={mapType === 'roadmap' ? "Switch to satellite view" : "Switch to street view"}
            >
              {mapType === 'roadmap' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m2.5 12 19 0" />
                  <path d="m12 2.5 0 19" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M9 20L2 20L2 6L9 3L16 6L22 3L22 17L16 20L9 17L9 20" />
                  <path d="M16 6L16 20" />
                </svg>
              )}
            </Button>
            
            {/* Toggle dark mode (only applicable in roadmap view) */}
            {mapType === 'roadmap' && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-sm"
                onClick={toggleDarkMode}
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                )}
              </Button>
            )}
            
            {/* Toggle zones/boundaries button */}
            {onToggleZones && (
              <Button
                variant="outline"
                size="icon"
                className={`h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-sm ${
                  showZones ? 'border-primary text-primary' : ''
                }`}
                onClick={() => onToggleZones(!showZones)}
                title={showZones ? "Hide zones" : "Show zones"}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M19.1 4.9C23 8.8 23 15.2 19.1 19.1M16.2 7.8C18.2 9.8 18.2 13.1 16.2 15.1M7.8 16.2C5.8 14.2 5.8 10.9 7.8 8.9"/>
                </svg>
              </Button>
            )}
            
            {/* Fullscreen button */}
              <Button 
                variant="outline" 
              size="icon"
              className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-sm"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 