import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Zone, Mower, TimeRestriction, Location } from './MowerScheduler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Info, MapPin, Map as MapIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { saveZoneData, getZoneData } from '@/lib/firestoreDB';
import AcreageMapper from '../maps/AcreageMapper';
import { toast } from 'sonner';

// Mower model capabilities database
// These are approximate values based on typical Husqvarna mower specifications
const MOWER_CAPABILITIES: Record<string, {
  acresPerHour: number,
  maxAcresPerDay: number,
  recommendedMaxAcreage: number,
  batteryLife: number // in minutes
}> = {
  // Automower series
  '105': { acresPerHour: 0.02, maxAcresPerDay: 0.15, recommendedMaxAcreage: 0.15, batteryLife: 65 },
  '115H': { acresPerHour: 0.025, maxAcresPerDay: 0.4, recommendedMaxAcreage: 0.4, batteryLife: 60 },
  '305': { acresPerHour: 0.03, maxAcresPerDay: 0.4, recommendedMaxAcreage: 0.4, batteryLife: 70 },
  '310': { acresPerHour: 0.04, maxAcresPerDay: 0.6, recommendedMaxAcreage: 0.75, batteryLife: 70 },
  '315': { acresPerHour: 0.05, maxAcresPerDay: 0.75, recommendedMaxAcreage: 0.75, batteryLife: 70 },
  '415X': { acresPerHour: 0.08, maxAcresPerDay: 0.9, recommendedMaxAcreage: 0.9, batteryLife: 100 },
  '430X': { acresPerHour: 0.1, maxAcresPerDay: 1.25, recommendedMaxAcreage: 1.25, batteryLife: 145 },
  '430XH': { acresPerHour: 0.1, maxAcresPerDay: 1.25, recommendedMaxAcreage: 1.25, batteryLife: 145 },
  '435X AWD': { acresPerHour: 0.12, maxAcresPerDay: 1.5, recommendedMaxAcreage: 1.5, batteryLife: 100 },
  '450X': { acresPerHour: 0.13, maxAcresPerDay: 1.75, recommendedMaxAcreage: 1.75, batteryLife: 270 },
  '450XH': { acresPerHour: 0.13, maxAcresPerDay: 1.75, recommendedMaxAcreage: 1.75, batteryLife: 270 },
  '550 EPOS': { acresPerHour: 0.15, maxAcresPerDay: 1.75, recommendedMaxAcreage: 1.75, batteryLife: 210 },
  '535 AWD': { acresPerHour: 0.12, maxAcresPerDay: 1.5, recommendedMaxAcreage: 1.5, batteryLife: 100 },
  // Default for unknown models
  'default': { acresPerHour: 0.08, maxAcresPerDay: 0.9, recommendedMaxAcreage: 0.9, batteryLife: 100 }
};

interface ZoneManagerProps {
  zones: Zone[];
  setZones: (zones: Zone[]) => void;
  onNext: () => void;
  onBack: () => void;
  selectedMower: Mower;
}

interface ZoneForm {
  name: string;
  acreage: string;
  frequency: number;
}

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Once per week', description: 'Mow each zone one time per week' },
  { value: 2, label: 'Twice per week', description: 'Mow each zone two times per week' },
  { value: 3, label: 'Three times per week', description: 'Mow each zone three times per week' },
  { value: 4, label: 'Four times per week', description: 'Mow each zone four times per week' },
  { value: 5, label: 'Five times per week', description: 'Mow each zone five times per week' },
];

