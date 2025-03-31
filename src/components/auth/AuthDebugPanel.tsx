import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { useHusqvarnaAuth } from '@/contexts/AuthProvider';

export default function AuthDebugPanel() {
  const { token, isAuthenticated, refreshToken, logout } = useHusqvarnaAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Function to get auth debug info
  const getDebugInfo = async () => {
    try {
      const response = await fetch('/api/auth/debug');
      const data = await response.json();
      console.log('Auth debug info:', data);
    } catch (error) {
      console.error('Error getting debug info:', error);
    }
  };
  
  // Function to force refresh token
  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Token refreshed successfully');
        
        // Force reload the page to update the app with new token
        window.location.reload();
      } else {
        toast.error(`Failed to refresh token: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Error refreshing token');
      console.error('Error refreshing token:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Calculate token expiry time if possible
  let tokenExpiry = null;
  try {
    if (token && token.split('.').length > 1) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp) {
        tokenExpiry = new Date(payload.exp * 1000);
      }
    }
  } catch (e) {
    console.log('Not a valid JWT token or no expiry');
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Authentication Debug</CardTitle>
        <CardDescription>Troubleshoot authentication issues</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">Status:</div>
            <Badge variant={isAuthenticated ? "success" : "destructive"}>
              {isAuthenticated ? "Authenticated" : "Not Authenticated"}
            </Badge>
          </div>
          
          {tokenExpiry && (
            <div className="flex items-center justify-between">
              <div className="font-medium">Token Expires:</div>
              <div>{tokenExpiry.toLocaleString()}</div>
            </div>
          )}
          
          <Separator className="my-2" />
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={getDebugInfo}
            >
              Debug Token
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleForceRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Force Refresh Token'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                logout();
                toast.success('Logged out successfully');
              }}
            >
              Debug Reset
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Use these tools only for debugging purposes
      </CardFooter>
    </Card>
  );
} 