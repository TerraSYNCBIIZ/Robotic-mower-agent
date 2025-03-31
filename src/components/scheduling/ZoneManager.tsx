import React, { useState } from 'react';
import { MowerData, ZoneData } from './MowerScheduler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash, PlusCircle, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ZoneManagerProps {
  mower: MowerData;
  zones: ZoneData[];
  onZonesUpdate: (zones: ZoneData[]) => void;
}

const ZoneManager: React.FC<ZoneManagerProps> = ({ mower, zones, onZonesUpdate }) => {
  const [zoneName, setZoneName] = useState('');
  const [zoneAcreage, setZoneAcreage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddZone = () => {
    if (!zoneName.trim()) {
      setError('Zone name is required');
      return;
    }

    const acreage = parseFloat(zoneAcreage);
    if (isNaN(acreage) || acreage <= 0) {
      setError('Please enter a valid acreage greater than 0');
      return;
    }

    const newZone: ZoneData = {
      id: `zone-${Date.now()}`, // Generate a unique ID
      name: zoneName.trim(),
      acreage: acreage
    };

    onZonesUpdate([...zones, newZone]);
    setZoneName('');
    setZoneAcreage('');
    setError(null);
  };

  const handleRemoveZone = (zoneId: string) => {
    onZonesUpdate(zones.filter(zone => zone.id !== zoneId));
  };

  const handleUpdateZoneAcreage = (zoneId: string, newAcreage: string) => {
    const acreage = parseFloat(newAcreage);
    if (isNaN(acreage) || acreage <= 0) {
      return; // Don't update with invalid values
    }

    onZonesUpdate(
      zones.map(zone => 
        zone.id === zoneId 
          ? { ...zone, acreage: acreage } 
          : zone
      )
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Configure Work Areas for {mower.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define the zones that your mower will work in and their sizes
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add New Zone</CardTitle>
          <CardDescription>
            Create a new work area for your mower
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zone-name">Zone Name</Label>
                <Input
                  id="zone-name"
                  placeholder="e.g., Front Yard"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-acreage">Size (acres)</Label>
                <Input
                  id="zone-acreage"
                  type="number"
                  placeholder="e.g., 0.25"
                  step="0.01"
                  min="0.01"
                  value={zoneAcreage}
                  onChange={(e) => setZoneAcreage(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleAddZone}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" /> Add Zone
          </Button>
        </CardFooter>
      </Card>

      {zones.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map(zone => (
            <Card key={zone.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{zone.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveZone(zone.id)}
                    className="h-8 w-8 text-destructive"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor={`acreage-${zone.id}`} className="text-sm">
                    Size (acres)
                  </Label>
                  <Input
                    id={`acreage-${zone.id}`}
                    type="number"
                    value={zone.acreage?.toString() || ''}
                    onChange={(e) => handleUpdateZoneAcreage(zone.id, e.target.value)}
                    step="0.01"
                    min="0.01"
                    className="h-8 text-sm"
                  />
                </div>
                
                <div className="mt-2 text-xs text-muted-foreground">
                  {zone.acreage && (
                    <p>Estimated mowing time: {Math.round(zone.acreage * 60)} minutes</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <h3 className="font-medium text-muted-foreground">No Zones Added Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add at least one zone to create a mowing schedule
          </p>
        </div>
      )}
    </div>
  );
};

export default ZoneManager; 