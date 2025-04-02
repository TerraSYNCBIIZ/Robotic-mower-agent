import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Server, 
  Wifi, 
  Database, 
  RefreshCw, 
  Activity, 
  Clock, 
  PieChart, 
  AlertCircle, 
  Scissors,
  BarChart3,
  Gauge
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Error codes mapping based on Husqvarna API documentation
const ERROR_CODES: Record<number, string> = {
  0: "No error",
  1: "Outside working area",
  2: "No loop signal",
  3: "Wrong loop signal",
  4: "Loop error",
  5: "Outside charging station",
  6: "Outside starting point",
  7: "Request start point not reached",
  8: "Request start point reached",
  9: "Trapped",
  10: "Upside down",
  11: "Low battery",
  12: "Empty battery",
  13: "No drive",
  14: "Mower lifted",
  15: "Lifted",
  16: "Stuck in charging station",
  17: "Charging station blocked",
  18: "Collision sensor problem",
  19: "Battery problem",
  20: "Charging system problem",
  21: "Generic error",
  22: "Programming error",
  23: "Cutting system blocked",
  24: "Invalid sub-device combination",
  25: "Settings restored",
  26: "Memory circuit problem",
  27: "Slope too steep",
  28: "Charging current too high",
  29: "Electronic problem",
  30: "Cutting system error",
  31: "Tilt sensor error",
  32: "Wheel calibration failed",
  33: "Scheduler calibration failed",
  34: "Poor pairing connectivity",
  35: "Guide calibration accomplished",
  36: "Calibration failed",
  37: "Pairing settings cleared",
  38: "Twisted cable",
  39: "Charging device blocked",
  40: "GPS navigation problem",
  41: "Weak GPS signal",
  42: "Difficult finding home",
  43: "Charging station communication problem",
  44: "Charging station communication problem",
  45: "Communication problem",
  46: "Communication problem",
  47: "Communication problem",
  48: "Wireless communication problem",
  49: "Wireless communication problem",
  50: "Communication problem",
  51: "Zone generator problem",
  52: "Ultrasonic problem",
  53: "Rain sensor problem",
  54: "Temporary problem",
  55: "Temporary problem",
  56: "Temporary problem",
  57: "Temporary problem",
  58: "Temporary problem",
  59: "Temporary problem",
  60: "Power supply problem",
  61: "Stop button problem",
  62: "Tilt sensor problem",
  63: "Mower lifted problem",
  64: "Collision sensor problem",
  65: "Wheel motor blocked",
  66: "Wheel drive problem",
  67: "Cutting motor problem",
  68: "Invalid battery combination",
  69: "Alarm! Mower switched off",
  70: "Alarm! Mower stopped",
  71: "Alarm! Mower lifted",
  72: "Alarm! Mower tilted",
  73: "Alarm! Mower in motion",
  74: "Alarm! Outside geofence",
  75: "Connection changed",
  76: "Connection NOT changed",
  77: "Com board not available",
  78: "Slipped - Mower has Slipped",
  79: "Invalid battery combination",
  80: "Wheel motor failed",
  81: "Wheel motor failed",
  82: "Cutting motor failed",
  83: "Cutting motor failed",
  84: "Unrecognized message",
  85: "Feature not in this firmware",
  86: "Unauthorized command",
  87: "SIM card requires PIN",
  88: "SIM card error",
  89: "SIM card locked",
  90: "SIM card not found",
  91: "SIM card communication error",
  92: "SIM card settings error",
  93: "GPRS not configured",
  94: "GPRS registration failed",
  95: "GPRS registration failed",
  96: "Terminal GPRS failed",
  97: "GPRS settings error",
  98: "No contact with server",
  99: "Internal error"
};

// Type of our expected mower statuses
type MowerStatus = 'mowing' | 'charging' | 'idle' | 'error' | 'offline' | 'returning' | 'parked' | 'online' | 'paused';

export interface MowerError {
  mowerId: string;
  mowerName: string;
  errorCode: number;
  errorTimestamp: number;
  status: MowerStatus;
}

