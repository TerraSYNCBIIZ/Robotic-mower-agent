/**
 * MowerStatusIndicator Component
 * Shows the current status of a mower with consistent styling
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock } from "lucide-react";

interface MowerStatusIndicatorProps {
  activity: string;
  state: string;
  errorCode?: number;
  batteryLevel?: number;
  className?: string;
  showLastUpdate?: boolean;
  lastUpdated?: Date | string | number | null;
  variant?: 'default' | 'small' | 'outline';
}

export function MowerStatusIndicator({
  activity,
  state,
  errorCode = 0,
  batteryLevel = 100,
  className,
  showLastUpdate = false,
  lastUpdated = null,
  variant = 'default'
}: MowerStatusIndicatorProps) {
  // Determine status
  const isError = state === 'ERROR' || state === 'FATAL_ERROR' || errorCode > 0;
  const isOffline = state === 'UNKNOWN' || state === 'NOT_APPLICABLE' || !state;
  
  // Calculate displayed status
  let status = 'unknown';
  let statusText = 'Unknown';
  
  if (isError) {
    status = 'error';
    statusText = 'Error';
  } else if (isOffline) {
    status = 'offline';
    statusText = 'Offline';
  } else {
    // Based on activity
    switch (activity) {
      case 'MOWING':
        status = 'mowing';
        statusText = 'Mowing';
        break;
      case 'CHARGING':
        status = 'charging';
        statusText = 'Charging';
        break;
      case 'PARKED_IN_CS':
        status = 'parked';
        statusText = 'Parked';
        break;
      case 'GOING_HOME':
        status = 'returning';
        statusText = 'Returning';
        break;
      case 'LEAVING':
        status = 'leaving';
        statusText = 'Leaving';
        break;
      case 'STOPPED_IN_GARDEN':
        status = 'stopped';
        statusText = 'Stopped';
        break;
      default:
        if (state === 'PAUSED') {
          status = 'paused';
          statusText = 'Paused';
        } else if (state === 'RESTRICTED') {
          status = 'restricted';
          statusText = 'Restricted';
        } else if (state === 'IN_OPERATION') {
          status = 'active';
          statusText = 'Active';
        } else {
          status = 'idle';
          statusText = 'Idle';
        }
    }
  }
  
  // Status color mapping
  const statusColors = {
    mowing: "bg-green-500 text-green-50",
    charging: "bg-blue-500 text-blue-50",
    parked: "bg-slate-500 text-slate-50",
    returning: "bg-amber-500 text-amber-50",
    leaving: "bg-purple-500 text-purple-50",
    stopped: "bg-orange-500 text-orange-50",
    paused: "bg-yellow-500 text-yellow-50",
    restricted: "bg-red-400 text-red-50",
    error: "bg-red-500 text-red-50",
    offline: "bg-red-500 text-red-50",
    active: "bg-green-500 text-green-50",
    idle: "bg-slate-500 text-slate-50",
    unknown: "bg-gray-500 text-gray-50"
  };
  
  // Format the last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    
    const date = typeof lastUpdated === 'string' || typeof lastUpdated === 'number'
      ? new Date(lastUpdated)
      : lastUpdated;
    
    // Calculate seconds since update
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  
  // Determine badge based on variant
  if (variant === 'small') {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <span className={cn(
          "relative h-2 w-2 rounded-full",
          status === 'mowing' && "bg-green-500",
          status === 'charging' && "bg-blue-500",
          status === 'parked' && "bg-slate-500",
          status === 'returning' && "bg-amber-500",
          status === 'error' && "bg-red-500",
          status === 'offline' && "bg-red-500",
          status === 'paused' && "bg-yellow-500"
        )}>
          {(status === 'error' || status === 'offline') && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-400"></span>
          )}
          {status === 'mowing' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-green-400"></span>
          )}
        </span>
        <span className="text-xs">{statusText}</span>
        {showLastUpdate && lastUpdated && (
          <span className="text-xs text-muted-foreground ml-1">({formatLastUpdated()})</span>
        )}
      </div>
    );
  }
  
  if (variant === 'outline') {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className={cn(
          "px-2 py-0.5 rounded-full text-xs border",
          status === 'mowing' && "border-green-500 text-green-500",
          status === 'charging' && "border-blue-500 text-blue-500",
          status === 'parked' && "border-slate-500 text-slate-500",
          status === 'returning' && "border-amber-500 text-amber-500",
          status === 'error' && "border-red-500 text-red-500",
          status === 'offline' && "border-red-500 text-red-500",
          status === 'paused' && "border-yellow-500 text-yellow-500"
        )}>
          {(status === 'error' || status === 'offline') && <AlertTriangle className="inline h-3 w-3 mr-1" />}
          {statusText}
        </div>
        {showLastUpdate && lastUpdated && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-0.5" />
            {formatLastUpdated()}
          </div>
        )}
      </div>
    );
  }
  
  // Default variant
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Badge className={cn(
        statusColors[status as keyof typeof statusColors]
      )}>
        {(status === 'offline' || status === 'error') && (
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
        )}
        {statusText}
      </Badge>
      {showLastUpdate && lastUpdated && (
        <span className="text-xs text-muted-foreground">
          <Clock className="inline h-3 w-3 mr-0.5" />
          {formatLastUpdated()}
        </span>
      )}
    </div>
  );
} 