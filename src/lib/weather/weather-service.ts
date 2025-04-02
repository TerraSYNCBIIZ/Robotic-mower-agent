import type { WeatherData, WeatherType, AlertType, AlertSeverity, WeatherAlert, ForecastDay } from "@/types/weather";

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || process.env.NEXT_PUBLIC_WEATHER_API_KEY;
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5";

/**
 * Maps OpenWeatherMap weather conditions to our app's weather types
 */
const mapWeatherCondition = (condition: string): WeatherType => {
  const lowercaseCondition = condition.toLowerCase();
  
  if (lowercaseCondition.includes('clear')) return 'clear';
  if (lowercaseCondition.includes('cloud')) return 'clouds';
  if (lowercaseCondition.includes('rain') || lowercaseCondition.includes('drizzle')) return 'rain';
  if (lowercaseCondition.includes('snow')) return 'snow';
  if (lowercaseCondition.includes('thunder')) return 'thunderstorm';
  if (lowercaseCondition.includes('fog') || lowercaseCondition.includes('mist') || lowercaseCondition.includes('haze')) return 'mist';
  
  return 'unknown';
};

/**
 * Generates weather alerts based on forecast data
 */
const generateWeatherAlerts = (forecastData: any): WeatherAlert[] => {
  const alerts: WeatherAlert[] = [];
  const today = new Date();
  
  // Check each day in the forecast
  if (forecastData && forecastData.list) {
    // Group forecast by day
    const groupedByDay: Record<string, any[]> = {};
    
    forecastData.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!groupedByDay[dayKey]) {
        groupedByDay[dayKey] = [];
      }
      
      groupedByDay[dayKey].push(item);
    });
    
    // Process each day
    Object.entries(groupedByDay).forEach(([dayKey, dayData], index) => {
      const date = new Date(dayKey);
      const dayOffset = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const dateString = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      
      // Max values for the day
      const maxTemp = Math.max(...dayData.map(item => item.main.temp));
      const maxWindSpeed = Math.max(...dayData.map(item => item.wind.speed * 3.6)); // Convert to km/h
      let hasThunderstorm = false;
      let hasHeavyRain = false;
      let hasHail = false;
      let hasTornado = false;
      let hasSnow = false;
      
      // Check each time slot in the day
      dayData.forEach(item => {
        const weatherId = item.weather[0].id;
        const weatherDesc = item.weather[0].description.toLowerCase();
        
        // Check for extreme weather conditions
        if (weatherId >= 200 && weatherId < 300) {
          hasThunderstorm = true;
        }
        
        if (weatherId >= 500 && weatherId < 600) {
          const rainAmount = item.rain && item.rain['3h'] ? item.rain['3h'] : 0;
          if (rainAmount > 7.5 || weatherId >= 502) { // Heavy rain
            hasHeavyRain = true;
          }
        }
        
        if (weatherDesc.includes('hail') || weatherId === 906) {
          hasHail = true;
        }
        
        if (weatherDesc.includes('tornado') || weatherId === 781) {
          hasTornado = true;
        }
        
        if (weatherId >= 600 && weatherId < 700) {
          hasSnow = true;
        }
      });
      
      // Generate alerts based on conditions
      
      // Extreme heat (over 35°C/95°F)
      if (maxTemp > 35) {
        alerts.push({
          type: 'extreme_heat',
          severity: maxTemp > 40 ? 'extreme' : maxTemp > 37 ? 'high' : 'moderate',
          description: `Extreme heat expected with temperatures reaching ${Math.round(maxTemp)}°C`,
          dayOffset,
          date: dateString,
          temperature: Math.round(maxTemp)
        });
      }
      
      // High winds (over 30 km/h)
      if (maxWindSpeed > 30) {
        alerts.push({
          type: 'high_wind',
          severity: maxWindSpeed > 60 ? 'extreme' : maxWindSpeed > 45 ? 'high' : 'moderate',
          description: `High winds expected up to ${Math.round(maxWindSpeed)} km/h`,
          dayOffset,
          date: dateString,
          windSpeed: Math.round(maxWindSpeed)
        });
      }
      
      // Thunderstorms
      if (hasThunderstorm) {
        alerts.push({
          type: 'thunderstorm',
          severity: 'high',
          description: 'Thunderstorms expected with potential lightning',
          dayOffset,
          date: dateString
        });
      }
      
      // Lightning warning (separate from thunderstorm)
      if (hasThunderstorm) {
        alerts.push({
          type: 'lightning',
          severity: 'high',
          description: 'Lightning risk - consider disconnecting charging station',
          dayOffset,
          date: dateString
        });
      }
      
      // Heavy rain/flooding
      if (hasHeavyRain) {
        alerts.push({
          type: 'heavy_rain',
          severity: 'high',
          description: 'Heavy rainfall expected with potential flooding',
          dayOffset,
          date: dateString
        });
      }
      
      // Hail
      if (hasHail) {
        alerts.push({
          type: 'hail',
          severity: 'high',
          description: 'Hail expected - risk of damage to outdoor equipment',
          dayOffset,
          date: dateString
        });
      }
      
      // Tornado
      if (hasTornado) {
        alerts.push({
          type: 'tornado',
          severity: 'extreme',
          description: 'Tornado warning in effect',
          dayOffset,
          date: dateString
        });
      }
      
      // Snow
      if (hasSnow) {
        alerts.push({
          type: 'snow',
          severity: 'moderate',
          description: 'Snowfall expected - not suitable for mowing',
          dayOffset,
          date: dateString
        });
      }
    });
  }
  
  // Sort alerts by day offset and severity
  return alerts.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) {
      return a.dayOffset - b.dayOffset;
    }
    
    const severityRank = { 'extreme': 0, 'high': 1, 'moderate': 2, 'low': 3 };
    return severityRank[a.severity] - severityRank[b.severity];
  });
};

