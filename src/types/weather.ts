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
  forecast?: ForecastDay[];
  alerts?: WeatherAlert[];
}

export interface ForecastDay {
  date: string;
  dayOfWeek: string;
  temperature: number;
  weatherType: WeatherType;
  windSpeed?: number;
  precipitation?: number;
}

export interface WeatherAlert {
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  dayOffset: number; // 0 = today, 1 = tomorrow, etc.
  date: string;
  temperature?: number; // For extreme temperature alerts
  windSpeed?: number; // For high wind alerts
  precipitation?: number; // For heavy rain/flooding alerts
}

export type AlertType = 
  | 'extreme_heat'
  | 'extreme_cold'
  | 'thunderstorm'
  | 'high_wind'
  | 'flooding'
  | 'heavy_rain'
  | 'hail'
  | 'tornado'
  | 'lightning'
  | 'snow'
  | 'other';

export type AlertSeverity = 'low' | 'moderate' | 'high' | 'extreme'; 