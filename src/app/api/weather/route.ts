import { NextRequest, NextResponse } from 'next/server'

// Using Open-Meteo API (free, no API key needed)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || 'Bangkok'

  try {
    // Step 1: Geocode city name to coordinates
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
    )
    const geoData = await geoRes.json()

    if (!geoData.results || geoData.results.length === 0) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 })
    }

    const { latitude, longitude, name, country } = geoData.results[0]

    // Step 2: Get 7-day forecast
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max,uv_index_max` +
      `&current=temperature_2m,relative_humidity_2m,weathercode,windspeed_10m` +
      `&timezone=auto&forecast_days=7`
    )
    const weatherData = await weatherRes.json()

    return NextResponse.json({
      city: name,
      country,
      latitude,
      longitude,
      current: {
        temperature: weatherData.current?.temperature_2m,
        humidity: weatherData.current?.relative_humidity_2m,
        weatherCode: weatherData.current?.weathercode,
        windSpeed: weatherData.current?.windspeed_10m,
      },
      daily: weatherData.daily?.time?.map((date: string, i: number) => ({
        date,
        tempMax: weatherData.daily.temperature_2m_max[i],
        tempMin: weatherData.daily.temperature_2m_min[i],
        precipitationProb: weatherData.daily.precipitation_probability_max[i],
        weatherCode: weatherData.daily.weathercode[i],
        windSpeed: weatherData.daily.windspeed_10m_max[i],
        uvIndex: weatherData.daily.uv_index_max[i],
      })) || [],
    })
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}
