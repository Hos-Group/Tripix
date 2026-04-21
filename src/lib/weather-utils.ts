/**
 * Shared WMO weather code utilities.
 * Used by WeatherWidget, weather page, and any other component showing weather data.
 */

export interface WeatherMeta {
  emoji:    string
  gradient: string
  descHe:   string
}

/** Map WMO weather code (+ optional hour) to emoji, gradient, and Hebrew description. */
export function getWeatherMeta(code: number, hour = 12): WeatherMeta {
  const isNight = hour < 6 || hour >= 20

  if (code === 0) return isNight
    ? { emoji: '🌙', gradient: 'from-indigo-900 to-slate-900', descHe: 'שמיים בהירים' }
    : { emoji: '☀️', gradient: 'from-sky-400 to-blue-600',    descHe: 'שמיים בהירים' }
  if (code <= 2)  return { emoji: '⛅',  gradient: 'from-sky-400 to-blue-600',    descHe: 'מעונן חלקית' }
  if (code === 3) return { emoji: '☁️',  gradient: 'from-slate-400 to-slate-600', descHe: 'מעונן' }
  if (code <= 48) return { emoji: '🌫️', gradient: 'from-slate-400 to-slate-600', descHe: 'ערפל' }
  if (code <= 57) return { emoji: '🌦️', gradient: 'from-slate-500 to-blue-800',  descHe: 'גשם קל' }
  if (code <= 67) return { emoji: '🌧️', gradient: 'from-slate-500 to-blue-800',  descHe: 'גשם' }
  if (code <= 77) return { emoji: '❄️',  gradient: 'from-blue-200 to-blue-400',   descHe: 'שלג' }
  if (code <= 82) return { emoji: '⛈️', gradient: 'from-slate-500 to-blue-800',  descHe: 'סופה' }
  return               { emoji: '⛈️', gradient: 'from-indigo-900 to-slate-900', descHe: 'סופת רעמים' }
}

/** Extract just the emoji for a WMO code (convenience wrapper). */
export function wmoEmoji(code: number, hour = 12): string {
  return getWeatherMeta(code, hour).emoji
}
