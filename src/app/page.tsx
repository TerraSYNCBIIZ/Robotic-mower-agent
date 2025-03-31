'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Bot, Clock, Home, Map, Settings } from 'lucide-react';

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
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-background to-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Husqvarna Robotic Mower Control
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Smart mower management with intuitive controls and AI assistance.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-center gap-2">
                  <Button asChild size="lg">
                    <Link href="/dashboard">
                      Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/chat">
                      AI Assistant
                      <Bot className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="space-y-4">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
                  Intelligent Control
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                  Talk to Your Mower
                </h2>
                <p className="max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our new AI Assistant lets you control your mower with natural language. Ask questions, give commands, and get real-time updates about your lawn care.
                </p>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild>
                    <Link href="/chat">
                      Try MowerMind AI
                      <Bot className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <li className="flex items-center gap-2 rounded-lg border p-4">
                    <Home className="h-5 w-5 text-primary" />
                    <div className="font-medium">Smart Scheduling</div>
                  </li>
                  <li className="flex items-center gap-2 rounded-lg border p-4">
                    <Clock className="h-5 w-5 text-primary" />
                    <div className="font-medium">Real-time Monitoring</div>
                  </li>
                  <li className="flex items-center gap-2 rounded-lg border p-4">
                    <Map className="h-5 w-5 text-primary" />
                    <div className="font-medium">GPS Tracking</div>
                  </li>
                  <li className="flex items-center gap-2 rounded-lg border p-4">
                    <Settings className="h-5 w-5 text-primary" />
                    <div className="font-medium">Complete Control</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full border-t items-center px-4 md:px-6">
        <p className="text-xs text-muted-foreground">
          © 2024 Husqvarna Robotic Mower Assistant. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
} 