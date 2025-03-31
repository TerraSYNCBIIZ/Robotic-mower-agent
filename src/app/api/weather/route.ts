import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchWeatherByCity, fetchWeatherByCoordinates } from "@/lib/weather/weather-service";
import type { WeatherData } from "@/types/weather";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    // Check if we have enough parameters
    if (!city && (!lat || !lon)) {
      return NextResponse.json(
        { error: "Either city or lat/lon coordinates are required" },
        { status: 400 }
      );
    }

    // Fetch weather data based on provided parameters
    let weatherData: WeatherData | undefined;
    if (city) {
      weatherData = await fetchWeatherByCity(city);
    } else if (lat && lon) {
      weatherData = await fetchWeatherByCoordinates(
        Number.parseFloat(lat),
        Number.parseFloat(lon)
      );
    }

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("Error fetching weather:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 