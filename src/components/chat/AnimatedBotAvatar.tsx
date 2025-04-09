'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface AnimatedBotAvatarProps {
  status?: 'idle' | 'thinking' | 'speaking' | 'error';
  size?: 'sm' | 'md' | 'lg';
  avatarUrl?: string;
  className?: string;
}

export function AnimatedBotAvatar({
  status = 'idle',
  size = 'md',
  avatarUrl = "/images/ai-avatar.png",
  className
}: AnimatedBotAvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  // Different effects based on status
  const statusEffects = {
    idle: "",
    thinking: "before:absolute before:inset-0 before:rounded-full before:bg-green-500/20 before:animate-ripple",
    speaking: "before:absolute before:inset-0 before:rounded-full before:bg-blue-500/20 before:animate-ripple",
    error: "before:absolute before:inset-0 before:rounded-full before:bg-red-500/20 before:animate-ripple"
  };
  
  return (
    <div className={cn("relative", statusEffects[status])}>
      <Avatar className={cn(sizeClasses[size], "border-2 border-background shadow-sm", className)}>
        <AvatarImage src={avatarUrl} alt="AI" />
        <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
      </Avatar>
    </div>
  );
}

// Demo component for showcasing different states
export function AnimatedBotAvatarDemo() {
  const [status, setStatus] = useState<'idle' | 'thinking' | 'speaking' | 'error'>('idle');
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md');
  
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Animated Bot Avatar</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Status</h3>
          <div className="flex flex-wrap gap-2">
            {(['idle', 'thinking', 'speaking', 'error'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm",
                  status === s 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="font-medium mb-2">Size</h3>
          <div className="flex flex-wrap gap-2">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm",
                  size === s 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-6 pt-4">
        <div className="text-center">
          <AnimatedBotAvatar status={status} size={size} />
          <p className="mt-2 text-sm text-muted-foreground">Current</p>
        </div>
        
        <div className="flex gap-4">
          <div className="text-center">
            <AnimatedBotAvatar status="idle" size={size} />
            <p className="mt-2 text-sm text-muted-foreground">Idle</p>
          </div>
          <div className="text-center">
            <AnimatedBotAvatar status="thinking" size={size} />
            <p className="mt-2 text-sm text-muted-foreground">Thinking</p>
          </div>
          <div className="text-center">
            <AnimatedBotAvatar status="speaking" size={size} />
            <p className="mt-2 text-sm text-muted-foreground">Speaking</p>
          </div>
          <div className="text-center">
            <AnimatedBotAvatar status="error" size={size} />
            <p className="mt-2 text-sm text-muted-foreground">Error</p>
          </div>
        </div>
      </div>
    </div>
  );
} 