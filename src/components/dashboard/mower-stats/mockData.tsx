import React from "react";
import { Crop, Battery, Clock, Cog } from "lucide-react";
import { MowerMetric, ServiceHistoryItem, AlertItem, ChatItem, MaintenanceItem, ScheduleItem } from "./types";

export const defaultMetrics: MowerMetric[] = [
  {
    title: "Total Area Mowed",
    value: "12,450 m²",
    change: "+15.3% from last month",
    trend: "up",
    icon: <Crop className="h-4 w-4" />,
  },
  {
    title: "Battery Efficiency",
    value: "92%",
    change: "+2.5% from last month",
    trend: "up",
    icon: <Battery className="h-4 w-4" />,
  },
  {
    title: "Mowing Hours",
    value: "187.5 hrs",
    change: "-3.2% from last month",
    trend: "down",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    title: "Maintenance Score",
    value: "86/100",
    change: "No change",
    trend: "neutral",
    icon: <Cog className="h-4 w-4" />,
  },
];

export const defaultServiceHistory: ServiceHistoryItem[] = [
  {
    date: "2024-03-15",
    service: "Blade Replacement",
    technician: "John Smith",
    isCompleted: true,
  },
  {
    date: "2024-02-10",
    service: "Battery Check",
    technician: "Sarah Johnson",
    isCompleted: true,
  },
  {
    date: "2024-01-05",
    service: "Annual Maintenance",
    technician: "Mike Davis",
    isCompleted: true,
  },
];

export const defaultAlerts: AlertItem[] = [
  {
    date: "2024-03-20",
    message: "Obstacle detected - mower stopped",
    severity: "warning",
  },
  {
    date: "2024-03-18",
    message: "Battery level below 20%",
    severity: "info",
  },
  {
    date: "2024-03-10",
    message: "Blade motor overheated",
    severity: "error",
  },
];

export const defaultChatHistory: ChatItem[] = [
  {
    date: "2024-03-21",
    message: "When is the next scheduled maintenance?",
    sender: "User",
  },
  {
    date: "2024-03-21",
    message: "Your next maintenance is scheduled for April 5th. Would you like to reschedule?",
    sender: "Support",
  },
  {
    date: "2024-03-15",
    message: "I noticed the mower is making a strange noise when starting up.",
    sender: "User",
  },
];

export const defaultUpcomingMaintenance: MaintenanceItem[] = [
  {
    date: "2024-04-05",
    task: "Quarterly Maintenance Check",
    priority: "medium",
  },
  {
    date: "2024-04-15",
    task: "Blade Sharpening",
    priority: "low",
  },
  {
    date: "2024-04-30",
    task: "Software Update",
    priority: "high",
  },
];

export const defaultSchedule: ScheduleItem[] = [
  {
    day: "Monday",
    timeSlots: [
      {
        startTime: "09:00",
        endTime: "11:30",
        zones: [
          { name: "Front Yard", color: "#10b981" },
          { name: "Side Path", color: "#6366f1" }
        ]
      },
      {
        startTime: "14:00",
        endTime: "15:30",
        zones: [
          { name: "Garden Edges", color: "#f59e0b" }
        ]
      }
    ]
  },
  {
    day: "Tuesday",
    timeSlots: []
  },
  {
    day: "Wednesday",
    timeSlots: [
      {
        startTime: "10:30",
        endTime: "14:00",
        zones: [
          { name: "Back Yard", color: "#ef4444" },
          { name: "Patio Area", color: "#8b5cf6" }
        ]
      }
    ]
  },
  {
    day: "Thursday",
    timeSlots: []
  },
  {
    day: "Friday",
    timeSlots: [
      {
        startTime: "08:00",
        endTime: "11:30",
        zones: [
          { name: "Front Yard", color: "#10b981" },
          { name: "Garden", color: "#0ea5e9" }
        ]
      }
    ]
  },
  {
    day: "Saturday",
    timeSlots: [
      {
        startTime: "16:00",
        endTime: "18:00",
        zones: [
          { name: "Side Path", color: "#6366f1" },
          { name: "Driveway", color: "#d946ef" }
        ]
      }
    ]
  },
  {
    day: "Sunday",
    timeSlots: [
      {
        startTime: "15:00",
        endTime: "17:00",
        zones: [
          { name: "Garden", color: "#0ea5e9" }
        ]
      }
    ]
  }
]; 