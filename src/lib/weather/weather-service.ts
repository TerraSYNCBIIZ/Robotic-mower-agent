import type { WeatherData, WeatherType } from "@/types/weather";

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
 * Fetches weather data for a given location
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
    const response = await fetch(
      `${WEATHER_API_URL}/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Get current time at location
    const timestamp = data.dt * 1000;
    const sunrise = data.sys.sunrise * 1000;
    const sunset = data.sys.sunset * 1000;
    const isDay = timestamp > sunrise && timestamp < sunset;

    const weatherData: WeatherData = {
      city: data.name,
      temperature: Math.round(data.main.temp),
      weatherType: mapWeatherCondition(data.weather[0].main),
      dateTime: new Date(timestamp).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }),
      isDay,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // Convert from m/s to km/h
      precipitation: data.rain ? Math.round((data.rain['1h'] || 0) * 100) : 0
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
    const response = await fetch(
      `${WEATHER_API_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Get current time at location
    const timestamp = data.dt * 1000;
    const sunrise = data.sys.sunrise * 1000;
    const sunset = data.sys.sunset * 1000;
    const isDay = timestamp > sunrise && timestamp < sunset;

    const weatherData: WeatherData = {
      city: data.name,
      temperature: Math.round(data.main.temp),
      weatherType: mapWeatherCondition(data.weather[0].main),
      dateTime: new Date(timestamp).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }),
      isDay,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // Convert from m/s to km/h
      precipitation: data.rain ? Math.round((data.rain['1h'] || 0) * 100) : 0
    };

    return weatherData;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}; 