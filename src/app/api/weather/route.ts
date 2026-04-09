import { NextRequest, NextResponse } from 'next/server'

// Using Open-Meteo API (free, no API key needed)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || 'Bangkok'

  try {
    // Step 1: Geocode city name to coordinates
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`,
    )
    const geoData = await geoRes.json()

    if (!geoData.results || geoData.results.length === 0) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 })
    }

    const { latitude, longitude, name, country } = geoData.results[0]

    // Step 2: Get comprehensive forecast — current + hourly + 10-day daily
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      // Current conditions (detailed)
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weathercode` +
      `,windspeed_10m,winddirection_10m,surface_pressure,visibility,precipitation` +
      // Hourly (48h) — sliced client-side to next 24h
      `&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m,uv_index` +
      // Daily — 10 days
      `&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min` +
      `,precipitation_probability_max,precipitation_sum,weathercode,windspeed_10m_max` +
      `,winddirection_10m_dominant,uv_index_max,sunrise,sunset` +
      `&timezone=auto&forecast_days=10`,
    )
    const w = await weatherRes.json()
    const c = w.current || {}
    const d = w.daily   || {}
    const h = w.hourly  || {}

    // Build next-24h hourly starting from the current hour
    const nowHour = new Date().getHours()
    const hourly = (h.time || []).slice(nowHour, nowHour + 25).map((time: string, i: number) => ({
      time,
      temperature:       h.temperature_2m?.[nowHour + i]           ?? null,
      weatherCode:       h.weathercode?.[nowHour + i]              ?? 0,
      precipitationProb: h.precipitation_probability?.[nowHour + i] ?? 0,
      windSpeed:         h.windspeed_10m?.[nowHour + i]            ?? 0,
      uvIndex:           h.uv_index?.[nowHour + i]                 ?? 0,
    }))

    return NextResponse.json({
      city: name,
      country,
      latitude,
      longitude,
      current: {
        temperature:   c.temperature_2m,
        feelsLike:     c.apparent_temperature,
        humidity:      c.relative_humidity_2m,
        weatherCode:   c.weathercode,
        windSpeed:     c.windspeed_10m,
        windDirection: c.winddirection_10m,
        pressure:      c.surface_pressure,
        visibility:    c.visibility,     // metres
        precipitation: c.precipitation,  // mm in last hour
      },
      hourly,
      daily: (d.time || []).map((date: string, i: number) => ({
        date,
        tempMax:           d.temperature_2m_max?.[i]               ?? null,
        tempMin:           d.temperature_2m_min?.[i]               ?? null,
        feelsMax:          d.apparent_temperature_max?.[i]         ?? null,
        feelsMin:          d.apparent_temperature_min?.[i]         ?? null,
        precipitationProb: d.precipitation_probability_max?.[i]   ?? 0,
        precipitationSum:  d.precipitation_sum?.[i]                ?? 0,
        weatherCode:       d.weathercode?.[i]                      ?? 0,
        windSpeed:         d.windspeed_10m_max?.[i]                ?? 0,
        windDirection:     d.winddirection_10m_dominant?.[i]       ?? 0,
        uvIndex:           d.uv_index_max?.[i]                     ?? 0,
        sunrise:           d.sunrise?.[i]                          ?? '',
        sunset:            d.sunset?.[i]                           ?? '',
      })),
    })
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}
