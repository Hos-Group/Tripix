'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Plane, TrendingUp, CalendarDays, Wallet, Plus,
  ScanLine, FolderOpen, MoreHorizontal, ArrowLeftRight,
  ChevronLeft, ChevronRight, Smartphone, ShieldCheck,
  Building2, Car, Calendar, Clock, Cloud,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, getDaysRemaining, getTripDays } from '@/lib/utils'
import { Expense, Category, CATEGORY_META, Currency, CURRENCY_SYMBOL, Document as TripDoc } from '@/types'
import { DocEventIconBadge } from '@/lib/iconConfig'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import GmailScanButton from '@/components/GmailScanButton'
import CurrencySelector from '@/components/CurrencySelector'

// ── Upcoming event extracted from documents ────────────────────────────────────
interface UpcomingEvent {
  date:      string
  title:     string
  subtitle?: string
  type:      string
  time?:     string
  docId:     string
}

function extractUpcomingEvents(docs: TripDoc[], todayStr: string): UpcomingEvent[] {
  const events: UpcomingEvent[] = []

  for (const doc of docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ext = doc.extracted_data as any
    if (!ext) continue

    if (doc.doc_type === 'flight') {
      const legs = ext.legs || []
      for (const leg of legs) {
        const date = leg.departure_date || leg.dep_date
        if (!date || date < todayStr) continue
        events.push({
          date,
          title:    (leg.departure_city && leg.arrival_city)
                      ? `${leg.departure_city} → ${leg.arrival_city}`
                      : doc.name,
          subtitle: [leg.flight_number || leg.airline, leg.departure_time].filter(Boolean).join(' · '),
          type:     'flight',
          time:     leg.departure_time || undefined,
          docId:    doc.id,
        })
      }
      // fallback for flat flight doc
      if (!ext.legs?.length) {
        const date = ext.departure_date || ext.dep_date
        if (date && date >= todayStr) {
          events.push({
            date,
            title:    (ext.departure_city && ext.arrival_city)
                        ? `${ext.departure_city} → ${ext.arrival_city}`
                        : doc.name,
            subtitle: [ext.flight_number || ext.airline, ext.departure_time].filter(Boolean).join(' · '),
            type:     'flight',
            time:     ext.departure_time || undefined,
            docId:    doc.id,
          })
        }
      }
    }

    if (doc.doc_type === 'hotel') {
      const checkIn = ext.check_in
      if (checkIn && checkIn >= todayStr) {
        events.push({
          date:     checkIn,
          title:    ext.hotel_name || doc.name,
          subtitle: `צ׳ק אין${ext.check_out ? ` → ${ext.check_out}` : ''}`,
          type:     'hotel_checkin',
          docId:    doc.id,
        })
      }
    }

    // Car rental
    if (ext.pickup_date && ext.pickup_date >= todayStr) {
      events.push({
        date:     ext.pickup_date,
        title:    `איסוף רכב${ext.rental_company ? ` — ${ext.rental_company}` : ''}`,
        subtitle: [ext.car_type, ext.pickup_location, ext.pickup_time].filter(Boolean).join(' · '),
        type:     'car_pickup',
        time:     ext.pickup_time || undefined,
        docId:    doc.id,
      })
    }
  }

  return events
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date)
      if (dc !== 0) return dc
      return (a.time || '').localeCompare(b.time || '')
    })
    .slice(0, 6)
}

