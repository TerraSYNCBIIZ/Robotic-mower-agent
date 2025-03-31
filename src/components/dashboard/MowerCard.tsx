'use client';

import React from "react";
import { Battery, Clock, Gauge, AlertCircle, Play, Pause, Wrench } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

export interface MowerCardProps {
  name: string;
  status: "idle" | "mowing" | "charging" | "error" | "offline" | "returning" | "parked";
  batteryLevel: number;
  areaComplete: string;
  nextMaintenance: number;
  errorMessage?: string;
  imageSrc?: string;
  className?: string;
  id?: string;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium truncate">{name}</h3>
          <Badge
            variant="outline"
            className={cn(
              "font-normal whitespace-nowrap",
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

      <CardFooter className="p-4 pt-2 flex items-center justify-between">
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
      </CardFooter>
    </Card>
  );
} 