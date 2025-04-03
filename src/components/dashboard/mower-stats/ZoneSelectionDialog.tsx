"use client";

import React from "react";
import { X, PlayCircle } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogClose, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoneSelectionDialogProps } from "./types";

export function ZoneSelectionDialog({ 
  isOpen, 
  onClose, 
  zones, 
  onSelectZone 
}: ZoneSelectionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogClose asChild className="absolute right-1 top-1 bg-background/80 backdrop-blur-sm rounded-full z-10 hover:bg-muted transition-colors">
          <Button variant="ghost" size="icon" className="h-7 w-7 border-none shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>Select Zone to Mow</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {zones.map((zone) => (
            <Button
              key={zone.name}
              variant="outline"
              className="flex justify-start items-center gap-2 h-10 px-3"
              onClick={() => {
                onSelectZone(zone.name, zone.workAreaId);
                onClose();
              }}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: zone.color }}
              />
              <span>{zone.name}</span>
            </Button>
          ))}
        </div>
        
        <DialogFooter className="mt-2">
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              onSelectZone("Entire Yard");
              onClose();
            }}
          >
            <PlayCircle className="h-4 w-4" />
            Start Without Zone Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 