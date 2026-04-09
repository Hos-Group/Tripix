'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ChevronLeft, Search, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { he } from 'date-fns/locale'
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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface WeatherMeta {
  emoji:    string
  label:    string
  gradient: string   // CSS gradient for the big card
  textDim:  string   // dimmed text color
}

function getWeatherMeta(code: number, hour = 12): WeatherMeta {
  const isNight = hour < 6 || hour >= 20
  if (code === 0)           return { emoji: isNight ? '🌙' : '☀️',  label: 'בהיר',             gradient: isNight ? 'from-[#1a1a4e] to-[#0d0d2b]' : 'from-[#2193b0] to-[#6dd5ed]', textDim: 'text-blue-100' }
  if (code <= 2)            return { emoji: '⛅',  label: 'מעונן חלקית',   gradient: 'from-[#4a6fa5] to-[#6d9dc5]',  textDim: 'text-blue-100' }
  if (code === 3)           return { emoji: '☁️',  label: 'מעונן',          gradient: 'from-[#4a5568] to-[#718096]',  textDim: 'text-gray-200' }
  if (code <= 48)           return { emoji: '🌫️',  label: 'ערפל',           gradient: 'from-[#6b7280] to-[#9ca3af]',  textDim: 'text-gray-100' }
  if (code <= 57)           return { emoji: '🌧️',  label: 'טפטוף',          gradient: 'from-[#3a4a6b] to-[#5a7a9b]',  textDim: 'text-blue-100' }
  if (code <= 67)           return { emoji: '🌧️',  label: 'גשם',            gradient: 'from-[#1a3a5c] to-[#2d6a9f]',  textDim: 'text-blue-100' }
  if (code <= 77)           return { emoji: '❄️',  label: 'שלג',            gradient: 'from-[#b0c4de] to-[#e8f4f8]',  textDim: 'text-blue-900' }
  if (code <= 82)           return { emoji: '⛈️',  label: 'גשם חזק',        gradient: 'from-[#1a2a4a] to-[#2c3e6b]',  textDim: 'text-blue-100' }
  if (code <= 99)           return { emoji: '⛈️',  label: 'סופת ברקים',     gradient: 'from-[#0f0f23] to-[#1a1a3e]',  textDim: 'text-purple-200' }
  return                           { emoji: '🌡️',  label: 'לא ידוע',        gradient: 'from-[#374151] to-[#6b7280]',  textDim: 'text-gray-200' }
}

function uvLabel(uv: number): { label: string; color: string } {
  if (uv <= 2)  return { label: 'נמוך',     color: 'text-green-400' }
  if (uv <= 5)  return { label: 'בינוני',   color: 'text-yellow-400' }
  if (uv <= 7)  return { label: 'גבוה',     color: 'text-orange-400' }
  if (uv <= 10) return { label: 'גבוה מאוד', color: 'text-red-400' }
  return               { label: 'קיצוני',   color: 'text-purple-400' }
}

function windDirLabel(deg: number): string {
  const dirs = ['צפון','צ-מז','מזרח','ד-מז','דרום','ד-מע','מערב','צ-מע']
  return dirs[Math.round(deg / 45) % 8]
}

function fmtHour(isoOrTime: string): string {
  // e.g. "2024-04-15T14:00" → "14:00"
  const t = isoOrTime.includes('T') ? isoOrTime.split('T')[1].slice(0, 5) : isoOrTime
  return t
}

function fmtSunTime(iso: string): string {
  if (!iso) return ''
  return iso.includes('T') ? iso.split('T')[1].slice(0, 5) : iso
}

