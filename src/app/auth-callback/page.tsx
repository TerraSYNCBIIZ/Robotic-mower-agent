'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [isProcessed, setIsProcessed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  // Use useCallback to memoize the function and prevent recreation on every render
  const processAuth = useCallback(() => {
    // Prevent multiple processing attempts
    if (isProcessed) return;
    
    try {
      // Get parameters from URL
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const redirectTo = searchParams.get('redirect_to') || '/dashboard';

      // Validate required parameters
      if (!accessToken) {
        setError('Access token is missing from the callback');
        setIsProcessing(false);
        return;
      }

      // Call login to store the tokens in localStorage and cookies
      login(accessToken, refreshToken || '');
      
      // Mark as processed before redirecting
      setIsProcessed(true);
      setIsProcessing(false);

      // Redirect to the intended destination after a short delay
      // to ensure state updates are complete
      setTimeout(() => {
        router.push(redirectTo);
      }, 100);
    } catch (err) {
      console.error('Error processing authentication callback:', err);
      setError('Failed to process authentication. Please try again.');
      setIsProcessing(false);
    }
  }, [isProcessed, login, router, searchParams]);

  // Process authentication only once on mount
  useEffect(() => {
    if (!isProcessed) {
      processAuth();
    }
  }, [processAuth, isProcessed]);

  // Display loading state or error
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {isProcessing ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium">Completing authentication...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="p-4 bg-red-50 rounded-md border border-red-200 text-red-700">
            <p className="text-lg font-medium mb-2">Authentication Error</p>
            <p>{error}</p>
          </div>
          <button 
            type="button"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            onClick={() => router.push('/login')}
          >
            Return to Login
          </button>
        </div>
      )}
    </div>
  );
} 