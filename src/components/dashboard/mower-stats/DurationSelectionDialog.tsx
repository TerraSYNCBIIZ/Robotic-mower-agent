"use client";

import React from "react";
import { X, Clock, PlayCircle, Calendar, BatteryFull, PowerOff } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogClose, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DurationSelectionDialogProps } from "./types";

export function DurationSelectionDialog({ 
  isOpen, 
  onClose, 
  selectedZone,
  onSelectDuration
}: DurationSelectionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogClose asChild className="absolute right-1 top-1 bg-background/80 backdrop-blur-sm rounded-full z-10 hover:bg-muted transition-colors">
          <Button variant="ghost" size="icon" className="h-7 w-7 border-none shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>Mowing Duration</DialogTitle>
          <DialogDescription>
            {selectedZone?.workAreaId 
              ? `Select how long to mow in ${selectedZone.name}` 
              : 'Select how long to mow'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Time-based Options</h3>
            <Separator />
          </div>
          
          <Button 
            onClick={() => onSelectDuration(60, selectedZone?.workAreaId ? 'StartInWorkArea' : 'Start')}
            className="flex items-center justify-start gap-2"
            variant="outline"
          >
            <Clock className="h-4 w-4 text-blue-500" />
            Mow for 1 hour
          </Button>
          
          <Button 
            onClick={() => onSelectDuration(120, selectedZone?.workAreaId ? 'StartInWorkArea' : 'Start')}
            className="flex items-center justify-start gap-2"
            variant="outline"
          >
            <Clock className="h-4 w-4 text-blue-500" />
            Mow for 2 hours
          </Button>
          
          <Button 
            onClick={() => onSelectDuration(180, selectedZone?.workAreaId ? 'StartInWorkArea' : 'Start')}
            className="flex items-center justify-start gap-2"
            variant="outline"
          >
            <Clock className="h-4 w-4 text-blue-500" />
            Mow for 3 hours
          </Button>
          
          <div className="space-y-2 mt-2">
            <h3 className="text-sm font-medium">Schedule-based Options</h3>
            <Separator />
          </div>
          
          <Button 
            onClick={() => onSelectDuration(0, 'ResumeSchedule')}
            className="flex items-center justify-start gap-2"
            variant="outline"
          >
            <Calendar className="h-4 w-4 text-emerald-500" />
            Resume regular schedule
          </Button>
          
          <Button 
            onClick={() => onSelectDuration(0, 'ParkUntilNextSchedule')}
            className="flex items-center justify-start gap-2"
            variant="outline"
          >
            <BatteryFull className="h-4 w-4 text-amber-500" />
            Park until next scheduled task
          </Button>
          
          <Button 
            onClick={() => onSelectDuration(0, 'ParkUntilFurtherNotice')}
            className="flex items-center justify-start gap-2"
            variant="outline"
          >
            <PowerOff className="h-4 w-4 text-red-500" />
            Park until further notice
          </Button>
        </div>
        
        <DialogFooter className="sm:justify-start">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={onClose}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 