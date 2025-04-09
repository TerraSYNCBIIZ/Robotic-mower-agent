'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

/**
 * WebSocket page that redirects to the new WebSocket proxy page
 */
export default function WebSocketPage() {
  const router = useRouter();
  
  // Auto-redirect after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/websocket-proxy');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">WebSocket</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>WebSocket Implementation Updated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The WebSocket implementation has been updated to use a dedicated proxy server for improved reliability.
          </p>
          <p>
            You will be redirected to the new WebSocket management page automatically in 5 seconds.
          </p>
          <Button 
            onClick={() => router.push('/websocket-proxy')}
            className="flex items-center gap-2"
          >
            Go to WebSocket Proxy Management
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 