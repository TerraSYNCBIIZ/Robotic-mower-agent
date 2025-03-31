"use client";

import React, { createContext, useContext, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = (options: ConfirmDialogOptions): Promise<boolean> => {
    const promise = new Promise<boolean>((resolve) => {
      setOptions(options);
      setResolver(() => resolve);
      setOpen(true);
    });
    
    return promise;
  };

  const handleConfirm = () => {
    if (resolver) {
      resolver(true);
      setOpen(false);
      setResolver(null);
    }
  };

  const handleCancel = () => {
    if (resolver) {
      resolver(false);
      setOpen(false);
      setResolver(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {options && (
        <Dialog open={open} onOpenChange={(open) => {
          if (!open) handleCancel();
          setOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{options.title}</DialogTitle>
              {options.message && (
                <DialogDescription>{options.message}</DialogDescription>
              )}
            </DialogHeader>
            
            <DialogFooter className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={handleCancel}>
                {options.cancelText || "Cancel"}
              </Button>
              <Button onClick={handleConfirm}>
                {options.confirmText || "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
} 