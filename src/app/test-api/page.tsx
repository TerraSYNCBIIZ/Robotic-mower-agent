'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { husqvarnaApi } from '@/lib/husqvarna/api-client';

export default function TestApiPage() {
  const [apiResult, setApiResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<any>(null);
  
  // Get the token details on mount
  useEffect(() => {
    const token = husqvarnaApi.getAccessToken();
    if (token) {
      try {
        // If it's a JWT token, decode it
        if (token.includes('.') && token.split('.').length === 3) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setTokenDetails({
            type: 'oauth',
            payload,
            expires: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'Unknown'
          });
        } else if (token.startsWith('directapi.')) {
          // If it's our synthetic token, decode it
          const payload = JSON.parse(atob(token.split('.')[1]));
          setTokenDetails({
            type: 'synthetic',
            payload,
            expires: payload.exp ? new Date(payload.exp).toLocaleString() : 'Unknown'
          });
        }
      } catch (e) {
        setTokenDetails({
          type: 'unknown',
          error: 'Failed to decode token'
        });
      }
    }
  }, []);
  
  // Test getting all mowers
  const testGetMowers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mowers = await husqvarnaApi.getMowers();
      setApiResult(mowers);
    } catch (err) {
      console.error('Error testing API:', err);
      setError((err as Error).message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Force token refresh
  const forceRefreshToken = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setApiResult({
          message: 'Token refreshed successfully',
          ...data
        });
        // Reload to apply new token
        window.location.reload();
      } else {
        setError(`Failed to refresh token: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError((err as Error).message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Husqvarna API Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>API Authentication</CardTitle>
          <CardDescription>Current authentication status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Status:</div>
              <div>{husqvarnaApi.isAuthenticated() ? '✅ Authenticated' : '❌ Not Authenticated'}</div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="font-medium">API Key:</div>
              <div>{husqvarnaApi.getApiKey() ? 
                `${husqvarnaApi.getApiKey()?.substring(0, 8)}...` : 
                '❌ Not Available'}
              </div>
            </div>
            
            {tokenDetails && (
              <>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Token Type:</div>
                  <div>{tokenDetails.type}</div>
                </div>
                
                {tokenDetails.expires && (
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Token Expires:</div>
                    <div>{tokenDetails.expires}</div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <div className="font-medium">Token Format:</div>
                  <div>{(tokenDetails.payload?.scope || 
                    (tokenDetails.payload?.type === 'direct_api')) ? 
                    '✅ Valid' : '❌ Invalid'}</div>
                </div>
                
                {tokenDetails.payload && (
                  <div className="mt-2">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">Token Details</summary>
                      <pre className="mt-2 p-2 text-xs bg-muted rounded-md overflow-auto max-h-96">
                        {JSON.stringify(tokenDetails.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 items-start">
          <Button onClick={forceRefreshToken} disabled={isLoading} className="w-full">
            {isLoading ? 'Refreshing...' : 'Force Refresh Token'}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            This will get a new token from the Husqvarna API using client credentials
          </p>
        </CardFooter>
      </Card>
      
      <Tabs defaultValue="mowers">
        <TabsList>
          <TabsTrigger value="mowers">Mowers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="mowers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Mower API Test</CardTitle>
              <CardDescription>Test retrieving mowers from the Husqvarna API</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={testGetMowers} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Test Get Mowers'}
              </Button>
              
              <Separator className="my-4" />
              
              {error && (
                <div className="p-4 mt-4 bg-red-100 text-red-800 rounded-md">
                  <h3 className="font-bold mb-2">Error</h3>
                  <p>{error}</p>
                </div>
              )}
              
              {apiResult && (
                <div className="mt-4">
                  <h3 className="font-bold mb-2">API Response</h3>
                  <pre className="p-4 bg-muted rounded-md overflow-auto max-h-96 text-xs">
                    {JSON.stringify(apiResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 