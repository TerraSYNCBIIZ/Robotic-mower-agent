export interface MowerCapabilities {
  workAreas?: boolean;
  position?: boolean;
  headlights?: boolean;
  stayOutZones?: boolean;
  canConfirmError?: boolean;
}

export interface WorkAreaProgress {
  workAreaId: number;
  name: string;
  progress: number;
  lastCompleted?: number;
  enabled?: boolean;
  cuttingHeight?: number;
}

export interface Mower {
  id: string;
  name: string;
  status: string;
  batteryLevel: number;
  areaComplete?: string;
  errorMessage?: string | null;
  lastUpdated?: Date;
  model?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  dataSource?: string;
  zones?: Array<{
    name: string;
    color: string;
    workAreaId?: number;
  }>;
  capabilities?: MowerCapabilities;
  isChargingWhileParked?: boolean;
  nextStartTime?: string;
  workAreaProgress?: WorkAreaProgress[];
} 