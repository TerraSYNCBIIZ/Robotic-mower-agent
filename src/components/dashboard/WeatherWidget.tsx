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
  Umbrella
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { WeatherData, WeatherType } from "@/types/weather"

interface WeatherWidgetProps {
  className?: string
  width?: string
  onFetchWeather?: () => Promise<WeatherData>
  city?: string
  latitude?: number
  longitude?: number
}

const WeatherWidget = ({
  className = "",
  width = "16rem",
  onFetchWeather,
  city = "New York",
  latitude,
  longitude
}: WeatherWidgetProps) => {
  const [weather, setWeather] = React.useState<WeatherData | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState<boolean>(false)

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
      
      if (city) {
        url += `city=${encodeURIComponent(city)}`
      } else if (latitude !== undefined && longitude !== undefined) {
        url += `lat=${latitude}&lon=${longitude}`
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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card 
          className={`overflow-hidden rounded-xl cursor-pointer hover:shadow-md transition-shadow duration-200 ${className}`}
          style={{ width }}
        >
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-4 text-center">
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
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-3xl">
                    {getWeatherIcon(weather.weatherType, weather.isDay)}
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
                <div className="space-y-1">
                  <div className="text-4xl font-extralight">
                    {weather.temperature}<span className="text-2xl">°</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <MapPin size={12} className="mr-1" />
                    <span>{weather.city}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {weather.dateTime}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      
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
                <div className="text-lg font-medium">{weather.city}</div>
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
            
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">Forecast</h3>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((day) => (
                  <div key={day} className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                    <span className="text-xs text-muted-foreground">
                      {new Date(Date.now() + day * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <Sun className="h-5 w-5 my-1 text-amber-400" />
                    <span className="text-sm font-medium">{Math.round(weather.temperature + (Math.random() * 6 - 3))}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default WeatherWidget 