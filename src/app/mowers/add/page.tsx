"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HusqvarnaClient } from "@/lib/husqvarna/api";
import type { MowerData } from "@/lib/husqvarna/api";
import { useAuth } from "@/components/layout/AuthProvider";
import { toast } from "sonner";

export default function AddMowerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mowers, setMowers] = useState<MowerData[]>([]);
  const codeProcessed = useRef(false);
  const { login } = useAuth();

  // Handle OAuth redirect callback
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    
    if (code && !codeProcessed.current) {
      console.log("Received authorization code, processing...");
      codeProcessed.current = true;
      // Clear any existing URL parameters to prevent reusing the code
      if (window.history?.replaceState) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
      handleOAuthCallback(code);
    }
  }, [searchParams]);

  // Connect with Husqvarna
  const startAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const client = new HusqvarnaClient();
      // Use a hardcoded redirect URI to ensure exact match with developer portal
      const redirectUri = "http://localhost:3000/mowers/add";
      const authUrl = client.getAuthorizationUrl(redirectUri);
      
      // Redirect to Husqvarna for auth
      window.location.href = authUrl;
    } catch (err) {
      console.error("Failed to start auth process:", err);
      setError("Failed to start the authentication process. Please try again.");
      setIsLoading(false);
    }
  };

  // Handle OAuth callback after user authorizes with Husqvarna
  const handleOAuthCallback = async (code: string) => {
    try {
      setIsLoading(true);
      
      // Call our API endpoint instead of directly using the client
      // Use the same hardcoded redirect URI for consistency
      const redirectUri = "http://localhost:3000/mowers/add";
      console.log("Sending auth code to server with redirectUri:", redirectUri);
      
      const response = await fetch('/api/mowers/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirectUri }),
      });
      
      // Get the response data
      let data: { 
        success?: boolean; 
        message?: string; 
        mowers?: MowerData[]; 
        authData?: {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          provider: string;
          user_id: string;
          token_type: string;
        };
        error?: string;
        details?: string;
      };
      
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Error parsing response:", jsonError);
        throw new Error(`Failed to parse server response: ${await response.text()}`);
      }
      
      // Handle successful response or detailed error
      if (!response.ok) {
        // If we already have a success state (from another handler run), ignore this error
        if (success) {
          console.warn("Ignoring secondary error, authentication already succeeded");
          return;
        }
        
        const errorText = data.details || data.error || response.statusText;
        throw new Error(`Authentication failed: ${errorText}`);
      }
      
      // Set mowers from response
      setMowers(data.mowers || []);
      setSuccess(true);
      setIsLoading(false);
      
      // Store authentication tokens in localStorage with safety checks
      if (typeof window !== 'undefined' && data.authData && data.authData.access_token) {
        // Use the AuthProvider login method to set up auth and initialize WebSocket
        login(
          data.authData.access_token, 
          data.authData.refresh_token || ''
        );
        
        // Store token expiry time
        localStorage.setItem('mowerTokenExpiry', (Date.now() + (data.authData.expires_in * 1000)).toString());
        
        console.log("Authentication tokens stored and WebSocket initialized");
        toast.success("Connected successfully. Real-time updates enabled.");
      }
      
      // Log success
      console.log("Authentication successful, mowers:", data.mowers ? data.mowers.length : 0);
      
      // Redirect to dashboard immediately after auth is complete
      setTimeout(() => {
        router.push('/dashboard');
        // Force a full page refresh to ensure auth state is consistent
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err) {
      // If we already have a success state (from another handler run), ignore this error
      if (success) {
        console.warn("Ignoring error, authentication already succeeded");
        return;
      }
      
      console.error("Failed to complete auth:", err);
      setError(`Failed to complete the authentication process: ${(err as Error).message}`);
      setIsLoading(false);
    }
  };

  // If successful, show success message
  if (success) {
    return (
      <div className="container mx-auto max-w-md py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Success!</CardTitle>
            <CardDescription>
              Your Husqvarna account has been successfully connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-10 w-10" />
            </div>
            <p className="text-muted-foreground">
              {mowers.length === 0 
                ? "No mowers found in your account."
                : `Found ${mowers.length} mower${mowers.length > 1 ? 's' : ''} in your account.`}
            </p>
            {mowers.length > 0 && (
              <div className="mt-4 text-left">
                <h4 className="font-medium mb-2">Connected Mowers:</h4>
                <ul className="space-y-2">
                  {mowers.map(mower => (
                    <li key={mower.id} className="p-2 bg-secondary/50 rounded-md text-sm">
                      {mower.attributes.system.name} ({mower.attributes.system.model})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                Go to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add Your Mower</CardTitle>
          <CardDescription>
            Connect your Husqvarna Automower to MowerMind AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">How it works</h3>
            <p className="text-sm text-muted-foreground">
              1. Click the "Connect with Husqvarna" button below
            </p>
            <p className="text-sm text-muted-foreground">
              2. You'll be redirected to Husqvarna to authorize access
            </p>
            <p className="text-sm text-muted-foreground">
              3. Sign in with your Husqvarna account credentials
            </p>
            <p className="text-sm text-muted-foreground">
              4. Once authorized, your mowers will be automatically imported
            </p>
          </div>
          
          {error && (
            <div className="p-3 text-sm bg-red-500/10 border border-red-500/20 text-red-500 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={startAuth} 
            disabled={isLoading} 
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect with Husqvarna
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 