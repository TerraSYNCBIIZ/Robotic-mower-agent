"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Calendar, 
  Clock, 
  Edit, 
  Info, 
  MapPin, 
  MoreHorizontal, 
  Plus, 
  Settings, 
  Trash2 
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Schedule {
  days: string[]
  startTime: string
  endTime: string
}

export interface Zone {
  id: string
  name: string
  status: "active" | "inactive" | "scheduled"
  area: number
  schedule: Schedule
  lastMowed?: string
  nextScheduled?: string
}

interface MowerZoneManagerProps {
  zones: Zone[]
  onAddZone?: () => void
  onEditZone?: (zone: Zone) => void
  onDeleteZone?: (zoneId: string) => void
  onToggleZone?: (zoneId: string, enabled: boolean) => void
  className?: string
}

// New interface for the adapter component that accepts mowerId
interface MowerZoneManagerAdapterProps {
  mowerId: string
  className?: string
}

// The adapter component that accepts mowerId and provides mock data
export function MowerZoneManager({
  mowerId,
  className
}: MowerZoneManagerAdapterProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch zones data when mowerId changes
  useEffect(() => {
    const fetchZonesData = async () => {
      if (!mowerId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // In a real application, you would fetch zones data from an API
        // For demonstration, we'll create mock data
        
        // Mock zones data for demonstration
        const mockZones: Zone[] = [
          {
            id: `${mowerId}-zone-1`,
            name: "Front Yard",
            status: "active" as const,
            area: 250,
            schedule: {
              days: ["Monday", "Wednesday", "Friday"],
              startTime: "09:00",
              endTime: "11:00"
            },
            lastMowed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            nextScheduled: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString()
          },
          {
            id: `${mowerId}-zone-2`,
            name: "Back Yard",
            status: "scheduled" as const,
            area: 350,
            schedule: {
              days: ["Tuesday", "Thursday", "Saturday"],
              startTime: "14:00",
              endTime: "16:00"
            },
            lastMowed: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            nextScheduled: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString()
          },
          {
            id: `${mowerId}-zone-3`,
            name: "Side Garden",
            status: "inactive" as const,
            area: 120,
            schedule: {
              days: ["Sunday"],
              startTime: "10:00",
              endTime: "12:00"
            }
          }
        ]

        setZones(mockZones)
      } catch (error) {
        console.error("Failed to fetch zones data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchZonesData()
  }, [mowerId])

  // Handler functions
  const handleAddZone = () => {
    // In a real application, you would make an API call
    console.log(`Adding new zone for mower ${mowerId}`)
    
    // For demonstration, add a new zone to the local state
    const newZone: Zone = {
      id: `${mowerId}-zone-${zones.length + 1}`,
      name: `New Zone ${zones.length + 1}`,
      status: "inactive" as const,
      area: 100,
      schedule: {
        days: ["Monday"],
        startTime: "12:00",
        endTime: "14:00"
      }
    }
    
    setZones([...zones, newZone])
  }

  const handleEditZone = (zone: Zone) => {
    // In a real application, you would make an API call
    console.log(`Editing zone ${zone.id} for mower ${mowerId}`)
    
    // For demonstration, update the zone in the local state
    // In a real application, you would apply actual changes here
    const updatedZones = zones.map(z => z.id === zone.id ? { ...zone, name: `${zone.name} (Updated)` } : z)
    setZones(updatedZones)
  }

  const handleDeleteZone = (zoneId: string) => {
    // In a real application, you would make an API call
    console.log(`Deleting zone ${zoneId} for mower ${mowerId}`)
    
    // For demonstration, remove the zone from the local state
    const updatedZones = zones.filter(z => z.id !== zoneId)
    setZones(updatedZones)
  }

  const handleToggleZone = (zoneId: string, enabled: boolean) => {
    // In a real application, you would make an API call
    console.log(`Toggling zone ${zoneId} to ${enabled ? 'active' : 'inactive'} for mower ${mowerId}`)
    
    // For demonstration, update the zone status in the local state
    const updatedZones = zones.map(z => 
      z.id === zoneId 
        ? { ...z, status: enabled ? ("active" as const) : ("inactive" as const) } 
        : z
    )
    setZones(updatedZones)
  }

  if (loading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
            </div>
            <div className="h-9 w-24 bg-muted rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-28 bg-muted rounded animate-pulse" />
            <div className="h-28 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render the original component with the adapted props
  return (
    <MowerZoneManagerOriginal
      zones={zones}
      onAddZone={handleAddZone}
      onEditZone={handleEditZone}
      onDeleteZone={handleDeleteZone}
      onToggleZone={handleToggleZone}
      className={className}
    />
  )
}

// Rename the original component
export function MowerZoneManagerOriginal({
  zones,
  onAddZone,
  onEditZone,
  onDeleteZone,
  onToggleZone,
  className,
}: MowerZoneManagerProps) {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const handleToggleZone = (zone: Zone, enabled: boolean) => {
    onToggleZone?.(zone.id, enabled)
  }

  const handleEditZone = (zone: Zone) => {
    setSelectedZone(zone)
    setIsEditDialogOpen(true)
  }

  const handleDeleteZone = (zoneId: string) => {
    onDeleteZone?.(zoneId)
  }

  const getStatusColor = (status: Zone["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "inactive":
        return "bg-gray-400"
      case "scheduled":
        return "bg-blue-500"
      default:
        return "bg-gray-400"
    }
  }

  const getStatusText = (status: Zone["status"]) => {
    switch (status) {
      case "active":
        return "Active"
      case "inactive":
        return "Inactive"
      case "scheduled":
        return "Scheduled"
      default:
        return "Unknown"
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Mower Work Areas</CardTitle>
          <CardDescription>Manage your mower zones and schedules</CardDescription>
        </div>
        <Button onClick={onAddZone} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {zones.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/50 p-8 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No zones configured</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your first mowing zone to get started
            </p>
            <Button onClick={onAddZone} className="mt-4" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Zone
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {zones.map((zone) => (
              <motion.div
                key={zone.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-4">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", 
                        zone.status === "active" ? "bg-green-100 dark:bg-green-900/30" : 
                        zone.status === "scheduled" ? "bg-blue-100 dark:bg-blue-900/30" : 
                        "bg-gray-100 dark:bg-gray-800/50"
                      )}>
                        <MapPin className={cn("h-5 w-5", 
                          zone.status === "active" ? "text-green-600 dark:text-green-400" : 
                          zone.status === "scheduled" ? "text-blue-600 dark:text-blue-400" : 
                          "text-gray-500 dark:text-gray-400"
                        )} />
                      </div>
                      <div>
                        <h3 className="font-medium">{zone.name}</h3>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>{zone.area} m²</span>
                          <span className="text-xs">•</span>
                          <div className="flex items-center">
                            <div className={cn("mr-1.5 h-2 w-2 rounded-full", getStatusColor(zone.status))} />
                            <span>{getStatusText(zone.status)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={zone.status !== "inactive"} 
                        onCheckedChange={(checked) => handleToggleZone(zone, checked)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditZone(zone)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Zone
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteZone(zone.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Zone
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Schedule:</span>
                      <span>{zone.schedule.days.join(", ")}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Time:</span>
                      <span>{zone.schedule.startTime} - {zone.schedule.endTime}</span>
                    </div>
                    {zone.lastMowed && (
                      <div className="flex items-center space-x-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Last mowed:</span>
                        <span>{zone.lastMowed}</span>
                      </div>
                    )}
                    {zone.nextScheduled && (
                      <div className="flex items-center space-x-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Next scheduled:</span>
                        <span>{zone.nextScheduled}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t bg-muted/50 px-6 py-3">
        <div className="text-sm text-muted-foreground">
          {zones.length} zone{zones.length !== 1 ? "s" : ""} configured
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zone Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>

      {selectedZone && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Zone</DialogTitle>
              <DialogDescription>
                Update the zone details and schedule
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Zone Details</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Zone Name</Label>
                    <Input id="name" defaultValue={selectedZone.name} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="area">Area (m²)</Label>
                    <Input id="area" type="number" defaultValue={selectedZone.area} />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="schedule" className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                        <Badge 
                          key={day} 
                          variant={selectedZone.schedule.days.includes(day) ? "default" : "outline"}
                          className="cursor-pointer"
                        >
                          {day.substring(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input id="startTime" type="time" defaultValue={selectedZone.schedule.startTime} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input id="endTime" type="time" defaultValue={selectedZone.schedule.endTime} />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                onEditZone?.(selectedZone)
                setIsEditDialogOpen(false)
              }}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
} 