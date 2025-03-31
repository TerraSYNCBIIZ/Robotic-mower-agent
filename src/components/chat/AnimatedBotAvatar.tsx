"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Brain, Zap, Loader2 } from "lucide-react"

interface BotAvatarProps {
  state?: "idle" | "thinking" | "active"
  size?: "sm" | "md" | "lg"
  fallback?: string
  src?: string
  className?: string
  alt?: string
}

const stateColors = {
  idle: "bg-muted",
  thinking: "bg-amber-500",
  active: "bg-emerald-500"
}

const stateIcons = {
  idle: Brain,
  thinking: Loader2,
  active: Zap
}

export function AnimatedBotAvatar({
  state = "idle",
  size = "md",
  fallback = "AI",
  src,
  className,
  alt = "AI Assistant avatar"
}: BotAvatarProps) {
  const StateIcon = stateIcons[state]
  
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  }

  return (
    <div className={cn("relative", className)}>
      <Avatar className={cn(sizeClasses[size])}>
        {src && <AvatarImage src={src} alt={alt} />}
        <AvatarFallback className="bg-background text-foreground">
          {fallback}
        </AvatarFallback>
      </Avatar>
      
      <AnimatePresence mode="wait">
        <motion.div 
          key={state}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-background",
            stateColors[state],
            size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6"
          )}
        >
          <StateIcon 
            className={cn(
              "text-white",
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-4 w-4",
              state === "thinking" && "animate-spin"
            )} 
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function MessageLoading() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="text-foreground"
    >
      <circle cx="4" cy="12" r="2" fill="currentColor">
        <animate
          id="spinner_qFRN"
          begin="0;spinner_OcgL.end+0.25s"
          attributeName="cy"
          calcMode="spline"
          dur="0.6s"
          values="12;6;12"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
        />
      </circle>
      <circle cx="12" cy="12" r="2" fill="currentColor">
        <animate
          begin="spinner_qFRN.begin+0.1s"
          attributeName="cy"
          calcMode="spline"
          dur="0.6s"
          values="12;6;12"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
        />
      </circle>
      <circle cx="20" cy="12" r="2" fill="currentColor">
        <animate
          id="spinner_OcgL"
          begin="spinner_qFRN.begin+0.2s"
          attributeName="cy"
          calcMode="spline"
          dur="0.6s"
          values="12;6;12"
          keySplines=".33,.66,.66,1;.33,0,.66,.33"
        />
      </circle>
    </svg>
  );
}

export function AnimatedBotAvatarDemo() {
  const [state, setState] = React.useState<"idle" | "thinking" | "active">("idle")
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setState(prevState => {
        if (prevState === "idle") return "thinking"
        if (prevState === "thinking") return "active"
        return "idle"
      })
    }, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <h2 className="text-xl font-semibold">Bot Avatar States</h2>
      
      <div className="flex gap-8">
        <div className="flex flex-col items-center gap-2">
          <AnimatedBotAvatar state="idle" size="md" />
          <span className="text-sm text-muted-foreground">Idle</span>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <AnimatedBotAvatar state="thinking" size="md" />
          <span className="text-sm text-muted-foreground">Thinking</span>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <AnimatedBotAvatar state="active" size="md" />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-4 mt-8">
        <h3 className="text-lg font-medium">Animated Demo</h3>
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <AnimatedBotAvatar state={state} size="lg" />
          <div className="flex flex-col gap-1">
            <div className="font-medium">AI Assistant</div>
            <div className="text-sm text-muted-foreground">
              {state === "idle" && "Ready to help"}
              {state === "thinking" && <div className="flex items-center gap-2">Thinking <MessageLoading /></div>}
              {state === "active" && "Processing your request..."}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-8 mt-8">
        <div className="flex flex-col items-center gap-2">
          <AnimatedBotAvatar state={state} size="sm" />
          <span className="text-sm text-muted-foreground">Small</span>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <AnimatedBotAvatar state={state} size="md" />
          <span className="text-sm text-muted-foreground">Medium</span>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <AnimatedBotAvatar state={state} size="lg" />
          <span className="text-sm text-muted-foreground">Large</span>
        </div>
      </div>
    </div>
  )
} 