export default function DashboardPage() {
  const { currentTrip, trips, loading: tripsLoading } = useTrip()
  const { displayName } = useAuth()
  const { t, dir } = useLanguage()
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [documents, setDocuments]       = useState<TripDoc[]>([])
  const [loading, setLoading]           = useState(true)
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('ILS')
  const [showChart, setShowChart]       = useState(false)
  const [miniWeather, setMiniWeather]   = useState<{ temp: number; emoji: string; city: string; desc: string } | null>(null)

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setDocuments([]); setLoading(false); return }
    try {
      const [expRes, docRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('trip_id', currentTrip.id).order('expense_date', { ascending: false }),
        supabase.from('documents').select('*').eq('trip_id', currentTrip.id),
      ])
      if (!expRes.error) setExpenses(expRes.data || [])
      if (!docRes.error) setDocuments(docRes.data || [])
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // Fetch mini weather widget for the trip's main city
  useEffect(() => {
    if (!currentTrip?.destination) return
    const city = currentTrip.destination.split(/[,، ]/)[0].trim() || 'Bangkok'
    const WMO_EMOJI: Record<string, string> = {
      '0': '☀️', '1': '🌤', '2': '⛅', '3': '☁️',
      '45': '🌫', '48': '🌫',
      '51': '🌦', '53': '🌦', '55': '🌧',
      '61': '🌧', '63': '🌧', '65': '🌧',
      '71': '❄️', '73': '❄️', '75': '❄️',
      '80': '⛈', '81': '⛈', '82': '⛈',
      '95': '⛈', '96': '⛈', '99': '⛈',
    }
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.current) return
        const code = String(data.current.weatherCode ?? 0)
        const emoji = WMO_EMOJI[code] ?? '🌡️'
        setMiniWeather({ temp: Math.round(data.current.temperature), emoji, city: data.city, desc: data.current.weatherCode <= 2 ? 'שמיים בהירים' : data.current.weatherCode <= 3 ? 'מעונן חלקית' : data.current.weatherCode <= 48 ? 'ערפל' : data.current.weatherCode <= 67 ? 'גשם' : data.current.weatherCode <= 77 ? 'שלג' : 'סופה' })
      })
      .catch(() => {})
  }, [currentTrip?.destination])

  const totalIls = expenses.reduce((sum, e) => sum + (e.amount_ils || 0), 0)

  const tripStart  = currentTrip ? new Date(currentTrip.start_date) : new Date()
  const tripEnd    = currentTrip ? new Date(currentTrip.end_date)   : new Date()
  const totalTripDays = Math.max(1, Math.ceil((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1)
  const daysElapsed   = Math.max(1, Math.ceil((Math.min(Date.now(), tripEnd.getTime()) - tripStart.getTime()) / 86400000) + 1)
  const avgDaily      = totalIls / daysElapsed
  const todayStr      = new Date().toISOString().split('T')[0]
  const todayTotal    = expenses.filter(e => e.expense_date === todayStr).reduce((s, e) => s + (e.amount_ils || 0), 0)
  const daysRemaining = Math.max(0, Math.ceil((tripEnd.getTime() - Date.now()) / 86400000))

  const RATE_FROM_ILS: Record<Currency, number> = {
    ILS: 1, USD: 1 / 3.70, THB: 1 / 0.105, EUR: 1 / 4.00, GBP: 1 / 4.65,
    JPY: 1 / 0.025, AED: 1 / 1.01, SGD: 1 / 2.74, TRY: 1 / 0.11, CHF: 1 / 4.10, AUD: 1 / 2.38, CAD: 1 / 2.72,
  }
  const convert = (ils: number) => {
    const val = ils * RATE_FROM_ILS[displayCurrency]
    return `${CURRENCY_SYMBOL[displayCurrency]}${Math.round(val).toLocaleString('he-IL')}`
  }

  const categoryData = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amount_ils || 0)
      return acc
    }, {})
  ).map(([cat, total]) => ({
    name:  CATEGORY_META[cat as Category]?.label || cat,
    value: Math.round(total),
    color: CATEGORY_META[cat as Category]?.color || '#888',
  }))

  const recentExpenses    = expenses.slice(0, 8)
  const upcomingEvents    = extractUpcomingEvents(documents, todayStr)

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || tripsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-10 h-10 rounded-full animate-spin"
          style={{ border: '3px solid rgba(108,71,255,0.15)', borderTopColor: '#6C47FF' }} />
        <p className="text-sm text-gray-400 font-medium">טוען...</p>
      </div>
    )
  }

  // ── No trips empty state ───────────────────────────────────────────────────
  if (!tripsLoading && trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <Plane className="w-12 h-12 text-white" />
          </div>
          {displayName && (
            <p className="text-gray-400 text-sm mb-1">שלום {displayName} 👋</p>
          )}
          <h2 className="text-2xl font-bold tracking-tight mb-2">{t('dash_ready')}</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            צור נסיעה ראשונה כדי להתחיל לעקוב אחר ההוצאות, המסמכים ולוח הזמנים שלך
          </p>
          <Link href="/trips/new"
            className="w-full text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-fab"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
            <Plus className="w-5 h-5" />
            {t('dash_first_trip')}
          </Link>
          <Link href="/quiz"
            className="w-full mt-3 border border-violet-200 bg-violet-50 text-violet-600 rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            🌍 לא יודע לאן לטוס? קבל המלצה אישית
          </Link>
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { emoji: '💰', label: 'מעקב הוצאות' },
              { emoji: '📸', label: 'סריקת קבלות' },
              { emoji: '🧳', label: 'רשימת אריזה' },
            ].map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-white rounded-2xl p-3 shadow-card text-center">
                <div className="text-2xl mb-1">{f.emoji}</div>
                <p className="text-[11px] text-gray-500 font-medium">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Main Revolut-style dashboard ───────────────────────────────────────────
  return (
    <div className="page-enter -mx-4" dir={dir}>
      {/* ══════════════════════════════════════════════════════
          HERO SECTION — full-width gradient background
          ════════════════════════════════════════════════════ */}
      <div
        className="relative px-5 pt-4 pb-8 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #EEE9FF 0%, #DDD4FF 35%, #C5B3FF 70%, #A98EFF 100%)',
          minHeight: 260,
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.25)', transform: 'translate(40%, -40%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'rgba(108,71,255,0.12)', transform: 'translate(-30%, 40%)' }} />

        {/* Top row: greeting + currency */}
        <div className="relative flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-dark/70 text-xs font-medium">
              {displayName ? `שלום, ${displayName}` : 'ברוך הבא'}
            </p>
            <p className="text-primary-dark font-bold text-sm truncate max-w-[180px]">
              {currentTrip?.name || t('dash_no_trip')}
            </p>
          </div>
          <CurrencySelector value={displayCurrency} onChange={setDisplayCurrency} />
        </div>

        {/* Giant balance */}
        <div className="relative text-center mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-dark/60 mb-1">
            סה״כ הוצאות
          </p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            {/* Big balance — currency symbol + formatted number */}
            <div className="flex items-end justify-center gap-1 leading-none">
              <span className="text-2xl font-bold text-primary-dark/70 mb-2">
                {CURRENCY_SYMBOL[displayCurrency]}
              </span>
              <span className="text-[52px] font-black tracking-tight text-primary-dark">
                {Math.round(totalIls * RATE_FROM_ILS[displayCurrency]).toLocaleString('he-IL')}
              </span>
            </div>
          </motion.div>
          <p className="text-xs text-primary-dark/55 mt-1 font-medium">
            {currentTrip?.destination} · {totalTripDays} ימים · {daysRemaining} נותרו
          </p>
        </div>

        {/* Trip switcher pill */}
        {trips.length > 1 && (
          <div className="relative flex justify-center mt-3">
            <Link href="/trips"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full active:scale-95 transition-all"
              style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(8px)' }}>
              <Plane className="w-3 h-3 text-primary-dark" />
              <span className="text-xs font-semibold text-primary-dark">{t('dash_all_trips')}</span>
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{trips.length}</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          QUICK ACTIONS — 5 service shortcuts (horizontal scroll)
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-gray-50">
        <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[
            { href: 'https://www.airalo.com',  icon: Smartphone,  label: 'eSim',          color: '#6C47FF', bg: 'rgba(108,71,255,0.12)', external: true  },
            { href: '/documents',              icon: ShieldCheck,  label: 'ביטוח',         color: '#10B981', bg: 'rgba(16,185,129,0.10)', external: false },
            { href: '/documents',              icon: Building2,    label: 'מלונות',        color: '#0891B2', bg: 'rgba(8,145,178,0.10)',  external: false },
            { href: '/documents',              icon: Car,          label: 'השכרת רכב',    color: '#D97706', bg: 'rgba(217,119,6,0.10)',  external: false },
            { href: '/documents',              icon: Plane,        label: 'טיסות',         color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', external: false },
          ].map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex-shrink-0">
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 active:scale-90 transition-all">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: item.bg }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 text-center">{item.label}</span>
                </a>
              ) : (
                <Link href={item.href}
                  className="flex flex-col items-center gap-1.5 active:scale-90 transition-all">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: item.bg }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 text-center">{item.label}</span>
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          GMAIL SCAN BUTTON
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 py-3 border-b border-gray-50">
        <GmailScanButton onScanComplete={(created) => { if (created > 0) fetchExpenses() }} />
      </div>

      {/* ══════════════════════════════════════════════════════
          STATS STRIP — horizontal scroll
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 py-3 border-b border-gray-50">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[
            { label: 'ממוצע יומי', value: convert(avgDaily),  icon: TrendingUp,   color: '#10B981', bg: '#ECFDF5' },
            { label: 'היום',       value: convert(todayTotal), icon: CalendarDays, color: '#F59E0B', bg: '#FFFBEB' },
            { label: t('dash_travel_days'),  value: `${totalTripDays}`, icon: Plane,        color: '#3B82F6', bg: '#EFF6FF' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl flex-shrink-0"
              style={{ background: s.bg }}>
              <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
              <div>
                <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                <p className="text-sm font-bold text-gray-800 leading-tight">{s.value}</p>
              </div>
            </motion.div>
          ))}
          {/* Weather mini-widget */}
          {miniWeather && (
            <Link href="/weather"
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl flex-shrink-0 active:scale-95 transition-all"
              style={{ background: '#EFF6FF' }}>
              <span className="text-xl leading-none">{miniWeather.emoji}</span>
              <div>
                <p className="text-[10px] text-gray-400 font-medium">{miniWeather.city}</p>
                <p className="text-sm font-bold text-gray-800 leading-tight">{miniWeather.temp}°C</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          UPCOMING SCHEDULE — from timeline documents
          ════════════════════════════════════════════════════ */}
      <div className="bg-white">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-gray-800">לוז קרוב</h2>
          </div>
          <Link href="/timeline"
            className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full active:scale-95">
            הכל
          </Link>
        </div>

        {upcomingEvents.length > 0 ? (
          <div>
            {upcomingEvents.map((ev, i) => {
              const isEvToday = ev.date === todayStr
              return (
                <motion.div key={`${ev.docId}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3.5 px-5 py-3.5 active:bg-gray-50 transition-colors
                    ${i < upcomingEvents.length - 1 ? 'border-b border-gray-50' : ''}`}>

                  {/* Icon badge */}
                  <DocEventIconBadge type={ev.type} size={10} />

                  {/* Title + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {ev.time && (
                        <span className="text-[11px] font-bold text-primary tabular-nums">{ev.time}</span>
                      )}
                      <p className="text-[11px] text-gray-400">
                        {isEvToday ? 'היום' : ev.date}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Today badge */}
                  {isEvToday && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      היום
                    </span>
                  )}
                </motion.div>
              )
            })}

            <Link href="/timeline"
              className="flex items-center justify-between px-5 py-3.5 border-t border-gray-50 active:bg-gray-50 transition-colors">
              <span className="text-sm font-semibold text-primary">ציר הזמן המלא</span>
              <ChevronLeft className="w-4 h-4 text-primary" />
            </Link>
          </div>
        ) : (
          /* Empty state */
          <div className="px-5 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #6C47FF18, #9B7BFF18)' }}>
              <Clock className="w-7 h-7 text-primary/50" />
            </div>
            <p className="text-sm font-bold text-gray-600 mb-1">אין אירועים קרובים</p>
            <p className="text-xs text-gray-400 mb-5">הוסף מסמכי הזמנה כדי לראות את הלוז</p>
            <Link href="/scan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
              <ScanLine className="w-4 h-4" />
              הוסף מסמך ראשון
            </Link>
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-6 bg-surface-secondary" />
    </div>
  )
}
