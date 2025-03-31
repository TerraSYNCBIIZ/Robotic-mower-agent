'use client';

import React from "react";
import { Battery, Clock, Gauge, Wifi, AlertCircle, Play, Pause } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface MowerCardProps {
  id: string;
  name: string;
  status: "idle" | "mowing" | "charging" | "error" | "offline";
  batteryLevel: number;
  lastSeen: string;
  errorMessage?: string;
  className?: string;
}

export function MowerCard({
  id,
  name,
  status,
  batteryLevel,
  lastSeen,
  errorMessage,
  className,
}: MowerCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "mowing":
        return {
          label: "Mowing",
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          icon: Play
        };
      case "charging":
        return {
          label: "Charging",
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
          icon: Battery
        };
      case "error":
        return {
          label: "Error",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
          icon: AlertCircle
        };
      case "offline":
        return {
          label: "Offline",
          color: "text-gray-500",
          bgColor: "bg-gray-500/10",
          borderColor: "border-gray-500/20",
          icon: Wifi
        };
      default:
        return {
          label: "Idle",
          color: "text-gray-400",
          bgColor: "bg-gray-400/10",
          borderColor: "border-gray-400/20",
          icon: Pause
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const batteryColorClass = 
    batteryLevel > 60 
      ? "bg-emerald-500" 
      : batteryLevel > 30 
      ? "bg-amber-500" 
      : "bg-red-500";

  const batteryTextClass = 
    batteryLevel > 60 
      ? "text-emerald-500" 
      : batteryLevel > 30 
      ? "text-amber-500" 
      : "text-red-500";

  const batteryBgClass = 
    batteryLevel > 60 
      ? "bg-emerald-500/20" 
      : batteryLevel > 30 
      ? "bg-amber-500/20" 
      : "bg-red-500/20";

  return (
    <Card className={cn("overflow-hidden border-border", className)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium tracking-tight">{name}</h3>
          <Badge
            variant="outline"
            className={cn(
              "font-normal",
              statusConfig.color,
              statusConfig.bgColor,
              statusConfig.borderColor
            )}
          >
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 pb-0 space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Battery</span>
            <span className={batteryTextClass}>
              {batteryLevel}%
            </span>
          </div>
          <div className={cn("w-full h-1.5 rounded-full overflow-hidden", batteryBgClass)}>
            <div
              className={cn("h-full rounded-full", batteryColorClass)}
              style={{ width: `${batteryLevel}%` }}
            />
          </div>
        </div>

        {status === "error" && errorMessage && (
          <div className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-md">
            <p className="text-xs text-red-500">{errorMessage}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-2 flex items-center justify-between">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="mr-1 h-3 w-3" />
          <span>Last seen {lastSeen}</span>
        </div>
        
        <Link href={`/chat?mower=${id}`}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-8 px-2 text-primary"
          >
            Chat
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
} 