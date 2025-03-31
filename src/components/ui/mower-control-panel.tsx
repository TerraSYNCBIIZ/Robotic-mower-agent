"use client"

import * as React from "react"
import { Calendar, Clock, Droplets, Gauge, Home, Layers, Power, Settings, Sliders } from "lucide-react"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useToast } from "@/components/ui/use-toast"

interface ScheduleDay {
  day: string
  enabled: boolean
  startTime: string
  endTime: string
}

interface MowingArea {
  id: string
  name: string
  size: number
  enabled: boolean
}

export interface RoboticMowerControlPanelProps {
  className?: string
  mowerId: string
}

export function RoboticMowerControlPanel({ className, mowerId }: RoboticMowerControlPanelProps) {
  const [power, setPower] = React.useState(true)
  const [mowingMode, setMowingMode] = React.useState("eco")
  const [cuttingHeight, setCuttingHeight] = React.useState(45)
  const [batteryLevel] = React.useState(85)
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const { toast } = useToast()
  
  const [schedule, setSchedule] = React.useState<ScheduleDay[]>([
    { day: "Monday", enabled: true, startTime: "09:00", endTime: "12:00" },
    { day: "Tuesday", enabled: true, startTime: "09:00", endTime: "12:00" },
    { day: "Wednesday", enabled: true, startTime: "09:00", endTime: "12:00" },
    { day: "Thursday", enabled: true, startTime: "09:00", endTime: "12:00" },
    { day: "Friday", enabled: true, startTime: "09:00", endTime: "12:00" },
    { day: "Saturday", enabled: false, startTime: "10:00", endTime: "13:00" },
    { day: "Sunday", enabled: false, startTime: "10:00", endTime: "13:00" },
  ])

  const [areas, setAreas] = React.useState<MowingArea[]>([
    { id: "1", name: "Front Yard", size: 250, enabled: true },
    { id: "2", name: "Back Yard", size: 350, enabled: true },
    { id: "3", name: "Side Garden", size: 120, enabled: false },
  ])

  const toggleScheduleDay = (index: number) => {
    const newSchedule = [...schedule]
    newSchedule[index].enabled = !newSchedule[index].enabled
    setSchedule(newSchedule)
  }

  const updateScheduleTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newSchedule = [...schedule]
    newSchedule[index][field] = value
    setSchedule(newSchedule)
  }

  const toggleAreaEnabled = (id: string) => {
    setAreas(areas.map(area => 
      area.id === id ? { ...area, enabled: !area.enabled } : area
    ))
  }

  const handleApplySettings = () => {
    toast({
      title: "Settings Applied",
      description: `Your changes have been saved for Mower #${mowerId}`,
      variant: "success",
    })
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Mower Control Panel</CardTitle>
            <CardDescription>Manage your mower settings and schedule</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="power-switch" className="sr-only">Power</Label>
            <Switch 
              id="power-switch" 
              checked={power} 
              onCheckedChange={setPower} 
              className={power ? "bg-green-500" : ""}
            />
            <Power className={cn("h-4 w-4", power ? "text-green-500" : "text-muted-foreground")} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">
              <Calendar className="mr-2 h-4 w-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="mode">
              <Sliders className="mr-2 h-4 w-4" />
              Mode
            </TabsTrigger>
            <TabsTrigger value="areas">
              <Layers className="mr-2 h-4 w-4" />
              Areas
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedule" className="p-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="text-sm font-medium">Weekly Schedule</div>
                <div className="space-y-4">
                  {schedule.map((day, index) => (
                    <div key={day.day} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`day-${index}`}
                          checked={day.enabled}
                          onCheckedChange={() => toggleScheduleDay(index)}
                        />
                        <Label htmlFor={`day-${index}`}>{day.day}</Label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm font-medium">Time Settings</div>
                <div className="space-y-4">
                  {schedule.filter(day => day.enabled).map((day, index) => (
                    <div key={`time-${day.day}`} className="space-y-2">
                      <div className="text-sm font-medium">{day.day}</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`start-${index}`}>Start Time</Label>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input 
                              id={`start-${index}`}
                              type="time"
                              value={day.startTime}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScheduleTime(schedule.findIndex(d => d.day === day.day), 'startTime', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`end-${index}`}>End Time</Label>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input 
                              id={`end-${index}`}
                              type="time"
                              value={day.endTime}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateScheduleTime(schedule.findIndex(d => d.day === day.day), 'endTime', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!schedule.some(day => day.enabled) && (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                      No active days selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="mode" className="p-4 pt-6 space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Mowing Mode</h3>
                <p className="text-sm text-muted-foreground">Select the operation mode for your robotic mower</p>
              </div>
              
              <RadioGroup value={mowingMode} onValueChange={setMowingMode} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="eco" id="eco" className="peer sr-only" />
                  <Label
                    htmlFor="eco"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Droplets className="mb-3 h-6 w-6" />
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-medium leading-none">Eco Mode</p>
                      <p className="text-sm text-muted-foreground">Low power, quiet operation</p>
                    </div>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
                  <Label
                    htmlFor="standard"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Home className="mb-3 h-6 w-6" />
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-medium leading-none">Standard Mode</p>
                      <p className="text-sm text-muted-foreground">Balanced performance</p>
                    </div>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem value="power" id="power" className="peer sr-only" />
                  <Label
                    htmlFor="power-mode"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Gauge className="mb-3 h-6 w-6" />
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-medium leading-none">Power Mode</p>
                      <p className="text-sm text-muted-foreground">Maximum cutting performance</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Cutting Height</h3>
                <p className="text-sm text-muted-foreground">Adjust the grass cutting height</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cutting-height">Height (mm)</Label>
                  <span className="w-12 rounded-md border border-input px-2 py-0.5 text-center text-sm text-muted-foreground">
                    {cuttingHeight}
                  </span>
                </div>
                <Slider
                  id="cutting-height"
                  min={20}
                  max={100}
                  step={5}
                  value={[cuttingHeight]}
                  onValueChange={(value: number[]) => setCuttingHeight(value[0])}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Battery Status</Label>
                <div className="text-sm text-muted-foreground">Current charge: {batteryLevel}%</div>
              </div>
              <div className="w-[100px]">
                <div className="h-3 w-full rounded-full bg-muted">
                  <div 
                    className={cn(
                      "h-full rounded-full", 
                      batteryLevel > 60 ? "bg-green-500" : 
                      batteryLevel > 30 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${batteryLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="areas" className="p-4 pt-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Mowing Areas</h3>
                <p className="text-sm text-muted-foreground">Configure and manage your mowing zones</p>
              </div>
              
              <div className="space-y-4">
                {areas.map((area) => (
                  <div key={area.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="font-medium">{area.name}</div>
                      <div className="text-sm text-muted-foreground">{area.size} m²</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id={`area-${area.id}`}
                        checked={area.enabled}
                        onCheckedChange={() => toggleAreaEnabled(area.id)}
                      />
                      <Label htmlFor={`area-${area.id}`} className="sr-only">Enable {area.name}</Label>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-4">
                <Button variant="outline" className="w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Configure Boundary Wires
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <div className="flex items-center justify-between w-full">
          <Select defaultValue="auto">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatic Mode</SelectItem>
              <SelectItem value="manual">Manual Control</SelectItem>
              <SelectItem value="scheduled">Scheduled Only</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleApplySettings}>
            Apply Settings
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
} 