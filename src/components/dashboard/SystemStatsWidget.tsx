import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, Clock, Cpu, Database, MoveUpRight, RefreshCw, Server } from 'lucide-react';

interface SystemStatsWidgetProps {
  className?: string;
  lastUpdated: string;
  onRefresh?: () => void;
  systemData?: {
    apiResponseTime?: number;
    networkLatency?: number;
    connectedMowers?: number;
    totalMowers?: number;
    servicesStatus?: {
      api: boolean;
      websocket: boolean;
      database: boolean;
    };
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
      
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border bg-card/50">
            <div className="flex justify-between items-start mb-2">
              <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
              <MoveUpRight className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-light">{systemData.apiResponseTime} <span className="text-xs text-muted-foreground">ms</span></div>
            <div className="text-xs text-muted-foreground">API Response</div>
          </div>
          
          <div className="p-3 rounded-lg border bg-card/50">
            <div className="flex justify-between items-start mb-2">
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-2xl font-light">{systemData.networkLatency} <span className="text-xs text-muted-foreground">ms</span></div>
            <div className="text-xs text-muted-foreground">Network</div>
          </div>
          
          <div className="p-3 rounded-lg border bg-card/50">
            <div className="flex justify-between items-start mb-2">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={`text-xs ${systemData.servicesStatus?.database ? 'text-emerald-500' : 'text-red-500'}`}>
                {systemData.servicesStatus?.database ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="text-2xl font-light">{systemData.connectedMowers}
              <span className="text-sm text-muted-foreground">/{systemData.totalMowers}</span>
            </div>
            <div className="text-xs text-muted-foreground">Connected Mowers</div>
          </div>
          
          <div className="p-3 rounded-lg border bg-card/50">
            <div className="flex justify-between items-start mb-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              Last Updated:
            </div>
            <div className="text-xs font-medium truncate">{lastUpdated}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 