export interface FleetStatus {
  statusCounts: Record<MowerStatus, number>;
  totalMowers: number;
  efficiency: number; // Percentage of time mowers are not in error/paused/stuck states
  bladeChangeDaysRemaining: number;
  errors: MowerError[];
  totalZones: number;
  completedZones: number;
}

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
  };
  fleetStatus?: FleetStatus;
  mowerData?: any[]; // Raw mower data to calculate status if fleetStatus not provided
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
  },
  fleetStatus,
  mowerData = []
}: SystemStatsWidgetProps) {
  const [lastFullRefresh, setLastFullRefresh] = useState<string>("Never");
  const [calculatedFleetStatus, setCalculatedFleetStatus] = useState<FleetStatus | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  
  // Calculate fleet status if not provided
  useEffect(() => {
    if (fleetStatus) {
      setCalculatedFleetStatus(fleetStatus);
      return;
    }
    
    if (mowerData && mowerData.length > 0) {
      // Initialize status counts
      const statusCounts: Record<MowerStatus, number> = {
        'mowing': 0,
        'charging': 0,
        'idle': 0,
        'error': 0,
        'offline': 0,
        'returning': 0,
        'parked': 0,
        'online': 0,
        'paused': 0
      };
      
      // Track errors
      const errors: MowerError[] = [];
      
      // Process mower data
      mowerData.forEach(mower => {
        // Count statuses
        const status = mower.status as MowerStatus;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // Collect errors
        if (status === 'error' && mower.attributes?.mower?.errorCode) {
          errors.push({
            mowerId: mower.id,
            mowerName: mower.name || mower.attributes?.system?.name || 'Unknown Mower',
            errorCode: mower.attributes.mower.errorCode,
            errorTimestamp: mower.attributes.mower.errorCodeTimestamp || Date.now(),
            status
          });
        }
      });
      
      // Calculate efficiency as percentage of mowers that are in productive states
      // (not error, not paused, not offline)
      const totalMowers = mowerData.length;
      const problemMowers = statusCounts.error + statusCounts.paused + statusCounts.offline;
      const efficiency = totalMowers > 0 ? Math.round(((totalMowers - problemMowers) / totalMowers) * 100) : 100;
      
      // Get blade change days - just a placeholder in this calculation 
      // In a real implementation, you would get this from maintenance records
      const bladeChangeDaysRemaining = 14;
      
      // Zone completion calculation - in real implementation this would come from work areas
      const totalZones = 10;
      const completedZones = 7;
      
      setCalculatedFleetStatus({
        statusCounts,
        totalMowers,
        efficiency,
        bladeChangeDaysRemaining,
        errors,
        totalZones,
        completedZones
      });
    }
  }, [fleetStatus, mowerData]);
  
  // Get status display with number and color
  const getStatusDisplay = (status: MowerStatus, count: number) => {
    // Define colors for each status
    const statusColors: Record<MowerStatus, string> = {
      'mowing': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'charging': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'idle': 'bg-gray-400/10 text-gray-400 border-gray-400/20',
      'error': 'bg-red-500/10 text-red-500 border-red-500/20',
      'offline': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      'returning': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      'parked': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      'online': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'paused': 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    };
    
    // Only show statuses with at least one mower
    if (count === 0) return null;
    
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "mr-1 mb-1 text-xs py-0 px-2 font-normal whitespace-nowrap",
          statusColors[status]
        )}
      >
        {count} {status}
      </Badge>
    );
  };
  
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
  
  // Format the error timestamp
  const formatErrorTime = (timestamp: number) => {
    if (!timestamp) return "Unknown";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return "Invalid timestamp";
    }
  };
  
  // Get error description
  const getErrorDescription = (errorCode: number) => {
    return ERROR_CODES[errorCode] || `Unknown error (${errorCode})`;
  };

  const fleet = calculatedFleetStatus || fleetStatus;

  return (
    <Card className={`overflow-hidden rounded-xl shadow-sm h-full ${className}`}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-md font-medium flex items-center gap-2">
          <Server className="w-4 h-4" />
          Fleet Overview
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
        {/* Fleet Overview Section */}
        {fleet && (
          <div className="space-y-4">
            <div className="mt-3">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <PieChart className="w-3.5 h-3.5 mr-1.5" />
                Mower Status: {fleet.totalMowers} Total Mowers
              </h3>
              
              <div className="flex flex-wrap mt-1.5">
                {Object.entries(fleet.statusCounts).map(([status, count]) => 
                  getStatusDisplay(status as MowerStatus, count)
                )}
              </div>
            </div>
            
            {/* Efficiency Section */}
            <div className="mt-2 rounded-md p-3 border border-border">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Gauge className="w-3.5 h-3.5 mr-1.5" />
                Operational Efficiency
              </h3>
              
              <div className="w-full bg-secondary/30 rounded-full h-2 mb-1.5">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    fleet.efficiency > 80 ? "bg-emerald-500" :
                    fleet.efficiency > 50 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${fleet.efficiency}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Fleet Uptime</span>
                <span className={cn(
                  "font-medium",
                  fleet.efficiency > 80 ? "text-emerald-500" :
                  fleet.efficiency > 50 ? "text-amber-500" : "text-red-500"
                )}>
                  {fleet.efficiency}%
                </span>
              </div>
            </div>
            
            {/* Error Summary Section */}
            <div className="mt-2">
              <Dialog open={showErrorDetails} onOpenChange={setShowErrorDetails}>
                <DialogTrigger asChild>
                  <div className="p-2 rounded-md bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors w-full">
                    <div className="flex items-center mb-1">
                      <AlertCircle className={cn(
                        "h-3.5 w-3.5 mr-1.5",
                        fleet.errors.length > 0 ? "text-red-500" : "text-muted-foreground"
                      )} />
                      <p className="text-xs text-muted-foreground">Mower Issues</p>
                    </div>
                    <p className="font-medium flex items-center">
                      {fleet.errors.length === 0 ? (
                        <span className="text-green-500">No Issues</span>
                      ) : (
                        <span className="text-red-500">{fleet.errors.length} {fleet.errors.length === 1 ? 'Issue' : 'Issues'}</span>
                      )}
                    </p>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                      Mower Errors ({fleet.errors.length})
                    </DialogTitle>
                    <DialogDescription>
                      Details of current mower errors and issues
                    </DialogDescription>
                  </DialogHeader>
                  
                  <ScrollArea className="max-h-[300px] p-1">
                    {fleet.errors.length === 0 ? (
                      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                        No errors detected in your fleet
                      </div>
                    ) : (
                      fleet.errors.map(error => (
                        <div key={error.mowerId} className="mb-4 p-3 border border-border rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{error.mowerName}</h4>
                            <Badge variant="destructive" className="text-xs">Error {error.errorCode}</Badge>
                          </div>
                          <p className="text-sm mb-1">{getErrorDescription(error.errorCode)}</p>
                          <p className="text-xs text-muted-foreground">
                            Occurred {formatErrorTime(error.errorTimestamp)}
                          </p>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
        
        {/* Services Status Section - expanded and clarified */}
        <div className="mt-3 p-2 border border-border rounded-md">
          <h3 className="text-xs font-medium mb-1 flex items-center">
            <Activity className="w-3.5 h-3.5 mr-1" />
            System Connectivity
          </h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1.5 ${systemData.servicesStatus.api ? "bg-green-500" : "bg-red-500"}`}></div>
                <span>Husqvarna API</span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1.5 ${systemData.servicesStatus.websocket ? "bg-green-500" : "bg-red-500"}`}></div>
                <span>Live Updates</span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1.5 ${systemData.servicesStatus.database ? "bg-green-500" : "bg-red-500"}`}></div>
                <span>Cloud Storage</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Last updated timestamp - small at bottom */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span>Last Updated:</span>
          <span>{lastUpdated || "N/A"}</span>
        </div>
      </CardContent>
    </Card>
  );
} 