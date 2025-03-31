'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function AuthDebugPage() {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [storedToken, setStoredToken] = useState<string>('');
  
  // Load token from localStorage on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem('mowerAccessToken');
    if (savedToken) {
      setStoredToken(savedToken);
      setToken(savedToken);
    }
  }, []);
  
  const testAuthentication = async (tokenToTest: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/test-auth?token=${encodeURIComponent(tokenToTest)}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container max-w-4xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Husqvarna API Authentication Debug</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Authentication</CardTitle>
          <CardDescription>
            Test connection to Husqvarna API with specific token
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <div className="mb-2 text-sm font-medium">Access Token</div>
              <Input 
                value={token} 
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your access token here"
                className="font-mono text-xs"
              />
            </div>
            <Button 
              onClick={() => testAuthentication(token)}
              disabled={isLoading || !token}
              className="mt-6"
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setToken(storedToken);
                testAuthentication(storedToken);
              }}
              disabled={!storedToken}
            >
              Use Stored Token
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (token) {
                  localStorage.setItem('mowerAccessToken', token);
                  setStoredToken(token);
                  alert('Token saved to localStorage');
                }
              }}
              disabled={!token}
            >
              Save Current Token
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Test Results
              <Badge className={
                result.authStatus === 'authenticated' ? 'bg-green-500' : 
                result.authStatus === 'failed' ? 'bg-red-500' : 
                'bg-yellow-500'
              }>
                {result.authStatus}
              </Badge>
            </CardTitle>
            <CardDescription>
              Test completed at {result.testTime}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="steps">
              <TabsList className="mb-4">
                <TabsTrigger value="steps">Test Steps</TabsTrigger>
                <TabsTrigger value="details">Config Details</TabsTrigger>
                <TabsTrigger value="raw">Raw Response</TabsTrigger>
              </TabsList>
              
              <TabsContent value="steps">
                <div className="space-y-4">
                  {result.steps?.map((step: any, index: number) => (
                    <div key={index} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          Step {step.step}: {step.action}
                        </div>
                        <Badge className={
                          step.status === 'completed' ? 'bg-green-500' : 
                          step.status === 'failed' ? 'bg-red-500' : 
                          'bg-yellow-500'
                        }>
                          {step.status}
                        </Badge>
                      </div>
                      
                      {step.status === 'completed' && step.mowersCount !== undefined && (
                        <div className="text-sm mt-2">
                          Found {step.mowersCount} mowers
                        </div>
                      )}
                      
                      {step.httpStatus && (
                        <div className="text-sm mt-2">
                          HTTP Status: {step.httpStatus} {step.statusText}
                        </div>
                      )}
                      
                      {step.error && (
                        <div className="text-sm text-red-500 mt-2">
                          Error: {typeof step.error === 'object' ? JSON.stringify(step.error, null, 2) : step.error}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {result.mowersCount > 0 && (
                    <div className="text-green-500 font-medium">
                      Successfully authenticated and found {result.mowersCount} mowers!
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="details">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">App Key</div>
                      <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        {result.appKey}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Client Secret</div>
                      <div className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        {result.clientSecret}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Request Headers</div>
                    <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                      {JSON.stringify(result.requestHeaders, null, 2)}
                    </pre>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="raw">
                <div className="space-y-2">
                  <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter>
            <div className="text-sm text-gray-500">
              {result.error ? (
                <div className="text-red-500">
                  Error: {typeof result.error === 'object' ? JSON.stringify(result.error, null, 2) : result.error}
                </div>
              ) : (
                "Authentication test completed"
              )}
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
} 