'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('ProtectedRoute authentication check starting - isAuth:', isAuthenticated, 'hasToken:', !!token);
    
    if (checkedOnce) return;
    
    const timer = setTimeout(() => {
      console.log('ProtectedRoute authentication check completed - isAuth:', isAuthenticated, 'hasToken:', !!token);
      setIsLoading(false);
      setCheckedOnce(true);
      
      if (!isAuthenticated || !token) {
        console.log('Not authenticated, redirecting to login from protected route');
        router.push(`/login?from=${encodeURIComponent(pathname)}`);
      } else {
        console.log('Authentication confirmed, allowing access to protected route');
      }
    }, 100);
    
    const failsafeTimer = setTimeout(() => {
      if (isLoading) {
        console.log('Auth check failsafe triggered, proceeding anyway');
        setIsLoading(false);
        setCheckedOnce(true);
      }
    }, 3000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(failsafeTimer);
    };
  }, [isAuthenticated, router, pathname, token, isLoading, checkedOnce]);

  if (isLoading) {
    console.log('ProtectedRoute showing loading state');
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated || !token) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">Authentication Required</h3>
          <p className="mb-4">
            Please log in to view this page. You are being redirected to the login screen.
          </p>
          <div className="w-full h-1 bg-amber-300 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 