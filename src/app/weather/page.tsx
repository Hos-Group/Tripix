'use client'

import { useEffect, useState } from 'react'
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, ChevronLeft, RefreshCw, Thermometer } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { he } from 'date-fns/locale'

interface DayForecast {
  date: string
  tempMax: number
  tempMin: number
  precipitationProb: number
  weatherCode: number
  windSpeed: number
  uvIndex: number
}

interface WeatherData {
  city: string
  country: string
  current: {
    temperature: number
    humidity: number
    weatherCode: number
    windSpeed: number
  }
  daily: DayForecast[]
}

function getWeatherIcon(code: number) {
  if (code <= 1) return { icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'בהיר' }
  if (code <= 3) return { icon: Cloud, color: 'text-gray-400', bg: 'bg-gray-50', label: 'מעונן חלקית' }
  if (code <= 48) return { icon: Cloud, color: 'text-gray-500', bg: 'bg-gray-100', label: 'מעונן' }
  if (code <= 67) return { icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', label: 'גשם' }
  if (code <= 77) return { icon: CloudSnow, color: 'text-blue-300', bg: 'bg-blue-50', label: 'שלג' }
  if (code <= 82) return { icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-100', label: 'גשם חזק' }
  return { icon: CloudRain, color: 'text-purple-500', bg: 'bg-purple-50', label: 'סופה' }
}

export default function WeatherPage() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('Phuket')

  const fetchWeather = async (c?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(c || city)}`)
      if (res.ok) {
        const data = await res.json()
        setWeather(data)
        if (data.city) setCity(data.city)
      }
    } catch {
      console.error('Weather fetch failed')
    }
    setLoading(false)
  }

  useEffect(() => { fetchWeather() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const current = weather?.current
  const currentWeather = current ? getWeatherIcon(current.weatherCode) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold">מזג אוויר</h1>
        <button onClick={() => fetchWeather()} className="mr-auto active:scale-95">
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* City Search */}
      <div className="flex gap-2">
        <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchWeather()}
          placeholder="חפש עיר..." dir="ltr"
          className="flex-1 bg-white rounded-xl px-4 py-3 text-sm shadow-sm outline-none text-left" />
        <button onClick={() => fetchWeather()}
          className="bg-primary text-white rounded-xl px-4 active:scale-95 text-sm font-medium">חפש</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : weather ? (
        <>
          {/* Current Weather */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{weather.city}, {weather.country}</p>
                <p className="text-5xl font-bold mt-1">{Math.round(current?.temperature || 0)}°</p>
                <p className="text-sm opacity-80 mt-1">{currentWeather?.label}</p>
              </div>
              {currentWeather && (
                <currentWeather.icon className="w-16 h-16 opacity-80" />
              )}
            </div>
            <div className="flex gap-4 mt-4 text-sm opacity-80">
              <div className="flex items-center gap-1">
                <Droplets className="w-4 h-4" />
                <span>{current?.humidity}%</span>
              </div>
              <div className="flex items-center gap-1">
                <Wind className="w-4 h-4" />
                <span>{current?.windSpeed} km/h</span>
              </div>
            </div>
          </motion.div>

          {/* 7-Day Forecast */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-600">תחזית שבועית</h3>
            {weather.daily.map((day, i) => {
              const w = getWeatherIcon(day.weatherCode)
              const Icon = w.icon
              const dayName = i === 0 ? 'היום' : i === 1 ? 'מחר' : format(parseISO(day.date), 'EEEE', { locale: he })
              const dateStr = format(parseISO(day.date), 'dd/MM')

              return (
                <motion.div key={day.date}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className={`w-10 h-10 ${w.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${w.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{dayName}</p>
                      <p className="text-[10px] text-gray-400">{dateStr}</p>
                    </div>
                    <p className="text-xs text-gray-400">{w.label}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-red-400" />
                      <span className="text-sm font-bold">{Math.round(day.tempMax)}°</span>
                      <span className="text-xs text-gray-400">{Math.round(day.tempMin)}°</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {day.precipitationProb > 0 && (
                        <span className="text-[10px] text-blue-400">{day.precipitationProb}% גשם</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <Cloud className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">לא נמצאו נתוני מזג אוויר</p>
        </div>
      )}
    </div>
  )
}