/**
 * Processes forecast data into our app's format
 */
const processForecastData = (data: any): ForecastDay[] => {
  const forecast: ForecastDay[] = [];
  const processedDays = new Set<string>();
  
  if (data && data.list) {
    // Process each time slot from forecast
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      
      // Only add one entry per day
      if (!processedDays.has(dayKey)) {
        processedDays.add(dayKey);
        
        forecast.push({
          date: dayKey,
          dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
          temperature: Math.round(item.main.temp),
          weatherType: mapWeatherCondition(item.weather[0].main),
          windSpeed: Math.round(item.wind.speed * 3.6), // Convert to km/h
          precipitation: item.pop ? Math.round(item.pop * 100) : 0 // Probability of precipitation
        });
      }
    });
  }
  
  return forecast.slice(0, 5); // Limit to 5 days
};

/**
 * Fetches weather and forecast data for a given location
 * @param latitude Latitude of the location
 * @param longitude Longitude of the location
 * @returns Weather data
 */
export const fetchWeatherByCoordinates = async (
  latitude: number,
  longitude: number
): Promise<WeatherData> => {
  if (!WEATHER_API_KEY) {
    throw new Error('Weather API key is not defined');
  }

  try {
    // Fetch current weather
    const currentResponse = await fetch(
      `${WEATHER_API_URL}/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`
    );

    if (!currentResponse.ok) {
      throw new Error(`Weather API responded with status: ${currentResponse.status}`);
    }

    const currentData = await currentResponse.json();
    
    // Fetch forecast data
    const forecastResponse = await fetch(
      `${WEATHER_API_URL}/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`
    );
    
    if (!forecastResponse.ok) {
      throw new Error(`Weather forecast API responded with status: ${forecastResponse.status}`);
    }
    
    const forecastData = await forecastResponse.json();
    
    // Get current time at location
    const timestamp = currentData.dt * 1000;
    const sunrise = currentData.sys.sunrise * 1000;
    const sunset = currentData.sys.sunset * 1000;
    const isDay = timestamp > sunrise && timestamp < sunset;

    const weatherData: WeatherData = {
      city: currentData.name,
      temperature: Math.round(currentData.main.temp),
      weatherType: mapWeatherCondition(currentData.weather[0].main),
      dateTime: new Date(timestamp).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }),
      isDay,
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed * 3.6), // Convert from m/s to km/h
      precipitation: currentData.rain ? Math.round((currentData.rain['1h'] || 0) * 100) : 0,
      forecast: processForecastData(forecastData),
      alerts: generateWeatherAlerts(forecastData)
    };

    return weatherData;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
};

/**
 * Fetches weather data for a given city
 * @param city Name of the city
 * @returns Weather data
 */
export const fetchWeatherByCity = async (city: string): Promise<WeatherData> => {
  if (!WEATHER_API_KEY) {
    throw new Error('Weather API key is not defined');
  }

  try {
    // Fetch current weather
    const currentResponse = await fetch(
      `${WEATHER_API_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
    );

    if (!currentResponse.ok) {
      throw new Error(`Weather API responded with status: ${currentResponse.status}`);
    }

    const currentData = await currentResponse.json();
    
    // Fetch forecast data using coordinates from current weather
    const forecastResponse = await fetch(
      `${WEATHER_API_URL}/forecast?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&units=metric&appid=${WEATHER_API_KEY}`
    );
    
    if (!forecastResponse.ok) {
      throw new Error(`Weather forecast API responded with status: ${forecastResponse.status}`);
    }
    
    const forecastData = await forecastResponse.json();
    
    // Get current time at location
    const timestamp = currentData.dt * 1000;
    const sunrise = currentData.sys.sunrise * 1000;
    const sunset = currentData.sys.sunset * 1000;
    const isDay = timestamp > sunrise && timestamp < sunset;

    const weatherData: WeatherData = {
      city: currentData.name,
      temperature: Math.round(currentData.main.temp),
      weatherType: mapWeatherCondition(currentData.weather[0].main),
      dateTime: new Date(timestamp).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }),
      isDay,
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed * 3.6), // Convert from m/s to km/h
      precipitation: currentData.rain ? Math.round((currentData.rain['1h'] || 0) * 100) : 0,
      forecast: processForecastData(forecastData),
      alerts: generateWeatherAlerts(forecastData)
    };

    return weatherData;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}; 