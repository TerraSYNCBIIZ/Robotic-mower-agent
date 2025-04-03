import React from 'react';

interface ScheduleTabProps {
  mowerId: string;
}

export function ScheduleTab({ mowerId }: ScheduleTabProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-3">Schedule functionality is coming soon</p>
          <p className="text-sm text-muted-foreground">We're building a better schedule interface for your mower.</p>
        </div>
      </div>
    </div>
  );
} 