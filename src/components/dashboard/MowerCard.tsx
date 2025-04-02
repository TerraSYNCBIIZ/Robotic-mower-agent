'use client';

import React from "react";
import { Battery, Clock, Gauge, AlertCircle, Play, Pause, Wrench, RefreshCw, Tag } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface MowerCardProps {
  name: string;
  status: "idle" | "mowing" | "charging" | "error" | "offline" | "returning" | "parked" | "online" | "paused";
  batteryLevel: number;
  areaComplete: string;
  nextMaintenance: number;
  errorMessage?: string | null;
  imageSrc?: string;
  className?: string;
  id?: string;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  lastUpdated?: Date;
  dataSource?: 'websocket' | 'api_poll' | 'dashboard_refresh' | string;
  categories?: Category[];
}

export function MowerCard({
  name,
  status,
  batteryLevel,
  areaComplete,
  nextMaintenance,
  errorMessage,
  imageSrc,
  className,
  id,
  isSelected = false,
  onSelect,
  lastUpdated,
  dataSource,
  categories = [],
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
      case "parked":
        return {
          label: "Parked",
          color: "text-slate-500",
          bgColor: "bg-slate-500/10",
          borderColor: "border-slate-500/20",
          icon: Battery
        };
      case "returning":
        return {
          label: "Returning",
          color: "text-indigo-500",
          bgColor: "bg-indigo-500/10",
          borderColor: "border-indigo-500/20",
          icon: Clock
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
          icon: Gauge
        };
      case "online":
        return {
          label: "Online",
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          icon: Gauge
        };
      case "paused":
        return {
          label: "Paused",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/20",
          icon: Pause
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

  const handleClick = () => {
    if (id && onSelect) {
      onSelect(id);
    }
  };

  // Map color names to actual Tailwind classes
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "bg-red-500",
      blue: "bg-blue-500",
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      pink: "bg-pink-500",
      gray: "bg-gray-500",
    };
    return colorMap[color] || "bg-gray-500";
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden border-border h-full", 
        isSelected && "ring-2 ring-primary",
        id && onSelect && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
      onClick={handleClick}
    >
      {imageSrc && (
        <div className="relative w-full h-32">
          <Image
            src={imageSrc}
            alt={name}
            className="object-contain"
            fill
            priority={id === "m1"}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
        </div>
      )}

      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium truncate">{name}</h3>
        </div>
        
        {/* Status badge - now at the top */}
        <Badge
          variant="outline"
          className={cn(
            "font-normal whitespace-nowrap",
            statusConfig.color,
            statusConfig.bgColor,
            statusConfig.borderColor,
            "w-full justify-center py-1.5 my-1"
          )}
        >
          <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
          {statusConfig.label}
        </Badge>
        
        {/* Categories section */}
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            <div className="flex items-center mr-1">
              <Tag className="h-3 w-3 text-muted-foreground mr-1" />
            </div>
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant="secondary"
                className="text-xs py-0 h-5 gap-1.5"
              >
                <span 
                  className={`w-2 h-2 rounded-full ${getColorClass(category.color)}`} 
                />
                {category.name}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <Tag className="h-3 w-3 mr-1" />
            <span>No categories</span>
          </div>
        )}
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

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Area Complete</span>
            <span className="text-muted-foreground">{areaComplete}</span>
          </div>
          {areaComplete !== 'N/A' ? (
            <Progress value={Number.parseInt(areaComplete || '0')} className="h-1.5" />
          ) : (
            <div className="h-1.5 w-full rounded-full bg-gray-600/20 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Not Available</span>
            </div>
          )}
        </div>

        {status === "error" && errorMessage && (
          <div className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-md">
            <p className="text-xs text-red-500">{errorMessage}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-2 flex-col space-y-3">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center text-xs text-muted-foreground">
            <Wrench className="mr-1 h-3 w-3" />
            <span>Maintenance in {nextMaintenance} days</span>
          </div>
          
          <Link href={`/chat?mower=${name}`}>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-2 text-primary"
            >
              Chat
            </Button>
          </Link>
        </div>
        
        {lastUpdated && (
          <div className="w-full flex items-center justify-between border-t border-border pt-2">
            <div className="flex items-center text-xs text-muted-foreground">
              <RefreshCw className="mr-1 h-3 w-3" />
              <span>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
            </div>
            
            {dataSource && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] h-5 px-1 bg-secondary/30 hover:bg-secondary/40">
                      {dataSource === 'websocket' ? 'Live' : 
                       dataSource === 'api_poll' ? 'API' : 
                       dataSource === 'dashboard_refresh' ? 'Full Refresh' : 
                       dataSource}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover border border-border text-popover-foreground">
                    <p className="text-xs">
                      {dataSource === 'websocket' ? 'Live WebSocket data' : 
                       dataSource === 'api_poll' ? 'Regular API poll' : 
                       dataSource === 'dashboard_refresh' ? 'Full dashboard refresh' : 
                       `Source: ${dataSource}`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 