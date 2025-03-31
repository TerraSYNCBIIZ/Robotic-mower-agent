"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AreaCompletionProps } from "./types";

export function AreaCompletion({ value }: AreaCompletionProps) {
  // Parse percentage value, default to 0 if value is not provided
  const percentage = value ? Number.parseInt(value.replace('%', '').trim()) : 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Area Complete</span>
        <span className="text-muted-foreground">{value || "0%"}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-emerald-500/20">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
} 