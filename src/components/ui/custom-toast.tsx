"use client";

import * as React from "react";
import { useState, useEffect, createContext, useContext } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onClose?: () => void;
}

interface ToastContextType {
  showToast: (props: ToastProps) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function CustomToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [visible, setVisible] = useState(false);
  
  const showToast = (props: ToastProps) => {
    setToast(props);
    setVisible(true);
    
    if (props.duration !== 0) {
      setTimeout(() => {
        hideToast();
      }, props.duration || 3000);
    }
  };
  
  const hideToast = () => {
    setVisible(false);
    setTimeout(() => setToast(null), 300); // Wait for animation to finish
  };
  
  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
      {toast && (
        <div 
          className={cn(
            "fixed bottom-4 right-4 z-50 max-w-sm transition-all duration-300",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
        >
          <div 
            className={cn(
              "p-4 rounded-md shadow-md flex items-start justify-between",
              toast.type === "success" ? "bg-green-100 text-green-800 border border-green-200" :
              toast.type === "error" ? "bg-red-100 text-red-800 border border-red-200" :
              toast.type === "warning" ? "bg-yellow-100 text-yellow-800 border border-yellow-200" :
              "bg-blue-100 text-blue-800 border border-blue-200"
            )}
          >
            <div>{toast.message}</div>
            <button 
              onClick={() => {
                hideToast();
                toast.onClose?.();
              }}
              className="ml-2 -mr-1 p-1 rounded-md hover:bg-black/5"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useCustomToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useCustomToast must be used within a CustomToastProvider");
  }
  return context;
} 