export default function ZoneManager({ zones, setZones, onNext, onBack, selectedMower }: ZoneManagerProps) {
  const [zoneForm, setZoneForm] = useState<ZoneForm>({
    name: '',
    acreage: '',
    frequency: 2
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [selectedZoneForMapping, setSelectedZoneForMapping] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Use useCallback for data loading to make dependencies clearer
  const loadSavedZoneData = useCallback(async (
    mowerId: string, 
    currentZones: Zone[], 
    mowerZones?: { id: string; name: string; color: string }[]
  ) => {
    setLoading(true);
    try {
      console.log('Starting to load saved zone data for mower:', mowerId);
      console.log('Current zones:', currentZones);
      console.log('Mower zones:', mowerZones);
      
      const result = await getZoneData(mowerId);
      console.log('getZoneData result:', result);
      
      if (result.success && result.data && result.data.zones) {
        // If no zones are set yet, but there are saved zone data from the mower
        if (currentZones.length === 0 && mowerZones && mowerZones.length > 0) {
          const mergedZones = mowerZones.map(zone => {
            const savedZone = result.data.zones.find((z: { id: string; name: string; workAreaId?: string }) => 
              z.id === zone.id || z.workAreaId === zone.id || z.name === zone.name
            );
            
            console.log(`Creating merged zone for ${zone.name}:`, savedZone);
            
            // Important: Use the zone's own name, not the savedZone name
            return {
              id: zone.id || `zone-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              name: zone.name, // Use correct zone name from mowerZones
              acreage: savedZone?.acreage || 0.25,
              frequency: savedZone?.frequency || 2,
              restrictions: [] as TimeRestriction[],
              mapData: savedZone?.mapData || null
            };
          });
          
          console.log('Setting merged zones:', mergedZones);
          setZones(mergedZones);
        } else if (currentZones.length > 0) {
          // Create a new array of zones with updated properties if needed
          const updatedZones = currentZones.map(zone => {
            // Find matching saved zone by id or name
            const savedZone = result.data.zones.find((z: { id: string; name: string; workAreaId?: string }) => 
              (z.id && z.id === zone.id) || 
              (z.workAreaId && z.workAreaId === zone.id) || 
              (z.name && z.name === zone.name)
            );
            
            console.log(`Checking zone ${zone.name} for updates:`, savedZone);
            
            if (savedZone) {
              console.log(`Updating zone ${zone.name} with saved data`);
              return {
                ...zone,
                acreage: savedZone.acreage || zone.acreage,
                mapData: savedZone.mapData || zone.mapData
              };
            }
            return zone;
          });
          
          // Only update zones if there are actual changes
          const hasChanges = JSON.stringify(updatedZones) !== JSON.stringify(currentZones);
          if (hasChanges) {
            console.log('Setting updated zones:', updatedZones);
            setZones(updatedZones);
          } else {
            console.log('No changes detected, keeping current zones');
          }
        }
      } else {
        console.log('No saved zone data found or error getting data');
      }
    } catch (error) {
      console.error('Error loading saved zone data:', error);
    } finally {
      setLoading(false);
    }
  }, [setZones]);

  // Track the number of data loading attempts to prevent excessive requests
  const [loadAttempts, setLoadAttempts] = useState(0);
  const MAX_LOAD_ATTEMPTS = 3;

  // Track whether to show warning about max attempts reached
  const [showMaxAttemptsWarning, setShowMaxAttemptsWarning] = useState(false);
  
  // Show warning if max attempts reached and no zones loaded
  useEffect(() => {
    if (loadAttempts >= MAX_LOAD_ATTEMPTS && zones.length === 0 && selectedMower.zones?.length > 0) {
      setShowMaxAttemptsWarning(true);
    } else {
      setShowMaxAttemptsWarning(false);
    }
  }, [loadAttempts, zones.length, selectedMower.zones]);

  // Load data only once when the component mounts or mower changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedMower.id && !loading && loadAttempts < MAX_LOAD_ATTEMPTS) {
      loadSavedZoneData(selectedMower.id, zones, selectedMower.zones);
      setLoadAttempts(prev => prev + 1);
    }
  }, [selectedMower.id, loadSavedZoneData, loading, selectedMower.zones, loadAttempts]);

  // Reset attempts counter when mower changes
  useEffect(() => {
    setLoadAttempts(0);
    setShowMaxAttemptsWarning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMower.id]); // ID is needed to reset state on mower change

  // Save zone data to Firebase when zones change
  useEffect(() => {
    // Create a debounced function to avoid frequent saves
    const saveZonesWithDebounce = () => {
      // Debounce time of 1000ms (1 second)
      const debounceTime = 1000;
      let timeout: NodeJS.Timeout;
      
      return () => {
        if (timeout) clearTimeout(timeout);
        
        timeout = setTimeout(async () => {
          if (!selectedMower.id || zones.length === 0) return;
          
          try {
            await saveZoneData(selectedMower.id, zones);
          } catch (error) {
            console.error('Error saving zone data:', error);
          }
        }, debounceTime);
      };
    };
    
    const debouncedSave = saveZonesWithDebounce();
    
    if (zones.length > 0) {
      debouncedSave();
    }
    
    // Cleanup the timeout on unmount
    return () => {
      if (typeof debouncedSave === 'function') {
        debouncedSave(); // Will clear any existing timeout
      }
    };
  }, [zones, selectedMower.id]);

  // Get mower capabilities based on model
  const mowerCapabilities = useMemo(() => {
    // Extract model number from the full model string
    const modelNumber = selectedMower.model?.replace(/[^0-9X\s]/g, '').trim() || '';
    
    // Try to find exact match, otherwise fall back to default
    return MOWER_CAPABILITIES[modelNumber] || MOWER_CAPABILITIES.default;
  }, [selectedMower.model]);
  
  // Calculate total weekly mowing requirement
  const weeklyMowingStats = useMemo(() => {
    const totalWeeklyAcreage = zones.reduce((sum, zone) => sum + (zone.acreage * zone.frequency), 0);
    const mowerCapacity = selectedMower.acresPerWeek;
    const utilizationPercentage = (totalWeeklyAcreage / mowerCapacity) * 100;
    
    // Calculate estimated weekly mowing time in hours
    const estimatedHours = totalWeeklyAcreage / mowerCapabilities.acresPerHour;
    
    return {
      totalWeeklyAcreage,
      mowerCapacity,
      utilizationPercentage,
      isOverCapacity: utilizationPercentage > 100,
      capacityStatus: utilizationPercentage <= 75 ? 'green' : utilizationPercentage <= 90 ? 'yellow' : 'red',
      estimatedHours
    };
  }, [zones, selectedMower.acresPerWeek, mowerCapabilities.acresPerHour]);

  const addZone = () => {
    if (!zoneForm.name || !zoneForm.acreage || Number.isNaN(Number(zoneForm.acreage)) || Number(zoneForm.acreage) <= 0) {
      return;
    }

    const newZone: Zone = {
      id: Date.now().toString(),
      name: zoneForm.name,
      acreage: Number(zoneForm.acreage),
      frequency: zoneForm.frequency,
      restrictions: [],
    };

    setZones([...zones, newZone]);
    setZoneForm({
      name: '',
      acreage: '',
      frequency: 2
    });
  };

  const removeZone = (id: string) => {
    setZones(zones.filter(zone => zone.id !== id));
  };

  // If the user has zones associated with their mower from the API, offer to use those
  const useExistingZones = () => {
    if (!selectedMower.zones || selectedMower.zones.length === 0) return;
    
    setShowConfirmDialog(true);
  };
  
  const handleConfirmUseExistingZones = () => {
    if (!selectedMower.zones) return;
    
    const convertedZones = selectedMower.zones.map(zone => ({
      id: zone.id || `zone-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: zone.name, // Use the correct zone name
      acreage: 0.25, // Default acreage - this would be customized by the user
      frequency: 2,  // Default frequency - twice per week
      restrictions: [],
    }));
    
    console.log("Creating zones from mower data:", convertedZones);
    setZones(convertedZones);
    setShowConfirmDialog(false);
  };
  
  // Check if a zone's acreage exceeds recommended limits
  const isZoneAcreageTooLarge = (acreage: number) => {
    return acreage > mowerCapabilities.recommendedMaxAcreage;
  };
  
  // Update a zone's acreage
  const updateZoneAcreage = (id: string, newAcreage: string) => {
    if (Number.isNaN(Number(newAcreage))) return;
    
    setZones(zones.map(zone => 
      zone.id === id 
        ? { ...zone, acreage: Number(newAcreage) } 
        : zone
    ));
  };
  
  // Update a zone's frequency
  const updateZoneFrequency = (id: string, newFrequency: number) => {
    setZones(zones.map(zone => 
      zone.id === id 
        ? { ...zone, frequency: newFrequency } 
        : zone
    ));
  };

  // Function to open the mapping dialog for a specific zone
  const handleMapZone = (zone: Zone) => {
    setSelectedZoneForMapping(zone);
    setShowMapDialog(true);
  };

  // Function to handle saving acreage data from the mapping tool
  const handleSaveAcreage = (acreage: number, polygonCoords: Location[]) => {
    if (!selectedZoneForMapping) {
      console.error("No zone selected for mapping");
      return;
    }
    
    console.log(`Saving acreage data for zone ${selectedZoneForMapping.name}:`, {
      zoneName: selectedZoneForMapping.name,
      acreage,
      polygonPoints: polygonCoords.length
    });
    
    // Create a deep copy of the zones array to avoid reference issues
    const zonesToUpdate = JSON.parse(JSON.stringify(zones));
    
    // Update only the specific zone with the new acreage and map data
    // Use zone name for identification since IDs may be undefined
    const updatedZones = zonesToUpdate.map((zone: Zone) => {
      if (zone.name === selectedZoneForMapping.name) {
        console.log(`Updating zone ${zone.name} with new data (acreage: ${acreage})`);
        
        // Ensure the zone has a valid ID
        const zoneId = zone.id || `zone-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        return { 
          ...zone, 
          id: zoneId,
          acreage, 
          mapData: { polygon: polygonCoords } 
        };
      } 
      // If the zone doesn't match, return it unchanged
      return zone;
    });
    
    console.log('Updated zones:', updatedZones.map((z: Zone) => `${z.name}: ${z.acreage} acres`));
    
    // Update state with the new zones
    setZones(updatedZones);
    
    // Save to Firebase/localStorage for persistence
    saveZoneData(selectedMower.id, updatedZones)
      .then(result => {
        if (result.success) {
          toast.success(`Zone "${selectedZoneForMapping.name}" updated to ${acreage} acres`);
        } else {
          toast.error("Failed to save zone data");
        }
      })
      .catch(err => {
        console.error("Error saving zone data:", err);
        toast.error("Error saving zone data");
      });
    
    // Clean up
    setSelectedZoneForMapping(null);
    setShowMapDialog(false);
  };

  // Function to determine the best location to use for mapping
  const getMowerMapLocation = (): Location => {
    console.log("Full mower data:", selectedMower);
    
    // 1. Check if the mower has a direct location property
    if (selectedMower.location?.lat && selectedMower.location?.lng) {
      console.log("Using mower's direct location");
      return {
        lat: selectedMower.location.lat,
        lng: selectedMower.location.lng
      };
    }
    
    // 2. Check if there's position data in mower attributes
    if (selectedMower.attributes?.positions && selectedMower.attributes.positions.length > 0) {
      const position = selectedMower.attributes.positions[0];
      if (position.latitude && position.longitude) {
        console.log("Using position from mower attributes:", position);
        return {
          lat: position.latitude,
          lng: position.longitude
        };
      }
    }
    
    // 3. Check if there's coordinates property (from API response)
    if (selectedMower.coordinates?.latitude && selectedMower.coordinates?.longitude) {
      console.log("Using coordinates from API response:", selectedMower.coordinates);
      return {
        lat: selectedMower.coordinates.latitude,
        lng: selectedMower.coordinates.longitude
      };
    }
    
    // 4. Check if the zone being mapped already has coordinates
    if (selectedZoneForMapping?.mapData?.polygon && selectedZoneForMapping.mapData.polygon.length > 0) {
      console.log("Using existing zone polygon data:", selectedZoneForMapping.mapData.polygon[0]);
      return selectedZoneForMapping.mapData.polygon[0];
    }
    
    // 5. Try to get any zone coordinates from any zone
    // Using a for loop instead of find to avoid optional chaining issues
    for (const zone of zones) {
      // Only access polygon if mapData exists and has coordinates
      if (zone.mapData?.polygon?.length > 0) {
        // Safely get the first coordinate
        const firstCoord = zone.mapData.polygon[0];
        console.log("Using coordinates from another zone:", firstCoord);
        return firstCoord; 
      }
    }
    
    // 6. Default to a more useful default coordinate instead of NYC
    console.log("No location data found, using default coordinates");
    return { lat: 40.7128, lng: -74.0060 }; // NYC default as last resort
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">Configure Your Zones</h2>
        <Button 
          onClick={() => setShowForm(!showForm)} 
          variant="outline" 
          className="flex items-center gap-1"
        >
          {showForm ? 'Hide Form' : <><Plus size={16} /> Add Zone</>}
        </Button>
      </div>

      {loading && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <AlertTitle>Loading zones from saved data...</AlertTitle>
          <AlertDescription>
            We're retrieving your previously saved zone data.
          </AlertDescription>
        </Alert>
      )}
      
      {showMaxAttemptsWarning && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
          <AlertTitle>Couldn't load saved zone data</AlertTitle>
          <AlertDescription>
            We couldn't retrieve your saved zone data after multiple attempts. 
            You can continue configuring zones manually.
          </AlertDescription>
        </Alert>
      )}

      {/* Mower Capability Info */}
      <Card className="p-4 bg-blue-50">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <Info className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900">Mower Capability</h3>
            <p className="text-sm text-blue-800">
              Your {selectedMower.model || 'mower'} can handle 
              approximately {mowerCapabilities.acresPerHour.toFixed(2)} acres per hour, 
              with a recommended maximum area of {mowerCapabilities.recommendedMaxAcreage.toFixed(2)} acres.
            </p>
          </div>
        </div>
      </Card>
      
      {/* Capacity Indicator */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Weekly Mowing Capacity</span>
            <span className="text-sm font-medium text-gray-900">
              {weeklyMowingStats.totalWeeklyAcreage.toFixed(2)} / {weeklyMowingStats.mowerCapacity.toFixed(2)} acres
            </span>
          </div>
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                weeklyMowingStats.capacityStatus === 'green' 
                  ? 'bg-green-500' 
                  : weeklyMowingStats.capacityStatus === 'yellow'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(weeklyMowingStats.utilizationPercentage, 100)}%` }}
            />
          </div>
          
          <div className="text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Estimated weekly mowing time:</span>
              <span className="font-medium">{weeklyMowingStats.estimatedHours.toFixed(1)} hours</span>
            </div>
          </div>
          
          {weeklyMowingStats.isOverCapacity && (
            <Alert variant="destructive" className="mt-2">
              <AlertTitle>Capacity Exceeded</AlertTitle>
              <AlertDescription>
                The total weekly mowing requirement exceeds the mower&apos;s capacity. 
                Please reduce zone sizes or frequencies.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      {/* Existing zones from mower */}
      {selectedMower.zones && selectedMower.zones.length > 0 && zones.length === 0 && (
        <Card className="p-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Detected Zones</h3>
            <p className="text-sm text-gray-600">We found {selectedMower.zones.length} zones configured for this mower</p>
          </div>
          <div className="flex justify-center">
            <Button onClick={useExistingZones}>
              Use Existing Zones
            </Button>
          </div>
        </Card>
      )}

      {/* Add zone form */}
      {showForm && (
        <Card className="p-4 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Add New Zone</h3>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowForm(false)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zoneName">Zone Name</Label>
                <Input
                  id="zoneName"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Front Yard"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="zoneAcreage">
                  Zone Size (acres)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 ml-1 inline-block text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-80">
                          Enter the approximate size of this zone in acres. 
                          For reference, 1 acre is about the size of a football field.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="zoneAcreage"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={zoneForm.acreage}
                  onChange={(e) => setZoneForm(prev => ({ ...prev, acreage: e.target.value }))}
                  placeholder="e.g., 0.25"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="zoneFrequency">Mowing Frequency</Label>
                <Select
                  value={zoneForm.frequency.toString()}
                  onValueChange={(value) => setZoneForm(prev => ({ ...prev, frequency: Number(value) }))}
                >
                  <SelectTrigger id="zoneFrequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(option => (
                      <SelectItem key={`new-${option.value}`} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button onClick={addZone} disabled={!zoneForm.name || !zoneForm.acreage}>
              Add Zone
            </Button>
          </div>
        </Card>
      )}

      {/* Zone List */}
      {zones.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Your Zones</h3>
          <div className="space-y-3">
            {zones.map((zone, index) => (
              <Card key={`zone-${zone.id || `idx-${index}`}`} className="p-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{zone.name}</h4>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleMapZone(zone)}
                        title="Map out this zone"
                      >
                        <MapPin size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeZone(zone.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Grid items within the Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Acreage Input */}
                    <div className="space-y-2">
                      <Label htmlFor={`acreage-${zone.id}`}>
                        Zone Size (acres)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 ml-1 inline-block text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="w-80">
                                Enter the approximate size of this zone in acres. 
                                For reference, 1 acre is about the size of a football field.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id={`acreage-${zone.id}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={zone.acreage}
                        onChange={(e) => updateZoneAcreage(zone.id, e.target.value)}
                        className={isZoneAcreageTooLarge(zone.acreage) ? 'border-red-300' : ''}
                      />
                      {isZoneAcreageTooLarge(zone.acreage) && (
                        <p className="text-xs text-red-500">
                          This acreage exceeds the recommended maximum for your mower model.
                        </p>
                      )}
                    </div>
                    
                    {/* Frequency Input */}
                    <div className="space-y-2">
                      <Label htmlFor={`frequency-${zone.id}`}>Mowing Frequency</Label>
                      <Select
                        value={zone.frequency.toString()}
                        onValueChange={(value) => updateZoneFrequency(zone.id, Number(value))}
                      >
                        <SelectTrigger id={`frequency-${zone.id}`}>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map(option => (
                            <SelectItem key={`${zone.id}-freq-${option.value}`} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Custom confirm dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zone Configuration</DialogTitle>
            <DialogDescription>
              You'll need to provide acreage estimates for each zone. Would you like to continue?
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUseExistingZones}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Acreage Mapper Dialog */}
      {selectedZoneForMapping && (() => {
        // Get existing polygon data if available
        const existingPolygon = selectedZoneForMapping.mapData?.polygon 
          ? selectedZoneForMapping.mapData.polygon 
          : [];
          
        // Log outside of JSX to avoid type issues
        console.log("Mower location data:", selectedMower.location);
        console.log("Selected zone for mapping:", selectedZoneForMapping);
        
        return (
          <AcreageMapper 
            isOpen={showMapDialog}
            onClose={() => setShowMapDialog(false)}
            onSaveAcreage={handleSaveAcreage}
            zoneName={selectedZoneForMapping.name}
            initialLocation={getMowerMapLocation()}
            existingPolygon={existingPolygon}
            existingAcreage={selectedZoneForMapping.acreage}
          />
        );
      })()}
    </div>
  );
} 