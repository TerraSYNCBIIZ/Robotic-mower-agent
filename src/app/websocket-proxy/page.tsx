'use client';

import React from 'react';
import ProxyWebSocketStatus from '@/components/ProxyWebSocketStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, Server, Activity, Settings } from 'lucide-react';
import Link from 'next/link';

export default function WebSocketProxyPage() {
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WebSocket Proxy Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage the WebSocket proxy connection to Husqvarna API
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
      
      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">
            <Activity className="h-4 w-4 mr-2" />
            Status
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4 mr-2" />
            About
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="status" className="space-y-4">
          <ProxyWebSocketStatus />
        </TabsContent>
        
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proxy Server Configuration</CardTitle>
              <CardDescription>
                Configure the WebSocket proxy server settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                <p>The WebSocket proxy server should be running on a separate Node.js process.</p>
                <p>Check the <code>websocket-proxy</code> directory for server configuration.</p>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-2">
                  <div className="font-medium">Start the proxy server:</div>
                  <div className="bg-muted text-muted-foreground p-2 rounded text-sm font-mono">
                    cd websocket-proxy && npm start
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <div className="font-medium">Server health check:</div>
                  <div className="bg-muted text-muted-foreground p-2 rounded text-sm font-mono">
                    curl http://localhost:8080/health
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About the WebSocket Proxy</CardTitle>
              <CardDescription>
                How the WebSocket proxy works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <Server className="mr-2 h-5 w-5" />
                  Architecture
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  The WebSocket proxy is a standalone Node.js server that manages a persistent connection to the Husqvarna WebSocket API. It handles authentication, reconnection, and data processing.
                </p>
                <div className="mt-2 p-4 bg-muted rounded-md">
                  <div className="text-xs font-mono">
                    <div className="flex items-center justify-center space-x-4">
                      <div className="px-3 py-2 border rounded bg-background">Client App</div>
                      <div className="text-muted-foreground">↔️</div>
                      <div className="px-3 py-2 border rounded bg-background">WebSocket Proxy</div>
                      <div className="text-muted-foreground">↔️</div>
                      <div className="px-3 py-2 border rounded bg-background">Husqvarna API</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Benefits</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Persistent connection without timeout limitations</li>
                  <li>Simplified error handling and reconnection logic</li>
                  <li>Centralized logging for better debugging</li>
                  <li>Data throttling to prevent excessive database writes</li>
                  <li>Independent from client app lifecycle</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Implementation Details</h3>
                <p className="text-sm text-muted-foreground">
                  The proxy server uses the <code>ws</code> package for WebSocket functionality and connects to Husqvarna's API using OAuth2 authentication. It maintains the connection and handles token refresh automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 