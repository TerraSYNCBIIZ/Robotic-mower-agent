export type WeatherType = 'clear' | 'clouds' | 'rain' | 'snow' | 'thunderstorm' | 'mist' | 'unknown';

export interface WeatherData {
  city: string;
  temperature: number;
  weatherType: WeatherType;
  dateTime: string;
  isDay: boolean;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
} 