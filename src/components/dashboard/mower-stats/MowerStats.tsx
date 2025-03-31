"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MessageSquare, 
  MoveDownLeft, 
  MoveUpRight, 
  Wrench,
  Play,
  Pause,
  Home,
  BatteryFull,
  PowerOff,
  Crop,
  Battery,
  Cog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

// Import components from the same directory
import { BatteryLevel } from "./BatteryLevel";
import { AreaCompletion } from "./AreaCompletion";
import { StatusIndicator } from "./StatusIndicator";
import { Toast } from "./Toast";
import { ZoneSelectionDialog } from "./ZoneSelectionDialog";
import { MiniMap } from "./MiniMap";
import { ScheduleView } from "./ScheduleView";

// Import types and mock data
import type { MowerStatsProps } from "./types";
import { 
  defaultServiceHistory, 
  defaultAlerts, 
  defaultChatHistory, 
  defaultUpcomingMaintenance, 
  defaultSchedule 
} from "./mockData";

// Add a new import for getting auth token
import { getAuthToken } from "@/lib/auth";

interface ButtonLoadingState {
  home: boolean;
  play: boolean;
  pause: boolean;
  restart: boolean;
}

export function MowerStats({
  mowerName = "Mower",
  mowerModel = "Default Model",
  mowerImage = "/images/h310-1890.webp",
  mowerId,
  batteryLevel = 75,
  areaComplete = "65%",
  status = "mowing",
  currentZone = "Front Yard",
  metrics,
  serviceHistory = defaultServiceHistory,
  recentAlerts = defaultAlerts,
  chatHistory = defaultChatHistory,
  upcomingMaintenance = defaultUpcomingMaintenance,
  schedule = defaultSchedule,
  zones: mowerZones,
  className,
  hideTopCard = false,
  onCommand,
  supportsAreaCompletion = false
}: MowerStatsProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ show: false, message: '', type: 'info' });

  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showHomeOptionsDialog, setShowHomeOptionsDialog] = useState(false);
  const [mowerStatus, setMowerStatus] = useState<'mowing' | 'charging' | 'idle' | 'error' | 'offline' | 'returning' | 'parked'>(status);
  
  const [buttonLoading, setButtonLoading] = useState<ButtonLoadingState>({
    home: false,
    play: false, 
    pause: false,
    restart: false,
  });

  // Update the allZones extraction with direct zones prop and schedule fallback
  const allZones = React.useMemo(() => {
    // If zones are directly provided, use them
    if (mowerZones && mowerZones.length > 0) {
      return mowerZones;
    }
    
    // Otherwise extract from schedule as a fallback
    const zonesSet = new Set<{ name: string, color: string }>();
    
    // Try to extract zones from schedule
    for (const day of schedule) {
      for (const slot of day.timeSlots) {
        for (const zone of slot.zones) {
          zonesSet.add(zone);
        }
      }
    }
    
    // If no zones found in schedule or direct zones, add default zones
    if (zonesSet.size === 0) {
      zonesSet.add({ name: "Entire Yard", color: "#10b981" });
      zonesSet.add({ name: "Front Yard", color: "#3b82f6" });
      zonesSet.add({ name: "Back Yard", color: "#8b5cf6" });
      zonesSet.add({ name: "Side Yard", color: "#f59e0b" });
    }
    
    return Array.from(zonesSet);
  }, [mowerZones, schedule]);

  // Generate metrics based on real data if metrics not provided
  const mowerMetrics = React.useMemo(() => {
    if (metrics) return metrics;
    
    // Calculate derived metrics if not provided but we have some data
    return [
      {
        title: "Total Area Mowed",
        value: "12,450 m²", // This would ideally come from API data
        change: "+15.3% from last month",
        trend: "up",
        icon: <Crop className="h-4 w-4" />,
      },
      {
        title: "Battery Efficiency",
        value: `${batteryLevel}%`,
        change: batteryLevel > 80 ? "+2.5% from last month" : "-1.2% from last month",
        trend: batteryLevel > 80 ? "up" : "down",
        icon: <Battery className="h-4 w-4" />,
      },
      {
        title: "Mowing Hours",
        value: "187.5 hrs", // This would ideally come from API data
        change: "-3.2% from last month",
        trend: "down",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        title: "Maintenance Score",
        value: "86/100", // This would ideally be calculated based on various factors
        change: "No change",
        trend: "neutral",
        icon: <Cog className="h-4 w-4" />,
      },
    ];
  }, [metrics, batteryLevel]);

  // Add this new function after the allZones useMemo hook
  const ensureAuthenticated = async () => {
    const token = getAuthToken();
    
    if (!token) {
      setToast({
        show: true,
        message: 'Please connect your Husqvarna account to control your mowers.',
        type: 'error'
      });
      return false;
    }
    
    // For a real implementation, we would check token expiration and refresh if needed
    // This is a simplified version that just checks if token exists
    return true;
  };

  const handleCommand = async (command: string, duration?: number) => {
    if (!mowerId || !onCommand) {
      setToast({
        show: true,
        message: 'Cannot control mower: Mower ID or onCommand is missing.',
        type: 'error'
      });
      return;
    }

    try {
      // Check authentication first
      const isAuthenticated = await ensureAuthenticated();
      if (!isAuthenticated) {
        return null;
      }
      
      const token = getAuthToken();

      const response = await fetch(`/api/mowers/${mowerId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command, duration })
      });

      const data = await response.json();

      if (!response.ok) {
        // If authentication error, show special message
        if (response.status === 401) {
          throw new Error('Authentication failed. Please reconnect your account.');
        }
        
        throw new Error(data.error || 'Failed to send command to mower');
      }

      return data;
    } catch (error) {
      console.error('Error sending mower command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setToast({
        show: true,
        message: `Failed to control mower: ${errorMessage}`,
        type: 'error'
      });
      
      return null;
    }
  };

  const handlePlay = async () => {
    setButtonLoading({ ...buttonLoading, play: true });
    setShowZoneDialog(true);
    setButtonLoading({ ...buttonLoading, play: false });
  };

  const handlePause = async () => {
    setButtonLoading({ ...buttonLoading, pause: true });
    
    const result = await handleCommand('pause');
    
    if (result?.success) {
      setMowerStatus('idle');
      setToast({
        show: true,
        message: 'Mower paused. Current operation interrupted.',
        type: 'warning'
      });
    }
    
    setButtonLoading({ ...buttonLoading, pause: false });
  };

  const handleGoHome = async () => {
    setButtonLoading({ ...buttonLoading, home: true });
    setShowHomeOptionsDialog(true);
    setButtonLoading({ ...buttonLoading, home: false });
  };

  const handleReturnHome = async (option: string) => {
    setButtonLoading({ ...buttonLoading, home: true });
    
    let command = 'home';
    let duration: number | undefined;
    let message = 'Mower returning to charging station.';
    let targetStatus: 'returning' | 'parked' = 'returning';
    
    switch (option) {
      case '24h':
        command = 'park';
        duration = 24 * 60; // 24 hours in minutes
        message = 'Mower returning home and will stay for 24 hours.';
        targetStatus = 'parked';
        break;
      case '72h':
        command = 'park';
        duration = 72 * 60; // 72 hours in minutes
        message = 'Mower returning home and will stay for 72 hours.';
        targetStatus = 'parked';
        break;
      case 'until-charged':
        command = 'parkUntilNext';
        message = 'Mower returning home until charged.';
        targetStatus = 'parked';
        break;
      case 'indefinite':
        command = 'home';
        message = 'Mower returning home until further notice.';
        targetStatus = 'parked';
        break;
      default:
        command = 'home';
    }
    
    const result = await handleCommand(command, duration);
    
    if (result?.success) {
      setMowerStatus(targetStatus);
      setToast({
        show: true,
        message,
        type: 'info'
      });
    }
    
    setShowHomeOptionsDialog(false);
    setButtonLoading({ ...buttonLoading, home: false });
  };

  const handleSelectZone = async (zone: string) => {
    // Set loading state while sending command
    setButtonLoading({ ...buttonLoading, play: true });
    
    // Send command to start mowing with a default duration of 60 minutes
    const result = await handleCommand('start', 60);
    
    if (result?.success) {
      setMowerStatus('mowing');
      setToast({
        show: true,
        message: zone === "Entire Yard" 
          ? "Mower started mowing the entire yard." 
          : `Mower started mowing in ${zone}.`,
        type: 'success'
      });
    }
    
    // Close zone dialog in any case
    setShowZoneDialog(false);
    
    setButtonLoading({ ...buttonLoading, play: false });
  };

  const handleContinueChat = (sender: string, initialMessage: string) => {
    // Navigate to the chat page instead of opening a dialog
    const query = new URLSearchParams();
    
    if (mowerId) {
      query.set('mower', mowerId);
    }
    
    if (sender !== 'User') {
      query.set('agent', sender);
    }
    
    if (initialMessage) {
      query.set('context', initialMessage);
    }
    
    router.push(`/chat?${query.toString()}`);
  };

  const closeToast = () => {
    setToast({ ...toast, show: false });
  };

  return (
    <div className={cn("w-full space-y-3", className)} data-mower-id={mowerId}>
      {/* Top card with mower image, controls and mini map */}
      {!hideTopCard && (
        <Card className="overflow-hidden border">
          <div className="flex flex-col md:flex-row md:h-[350px]">
            {/* Mower Image and Controls */}
            <div className="w-full md:w-1/2 p-4 relative flex flex-col">
              <div className="relative w-full h-40 md:h-48 flex-shrink-0">
                <Image 
                  src={mowerImage} 
                  alt={mowerName}
                  className="object-contain"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              
              <div className="flex items-center justify-center gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full w-9 h-9 p-0"
                  onClick={handlePlay}
                  data-action="play"
                  disabled={buttonLoading.play}
                >
                  {buttonLoading.play ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-r-transparent" />
                  ) : (
                    <Play className="h-4 w-4 text-emerald-500" />
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full w-9 h-9 p-0"
                  onClick={handlePause}
                  data-action="pause"
                  disabled={buttonLoading.pause}
                >
                  {buttonLoading.pause ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-r-transparent" />
                  ) : (
                    <Pause className="h-4 w-4 text-amber-500" />
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full w-9 h-9 p-0"
                  onClick={handleGoHome}
                  data-action="home"
                  disabled={buttonLoading.home}
                >
                  {buttonLoading.home ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-r-transparent" />
                  ) : (
                    <Home className="h-4 w-4 text-blue-500" />
                  )}
                </Button>
              </div>
              
              {/* Home options dialog */}
              <Dialog open={showHomeOptionsDialog} onOpenChange={setShowHomeOptionsDialog}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Return to charging station</DialogTitle>
                    <DialogDescription>
                      Select how long the mower should stay at the charging station.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <Button 
                      onClick={() => handleReturnHome('24h')}
                      className="flex items-center justify-start gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      Return for 24 hours
                    </Button>
                    
                    <Button 
                      onClick={() => handleReturnHome('72h')}
                      className="flex items-center justify-start gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      Return for 72 hours
                    </Button>
                    
                    <Button 
                      onClick={() => handleReturnHome('until-charged')}
                      className="flex items-center justify-start gap-2"
                    >
                      <BatteryFull className="h-4 w-4" />
                      Return until charged
                    </Button>
                    
                    <Button 
                      onClick={() => handleReturnHome('indefinite')}
                      className="flex items-center justify-start gap-2"
                    >
                      <PowerOff className="h-4 w-4" />
                      Return until further notice
                    </Button>
                  </div>
                  
                  <DialogFooter className="sm:justify-start">
                    <Button type="button" variant="secondary" onClick={() => setShowHomeOptionsDialog(false)}>
                      Cancel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <div className="mt-3 flex-grow flex flex-col">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{mowerName}</h2>
                  <StatusIndicator status={mowerStatus} />
                </div>
                <p className="text-sm text-muted-foreground mb-3">{mowerModel}</p>
                
                <div className="space-y-2 mt-auto">
                  <BatteryLevel level={batteryLevel} />
                  {(supportsAreaCompletion || areaComplete !== 'N/A') && (
                    <AreaCompletion value={areaComplete} />
                  )}
                </div>
              </div>
            </div>
            
            {/* Mini Map */}
            <div className="w-full md:w-1/2 h-[250px] md:h-full">
              <MiniMap 
                mowerId={mowerId} 
                currentZone={currentZone} 
                batteryLevel={batteryLevel}
                areaComplete={areaComplete}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Weekly Schedule */}
      <Card className="overflow-hidden border p-2">
        <h3 className="text-sm font-medium mb-1">Weekly Schedule</h3>
        <ScheduleView schedule={schedule} />
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mowerMetrics.map((metric, index) => (
          <Card 
            key={`metric-${metric.title}-${index}`} 
            className={cn(
              "overflow-hidden relative group border",
              metric.trend === "up" ? "hover:border-emerald-500/50" : 
              metric.trend === "down" ? "hover:border-red-500/50" : 
              "hover:border-blue-500/50"
            )}
          >
            <div className={cn(
              "absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity",
              metric.trend === "up" ? "bg-gradient-to-br from-emerald-500/30 to-emerald-700/30" : 
              metric.trend === "down" ? "bg-gradient-to-br from-red-500/30 to-red-700/30" : 
              "bg-gradient-to-br from-blue-500/30 to-blue-700/30"
            )} />
            
            <div className="p-5 relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className={cn(
                  "h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg",
                  metric.trend === "up" ? "bg-emerald-500/10 text-emerald-500" : 
                  metric.trend === "down" ? "bg-red-500/10 text-red-500" : 
                  "bg-blue-500/10 text-blue-500"
                )}>
                  {metric.icon}
                </div>
                
                <div className={cn(
                  "h-10 flex items-center gap-1.5 px-3 rounded-lg ml-auto",
                  metric.trend === "up" ? "bg-emerald-500/10 text-emerald-500" : 
                  metric.trend === "down" ? "bg-red-500/10 text-red-500" : 
                  "bg-blue-500/10 text-blue-500"
                )}>
                  {metric.trend === "up" && <MoveUpRight className="h-3.5 w-3.5" />}
                  {metric.trend === "down" && <MoveDownLeft className="h-3.5 w-3.5" />}
                  {metric.trend === "neutral" && <Circle className="h-3.5 w-3.5" />}
                  <span className="text-xs font-medium">{metric.change}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
                <p className="text-2xl font-semibold">{metric.value}</p>
              </div>
              
              {/* Mini chart */}
              <div className="mt-4 h-10">
                {metric.trend === "up" && (
                  <div className="flex items-end h-full w-full gap-[2px]">
                    {[0.3, 0.5, 0.45, 0.6, 0.5, 0.7, 0.8, 0.75, 0.85, 0.9].map((height, i) => (
                      <div 
                        key={`up-bar-${metric.title}-${i}`} 
                        className="flex-1 rounded-sm bg-emerald-500/20"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                )}
                
                {metric.trend === "down" && (
                  <div className="flex items-end h-full w-full gap-[2px]">
                    {[0.8, 0.7, 0.75, 0.6, 0.65, 0.5, 0.55, 0.45, 0.4, 0.3].map((height, i) => (
                      <div 
                        key={`down-bar-${metric.title}-${i}`} 
                        className="flex-1 rounded-sm bg-red-500/20"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                )}
                
                {metric.trend === "neutral" && (
                  <div className="flex items-end h-full w-full gap-[2px]">
                    {[0.5, 0.55, 0.5, 0.6, 0.5, 0.45, 0.5, 0.55, 0.5, 0.55].map((height, i) => (
                      <div 
                        key={`neutral-bar-${metric.title}-${i}`} 
                        className="flex-1 rounded-sm bg-blue-500/20"
                        style={{ height: `${height * 100}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      <Tabs defaultValue="service-history" className="w-full">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="service-history">
            <Wrench className="h-4 w-4 mr-2" />
            Service History
          </TabsTrigger>
          <TabsTrigger value="recent-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Recent Alerts
          </TabsTrigger>
          <TabsTrigger value="chat-history">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat History
          </TabsTrigger>
          <TabsTrigger value="upcoming-maintenance">
            <Clock className="h-4 w-4 mr-2" />
            Upcoming
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="service-history" className="space-y-4">
          <div className="space-y-4">
            {serviceHistory.map((service, i) => (
              <div key={`service-${service.service}-${i}`} className="flex">
                <div className="flex flex-col items-center">
                  {service.isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-primary/70" />
                  ) : (
                    <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />
                  )}
                  {i < serviceHistory.length - 1 && (
                    <div className="w-[1.5px] h-12 bg-muted-foreground/30" />
                  )}
                </div>
                <div className="ml-3 pb-6">
                  <p className="text-sm font-medium">{service.service}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.date} • {service.technician}
                  </p>
                </div>
              </div>
            ))}
            {serviceHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">No service history available.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="recent-alerts" className="space-y-4">
          <div className="space-y-3">
            {recentAlerts.map((alert, i) => (
              <Card key={`alert-${alert.message}-${i}`} className="p-4 border">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    alert.severity === "error" ? "text-destructive" : 
                    alert.severity === "warning" ? "text-amber-500" : "text-blue-500"
                  )} />
                  <div>
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.date}</p>
                  </div>
                </div>
              </Card>
            ))}
            {recentAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent alerts.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="chat-history" className="space-y-4">
          <div className="space-y-4">
            {chatHistory.map((chat, i) => (
              <Card key={`chat-${chat.message.substring(0,10)}-${i}`} className="p-4 border">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">{chat.sender}</p>
                    <p className="text-xs text-muted-foreground">{chat.date}</p>
                  </div>
                  <Separator className="my-2" />
                  <p className="text-sm">{chat.message}</p>
                  <div className="flex justify-end mt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs h-7 gap-1"
                      type="button"
                      onClick={() => handleContinueChat(chat.sender, chat.message)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Continue Chat
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {chatHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">No chat history available.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="upcoming-maintenance" className="space-y-4">
          <div className="space-y-3">
            {upcomingMaintenance.map((task, i) => (
              <Card key={`task-${task.task}-${i}`} className="p-4 border">
                <div className="flex items-start gap-3">
                  <Wrench className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    task.priority === "high" ? "text-destructive" : 
                    task.priority === "medium" ? "text-amber-500" : "text-primary"
                  )} />
                  <div>
                    <p className="text-sm font-medium">{task.task}</p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled: {task.date} • 
                      <span className={cn(
                        "ml-1 font-medium",
                        task.priority === "high" ? "text-destructive" : 
                        task.priority === "medium" ? "text-amber-500" : "text-primary"
                      )}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                      </span>
                    </p>
                  </div>
                </div>
              </Card>
            ))}
            {upcomingMaintenance.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming maintenance scheduled.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Zone selection dialog */}
      <ZoneSelectionDialog 
        isOpen={showZoneDialog}
        onClose={() => setShowZoneDialog(false)}
        zones={allZones}
        onSelectZone={handleSelectZone}
      />

      {/* Toast notifications */}
      {toast.show && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
    </div>
  );
} 