'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'react-hot-toast';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  HelpCircle,
  KeyRound,
  Lock,
  LucideIcon,
  RefreshCcw,
  Send,
  Settings,
  Terminal,
  UserCheck,
  UserPlus,
  Wifi
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ProxyWebSocketStatus from '@/components/ProxyWebSocketStatus';

// Example API endpoints from Husqvarna API docs
const API_ENDPOINTS = [
  {
    name: 'OAuth - Get Token',
    endpoint: 'https://api.authentication.husqvarnagroup.dev/v1/oauth2/token',
    method: 'POST',
    description: 'Get authentication token',
    params: { grant_type: 'client_credentials' },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    requiresAuth: false,
  },
  {
    name: 'Get Mowers',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers',
    method: 'GET',
    description: 'Get all mowers',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    requiresAuth: true,
  },
  {
    name: 'Get Mower Details',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}',
    method: 'GET',
    description: 'Get details for a specific mower',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    requiresAuth: true,
  },
  {
    name: 'Get Mower Work Areas',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/workAreas',
    method: 'GET',
    description: 'Get work areas for a specific mower',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    requiresAuth: true,
  },
  {
    name: 'Get Mower Messages',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/messages',
    method: 'GET',
    description: 'Get error and warning messages for a mower',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    requiresAuth: true,
  },
  {
    name: 'Get Mower Stay-Out Zones',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/stayOutZones',
    method: 'GET',
    description: 'Get stay-out zones for a mower',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    requiresAuth: true,
  },
  {
    name: 'Start Mower',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Start mowing for a specified duration',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'Start',
        attributes: {
          duration: 60 // minutes
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Start Mower in Work Area',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Start mowing in a specific work area',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'StartInWorkArea',
        attributes: {
          workAreaId: 123, // requires a valid work area ID
          duration: 60 // minutes
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Pause Mower',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Pause the mower',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'Pause'
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Park Mower',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Park the mower for a specific duration',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'Park',
        attributes: {
          duration: 120 // minutes
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Park Until Next Schedule',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Park the mower until the next scheduled task',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'ParkUntilNextSchedule'
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Park Until Further Notice',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Park the mower indefinitely',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'ParkUntilFurtherNotice'
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Resume Schedule',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions',
    method: 'POST',
    description: 'Resume the mower\'s schedule',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'ResumeSchedule'
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Update Mower Calendar',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/calendar',
    method: 'POST',
    description: 'Update the mower\'s schedule/calendar',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'calendar',
        attributes: {
          tasks: [{
            start: 480, // 8:00 AM (minutes from midnight)
            duration: 180, // 3 hours
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false
          }]
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Update Work Area Calendar',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/workAreas/{workAreaId}/calendar',
    method: 'POST',
    description: 'Update the calendar for a specific work area (EPOS/Ceora models)',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'calendar',
        attributes: {
          tasks: [{
            start: 480, // 8:00 AM (minutes from midnight)
            duration: 180, // 3 hours
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
            workAreaId: 123 // requires a valid work area ID
          }]
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Update Mower Settings',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/settings',
    method: 'POST',
    description: 'Update mower settings (cutting height, headlight, etc.)',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'settings',
        attributes: {
          cuttingHeight: 5, // 1-9 scale
          headlight: {
            mode: 'ALWAYS_ON' // Options: ALWAYS_ON, ALWAYS_OFF, EVENING_ONLY, EVENING_AND_NIGHT
          }
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Update Work Area',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/workAreas/{workAreaId}',
    method: 'PATCH',
    description: 'Update a work area\'s settings',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'workArea',
        id: '123', // requires a valid work area ID
        attributes: {
          cuttingHeight: 50, // percentage 0-100
          enable: true
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Update Stay-Out Zone',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/stayOutZones/{stayOutId}',
    method: 'PATCH',
    description: 'Enable or disable a stay-out zone',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {
      data: {
        type: 'stayOutZone',
        id: 'zone-id-here', // requires a valid zone ID
        attributes: {
          enable: true
        }
      }
    },
    requiresAuth: true,
  },
  {
    name: 'Confirm Error',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/errors/confirm',
    method: 'POST',
    description: 'Confirm the current error on the mower',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {},
    requiresAuth: true,
  },
  {
    name: 'Reset Cutting Blade Usage Time',
    endpoint: 'https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/statistics/resetCuttingBladeUsageTime',
    method: 'POST',
    description: 'Reset the cutting blade usage time counter',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: {},
    requiresAuth: true,
  },
  {
    name: 'Get WebSocket Connection',
    endpoint: 'https://api.amc.husqvarna.dev/v1/websocket',
    method: 'GET',
    description: 'Get WebSocket connection details',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    requiresAuth: true,
  }
];

export default function ApiSandboxPage() {
  // API configuration state (minimized since we use cookies now)
  const [authStatus, setAuthStatus] = useState({
    isAuthenticated: false,
    tokenExpiry: null as string | null,
    _refreshed: undefined as number | undefined, // Used to force re-renders
  });

  // Request state
  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customMethod, setCustomMethod] = useState('GET');
  const [requestHeaders, setRequestHeaders] = useState('{}');
  const [requestBody, setRequestBody] = useState('{}');
  const [response, setResponse] = useState<null | any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [useCustomEndpoint, setUseCustomEndpoint] = useState(false);

  // Mower state
  const [mowerId, setMowerId] = useState('');
  const [mowers, setMowers] = useState<any[]>([]);

  // Function to get cookie value by name
  const getCookieValue = (name: string) => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  };

  // Function to get token - will try client-side cookie first, then API
  const [tokenValue, setTokenValue] = useState('');

  const getTokenValue = async () => {
    // First try client-side cookie
    const clientToken = getCookieValue('userAccessToken');
    if (clientToken) {
      setTokenValue(clientToken);
      return clientToken;
    }

    // If not found, check with API
    try {
      const response = await fetch('/api/husqvarna/status');
      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated) {
          // We know token exists but can't access it directly
          // Use a demo token value for display only
          const dummyToken = `demo_token_${Date.now()}`;
          setTokenValue(dummyToken);
          return dummyToken;
        }
      }
    } catch (error) {
      console.error('Error fetching token from API:', error);
    }
    
    setTokenValue('');
    return '';
  };

  // Refresh token value periodically
  useEffect(() => {
    if (authStatus.isAuthenticated) {
      getTokenValue();
      const interval = setInterval(getTokenValue, 5000);
      return () => clearInterval(interval);
    } else {
      setTokenValue('');
    }
  }, [authStatus.isAuthenticated, authStatus._refreshed]);

  // Check for user token in cookies on mount and when the component renders
  useEffect(() => {
    // Function to check authentication status
    const checkAuth = async () => {
      // First try to get the token from client-side cookies
      const userAccessToken = getCookieValue('userAccessToken');
      
      if (userAccessToken) {
        console.log('Found user access token in cookies, length:', userAccessToken.length);
        // If we have a token, set isAuthenticated to true
        setAuthStatus({
          isAuthenticated: true,
          tokenExpiry: new Date(Date.now() + 3600 * 1000).toISOString(), // Assume 1 hour
          _refreshed: Date.now(),
        });
      } else {
        console.log('No user access token found in cookies, checking with API...');
        // If no token in client-side cookies, check with the API
        try {
          const response = await fetch('/api/husqvarna/status');
          if (response.ok) {
            const data = await response.json();
            if (data.isAuthenticated) {
              console.log('API reports user is authenticated, token length:', data.tokenLength);
              setAuthStatus({
                isAuthenticated: true,
                tokenExpiry: new Date(Date.now() + 3600 * 1000).toISOString(), // Assume 1 hour
                _refreshed: Date.now(),
              });
              return;
            }
          }
        } catch (error) {
          console.error('Error checking auth status with API:', error);
        }
        
        // If we get here, user is not authenticated
        console.log('User is not authenticated');
        setAuthStatus({
          isAuthenticated: false,
          tokenExpiry: null,
          _refreshed: Date.now(),
        });
      }
    };
    
    // Check auth immediately
    checkAuth();
    
    // Set up an interval to periodically check authentication status
    const interval = setInterval(checkAuth, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Send API request
  const sendRequest = async () => {
    setIsLoading(true);
    setResponse(null);
    
    try {
      const endpoint = useCustomEndpoint ? customEndpoint : selectedEndpoint.endpoint;
      const method = useCustomEndpoint ? customMethod : selectedEndpoint.method;
      
      let finalEndpoint = endpoint;
      
      // Replace {mowerId} with actual mower ID if available
      if (mowerId && finalEndpoint.includes('{mowerId}')) {
        finalEndpoint = finalEndpoint.replace('{mowerId}', mowerId);
      }
      
      // Prepare headers
      let headers = useCustomEndpoint 
        ? JSON.parse(requestHeaders) 
        : { ...selectedEndpoint.headers };
      
      // We don't need to handle Authorization or X-Api-Key here anymore
      // as they're managed by the proxy via cookies and env variables
      
      // Add Authorization-Provider header for Husqvarna API requests
      if (finalEndpoint.includes('husqvarna.dev')) {
        headers = {
          ...headers,
          'Authorization-Provider': 'husqvarna',
        };
      }
      
      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers,
      };
      
      // Add body for non-GET requests
      if (method !== 'GET') {
        const body = useCustomEndpoint 
          ? requestBody 
          : JSON.stringify(selectedEndpoint.body || {});
        
        requestOptions.body = body;
      }
      
      // Proxy the request through our API
      finalEndpoint = `/api/husqvarna/proxy?url=${encodeURIComponent(finalEndpoint)}`;
      
      const startTime = performance.now();
      
      // Make the API request through our proxy endpoint
      const response = await fetch(finalEndpoint, {
        method: requestOptions.method,
        headers: requestOptions.headers,
        body: requestOptions.body,
      });
      
      const endTime = performance.now();
      setResponseTime(endTime - startTime);
      
      const data = await response.json();
      setResponse(data);
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      toast.success('API request successful');
      
      // If this was a get mowers request, save the mower IDs
      if (finalEndpoint.includes('/mowers') && !finalEndpoint.includes('/actions') && method === 'GET') {
        if (data && data.data) {
          console.log('Mower data received:', data.data);
          
          // Make sure we have an array of mowers
          const mowerArray = Array.isArray(data.data) ? data.data : [data.data];
          
          // Save mowers to state for dropdown selection
          setMowers(mowerArray);
          
          // If mowers were found, show success message
          if (mowerArray.length > 0) {
            toast.success(`Found ${mowerArray.length} mower(s)`);
            console.log('Mowers saved for selection:', mowerArray);
          } else {
            toast.success('No mowers found in your account');
          }
        } else {
          console.warn('No mower data in API response:', data);
        }
      }
    } catch (error) {
      console.error('API request error:', error);
      toast.error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format JSON
  const formatJson = (json: any) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return JSON.stringify({ error: 'Invalid JSON' });
    }
  };

  // Helper function to add a mower ID directly
  const addMowerId = (id: string) => {
    // Check if mower ID already exists in the mowers array
    if (!mowers.some(mower => mower.id === id)) {
      // Add a simple mower object with just the ID
      setMowers([...mowers, { id, attributes: { system: { name: `Mower ${id}` } } }]);
      toast.success(`Added mower ID: ${id}`);
    }
    
    // Set the mower ID
    setMowerId(id);
  };

  return (
    <div className="container mx-auto p-4 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Husqvarna API Sandbox</h1>
          <p className="text-muted-foreground">
            Test and develop with the Husqvarna Automower Connect API
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" /> API Settings</TabsTrigger>
          <TabsTrigger value="request"><Send className="mr-2 h-4 w-4" /> API Request</TabsTrigger>
          <TabsTrigger value="websocket"><Terminal className="mr-2 h-4 w-4" /> WebSocket</TabsTrigger>
        </TabsList>
        
        {/* API Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your Husqvarna API credentials. These will be saved in your browser's local storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="mb-4">
                <Lock className="h-4 w-4" />
                <AlertTitle>Security Notice</AlertTitle>
                <AlertDescription>
                  You need a Husqvarna Connect account with at least one paired mower to use this API.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-6">
                {/* User Authentication Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">User Authentication</h3>
                      <p className="text-sm text-muted-foreground">
                        Log in with your personal Husqvarna account to access your mowers
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            This uses the Authorization Code flow to authenticate with your Husqvarna account.
                            You'll need a Husqvarna account with connected mowers.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Personal Account Required</AlertTitle>
                      <AlertDescription>
                        You need a Husqvarna Connect account with at least one paired mower to use this feature.
                      </AlertDescription>
                    </Alert>
                    <Button 
                      className="flex items-center space-x-2"
                      onClick={() => {
                        const loginUrl = `/api/husqvarna/login?redirect=/api-sandbox`;
                        window.location.href = loginUrl;
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Login with Husqvarna Account</span>
                    </Button>
                    
                    <Button 
                      className="flex items-center space-x-2 mt-2"
                      variant="secondary"
                      onClick={() => {
                        const loginUrl = `/api/husqvarna/user-login?redirect=/api-sandbox`;
                        window.location.href = loginUrl;
                      }}
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Login with Enhanced Scopes</span>
                    </Button>
                    
                    {/* Debug login option */}
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Debug Tools:</p>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/husqvarna/debug-login');
                              const data = await response.json();
                              
                              if (response.ok) {
                                console.log('Debug login successful:', data);
                                toast.success('Debug login successful - token length: ' + data.tokenLength);
                                
                                // Force refresh auth status
                                setAuthStatus(current => ({
                                  isAuthenticated: true,
                                  tokenExpiry: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
                                  _refreshed: Date.now(),
                                }));
                                
                                // Force token refresh
                                getTokenValue();
                              } else {
                                console.error('Debug login failed:', data);
                                toast.error('Debug login failed: ' + (data.error || 'Unknown error'));
                              }
                            } catch (error) {
                              console.error('Error with debug login:', error);
                              toast.error('Debug login error: ' + (error instanceof Error ? error.message : 'Unknown error'));
                            }
                          }}
                        >
                          Direct Auth Test
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/husqvarna/status');
                              const data = await response.json();
                              console.log('Auth status detailed debug:', data);
                              toast.success('Auth status checked - see console');
                            } catch (error) {
                              console.error('Error checking auth status:', error);
                              toast.error('Auth status check failed');
                            }
                          }}
                        >
                          Check Auth Status
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                          onClick={async () => {
                            try {
                              toast.loading('Testing API connection directly...');
                              const response = await fetch('/api/husqvarna/debug-api?endpoint=/mowers');
                              const data = await response.json();
                              console.log('Direct API test results:', data);
                              
                              if (response.ok) {
                                if (data.success) {
                                  toast.success(`API test success (${data.statusCode}). See console for details.`);
                                } else {
                                  toast.error(`API request error: ${data.statusCode} ${data.statusText}`);
                                }
                              } else {
                                toast.error('API test failed: ' + (data.error || 'Unknown error'));
                              }
                            } catch (error) {
                              console.error('Error testing API:', error);
                              toast.error('API test error: ' + (error instanceof Error ? error.message : 'Unknown error'));
                            }
                          }}
                        >
                          Test API Direct
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                          onClick={async () => {
                            try {
                              toast.loading('Testing application API access...');
                              const response = await fetch('/api/husqvarna/auth-test');
                              const data = await response.json();
                              console.log('Application API access test results:', data);
                              
                              if (response.ok) {
                                if (data.apiTest?.success) {
                                  toast.success(`App credentials API test success. See console for details.`);
                                } else {
                                  toast.error(`App credentials API test error: ${data.apiTest?.status} ${data.apiTest?.statusText}`);
                                }
                              } else {
                                toast.error('App credentials test failed: ' + (data.error || 'Unknown error'));
                              }
                            } catch (error) {
                              console.error('Error testing app credentials:', error);
                              toast.error('App credentials test error: ' + (error instanceof Error ? error.message : 'Unknown error'));
                            }
                          }}
                        >
                          Test App Credentials
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Authentication Status */}
                {authStatus.isAuthenticated && authStatus.tokenExpiry && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
                      <div className="flex items-center">
                        <Check className="text-green-500 dark:text-green-400 mr-2 h-5 w-5" />
                        <span className="font-medium text-green-700 dark:text-green-400">Authenticated</span>
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                        Token expires at: {new Date(authStatus.tokenExpiry).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Authentication Token</h4>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // Force re-read of the token
                            const refreshedToken = getCookieValue('userAccessToken');
                            if (refreshedToken) {
                              toast.success('Token refreshed');
                              // Force a re-render
                              setAuthStatus(current => ({
                                ...current,
                                // Add a timestamp to ensure the state actually changes
                                _refreshed: Date.now()
                              }));
                            } else {
                              toast.error('No token found');
                            }
                          }}
                        >
                          <RefreshCcw className="h-3 w-3 mr-1" />
                          <span>Refresh</span>
                        </Button>
                      </div>
                      <div className="relative">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md overflow-x-auto max-h-24">
                          <p className="text-xs font-mono break-all whitespace-pre-wrap">
                            {tokenValue || 'No token found'}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="absolute top-2 right-2"
                          onClick={() => {
                            if (tokenValue) {
                              navigator.clipboard.writeText(tokenValue);
                              toast.success('Token copied to clipboard');
                            }
                          }}
                        >
                          <span className="sr-only">Copy</span>
                          <ClipboardCopy className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-1">Token Information</h4>
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="font-medium">Cookie Found:</span>
                            <span>{getCookieValue('userAccessToken') ? 'Yes' : 'No'}</span>
                            
                            <span className="font-medium">Token Length:</span>
                            <span>{tokenValue?.length || 0} characters</span>
                            
                            <span className="font-medium">Has Refresh Token:</span>
                            <span>{getCookieValue('userRefreshToken') ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  // Clear cookies by setting an expired cookie
                  document.cookie = "userAccessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                  document.cookie = "userRefreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                  
                  // Reset auth status
                  setAuthStatus({
                    isAuthenticated: false,
                    tokenExpiry: null,
                    _refreshed: Date.now(),
                  });
                  
                  toast.success('Logged out successfully');
                }}
              >
                Logout
              </Button>
            </CardFooter>
          </Card>
          
          {/* Authentication Response */}
          {response && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Authentication Response</CardTitle>
                {responseTime && (
                  <CardDescription>
                    Response time: {responseTime.toFixed(0)} ms
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="bg-zinc-950 text-zinc-50 p-4 rounded-md overflow-auto max-h-96">
                  <pre className="text-xs md:text-sm">{formatJson(response)}</pre>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Debug Information (hidden in production) */}
          <Card className="mt-4 border-dashed border-amber-500 dark:border-amber-700">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center">
                <div className="mr-2 p-1 rounded-full bg-amber-500 animate-pulse" style={{width: '8px', height: '8px'}}></div>
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-xs space-y-1">
                <div><strong>Auth Status:</strong> {authStatus.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
                <div><strong>Token Present:</strong> {getCookieValue('userAccessToken') ? 'Yes' : 'No'}</div>
                <div><strong>Token Length:</strong> {tokenValue?.length || 0} chars</div>
                <div><strong>Last Refresh:</strong> {authStatus._refreshed ? new Date(authStatus._refreshed).toLocaleTimeString() : 'Never'}</div>
                <div className="flex items-baseline mt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs mr-2"
                    onClick={() => {
                      // Force refresh of token status
                      getTokenValue().then(() => {
                        setAuthStatus(current => ({...current, _refreshed: Date.now()}));
                        toast.success('Auth state refreshed');
                      });
                    }}
                  >
                    Force Refresh
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs mr-2"
                    onClick={async () => {
                      // Check auth status with the API
                      try {
                        const response = await fetch('/api/husqvarna/status');
                        if (response.ok) {
                          const data = await response.json();
                          console.log('Auth status from API:', data);
                          toast.success('Auth status checked - see console');
                        }
                      } catch (error) {
                        console.error('Error checking auth status:', error);
                        toast.error('Error checking auth status');
                      }
                    }}
                  >
                    Check API Status
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 text-xs"
                    onClick={() => {
                      console.log('Cookie dump:', document.cookie);
                      toast.success('Cookies logged to console');
                    }}
                  >
                    Log Cookies
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* API Request Tab */}
        <TabsContent value="request">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Request Builder</CardTitle>
                  <CardDescription>
                    Select an endpoint or create a custom request
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="customEndpoint">Custom Endpoint</Label>
                    <Switch 
                      id="customEndpoint" 
                      checked={useCustomEndpoint}
                      onCheckedChange={setUseCustomEndpoint}
                    />
                  </div>
                  
                  {!useCustomEndpoint ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="endpoint">API Endpoint</Label>
                        <Select 
                          value={selectedEndpoint.name}
                          onValueChange={(value) => {
                            const endpoint = API_ENDPOINTS.find(e => e.name === value);
                            if (endpoint) setSelectedEndpoint(endpoint);
                          }}
                        >
                          <SelectTrigger id="endpoint">
                            <SelectValue placeholder="Select endpoint" />
                          </SelectTrigger>
                          <SelectContent>
                            {API_ENDPOINTS.map((endpoint) => (
                              <SelectItem key={endpoint.name} value={endpoint.name}>
                                {endpoint.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <p className="text-sm text-muted-foreground">{selectedEndpoint.description}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>HTTP Method</Label>
                        <Badge variant="outline">{selectedEndpoint.method}</Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>URL</Label>
                        <p className="text-sm font-mono break-all bg-slate-100 dark:bg-slate-800 p-2 rounded">
                          {selectedEndpoint.endpoint}
                        </p>
                      </div>
                      
                      {selectedEndpoint.endpoint.includes('{mowerId}') && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="mowerId">Mower ID</Label>
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log('Current mowers state:', mowers);
                                if (mowers.length > 0) {
                                  // Show mowers in toast
                                  toast.success(`Found ${mowers.length} mowers in state`);
                                  // Auto-select the first mower if none selected
                                  if (!mowerId && mowers[0] && mowers[0].id) {
                                    setMowerId(mowers[0].id);
                                    toast.success(`Auto-selected mower: ${mowers[0].attributes?.system?.name || mowers[0].id}`);
                                  }
                                } else {
                                  // If no mowers, redirect user to get mowers first
                                  toast.error('No mowers found. Run "Get Mowers" first');
                                  const getMowersEndpoint = API_ENDPOINTS.find(e => e.name === 'Get Mowers');
                                  if (getMowersEndpoint) setSelectedEndpoint(getMowersEndpoint);
                                }
                              }}
                            >
                              Debug Mowers
                            </Button>
                          </div>
                          
                          {mowers.length > 0 ? (
                            <div className="space-y-2">
                              <Select 
                                value={mowerId}
                                onValueChange={setMowerId}
                              >
                                <SelectTrigger id="mowerId">
                                  <SelectValue placeholder="Select a mower" />
                                </SelectTrigger>
                                <SelectContent>
                                  {mowers.map((mower: any) => (
                                    <SelectItem key={mower.id} value={mower.id}>
                                      {mower.attributes?.system?.name || mower.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {/* Manual entry option */}
                              <div className="mt-2">
                                <Label htmlFor="manualMowerId">Or enter ID manually:</Label>
                                <div className="flex mt-1">
                                  <Input
                                    id="manualMowerId"
                                    value={mowerId}
                                    onChange={(e) => setMowerId(e.target.value)}
                                    placeholder="Enter mower ID here"
                                    className="mr-2"
                                  />
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      if (mowerId) {
                                        addMowerId(mowerId);
                                        toast.success(`Set mower ID to: ${mowerId}`);
                                      } else {
                                        toast.error('Please enter a mower ID');
                                      }
                                    }}
                                  >
                                    Set
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Alert variant="destructive">
                                <AlertTitle>No mowers available</AlertTitle>
                                <AlertDescription>
                                  Please run the "Get Mowers" request first to fetch your mowers
                                </AlertDescription>
                              </Alert>
                              
                              {/* Manual entry fallback */}
                              <div className="mt-4">
                                <Label htmlFor="manualMowerId">Enter mower ID manually:</Label>
                                <div className="flex mt-1">
                                  <Input
                                    id="manualMowerId"
                                    value={mowerId}
                                    onChange={(e) => setMowerId(e.target.value)}
                                    placeholder="Enter mower ID here"
                                    className="mr-2"
                                  />
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      if (mowerId) {
                                        addMowerId(mowerId);
                                        toast.success(`Set mower ID to: ${mowerId}`);
                                      } else {
                                        toast.error('Please enter a mower ID');
                                      }
                                    }}
                                  >
                                    Set
                                  </Button>
                                </div>
                              </div>
                              
                              <Button 
                                variant="secondary" 
                                className="w-full mt-2"
                                onClick={() => {
                                  const getMowersEndpoint = API_ENDPOINTS.find(e => e.name === 'Get Mowers');
                                  if (getMowersEndpoint) {
                                    setSelectedEndpoint(getMowersEndpoint);
                                    toast.success('Switched to "Get Mowers" endpoint');
                                  }
                                }}
                              >
                                Switch to Get Mowers
                              </Button>
                            </div>
                          )}
                          
                          {mowerId && (
                            <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
                              <p className="text-xs">Using mower ID: <span className="font-mono">{mowerId}</span></p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="customMethod">HTTP Method</Label>
                        <Select 
                          value={customMethod}
                          onValueChange={setCustomMethod}
                        >
                          <SelectTrigger id="customMethod">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customUrl">API URL</Label>
                        <Input 
                          id="customUrl" 
                          value={customEndpoint}
                          onChange={(e) => setCustomEndpoint(e.target.value)}
                          placeholder="https://api.amc.husqvarna.dev/v1/..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="headers">Headers (JSON)</Label>
                        <Textarea 
                          id="headers" 
                          value={requestHeaders}
                          onChange={(e) => setRequestHeaders(e.target.value)}
                          rows={4}
                          placeholder={'{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer {token}",\n  "X-Api-Key": "{apiKey}"\n}'}
                        />
                      </div>
                      
                      {customMethod !== 'GET' && (
                        <div className="space-y-2">
                          <Label htmlFor="body">Request Body (JSON)</Label>
                          <Textarea 
                            id="body" 
                            value={requestBody}
                            onChange={(e) => setRequestBody(e.target.value)}
                            rows={4}
                            placeholder={'{\n  "key": "value"\n}'}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full"
                    onClick={sendRequest}
                    disabled={
                      isLoading || 
                      (useCustomEndpoint && !customEndpoint) ||
                      (selectedEndpoint.requiresAuth && !authStatus.isAuthenticated) ||
                      (selectedEndpoint.endpoint.includes('{mowerId}') && !mowerId)
                    }
                  >
                    {isLoading ? <RefreshCcw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Request
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Response</CardTitle>
                  {responseTime && (
                    <CardDescription>
                      Response time: {responseTime.toFixed(0)} ms
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {response ? (
                    <div className="space-y-4">
                      {/* Extract Mower ID Button */}
                      <div className="mb-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // Try to find mower ID in the response
                            if (response.data) {
                              // Check if it's a direct mower object
                              if (response.data.id && response.data.type === 'mower') {
                                addMowerId(response.data.id);
                                toast.success(`Found and set mower ID: ${response.data.id}`);
                                return;
                              }
                              
                              // Check if it's an array of mowers
                              if (Array.isArray(response.data) && response.data.length > 0) {
                                // Use the first mower's ID
                                const mower = response.data[0];
                                if (mower && mower.id) {
                                  addMowerId(mower.id);
                                  toast.success(`Found and set mower ID to first mower: ${mower.id}`);
                                  return;
                                }
                              }
                            }
                            
                            toast.error('No mower ID found in response');
                          }}
                        >
                          Extract Mower ID from Response
                        </Button>
                      </div>
                      
                      {/* JSON Response */}
                      <div className="bg-zinc-950 text-zinc-50 p-4 rounded-md overflow-auto max-h-96">
                        <pre className="text-xs md:text-sm">{formatJson(response)}</pre>
                      </div>
                      
                      {/* Mower Information (if present) */}
                      {response.data && Array.isArray(response.data) && response.data.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Mower Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {response.data.map((mower: any) => (
                              <div key={mower.id} className="border rounded-md p-4 bg-slate-50 dark:bg-slate-900">
                                <h4 className="font-medium">{mower.attributes?.system?.name || 'Unnamed Mower'}</h4>
                                <p className="text-sm text-muted-foreground">ID: {mower.id}</p>
                                
                                {mower.attributes?.mower?.activity && (
                                  <div className="mt-2">
                                    <span className="text-sm font-medium">Status: </span>
                                    <span className="text-sm">{mower.attributes.mower.activity}</span>
                                    {mower.attributes.mower.state && (
                                      <span className="text-sm"> ({mower.attributes.mower.state})</span>
                                    )}
                                  </div>
                                )}
                                
                                {mower.attributes?.battery?.batteryPercent !== undefined && (
                                  <div className="mt-2">
                                    <span className="text-sm font-medium">Battery: </span>
                                    <span className="text-sm">{mower.attributes.battery.batteryPercent}%</span>
                                  </div>
                                )}
                                
                                <div className="mt-3">
                                  <Button
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setMowerId(mower.id);
                                      // Find and select the "Get Mower Details" endpoint
                                      const detailsEndpoint = API_ENDPOINTS.find(e => e.name === 'Get Mower Details');
                                      if (detailsEndpoint) setSelectedEndpoint(detailsEndpoint);
                                    }}
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Make a request to see the response</p>
                    </div>
                  )}
                </CardContent>
                {response && (
                  <CardFooter className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(formatJson(response));
                        toast.success('Response copied to clipboard');
                      }}
                    >
                      <ClipboardCopy className="h-4 w-4 mr-2" />
                      Copy Response
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* WebSocket Tab */}
        <TabsContent value="websocket">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Connection</CardTitle>
                <CardDescription>
                  Monitor and manage the WebSocket connection to Husqvarna API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProxyWebSocketStatus />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Implementation</CardTitle>
                <CardDescription>
                  Learn about the WebSocket implementation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">About WebSocket Integration</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      The WebSocket connection provides real-time updates from your Husqvarna mowers. It's automatically established
                      when the application starts and maintained with health checks.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The connection status above shows if the WebSocket is currently active, when it was last updated,
                      and how many reconnection attempts have been made.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Implementation Features</h3>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Automatic connection establishment on deployment</li>
                      <li>Reconnection before the 2-hour WebSocket limit</li>
                      <li>Data throttling to prevent excessive database writes</li>
                      <li>Comprehensive error handling and logging</li>
                      <li>Real-time UI status indicators</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Example Implementation</h3>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-xs overflow-auto">
{`// Initialize WebSocket connection
async function initializeWebSocket() {
  try {
    // Get WebSocket URL from API
    const wsConfig = await api.getWebSocketConnection();
    
    // Create WebSocket connection
    const ws = new WebSocket(wsConfig.data.attributes.url);
    
    // Handle connection open
    ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Authenticate
      ws.send(JSON.stringify({
        type: 'authenticate',
        data: {
          token: api.getToken()
        }
      }));
      
      // Subscribe to mower events
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: {
          mowerId: 'mower-id-here'
        }
      }));
    };
    
    // Handle incoming messages
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      // Process different message types
      switch (message.type) {
        case 'data':
          // Update mower data in Firebase
          updateMowerInFirebase(message.data);
          break;
        case 'heartbeat':
          // Respond to keep connection alive
          ws.send(JSON.stringify({ type: 'heartbeat' }));
          break;
        // Handle other message types...
      }
    };
    
    // Handle errors and reconnection
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Implement reconnection logic
    };
    
    // Handle connection close
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Implement reconnection logic
    };
    
    return ws;
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    throw error;
  }
}`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 