'use client';

import { ProtectedRoute } from './ProtectedRoute';

interface ProtectedRouteWrapperProps {
  children: React.ReactNode;
}

export function ProtectedRouteWrapper({ children }: ProtectedRouteWrapperProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </ProtectedRoute>
  );
} 