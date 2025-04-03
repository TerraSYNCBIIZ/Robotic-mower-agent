"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AreaCompletionProps } from "./types";

export function AreaCompletion({ value, mowerId }: AreaCompletionProps) {
  // Add local state to track the value for better persistence
  const [localValue, setLocalValue] = useState<string>(value || "0%");
  
  // Update local state when props change
  useEffect(() => {
    if (value) {
      setLocalValue(value);
    }
  }, [value]);
  
  // Listen for area completion updates if mowerId is provided
  useEffect(() => {
    if (!mowerId) return;
    
    const handleAreaCompletionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.mowerId === mowerId && customEvent.detail?.areaComplete) {
        console.log(`AreaCompletion: Received update for mower ${mowerId}: ${customEvent.detail.areaComplete}`);
        setLocalValue(customEvent.detail.areaComplete);
      }
    };
    
    window.addEventListener('mower-area-completion-updated', handleAreaCompletionUpdate);
    
    return () => {
      window.removeEventListener('mower-area-completion-updated', handleAreaCompletionUpdate);
    };
  }, [mowerId]);
  
  // Parse percentage value, default to 0 if value is not provided
  const percentage = localValue ? Number.parseInt(localValue.replace('%', '').trim()) : 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Area Complete</span>
        <span className="text-muted-foreground">{localValue}</span>
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