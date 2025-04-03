"use client";

import React, { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { ScheduleItem } from '@/components/dashboard/mower-stats/types';
import MowerSchedule from '@/components/dashboard/mower-stats/MowerSchedule';
import { useMowerData } from '@/contexts/MowerDataContext';

export default function TestSchedulePage() {
  const [mowerId, setMowerId] = useState<string>('test-mower-1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Schedule Test Page</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : error ? (
        <div className="border border-red-300 bg-red-50 p-4 rounded-md text-red-800">
          {error}
        </div>
      ) : (
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-lg font-medium mb-4">Weekly Schedule View (New Component)</h2>
          <MowerSchedule mowerId={mowerId} />
          <p className="mt-4 text-xs text-muted-foreground">
            Note: This page uses the new consolidated MowerSchedule component. The previous ScheduleView component has been replaced.
          </p>
        </div>
      )}
    </div>
  );
} 