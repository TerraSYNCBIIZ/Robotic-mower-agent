'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  // Handle Husqvarna OAuth callback if code is present in URL
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (code) {
      setIsProcessingAuth(true);
      
      // Forward the code to our callback API
      let callbackUrl = `/api/auth/husqvarna/callback?code=${encodeURIComponent(code)}`;
      if (state) {
        callbackUrl += `&state=${encodeURIComponent(state)}`;
      }
      
      // Redirect to our internal callback handler
      router.push(callbackUrl);
    }
  }, [searchParams, router]);

  if (isProcessingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Processing Authentication</h1>
          <p className="mb-4">Please wait while we complete your authentication...</p>
          <div className="animate-pulse h-2 bg-primary/30 rounded-full mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-2">MowerMind AI</h1>
        <p className="text-muted-foreground mb-6">Intelligent management for your robotic mowers</p>
        
        <div className="flex flex-col gap-4">
          <Button asChild className="w-full" size="lg">
            <Link href="/login">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full" size="lg">
            <Link href="/about">
              Learn More
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 