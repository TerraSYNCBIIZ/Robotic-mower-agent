'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { usePathname } from 'next/navigation';

export default function MowersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  
  // Don't wrap /mowers/add with protection as it handles OAuth callbacks
  if (pathname === '/mowers/add') {
    return <>{children}</>;
  }
  
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
} 