"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { ToastProps } from "./types";

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in-20">
      <div className={cn(
        "rounded-md p-4 shadow-md flex items-center gap-3 bg-white dark:bg-slate-800 border",
        type === 'success' && "border-green-500",
        type === 'error' && "border-red-500",
        type === 'warning' && "border-amber-500",
        type === 'info' && "border-blue-500"
      )}>
        {icons[type]}
        <div className="text-sm">{message}</div>
        <button 
          onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 