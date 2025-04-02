'use client';

import { Suspense } from 'react';
import DataRefreshPanel from './DataRefreshPanel';
import MowerDataStatus from './MowerDataStatus';

// Other imports and components you may already have...

export default function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Robotic Mower Dashboard</h1>
      
      {/* Add the refresh panel at the top of the dashboard */}
      <Suspense fallback={<div className="bg-white shadow rounded-lg p-4 mb-6 h-32 animate-pulse"></div>}>
        <DataRefreshPanel />
      </Suspense>
      
      {/* Add the data status panel */}
      <Suspense fallback={<div className="bg-white shadow rounded-lg p-4 mb-6 h-64 animate-pulse"></div>}>
        <MowerDataStatus />
      </Suspense>
      
      {/* Your existing dashboard content goes here */}
      {/* For example, maps, mower status cards, controls, etc. */}
    </div>
  );
} 