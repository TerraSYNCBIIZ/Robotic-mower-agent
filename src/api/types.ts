/**
 * Husqvarna Automower Connect API Type Definitions
 * 
 * These types are based on the official Husqvarna API documentation
 * and cover all available data points from the API.
 */

// Base JSON:API response structure
export interface JsonApiResponse<T> {
  data: T;
}

// Single mower response
export interface MowerResponse {
  data: MowerData;
}

// Multiple mower response
export interface MowersResponse {
  data: MowerData[];
}

// Mower data with all attributes
export interface MowerData {
  type: string; // Usually "mower"
  id: string;   // Mower UUID
  attributes: MowerAttributes;
}

// Complete mower attributes
export interface MowerAttributes {
  system: SystemInfo;
  battery: BatteryInfo;
  capabilities: Capabilities;
  mower: MowerStatus;
  calendar: Calendar;
  planner: Planner;
  metadata: Metadata;
  positions: Position[];
  settings: Settings;
  statistics?: Statistics;
  workAreas?: WorkArea[];
  stayOutZones?: StayOutZones;
}

// System information
export interface SystemInfo {
  name: string;
  model: string;
  serialNumber: number;
}

// Battery information
export interface BatteryInfo {
  batteryPercent: number;
}

// Mower capabilities
export interface Capabilities {
  headlights: boolean;
  workAreas: boolean;
  position: boolean;
  canConfirmError: boolean;
  stayOutZones: boolean;
}

// Mower status
export interface MowerStatus {
  mode: MowerMode;
  activity: MowerActivity;
  inactiveReason: InactiveReason;
  state: MowerState;
  workAreaId?: number;
  errorCode: number;
  errorCodeTimestamp: number;
  isErrorConfirmable: boolean;
}

// Mower operating modes
export type MowerMode = 'MAIN_AREA' | 'SECONDARY_AREA' | 'HOME' | 'DEMO' | 'UNKNOWN' | 'POI';

// Mower activities
export type MowerActivity = 
  | 'UNKNOWN' 
  | 'NOT_APPLICABLE' 
  | 'MOWING' 
  | 'GOING_HOME' 
  | 'CHARGING' 
  | 'LEAVING' 
  | 'PARKED_IN_CS' 
  | 'STOPPED_IN_GARDEN';

// Inactive reasons
export type InactiveReason = 'NONE' | 'PLANNING' | 'SEARCHING_FOR_SATELLITES';

// Mower states
export type MowerState = 
  | 'UNKNOWN'
  | 'PAUSED'
  | 'IN_OPERATION'
  | 'WAIT_UPDATING'
  | 'WAIT_POWER_UP'
  | 'RESTRICTED'
  | 'OFF'
  | 'STOPPED'
  | 'ERROR'
  | 'FATAL_ERROR'
  | 'ERROR_AT_POWER_UP';

// Calendar/schedule
export interface Calendar {
  tasks: CalendarTask[];
}

// Calendar task
export interface CalendarTask {
  start: number;       // Minutes after midnight
  duration: number;    // Duration in minutes
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  workAreaId?: number; // Optional for work area specific tasks
}

// Planner information
export interface Planner {
  nextStartTimestamp: number;
  override: PlannerOverride;
  restrictedReason: RestrictedReason;
  externalReason?: number;
}

// Planner override
export interface PlannerOverride {
  action: 'NOT_ACTIVE' | 'FORCE_PARK' | 'FORCE_MOW';
}

// Restricted reasons
export type RestrictedReason = 
  | 'NONE'
  | 'WEEK_SCHEDULE'
  | 'PARK_OVERRIDE'
  | 'SENSOR'
  | 'DAILY_LIMIT'
  | 'FOTA'
  | 'FROST'
  | 'ALL_WORK_AREAS_COMPLETED'
  | 'EXTERNAL'
  | 'NOT_APPLICABLE';

// Metadata
export interface Metadata {
  connected: boolean;
  statusTimestamp: number; // Milliseconds since epoch
}

// GPS position
export interface Position {
  latitude: number;
  longitude: number;
}

// Mower settings
export interface Settings {
  cuttingHeight: number; // 1-9
  headlight?: HeadlightSettings;
  timer?: TimerSettings;
}

// Headlight settings
export interface HeadlightSettings {
  mode: 'ALWAYS_ON' | 'ALWAYS_OFF' | 'EVENING_ONLY' | 'EVENING_AND_NIGHT';
}

// Timer settings
export interface TimerSettings {
  dateTime: number;      // Seconds since epoch
  timeZone: string;      // e.g., "Europe/Stockholm" or "GMT+2"
}

// Mower statistics
export interface Statistics {
  cuttingBladeUsageTime?: number;   // Seconds
  downTime?: number;                // Seconds
  numberOfChargingCycles?: number;
  numberOfCollisions?: number;
  totalChargingTime?: number;       // Seconds
  totalCuttingTime?: number;        // Seconds
  totalDriveDistance?: number;      // Meters
  totalRunningTime?: number;        // Seconds
  totalSearchingTime?: number;      // Seconds
  upTime?: number;                  // Seconds
}

// Work areas
export interface WorkArea {
  workAreaId: number;
  name: string;
  cuttingHeight: number;  // Percentage 0-100
  enabled: boolean;
  progress?: number;      // Percentage 0-100
  lastTimeCompleted?: number; // Seconds since epoch
}

// Work areas collection
export interface WorkAreasResponse {
  data: WorkAreaObject[];
}

// Work area object
export interface WorkAreaObject {
  type: string; // Usually "workArea"
  id: number;   // Work area ID
  attributes: WorkArea;
}

// Stay-out zones
export interface StayOutZones {
  dirty: boolean;
  zones: StayOutZone[];
}

// Stay-out zone
export interface StayOutZone {
  id: string;   // UUID
  name: string;
  enabled: boolean;
}

// Stay-out zones response
export interface StayOutZonesResponse {
  data: {
    type: string;
    id: string;
    attributes: StayOutZones;
  }
}

// Messages (error/warning history)
export interface MessagesResponse {
  data: {
    type: string;
    id: string;
    attributes: {
      messages: Message[];
    }
  }
}

// Message
export interface Message {
  time: number;      // Milliseconds since epoch in local time
  code: number;      // Error code
  severity: MessageSeverity;
  latitude?: number;
  longitude?: number;
}

// Message severity
export type MessageSeverity = 'FATAL' | 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' | 'SW' | 'UNKNOWN';

// Authentication

// Token response
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

// Command types
export type MowerCommandType = 
  | 'Start'
  | 'StartInWorkArea'
  | 'ResumeSchedule'
  | 'Pause'
  | 'Park'
  | 'ParkUntilNextSchedule'
  | 'ParkUntilFurtherNotice';

// Command response
export interface CommandResponse {
  data: {
    type: string;
    id: string;
  }
}

// Settings update types
export interface SettingsUpdate {
  cuttingHeight?: number;
  headlight?: {
    mode: 'ALWAYS_ON' | 'ALWAYS_OFF' | 'EVENING_ONLY' | 'EVENING_AND_NIGHT';
  };
  timer?: {
    dateTime: number;
    timeZone: string;
  };
}

// Error response
export interface ErrorResponse {
  errors: [
    {
      id: string;
      status: string;
      code: string;
      title: string;
      detail: string;
    }
  ]
}

// Complete mower data (combination of all API responses)
export interface CompleteMowerData {
  mower: MowerResponse;
  workAreas?: WorkAreasResponse;
  messages?: MessagesResponse;
  stayOutZones?: StayOutZonesResponse;
} 