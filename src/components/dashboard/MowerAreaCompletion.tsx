'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MowerAreaCompletionProps {
  mowerId: string;
  initialValue?: string;
  className?: string;
}

export function MowerAreaCompletion({
  mowerId,
  initialValue = 'N/A',
  className
}: MowerAreaCompletionProps) {
  const [areaComplete, setAreaComplete] = useState<string>(initialValue);
  
  // Update local state when prop changes
  useEffect(() => {
    if (initialValue && initialValue !== 'N/A') {
      setAreaComplete(initialValue);
    }
  }, [initialValue]);
  
  // Parse percentage value, default to 0 if areaComplete is not provided or is N/A
  const percentage = (areaComplete && areaComplete !== 'N/A')
    ? Math.min(Math.max(parseInt(areaComplete.replace('%', '').trim()) || 0, 1), 100)
    : 0;
  
  const hasData = areaComplete && areaComplete !== 'N/A';
  
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Area Complete</span>
        <span className="text-muted-foreground">{hasData ? areaComplete : 'N/A'}</span>
      </div>
      
      {hasData ? (
        <div className="w-full h-1.5 rounded-full overflow-hidden bg-emerald-500/20">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-600/20">
          <div className="h-full bg-gray-300 dark:bg-gray-500/20 rounded-full w-full text-[8px] flex items-center justify-center overflow-hidden">
            <span className="text-muted-foreground truncate px-1">Waiting for data...</span>
          </div>
        </div>
      )}
    </div>
  );
} 