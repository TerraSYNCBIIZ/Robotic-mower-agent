'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Key, Lock, LogIn } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('from') || '/dashboard';
  const [mounted, setMounted] = useState(false);

  // If already authenticated, redirect to the dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
    // Set mounted to true after initial render to prevent double rendering
    setMounted(true);
  }, [isAuthenticated, router, redirectTo]);

  const handleLoginWithHusqvarna = () => {
    setIsLoading(true);
    setError(null);
    
    // Redirect to Husqvarna login/OAuth page
    window.location.href = `/api/auth/login?redirect=${encodeURIComponent(redirectTo)}`;
  };

  // Don't render anything until component is mounted
  if (!mounted) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background" key="login-page-container">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Key className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Connect with your Husqvarna account to manage your mowers
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <Button 
            className="w-full flex gap-2 items-center justify-center" 
            onClick={handleLoginWithHusqvarna}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            Sign in with Husqvarna
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Need help connecting your mower? <Link href="/help" className="underline underline-offset-4 hover:text-primary">View Help Guide</Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 