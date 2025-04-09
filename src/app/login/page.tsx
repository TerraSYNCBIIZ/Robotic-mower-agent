'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Key, Lock, LogIn } from 'lucide-react';
import Link from 'next/link';
import { MowerDataService } from '@/lib/husqvarna/mowerDataService';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('from') || '/dashboard';
  const [mounted, setMounted] = useState(false);
  const [isSyncingData, setSyncingData] = useState(false);

  // If already authenticated, redirect to the dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
    // Set mounted to true after initial render to prevent double rendering
    setMounted(true);
  }, [isAuthenticated, router, redirectTo]);

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate login with a demo token
      setTimeout(() => {
        const demoToken = `demo_token_${Date.now()}`;
        const refreshToken = `demo_refresh_${Date.now()}`;
        login(demoToken, refreshToken);
        
        // After login, sync mower data with Firebase
        syncMowerDataWithFirebase();
      }, 1000);
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError('Failed to log in. Please try again.');
      setIsLoading(false);
    }
  };

  // Function to sync mower data with Firebase after login
  const syncMowerDataWithFirebase = async () => {
    setSyncingData(true);
    
    try {
      // Show loading toast
      const syncToast = toast.loading('Syncing mower data...');
      
      // Initialize MowerDataService
      const mowerService = new MowerDataService();
      
      // Fetch mowers from API and store in Firebase
      await mowerService.fetchAndStoreMowersToFirebase();
      
      // Complete loading toast
      toast.dismiss(syncToast);
      toast.success('Mower data synced successfully');
      
      // Redirect to dashboard
      router.push(redirectTo);
    } catch (syncError) {
      console.error('Error syncing mower data:', syncError);
      toast.error('Failed to sync mower data, but login succeeded');
      
      // Still redirect to dashboard even if sync fails
      router.push(redirectTo);
    } finally {
      setSyncingData(false);
      setIsLoading(false);
    }
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
            Sign in to manage your robotic mowers
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          {/* In a real app, this would be a form with username/password */}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="example@domain.com" disabled={isLoading} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" disabled={isLoading} />
          </div>
          
          <Button 
            className="w-full flex gap-2 items-center justify-center" 
            onClick={handleDemoLogin}
            disabled={isLoading || isSyncingData}
          >
            {isLoading || isSyncingData ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Signing in...' : isSyncingData ? 'Syncing data...' : 'Sign in (Demo Mode)'}
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