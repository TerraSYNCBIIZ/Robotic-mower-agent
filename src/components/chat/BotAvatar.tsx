import React from 'react';
import { cn } from "@/lib/utils";
import { Loader2, Bot } from "lucide-react";

// Types for the avatar states
type AvatarState = 'idle' | 'thinking' | 'speaking';

// Props for the component
interface BotAvatarProps {
  state?: AvatarState;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function BotAvatar({
  state = 'idle',
  size = 'md',
  color = "#10b981", // Default to a teal/green
  className
}: BotAvatarProps) {
  // Size mapping
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  // Background animation based on state
  const bgAnimation = {
    idle: "bg-background/80",
    thinking: "bg-background/80 animate-pulse",
    speaking: "bg-background/80 animate-ripple", // Custom animation in globals.css
  };

  // Render icon based on state
  const renderIcon = () => {
    switch (state) {
      case 'thinking':
        return <Loader2 className="h-1/2 w-1/2 animate-spin" style={{ color }} />;
      case 'speaking':
        return (
          <div className="relative h-1/2 w-1/2">
            <Bot className="absolute" style={{ color }} />
            <div 
              className="absolute h-full w-full rounded-full animate-ping opacity-30"
              style={{ backgroundColor: color }}
            />
          </div>
        );
      default:
        return <Bot className="h-1/2 w-1/2" style={{ color }} />;
    }
  };

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center rounded-full border border-border/30 shadow-sm transition-all duration-300",
        sizeClass[size],
        bgAnimation[state],
        className
      )}
    >
      {renderIcon()}
      
      {/* Glow effect based on state */}
      <div 
        className={cn(
          "absolute -z-10 inset-0 rounded-full blur-md opacity-0 transition-opacity duration-300",
          state === 'speaking' && "opacity-40",
          state === 'thinking' && "opacity-20 animate-pulse"
        )}
        style={{ backgroundColor: color }}
      />
    </div>
  );
} 