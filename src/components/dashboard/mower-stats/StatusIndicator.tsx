"use client";

import React from "react";
import { StatusIndicatorProps } from "./types";

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "mowing":
        return { label: "Mowing", color: "bg-emerald-500", textColor: "text-emerald-500" };
      case "charging":
        return { label: "Charging", color: "bg-blue-500", textColor: "text-blue-500" };
      case "parked":
        return { label: "Parked", color: "bg-slate-500", textColor: "text-slate-500" };
      case "returning":
        return { label: "Returning Home", color: "bg-indigo-500", textColor: "text-indigo-500" };
      case "idle":
        return { label: "Idle", color: "bg-gray-400", textColor: "text-gray-400" };
      case "error":
        return { label: "Error", color: "bg-red-500", textColor: "text-red-500" };
      case "offline":
        return { label: "Offline", color: "bg-gray-600", textColor: "text-gray-600" };
      case "online":
        return { label: "Online", color: "bg-emerald-500", textColor: "text-emerald-500" };
      case "paused":
        return { label: "Paused", color: "bg-amber-500", textColor: "text-amber-500" };
      default:
        return { label: "Unknown", color: "bg-gray-400", textColor: "text-gray-400" };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
      <span className={`text-sm font-medium ${config.textColor}`}>
        {config.label}
      </span>
    </div>
  );
} 