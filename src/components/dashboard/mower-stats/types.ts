import type { ReactNode } from "react";

export interface MowerMetric {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: ReactNode;
}

export interface ServiceHistoryItem {
  date: string;
  service: string;
  technician: string;
  isCompleted: boolean;
}

export interface AlertItem {
  date: string;
  message: string;
  severity: "warning" | "error" | "info";
}

export interface ChatItem {
  date: string;
  message: string;
  sender: string;
}

export interface MaintenanceItem {
  date: string;
  task: string;
  priority: "low" | "medium" | "high";
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  zones: Array<{
    name: string;
    color: string;
    id?: string;
  }>;
  day?: string;
  slots?: Array<{
    start: number;
    duration: number;
  }>;
}

export interface ScheduleItem {
  day?: string;
  timeSlots?: TimeSlot[];
  zone?: {
    name: string;
    color: string;
  };
}

export interface MowerStatsProps {
  mowerId?: string;
  mowerName?: string;
  mowerModel?: string;
  mowerImage?: string;
  mowerStatus?: 'idle' | 'mowing' | 'charging' | 'error' | 'offline' | 'returning' | 'parked' | 'online' | 'paused' | 'leaving';
  batteryLevel?: number;
  areaComplete?: string;
  currentZone?: string;
  schedule?: ScheduleItem[];
  serviceHistory?: ServiceHistoryItem[];
  recentAlerts?: AlertItem[];
  chatHistory?: ChatItem[];
  upcomingMaintenance?: MaintenanceItem[];
  metrics?: MowerMetric[];
  mowerZones?: { name: string; color: string }[];
  className?: string;
  hideTopCard?: boolean;
  onCommand?: (command: string, duration?: number, workAreaId?: number) => Promise<any>;
  supportsAreaCompletion?: boolean;
  workAreas?: Array<{
    name?: string;
    workAreaId?: number;
    cuttingHeight?: number;
    enabled?: boolean;
    progress?: number;
    lastCompleted?: number | string;
  }>;
  zones?: { name: string; color: string; workAreaId?: number }[];
  nextStartTime?: string;
  customScheduleComponent?: ReactNode;
}

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export interface ZoneSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  zones: { name: string; color: string; workAreaId?: number }[];
  onSelectZone: (zone: string, workAreaId?: number) => void;
}

export interface DurationSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedZone: { name: string; workAreaId?: number } | null;
  onSelectDuration: (duration: number, command: 'Start' | 'StartInWorkArea' | 'ResumeSchedule' | 'ParkUntilNextSchedule' | 'ParkUntilFurtherNotice') => void;
}

export interface MiniMapProps {
  mowerId?: string;
  currentZone?: string;
  batteryLevel?: number;
  areaComplete?: string;
}

export interface ScheduleViewProps {
  schedule?: ScheduleItem[];
  mowerId?: string;
  onScheduleRefresh?: () => void;
}

export interface BatteryLevelProps {
  level: number;
}

export interface AreaCompletionProps {
  value?: string;
  mowerId?: string;
}

export interface StatusIndicatorProps {
  status?: string;
  isPending?: boolean;
  pendingDescription?: string;
  batteryLevel?: number;
  isChargingWhileParked?: boolean;
} 