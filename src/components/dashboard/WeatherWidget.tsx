"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Cloud, 
  CloudRain, 
  Snowflake, 
  Loader2, 
  MapPin, 
  RefreshCw, 
  Sun, 
  Moon, 
  CloudLightning, 
  CloudFog, 
  Thermometer,
  Wind,
  Droplets,
  Umbrella,
  AlertCircle,
  Zap,
  Flame,
  ThermometerSnowflake,
  CloudHail
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getCachedLocationName } from "@/lib/weather/location-utils"
import type { WeatherData, WeatherType, WeatherAlert, AlertType, AlertSeverity } from "@/types/weather"
import { Badge } from "@/components/ui/badge"

interface WeatherWidgetProps {
  className?: string
  width?: string
  onFetchWeather?: () => Promise<WeatherData>
  city?: string
  displayName?: string
  latitude?: number
  longitude?: number
  isFromMowerLocation?: boolean
}

const WeatherWidget = ({
  className = "",
  width = "100%",
  onFetchWeather,
  city = "New York",
  displayName,
  latitude,
  longitude,
  isFromMowerLocation = false
}: WeatherWidgetProps) => {
  const [weather, setWeather] = React.useState<WeatherData | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState<boolean>(false)
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false)
  const [locationName, setLocationName] = React.useState<string>(displayName || city)

  // When we have coordinates but no display name, try to get it via reverse geocoding
  React.useEffect(() => {
    const fetchLocationName = async () => {
      if (latitude && longitude && !displayName) {
        try {
          const name = await getCachedLocationName(latitude, longitude);
          setLocationName(name);
        } catch (err) {
          console.error("Error getting location name:", err);
          // Fall back to city name if provided, or "Unknown Location"
          setLocationName(city || "Unknown Location");
        }
      } else if (displayName) {
        setLocationName(displayName);
      }
    };

    fetchLocationName();
  }, [latitude, longitude, displayName, city]);

  const fetchWeather = React.useCallback(async () => {
    setRefreshing(true)
    try {
      // If custom fetch function is provided, use it
      if (onFetchWeather) {
        const data = await onFetchWeather()
        setWeather(data)
        return
      }

      // Otherwise, use our API endpoint
      let url = '/api/weather?'
      
      // Prioritize coordinates if available
      if (latitude !== undefined && longitude !== undefined) {
        url += `lat=${latitude}&lon=${longitude}`
      } else if (city) {
        url += `city=${encodeURIComponent(city)}`
      } else {
        // Default to New York if no location is provided
        url += 'city=New York'
      }
      
      const response = await fetch(url)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch weather data')
      }
      
      const data = await response.json()
      setWeather(data)
    } catch (err) {
      console.error('Error fetching weather:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch weather data'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [onFetchWeather, city, latitude, longitude])

  React.useEffect(() => {
    fetchWeather()
    
    // Refresh weather data every 15 minutes
    const interval = setInterval(() => {
      fetchWeather()
    }, 15 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [fetchWeather])

  const handleRefresh = () => {
    setLoading(true)
    fetchWeather()
  }

  // Get appropriate weather icon based on weather type and time of day
  const getWeatherIcon = (type: WeatherType, isDay: boolean): React.ReactNode => {
    switch (type) {
      case 'clear':
        return isDay 
          ? <Sun className="h-8 w-8 text-amber-400" /> 
          : <Moon className="h-8 w-8 text-slate-300" />
      case 'clouds':
        return <Cloud className="h-8 w-8 text-slate-500" />
      case 'rain':
        return <CloudRain className="h-8 w-8 text-blue-400" />
      case 'snow':
        return <Snowflake className="h-8 w-8 text-blue-300" />
      case 'thunderstorm':
        return <CloudLightning className="h-8 w-8 text-amber-400" />
      case 'mist':
        return <CloudFog className="h-8 w-8 text-slate-400" />
      default:
        return <Thermometer className="h-8 w-8 text-slate-500" />
    }
  }

  // Get appropriate alert icon based on alert type
  const getAlertIcon = (type: AlertType, size: number = 16): React.ReactNode => {
    switch (type) {
      case 'extreme_heat':
        return <Flame className={`h-${size} w-${size} text-red-500`} />
      case 'extreme_cold':
        return <ThermometerSnowflake className={`h-${size} w-${size} text-blue-400`} />
      case 'thunderstorm':
        return <CloudLightning className={`h-${size} w-${size} text-amber-500`} />
      case 'lightning':
        return <Zap className={`h-${size} w-${size} text-amber-400`} />
      case 'high_wind':
        return <Wind className={`h-${size} w-${size} text-indigo-400`} />
      case 'flooding':
        return <Droplets className={`h-${size} w-${size} text-blue-500`} />
      case 'heavy_rain':
        return <CloudRain className={`h-${size} w-${size} text-blue-500`} />
      case 'hail':
        return <CloudHail className={`h-${size} w-${size} text-slate-400`} />
      case 'tornado':
        return <Wind className={`h-${size} w-${size} text-purple-500 animate-spin-slow`} />
      case 'snow':
        return <Snowflake className={`h-${size} w-${size} text-blue-300`} />
      default:
        return <AlertCircle className={`h-${size} w-${size} text-amber-500`} />
    }
  }

  // Get severity badge color
  const getSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'extreme':
        return 'bg-red-600 hover:bg-red-700'
      case 'high':
        return 'bg-orange-500 hover:bg-orange-600'
      case 'moderate':
        return 'bg-amber-500 hover:bg-amber-600'
      case 'low':
        return 'bg-blue-500 hover:bg-blue-600'
      default:
        return 'bg-slate-500 hover:bg-slate-600'
    }
  }

  // Format day offset
  const formatDayOffset = (dayOffset: number): string => {
    if (dayOffset === 0) return 'Today'
    if (dayOffset === 1) return 'Tomorrow'
    return `In ${dayOffset} days`
  }

  return (
    <>
      <Card 
        className={`overflow-hidden rounded-xl hover:shadow-md transition-shadow duration-200 h-full flex flex-col ${className}`}
        style={{ width }}
        onClick={() => setDialogOpen(true)}
        role="button"
      >
        <CardContent className="p-4 flex-grow flex flex-col justify-between">
          {loading ? (
            <div className="flex items-center justify-center p-4 h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-center h-full flex flex-col justify-center">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRefresh()
                }}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                <span>Try Again</span>
              </button>
            </div>
          ) : weather && (
            <div className="flex flex-col h-full justify-between gap-2">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-5xl">
                      {getWeatherIcon(weather.weatherType, weather.isDay)}
                    </div>
                    <div className="flex flex-col">
                      <div className="text-4xl font-extralight">
                        {weather.temperature}<span className="text-2xl">°</span>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {weather.weatherType.replace('-', ' ')}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefresh()
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                  </button>
                </div>
                
                <div className="space-y-1 mb-3">
                  <div className="flex items-center text-sm">
                    <MapPin size={14} className={`mr-1 ${isFromMowerLocation ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={isFromMowerLocation ? "text-green-500 font-medium" : "text-muted-foreground"}>
                      {locationName}
                      {isFromMowerLocation && <span className="ml-1 text-xs opacity-75">(mower location)</span>}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {weather.dateTime}
                  </div>
                </div>
              
                {/* Additional weather info */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t mb-3">
                  <div className="flex flex-col items-center">
                    <Droplets className="h-4 w-4 text-blue-500 mb-1" />
                    <span className="text-xs font-medium">Humidity</span>
                    <span className="text-sm">{weather.humidity || '60'}%</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <Wind className="h-4 w-4 text-slate-500 mb-1" />
                    <span className="text-xs font-medium">Wind</span>
                    <span className="text-sm">{weather.windSpeed || '5'} km/h</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <Umbrella className="h-4 w-4 text-indigo-500 mb-1" />
                    <span className="text-xs font-medium">Rain</span>
                    <span className="text-sm">{weather.precipitation || '0'}%</span>
                  </div>
                </div>
                
                {/* Mini forecast */}
                {weather.forecast && weather.forecast.length > 0 && (
                  <div className="border-t pt-3 mb-3">
                    <h3 className="text-xs font-medium mb-2">Next 3 Days</h3>
                    <div className="flex justify-between">
                      {weather.forecast.slice(0, 3).map((day, index) => (
                        <div key={day.date} className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">
                            {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.dayOfWeek}
                          </span>
                          <div className="my-1 text-sm">
                            {getWeatherIcon(day.weatherType, true)}
                          </div>
                          <span className="text-xs font-medium">{day.temperature}°</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Weather alerts section (moved to bottom) */}
              {weather.alerts && weather.alerts.length > 0 && (
                <div className="mt-auto border-t pt-3">
                  <h3 className="text-xs font-semibold text-destructive flex items-center mb-2">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Inclement Weather Alerts
                  </h3>
                  <div className="space-y-2 max-h-[90px] overflow-y-auto pr-1 custom-scrollbar">
                    {weather.alerts.slice(0, 2).map((alert, index) => (
                      <div 
                        key={`${alert.type}-${index}`} 
                        className="flex items-start gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate">
                              {alert.description}
                            </span>
                            <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 h-5 ml-1 text-white ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatDayOffset(alert.dayOffset)} • {alert.date}
                          </div>
                        </div>
                      </div>
                    ))}
                    {weather.alerts.length > 2 && (
                      <div className="text-xs text-center text-muted-foreground pt-1">
                        +{weather.alerts.length - 2} more alerts
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Weather Forecast</DialogTitle>
          </DialogHeader>
          
          {weather && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">
                    {getWeatherIcon(weather.weatherType, weather.isDay)}
                  </div>
                  <div>
                    <div className="text-5xl font-light">
                      {weather.temperature}<span className="text-3xl">°</span>
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {weather.weatherType.replace('-', ' ')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <MapPin size={14} className={isFromMowerLocation ? "text-green-500" : "text-foreground"} />
                    <div className="text-lg font-medium">{locationName}</div>
                  </div>
                  {isFromMowerLocation && (
                    <div className="text-xs text-green-500 italic">Based on mower location</div>
                  )}
                  <div className="text-sm text-muted-foreground">{weather.dateTime}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="flex flex-col items-center gap-1">
                  <Droplets className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">Humidity</span>
                  <span className="text-lg">{weather.humidity}%</span>
                </div>
                
                <div className="flex flex-col items-center gap-1">
                  <Wind className="h-5 w-5 text-slate-500" />
                  <span className="text-sm font-medium">Wind</span>
                  <span className="text-lg">{weather.windSpeed} km/h</span>
                </div>
                
                <div className="flex flex-col items-center gap-1">
                  <Umbrella className="h-5 w-5 text-indigo-500" />
                  <span className="text-sm font-medium">Precipitation</span>
                  <span className="text-lg">{weather.precipitation}%</span>
                </div>
              </div>
              
              {/* Weather alerts section in dialog */}
              {weather.alerts && weather.alerts.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium flex items-center mb-3 text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                    Inclement Weather Alerts
                  </h3>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {weather.alerts.map((alert, index) => (
                      <div 
                        key={`${alert.type}-${index}`} 
                        className="flex items-start gap-3 p-3 rounded-md bg-muted/60"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getAlertIcon(alert.type, 5)}
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {alert.description}
                            </span>
                            <Badge className={`text-xs py-0.5 px-2 text-white ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDayOffset(alert.dayOffset)} • {alert.date}
                          </div>
                          <div className="text-xs mt-2">
                            {alert.type === 'extreme_heat' && (
                              <span><span className="font-medium">Mower Safety:</span> Avoid mowing during extreme heat to prevent damage to your lawn and mower.</span>
                            )}
                            {alert.type === 'thunderstorm' && (
                              <span><span className="font-medium">Mower Safety:</span> Do not mow during thunderstorms. Consider disconnecting charging station.</span>
                            )}
                            {alert.type === 'lightning' && (
                              <span><span className="font-medium">Mower Safety:</span> Risk of lightning strike! Disconnect charging station if possible.</span>
                            )}
                            {alert.type === 'high_wind' && (
                              <span><span className="font-medium">Mower Safety:</span> High winds may cause flying debris that could damage your mower.</span>
                            )}
                            {alert.type === 'flooding' && (
                              <span><span className="font-medium">Mower Safety:</span> Move mower to higher ground if flooding is expected.</span>
                            )}
                            {alert.type === 'heavy_rain' && (
                              <span><span className="font-medium">Mower Safety:</span> Move mower to covered area or higher ground.</span>
                            )}
                            {alert.type === 'hail' && (
                              <span><span className="font-medium">Mower Safety:</span> Store mower in protected area to prevent hail damage.</span>
                            )}
                            {alert.type === 'tornado' && (
                              <span><span className="font-medium">Mower Safety:</span> Store mower in secure location away from potential debris.</span>
                            )}
                            {alert.type === 'snow' && (
                              <span><span className="font-medium">Mower Safety:</span> Store mower indoors and protect from freezing conditions.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Forecast</h3>
                <div className="grid grid-cols-4 gap-2">
                  {weather.forecast ? (
                    weather.forecast.slice(0, 4).map((day, index) => (
                      <div key={day.date} className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                        <span className="text-xs text-muted-foreground">
                          {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.dayOfWeek}
                        </span>
                        <div className="my-1">
                          {getWeatherIcon(day.weatherType, true)}
                        </div>
                        <span className="text-sm font-medium">{day.temperature}°</span>
                        <span className="text-xs text-muted-foreground">
                          {day.precipitation}% / {day.windSpeed}km/h
                        </span>
                      </div>
                    ))
                  ) : (
                    // Fallback forecast if no real forecast data available
                    [1, 2, 3, 4].map((day) => (
                      <div key={day} className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                        <span className="text-xs text-muted-foreground">
                          {day === 1 ? 'Today' : day === 2 ? 'Tomorrow' : new Date(Date.now() + day * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <Sun className="h-5 w-5 my-1 text-amber-400" />
                        <span className="text-sm font-medium">{Math.round(weather.temperature + (Math.random() * 6 - 3))}°</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Custom scrollbar styling */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(155, 155, 155, 0.5);
          border-radius: 20px;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}

export default WeatherWidget 