function tempBar(min: number, max: number, dayMin: number, dayMax: number) {
  const range  = dayMax - dayMin || 1
  const left   = ((min - dayMin) / range) * 100
  const width  = ((max - min)    / range) * 100
  return { left: `${left}%`, width: `${width}%` }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const { currentTrip } = useTrip()
  const [weather,      setWeather]      = useState<WeatherData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [city,         setCity]         = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [searching,    setSearching]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Derive the default city from the current trip destination
  const defaultCity = currentTrip?.destination?.split(' ')[0] || 'Bangkok'

  const fetchWeather = useCallback(async (target?: string) => {
    const q = target || city || defaultCity
    setLoading(true)
    setError(null)
    setSearching(false)
    try {
      const res  = await fetch(`/api/weather?city=${encodeURIComponent(q)}`)
      if (!res.ok) { setError('לא נמצאה העיר — נסה שם אחר'); setLoading(false); return }
      const data = await res.json()
      setWeather(data)
      setCity(data.city)
      setSearchInput(data.city)
    } catch {
      setError('שגיאה בטעינת מזג האוויר')
    }
    setLoading(false)
  }, [city, defaultCity])

  useEffect(() => { fetchWeather(defaultCity) }, [defaultCity]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ───────────────────────────────────────────────────────
  const now    = new Date().getHours()
  const cur    = weather?.current
  const meta   = cur ? getWeatherMeta(cur.weatherCode, now) : null
  const today  = weather?.daily?.[0]

  const globalMin = weather ? Math.min(...weather.daily.map(d => d.tempMin)) : 0
  const globalMax = weather ? Math.max(...weather.daily.map(d => d.tempMax)) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-32">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className={`relative bg-gradient-to-b ${meta?.gradient || 'from-[#2193b0] to-[#6dd5ed]'} pt-safe`}
           style={{ paddingTop: 'max(env(safe-area-inset-top,0px),12px)' }}>

        {/* Nav */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1 text-center">מזג אוויר</h1>
          <button onClick={() => fetchWeather()} disabled={loading}
            className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin opacity-50' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 items-center bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-2">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchWeather(searchInput)}
              onFocus={() => setSearching(true)}
              placeholder="חפש עיר..."
              dir="rtl"
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
                חפש
              </button>
            )}
          </div>
        </div>

        {/* ── Big current weather ──────────────────────────────────────── */}
        {!loading && weather && cur && (
          <div className="px-4 pb-8 text-center">
            <p className="text-lg font-medium opacity-80">{weather.city}, {weather.country}</p>
            <div className="text-8xl font-thin mt-1 tracking-tight">
              {Math.round(cur.temperature)}°
            </div>
            <p className="text-xl opacity-80 mt-1">{meta?.label}</p>
            <p className="text-sm opacity-60 mt-1">
              גבוה {today ? Math.round(today.tempMax) : '--'}° · נמוך {today ? Math.round(today.tempMin) : '--'}°
            </p>
            <p className="text-sm opacity-60">מרגיש כמו {Math.round(cur.feelsLike)}°</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center pb-16 pt-4">
            <RefreshCw className="w-8 h-8 animate-spin opacity-50" />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-900/40 border border-red-500/30 rounded-2xl p-4 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && weather && (
        <div className="space-y-3 px-4 mt-3">

          {/* ── Hourly strip ────────────────────────────────────────────── */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-3 font-medium">
              {today ? `☔ ${today.precipitationProb}% סיכוי לגשם` : 'תחזית שעתית'}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
              {weather.hourly.map((h, i) => {
                const hm  = getWeatherMeta(h.weatherCode, parseInt(fmtHour(h.time)))
                const isNow = i === 0
                return (
                  <div key={h.time} className={`flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[48px] ${isNow ? 'opacity-100' : 'opacity-75'}`}>
                    <span className="text-xs font-medium">
                      {isNow ? 'עכשיו' : fmtHour(h.time)}
                    </span>
                    {h.precipitationProb >= 30 && (
                      <span className="text-[9px] text-blue-300">{h.precipitationProb}%</span>
                    )}
                    <span className="text-xl">{hm.emoji}</span>
                    <span className="text-sm font-semibold">
                      {h.temperature !== null ? `${Math.round(h.temperature)}°` : '--'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 10-day forecast ─────────────────────────────────────────── */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
            <p className="text-xs uppercase tracking-widest opacity-50 mb-3 font-medium">תחזית 10 ימים</p>
            <div className="space-y-3">
              {weather.daily.map((day, i) => {
                const dm       = getWeatherMeta(day.weatherCode)
                const dayName  = i === 0 ? 'היום' : i === 1 ? 'מחר'
                  : format(parseISO(day.date), 'EEEE', { locale: he })
                const bar      = tempBar(day.tempMin, day.tempMax, globalMin, globalMax)

                return (
                  <div key={day.date} className="flex items-center gap-2">
                    {/* Day */}
                    <span className="text-sm font-medium w-14 flex-shrink-0">{dayName}</span>
                    {/* Icon */}
                    <span className="text-base w-6 flex-shrink-0 text-center">{dm.emoji}</span>
                    {/* Rain % */}
                    <span className={`text-xs w-10 flex-shrink-0 text-right ${day.precipitationProb >= 30 ? 'text-blue-300' : 'opacity-0'}`}>
                      {day.precipitationProb}%
                    </span>
                    {/* Min */}
                    <span className="text-sm opacity-50 w-8 text-right flex-shrink-0">
                      {Math.round(day.tempMin)}°
                    </span>
                    {/* Temp bar */}
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full relative overflow-hidden mx-1">
                      <div className="absolute h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
                           style={{ left: bar.left, width: bar.width }} />
                    </div>
                    {/* Max */}
                    <span className="text-sm font-semibold w-8 flex-shrink-0">
                      {Math.round(day.tempMax)}°
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Metric tiles grid ────────────────────────────────────────── */}
          {cur && (
            <div className="grid grid-cols-2 gap-3">

              {/* UV Index */}
              {today && (() => {
                const uv = uvLabel(today.uvIndex)
                return (
                  <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                    <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-medium">☀️ UV</p>
                    <p className={`text-3xl font-semibold ${uv.color}`}>{Math.round(today.uvIndex)}</p>
                    <p className={`text-sm mt-1 ${uv.color}`}>{uv.label}</p>
                    <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-400 via-yellow-400 via-orange-400 to-red-600"
                           style={{ width: `${Math.min(today.uvIndex / 12 * 100, 100)}%` }} />
                    </div>
                  </div>
                )
              })()}

              {/* Wind */}
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-medium">💨 רוח</p>
                <p className="text-3xl font-semibold">{Math.round(cur.windSpeed)}</p>
                <p className="text-sm opacity-60">km/h</p>
                <p className="text-sm mt-1 opacity-80">{windDirLabel(cur.windDirection)}</p>
              </div>

              {/* Humidity */}
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-medium">💧 לחות</p>
                <p className="text-3xl font-semibold">{cur.humidity}%</p>
                <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400"
                       style={{ width: `${cur.humidity}%` }} />
                </div>
                <p className="text-xs opacity-50 mt-1">
                  {cur.humidity > 70 ? 'לח מאוד' : cur.humidity > 50 ? 'לח' : 'יבש'}
                </p>
              </div>

              {/* Visibility */}
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-medium">👁️ ראות</p>
                <p className="text-3xl font-semibold">
                  {cur.visibility >= 1000
                    ? `${(cur.visibility / 1000).toFixed(0)}`
                    : `${cur.visibility}`}
                </p>
                <p className="text-sm opacity-60">{cur.visibility >= 1000 ? 'ק"מ' : 'מטר'}</p>
                <p className="text-xs opacity-50 mt-1">
                  {cur.visibility >= 10000 ? 'מצוינת' : cur.visibility >= 5000 ? 'טובה' : cur.visibility >= 1000 ? 'מוגבלת' : 'ירודה'}
                </p>
              </div>

              {/* Pressure */}
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-medium">🌡️ לחץ אוויר</p>
                <p className="text-3xl font-semibold">{Math.round(cur.pressure)}</p>
                <p className="text-sm opacity-60">hPa</p>
                <p className="text-xs opacity-50 mt-1">
                  {cur.pressure > 1020 ? 'גבוה' : cur.pressure > 1000 ? 'תקין' : 'נמוך'}
                </p>
              </div>

              {/* Precipitation */}
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-1 font-medium">🌧️ משקעים</p>
                <p className="text-3xl font-semibold">
                  {today ? today.precipitationSum.toFixed(1) : '0'}
                </p>
                <p className="text-sm opacity-60">מ"מ</p>
                <p className="text-xs opacity-50 mt-1">
                  {today ? (today.precipitationProb >= 50 ? 'צפי גשם' : 'אין צפי משמעותי') : ''}
                </p>
              </div>

            </div>
          )}

          {/* ── Sunrise / Sunset ─────────────────────────────────────────── */}
          {today && (
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-4">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-3 font-medium">🌅 זריחה ושקיעה</p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-3xl">🌅</p>
                  <p className="text-sm font-semibold mt-1">{fmtSunTime(today.sunrise)}</p>
                  <p className="text-xs opacity-50">זריחה</p>
                </div>
                {/* Sun arc */}
                <div className="flex-1 mx-4 relative h-12">
                  <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                    <path d="M 5 38 Q 50 2 95 38" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="4 3"/>
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
                      return <circle cx={x} cy={y} r="4" fill="#FBBF24" />
                    })()}
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-3xl">🌇</p>
                  <p className="text-sm font-semibold mt-1">{fmtSunTime(today.sunset)}</p>
                  <p className="text-xs opacity-50">שקיעה</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
