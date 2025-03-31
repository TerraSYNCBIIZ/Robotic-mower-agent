"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { BatteryLevelProps } from "./types";

export function BatteryLevel({ level }: BatteryLevelProps) {
  const batteryColorClass = 
    level > 60 
      ? "bg-emerald-500" 
      : level > 30 
      ? "bg-amber-500" 
      : "bg-red-500";

  const batteryTextClass = 
    level > 60 
      ? "text-emerald-500" 
      : level > 30 
      ? "text-amber-500" 
      : "text-red-500";

  const batteryBgClass = 
    level > 60 
      ? "bg-emerald-500/20" 
      : level > 30 
      ? "bg-amber-500/20" 
      : "bg-red-500/20";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Battery</span>
        <span className={batteryTextClass}>
          {level}%
        </span>
      </div>
      <div className={cn("w-full h-1.5 rounded-full overflow-hidden", batteryBgClass)}>
        <div
          className={cn("h-full rounded-full", batteryColorClass)}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  );
} 