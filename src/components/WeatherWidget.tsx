'use client'

/**
 * WeatherWidget
 *
 * Compact weather card for a city.
 * Shows current temperature + emoji + short description + link to /weather.
 * Used in Dashboard and anywhere else a mini weather view is needed.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getWeatherMeta } from '@/lib/weather-utils'

interface WeatherData {
  temp:     number
  emoji:    string
  city:     string
  desc:     string
  humidity?: number
  wind?:    number
}

interface WeatherWidgetProps {
  /** City name or first word of a trip destination */
  city: string
  /** Tailwind / inline style override for the outer container */
  className?: string
  /** Show extra details (humidity, wind) — default false */
  detailed?: boolean
}

export default function WeatherWidget({ city, className = '', detailed = false }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!city) return
    const controller = new AbortController()
    setLoading(true)

    fetch(`/api/weather?city=${encodeURIComponent(city)}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.current) return
        const code = data.current.weatherCode ?? 0
        const { emoji, descHe } = getWeatherMeta(code)
        setWeather({
          temp:     Math.round(data.current.temperature),
          emoji,
          city:     data.city ?? city,
          desc:     descHe,
          humidity: data.current.relativeHumidity,
          wind:     data.current.windSpeed,
        })
      })
      .catch(err => { if (err.name !== 'AbortError') console.error(err) })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [city])

  // Skeleton — fixed size matches loaded content so there's no layout shift
  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-blue-50 animate-pulse min-w-[88px] ${className}`}>
        <span className="text-xl opacity-30">🌡️</span>
        <div className="space-y-1">
          <div className="h-2 w-12 bg-blue-100 rounded" />
          <div className="h-3 w-8 bg-blue-100 rounded" />
        </div>
      </div>
    )
  }

  if (!weather) return null

  return (
    <Link
      href="/weather"
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl active:scale-95 transition-all bg-blue-50 ${className}`}
    >
      <span className="text-xl leading-none">{weather.emoji}</span>
      <div>
        <p className="text-[10px] text-gray-400 font-medium leading-tight">{weather.city}</p>
        <p className="text-sm font-bold text-gray-800 leading-tight">{weather.temp}°C</p>
        {detailed && (
          <p className="text-[10px] text-gray-500 leading-tight">{weather.desc}</p>
        )}
      </div>
      {detailed && weather.humidity !== undefined && (
        <div className="mr-1 text-right">
          <p className="text-[10px] text-gray-400">{weather.humidity}% לחות</p>
          {weather.wind !== undefined && (
            <p className="text-[10px] text-gray-400">{weather.wind} km/h</p>
          )}
        </div>
      )}
    </Link>
  )
}
