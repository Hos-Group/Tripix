'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ChevronLeft, Search, X, Wind, Droplets, Eye, Gauge, CloudRain } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { useTrip } from '@/contexts/TripContext'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HourlyItem {
  time:              string
  temperature:       number | null
  weatherCode:       number
  precipitationProb: number
  windSpeed:         number
  uvIndex:           number
}

interface DayForecast {
  date:              string
  tempMax:           number
  tempMin:           number
  feelsMax:          number
  feelsMin:          number
  precipitationProb: number
  precipitationSum:  number
  weatherCode:       number
  windSpeed:         number
  windDirection:     number
  uvIndex:           number
  sunrise:           string
  sunset:            string
}

interface WeatherData {
  city:    string
  country: string
  current: {
    temperature:   number
    feelsLike:     number
    humidity:      number
    weatherCode:   number
    windSpeed:     number
    windDirection: number
    pressure:      number
    visibility:    number
    precipitation: number
  }
  hourly: HourlyItem[]
  daily:  DayForecast[]
}

// ─────────────────────────────────────────────────────────────────────────────
// WMO Weather Code Mappings
// ─────────────────────────────────────────────────────────────────────────────

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy Fog',
  51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Moderate Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Slight Showers', 81: 'Moderate Showers', 82: 'Violent Showers',
  85: 'Snow Showers', 86: 'Heavy Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Heavy Thunderstorm',
}

function getDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'Unknown'
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather Meta (emoji + gradient)
// ─────────────────────────────────────────────────────────────────────────────

interface WeatherMeta {
  emoji:    string
  gradient: string
}

