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
  zones: {
    name: string;
    color: string;
  }[];
}

export interface ScheduleItem {
  day: string;
  timeSlots: TimeSlot[];
}

export interface MowerStatsProps {
  mowerName?: string;
  mowerModel?: string;
  mowerImage?: string;
  mowerId?: string;
  batteryLevel?: number;
  areaComplete?: string;
  status?: 'mowing' | 'charging' | 'idle' | 'error' | 'offline' | 'returning' | 'parked' | 'online' | 'paused';
  currentZone?: string;
  metrics?: MowerMetric[];
  serviceHistory?: ServiceHistoryItem[];
  recentAlerts?: AlertItem[];
  chatHistory?: ChatItem[];
  upcomingMaintenance?: MaintenanceItem[];
  schedule?: ScheduleItem[];
  zones?: Array<{name: string, color: string, workAreaId?: number}>;
  className?: string;
  hideTopCard?: boolean;
  supportsAreaCompletion?: boolean;
  onCommand?: (command: string, duration?: number) => Promise<{ success: boolean; message?: string } | null>;
}

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export interface ZoneSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  zones: { name: string; color: string }[];
  onSelectZone: (zone: string) => void;
}

export interface MiniMapProps {
  mowerId?: string;
  currentZone?: string;
  batteryLevel?: number;
  areaComplete?: string;
}

export interface ScheduleViewProps {
  schedule?: ScheduleItem[];
}

export interface BatteryLevelProps {
  level: number;
}

export interface AreaCompletionProps {
  value?: string;
}

export interface StatusIndicatorProps {
  status: string;
} 