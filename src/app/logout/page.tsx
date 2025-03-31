'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function LogoutPage() {
  const { logout, isAuthenticated } = useAuth();
  const router = useRouter();

  // Automatically logout when this page loads
  useEffect(() => {
    if (isAuthenticated) {
      logout();
      
      // Small delay to ensure logout is complete before redirecting
      const redirectTimer = setTimeout(() => {
        router.push('/');
        router.refresh(); // Force a full refresh to clear any remaining state
      }, 500);
      
      return () => clearTimeout(redirectTimer);
    }
    
    // Already logged out, redirect immediately
    router.push('/');
  }, [logout, router, isAuthenticated]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg text-center">
        <LogOut className="w-16 h-16 mx-auto text-primary" />
        <h1 className="text-2xl font-bold">Logging Out</h1>
        <p className="text-muted-foreground">Please wait while we sign you out securely...</p>
        
        <div className="flex justify-center mt-6">
          <div className="w-16 h-1 bg-primary animate-pulse rounded-full" />
        </div>
        
        <div className="pt-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/')}
            className="mt-4"
          >
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
} 