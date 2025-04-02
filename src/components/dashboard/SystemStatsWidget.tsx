import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Wifi, Database, RefreshCw, Activity, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface SystemStatsWidgetProps {
  className?: string;
  lastUpdated?: string;
  onRefresh?: () => void;
  systemData?: {
    apiResponseTime: number;
    networkLatency: number;
    connectedMowers: number;
    totalMowers: number;
    servicesStatus: {
      api: boolean;
      websocket: boolean;
      database: boolean;
    }
  }
}

export function SystemStatsWidget({ 
  className, 
  lastUpdated,
  onRefresh,
  systemData = {
    apiResponseTime: 320,
    networkLatency: 56,
    connectedMowers: 3,
    totalMowers: 5,
    servicesStatus: {
      api: true,
      websocket: true,
      database: true
    }
  }
}: SystemStatsWidgetProps) {
  const [lastFullRefresh, setLastFullRefresh] = useState<string>("Never");
  
  // Fetch last refresh info 
  useEffect(() => {
    const fetchLastRefreshInfo = async () => {
      try {
        // Get last refresh info from localStorage as a backup solution
        // In production, you'd use Firebase properly
        const storedRefreshInfo = localStorage.getItem('lastComprehensiveRefresh');
        if (storedRefreshInfo) {
          const refreshTime = new Date(storedRefreshInfo);
          setLastFullRefresh(formatDistanceToNow(refreshTime, { addSuffix: true }));
        }
      } catch (error) {
        console.error('Error fetching refresh info:', error);
      }
    };
    
    fetchLastRefreshInfo();
    
    // Set up a refresh interval (every 60 seconds)
    const interval = setInterval(fetchLastRefreshInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className={`overflow-hidden rounded-xl shadow-sm h-full ${className}`}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-md font-medium flex items-center gap-2">
          <Server className="w-4 h-4" />
          System Status
        </CardTitle>
        
        <button
          onClick={onRefresh}
          className="p-1 rounded-full hover:bg-accent transition-colors"
          title="Refresh stats"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded-md bg-secondary/30">
            <p className="text-xs text-muted-foreground">Connected</p>
            <p className="font-medium">{systemData.connectedMowers} / {systemData.totalMowers}</p>
          </div>
          
          <div className="p-2 rounded-md bg-secondary/30">
            <p className="text-xs text-muted-foreground">API Response</p>
            <p className="font-medium">{systemData.apiResponseTime}ms</p>
          </div>
          
          <div className="p-2 rounded-md bg-secondary/30">
            <p className="text-xs text-muted-foreground">Network</p>
            <p className="font-medium">{systemData.networkLatency}ms</p>
          </div>
          
          <div className="p-2 rounded-md bg-secondary/30">
            <p className="text-xs text-muted-foreground">Basic Refresh</p>
            <p className="font-medium">{lastUpdated || "N/A"}</p>
          </div>
        </div>
        
        {/* Full refresh info */}
        <div className="mt-4 p-3 rounded-md border border-border">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Activity className="w-3.5 h-3.5 mr-1" />
            Comprehensive Data Status
          </h3>
          
          <div className="flex items-center text-sm mb-2">
            <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Last full refresh:</span>
            <span className="ml-auto text-xs font-medium">
              {lastFullRefresh}
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground mt-1">
            The refresh button updates all data from the Husqvarna API, including information that normally updates less frequently.
          </p>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium mb-2">Service Status</h3>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center text-xs text-muted-foreground">
              <Wifi className="h-3 w-3 mr-1" />
              WebSocket
            </span>
            <span className={systemData.servicesStatus.websocket ? "text-green-500 text-xs" : "text-red-500 text-xs"}>
              {systemData.servicesStatus.websocket ? "Online" : "Offline"}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center text-xs text-muted-foreground">
              <Server className="h-3 w-3 mr-1" />
              API Service
            </span>
            <span className={systemData.servicesStatus.api ? "text-green-500 text-xs" : "text-red-500 text-xs"}>
              {systemData.servicesStatus.api ? "Online" : "Offline"}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center text-xs text-muted-foreground">
              <Database className="h-3 w-3 mr-1" />
              Database
            </span>
            <span className={systemData.servicesStatus.database ? "text-green-500 text-xs" : "text-red-500 text-xs"}>
              {systemData.servicesStatus.database ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 