'use client';

import { useState } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function HusqvarnaErrorHandler() {
  const { token, refreshToken } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{success?: boolean; message?: string} | null>(null);

  const handleResetSessions = async () => {
    try {
      setIsResetting(true);
      setResetResult(null);

      // Use the client credentials endpoint directly
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ useDirect: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResetResult({
          success: false,
          message: data.error || 'Failed to reset authentication'
        });
        return;
      }

      if (data.access_token) {
        setResetResult({
          success: true,
          message: 'Authentication reset successful. Reloading page...'
        });
        
        // Reload the page to reinitialize everything with the new token
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setResetResult({
          success: false,
          message: 'Reset completed but no token returned'
        });
      }
    } catch (error) {
      setResetResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="my-4">
      {resetResult && (
        <Alert variant={resetResult.success ? "default" : "destructive"} className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {resetResult.success ? 'Authentication Reset' : 'Reset Failed'}
          </AlertTitle>
          <AlertDescription>
            {resetResult.message}
          </AlertDescription>
        </Alert>
      )}
      
      <Button 
        onClick={handleResetSessions} 
        disabled={isResetting}
        variant="outline"
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
        {isResetting ? 'Resetting Authentication...' : 'Reset Husqvarna Authentication'}
      </Button>
      
      <p className="text-sm text-muted-foreground mt-2">
        Use this if you&apos;re experiencing authentication issues or having trouble connecting to your mowers.
      </p>
    </div>
  );
} 