function getWeatherMeta(code: number, hour = 12): WeatherMeta {
  const isNight = hour < 6 || hour >= 20

  if (code === 0) {
    return isNight
      ? { emoji: '🌙', gradient: 'from-indigo-900 to-slate-900' }
      : { emoji: '☀️', gradient: 'from-sky-400 to-blue-600' }
  }
  if (code <= 2)  return { emoji: '⛅', gradient: 'from-sky-400 to-blue-600' }
  if (code === 3) return { emoji: '☁️', gradient: 'from-slate-400 to-slate-600' }
  if (code <= 48) return { emoji: '🌫️', gradient: 'from-slate-400 to-slate-600' }
  if (code <= 57) return { emoji: '🌦️', gradient: 'from-slate-500 to-blue-800' }
  if (code <= 67) return { emoji: '🌧️', gradient: 'from-slate-500 to-blue-800' }
  if (code <= 77) return { emoji: '❄️', gradient: 'from-blue-200 to-blue-400' }
  if (code <= 82) return { emoji: '⛈️', gradient: 'from-slate-500 to-blue-800' }
  if (code <= 99) return { emoji: '⛈️', gradient: 'from-indigo-900 to-slate-900' }
  return                { emoji: '🌡️', gradient: 'from-slate-400 to-slate-600' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function uvLabel(uv: number): string {
  if (uv <= 2)  return 'Low'
  if (uv <= 5)  return 'Moderate'
  if (uv <= 7)  return 'High'
  if (uv <= 10) return 'Very High'
  return               'Extreme'
}

function windDirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function fmtHour(isoOrTime: string): string {
  const t = isoOrTime.includes('T') ? isoOrTime.split('T')[1].slice(0, 5) : isoOrTime
  return t
}

function fmtSunTime(iso: string): string {
  if (!iso) return '--'
  return iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso
}

function fmtDayName(dateStr: string, i: number): string {
  if (i === 0) return 'Today'
  if (i === 1) return 'Tomorrow'
  return format(parseISO(dateStr), 'EEE')
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const { currentTrip } = useTrip()
  const [weather,     setWeather]     = useState<WeatherData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [city,        setCity]        = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searching,   setSearching]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const defaultCity = currentTrip?.destination?.split(' ')[0] || 'Bangkok'

  const fetchWeather = useCallback(async (target?: string) => {
    const q = target || city || defaultCity
    setLoading(true)
    setError(null)
    setSearching(false)
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(q)}`)
      if (!res.ok) { setError('City not found — try a different name'); setLoading(false); return }
      const data = await res.json()
      setWeather(data)
      setCity(data.city)
      setSearchInput(data.city)
    } catch {
      setError('Failed to load weather data')
    }
    setLoading(false)
  }, [city, defaultCity])

  useEffect(() => { fetchWeather(defaultCity) }, [defaultCity]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ──────────────────────────────────────────────────────────
  const now   = new Date().getHours()
  const cur   = weather?.current
  const meta  = cur ? getWeatherMeta(cur.weatherCode, now) : null
  const today = weather?.daily?.[0]

  const gradient = meta?.gradient ?? 'from-sky-400 to-blue-600'

  return (
    <div className={`min-h-screen bg-gradient-to-b ${gradient} text-white pb-32`}>

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 pt-safe bg-black/10 backdrop-blur-md border-b border-white/10"
           style={{ paddingTop: 'max(env(safe-area-inset-top,0px),12px)' }}>
        <div className="flex items-center gap-3 px-4 pb-3">
          <Link href="/dashboard"
            className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1 text-center">מזג אוויר</h1>
          <button onClick={() => fetchWeather()} disabled={loading}
            className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin opacity-50' : ''}`} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 items-center bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchWeather(searchInput)}
              onFocus={() => setSearching(true)}
              placeholder="Search city..."
              className="flex-1 bg-transparent outline-none text-sm placeholder-white/50 text-white"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearching(false) }}
                className="active:scale-95">
                <X className="w-4 h-4 text-white/60" />
              </button>
            )}
            {searching && (
              <button
                onClick={() => fetchWeather(searchInput)}
                className="bg-white/30 text-white text-xs font-medium px-3 py-1 rounded-xl active:scale-95">
                Search
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-4 bg-black/20 border border-white/20 rounded-2xl p-4 text-center text-sm text-white/80">
          {error}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center pt-24">
          <RefreshCw className="w-8 h-8 animate-spin opacity-50" />
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {!loading && weather && cur && (
        <div className="space-y-3 px-4 mt-2">

          {/* ── Hero: current weather ─────────────────────────────────────── */}
          <div className="pt-6 pb-8 text-center">
            <p className="text-base font-medium opacity-75 tracking-wide">
              {weather.city}, {weather.country}
            </p>
            <div className="text-9xl font-thin mt-2 tracking-tighter leading-none">
              {Math.round(cur.temperature)}°
            </div>
            <p className="text-2xl font-light opacity-90 mt-3">
              {getDescription(cur.weatherCode)}
            </p>
            <p className="text-sm opacity-60 mt-2">
              Feels like {Math.round(cur.feelsLike)}°
            </p>
            <p className="text-sm opacity-70 mt-1 font-medium">
              H: {today ? Math.round(today.tempMax) : '--'}°&ensp;·&ensp;L: {today ? Math.round(today.tempMin) : '--'}°
            </p>
          </div>

          {/* ── Hourly strip ──────────────────────────────────────────────── */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-4 font-semibold">
              Hourly Forecast
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {weather.hourly.slice(0, 12).map((h, i) => {
                const hm  = getWeatherMeta(h.weatherCode, parseInt(fmtHour(h.time)))
                const isNow = i === 0
                return (
                  <div key={h.time}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[52px] ${isNow ? 'opacity-100' : 'opacity-70'}`}>
                    <span className="text-xs font-semibold">
                      {isNow ? 'Now' : fmtHour(h.time)}
                    </span>
                    <span className="text-xl leading-none">{hm.emoji}</span>
                    {h.precipitationProb >= 20 && (
                      <span className="text-[10px] text-white/70">{h.precipitationProb}%</span>
                    )}
                    {h.precipitationProb < 20 && (
                      <span className="text-[10px] opacity-0">--</span>
                    )}
                    <span className="text-sm font-semibold">
                      {h.temperature !== null ? `${Math.round(h.temperature)}°` : '--'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 10-day forecast ───────────────────────────────────────────── */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-4 font-semibold">
              10-Day Forecast
            </p>
            <div className="space-y-0 divide-y divide-white/10">
              {weather.daily.map((day, i) => {
                const dm = getWeatherMeta(day.weatherCode)
                return (
                  <div key={day.date} className="flex items-center gap-3 py-2.5">
                    {/* Day name */}
                    <span className="text-sm font-medium w-16 flex-shrink-0">
                      {fmtDayName(day.date, i)}
                    </span>
                    {/* Icon */}
                    <span className="text-lg w-7 flex-shrink-0 text-center leading-none">
                      {dm.emoji}
                    </span>
                    {/* Rain % */}
                    <span className={`text-xs w-9 flex-shrink-0 ${day.precipitationProb >= 20 ? 'text-white/70' : 'opacity-0'}`}>
                      {day.precipitationProb}%
                    </span>
                    {/* Description */}
                    <span className="flex-1 text-xs opacity-55 truncate">
                      {getDescription(day.weatherCode)}
                    </span>
                    {/* H/L */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-sm font-semibold">{Math.round(day.tempMax)}°</span>
                      <span className="text-sm opacity-50">/</span>
                      <span className="text-sm opacity-50">{Math.round(day.tempMin)}°</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Detail tiles 2×3 ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">

            {/* Wind */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Wind className="w-3.5 h-3.5 opacity-50" />
                <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">Wind</p>
              </div>
              <p className="text-3xl font-light">{Math.round(cur.windSpeed)}</p>
              <p className="text-sm opacity-60 mt-0.5">km/h</p>
              <p className="text-sm opacity-80 mt-1">
                {windDirLabel(cur.windDirection)} — {Math.round(cur.windDirection)}°
              </p>
            </div>

            {/* Humidity */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Droplets className="w-3.5 h-3.5 opacity-50" />
                <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">Humidity</p>
              </div>
              <p className="text-3xl font-light">{cur.humidity}</p>
              <p className="text-sm opacity-60 mt-0.5">%</p>
              <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-white/60"
                     style={{ width: `${cur.humidity}%` }} />
              </div>
            </div>

            {/* UV Index */}
            {today && (
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs opacity-50">☀</span>
                  <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">UV Index</p>
                </div>
                <p className="text-3xl font-light">{Math.round(today.uvIndex)}</p>
                <p className="text-sm opacity-80 mt-0.5">{uvLabel(today.uvIndex)}</p>
                <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-white/60"
                       style={{ width: `${Math.min(today.uvIndex / 12 * 100, 100)}%` }} />
                </div>
              </div>
            )}

            {/* Visibility */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5 opacity-50" />
                <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">Visibility</p>
              </div>
              <p className="text-3xl font-light">
                {cur.visibility >= 1000
                  ? `${(cur.visibility / 1000).toFixed(0)}`
                  : `${cur.visibility}`}
              </p>
              <p className="text-sm opacity-60 mt-0.5">
                {cur.visibility >= 1000 ? 'km' : 'm'}
              </p>
              <p className="text-sm opacity-80 mt-1">
                {cur.visibility >= 10000 ? 'Excellent'
                  : cur.visibility >= 5000 ? 'Good'
                  : cur.visibility >= 1000 ? 'Moderate'
                  : 'Poor'}
              </p>
            </div>

            {/* Pressure */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Gauge className="w-3.5 h-3.5 opacity-50" />
                <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">Pressure</p>
              </div>
              <p className="text-3xl font-light">{Math.round(cur.pressure)}</p>
              <p className="text-sm opacity-60 mt-0.5">hPa</p>
              <p className="text-sm opacity-80 mt-1">
                {cur.pressure > 1020 ? 'High' : cur.pressure > 1000 ? 'Normal' : 'Low'}
              </p>
            </div>

            {/* Precipitation */}
            {today && (
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <CloudRain className="w-3.5 h-3.5 opacity-50" />
                  <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">Precipitation</p>
                </div>
                <p className="text-3xl font-light">{today.precipitationSum.toFixed(1)}</p>
                <p className="text-sm opacity-60 mt-0.5">mm today</p>
                <p className="text-sm opacity-80 mt-1">
                  {today.precipitationProb}% chance
                </p>
              </div>
            )}

          </div>

          {/* ── Sunrise / Sunset ──────────────────────────────────────────── */}
          {today && (
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-4 font-semibold">
                Sun
              </p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-3xl leading-none">🌅</p>
                  <p className="text-base font-semibold mt-2">{fmtSunTime(today.sunrise)}</p>
                  <p className="text-xs opacity-50 mt-0.5">Sunrise</p>
                </div>

                {/* Sun arc */}
                <div className="flex-1 mx-6 relative h-12">
                  <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                    <path d="M 5 38 Q 50 2 95 38"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    {(() => {
                      const riseH = parseInt(fmtSunTime(today.sunrise).split(':')[0])
                      const riseM = parseInt(fmtSunTime(today.sunrise).split(':')[1] || '0')
                      const setH  = parseInt(fmtSunTime(today.sunset).split(':')[0])
                      const setM  = parseInt(fmtSunTime(today.sunset).split(':')[1] || '0')
                      const riseMin = riseH * 60 + riseM
                      const setMin  = setH  * 60 + setM
                      const nowMin  = new Date().getHours() * 60 + new Date().getMinutes()
                      const t       = Math.max(0, Math.min(1, (nowMin - riseMin) / (setMin - riseMin)))
                      const x       = 5 + t * 90
                      const y       = 38 - 36 * Math.sin(t * Math.PI)
                      return <circle cx={x} cy={y} r="4" fill="#FCD34D" />
                    })()}
                  </svg>
                </div>

                <div className="text-center">
                  <p className="text-3xl leading-none">🌇</p>
                  <p className="text-base font-semibold mt-2">{fmtSunTime(today.sunset)}</p>
                  <p className="text-xs opacity-50 mt-0.5">Sunset</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
