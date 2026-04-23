'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Plane, TrendingUp, CalendarDays, Wallet, Plus,
  ScanLine, FolderOpen, MoreHorizontal, ArrowLeftRight,
  ChevronLeft, ChevronRight, Smartphone, ShieldCheck,
  Building2, Car, Calendar, Clock,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, getDaysRemaining, getTripDays } from '@/lib/utils'
import { getDestinationCity } from '@/lib/destinations'
import { Expense, Category, CATEGORY_META, Currency, CURRENCY_SYMBOL, Document as TripDoc } from '@/types'
import { DocEventIconBadge } from '@/lib/iconConfig'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import GmailScanButton from '@/components/GmailScanButton'
import CurrencySelector from '@/components/CurrencySelector'
import WeatherWidget from '@/components/WeatherWidget'
import { DashboardSkeleton } from '@/components/ui/Skeleton'
import { heroStagger, itemVariants, staggerContainer, spring } from '@/lib/motion'

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
  const reduce = useReducedMotion()
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [documents, setDocuments]       = useState<TripDoc[]>([])
  const [loading, setLoading]           = useState(true)
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('ILS')
  const [showChart, setShowChart]       = useState(false)

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
      <>
        <span className="sr-only" role="status" aria-live="polite">{t('dash_loading')}</span>
        <DashboardSkeleton />
      </>
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
            <p className="text-gray-400 text-sm mb-1">{t('dash_hello')} {displayName} 👋</p>
          )}
          <h2 className="text-2xl font-bold tracking-tight mb-2">{t('dash_ready')}</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            {t('dash_first_trip_subtitle')}
          </p>
          <Link href="/trips/new"
            className="w-full text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-fab"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
            <Plus className="w-5 h-5" />
            {t('dash_first_trip')}
          </Link>
          <Link href="/quiz"
            className="w-full mt-3 border border-violet-200 bg-violet-50 text-violet-600 rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            {t('dash_quiz_recommendation')}
          </Link>
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { emoji: '💰', label: t('dash_feature_expenses') },
              { emoji: '📸', label: t('dash_feature_scan') },
              { emoji: '🧳', label: t('dash_feature_packing') },
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
    <div className="-mx-4" dir={dir}>
      {/* ══════════════════════════════════════════════════════
          HERO SECTION — full-width gradient + animated aurora
          ════════════════════════════════════════════════════ */}
      <motion.section
        variants={heroStagger}
        initial={reduce ? false : 'initial'}
        animate="animate"
        aria-labelledby="hero-balance-label"
        className="relative px-5 pt-4 pb-8 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #EEE9FF 0%, #DDD4FF 35%, #C5B3FF 70%, #A98EFF 100%)',
          minHeight: 260,
          boxShadow: 'inset 0 -1px 0 rgba(108,71,255,0.08)',
        }}
      >
        {/* Animated aurora blobs */}
        <motion.div
          aria-hidden="true"
          className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.40) 0%, transparent 70%)', transform: 'translate(40%, -40%)' }}
          animate={reduce ? undefined : { scale: [1, 1.12, 1], x: ['40%', '32%', '40%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(108,71,255,0.18) 0%, transparent 70%)', transform: 'translate(-30%, 40%)' }}
          animate={reduce ? undefined : { scale: [1, 1.18, 1], y: ['40%', '46%', '40%'] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        {/* Top row: greeting + currency */}
        <motion.div variants={itemVariants} className="relative flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-dark/70 text-xs font-medium">
              {displayName ? `${t('dash_hello')}, ${displayName}` : t('dash_welcome')}
            </p>
            <p className="text-primary-dark font-bold text-sm truncate max-w-[180px]">
              {currentTrip?.name || t('dash_no_trip')}
            </p>
          </div>
          <CurrencySelector value={displayCurrency} onChange={setDisplayCurrency} />
        </motion.div>

        {/* Giant balance */}
        <motion.div variants={itemVariants} className="relative text-center mb-2">
          <p id="hero-balance-label" className="text-xs font-semibold uppercase tracking-widest text-primary-dark/60 mb-1">
            {t('dash_total_expenses')}
          </p>
          <motion.div
            initial={reduce ? undefined : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring.pop, delay: 0.18 }}
          >
            {/* Big balance — currency symbol + formatted number */}
            <div className="flex items-end justify-center gap-1 leading-none">
              <span className="text-2xl font-bold text-primary-dark/70 mb-2">
                {CURRENCY_SYMBOL[displayCurrency]}
              </span>
              <span
                className="text-[52px] font-black tracking-tight text-primary-dark tabular-nums"
                aria-live="polite"
              >
                {Math.round(totalIls * RATE_FROM_ILS[displayCurrency]).toLocaleString('he-IL')}
              </span>
            </div>
          </motion.div>
          <p className="text-xs text-primary-dark/55 mt-1 font-medium">
            {currentTrip?.destination} · {totalTripDays} {t('dash_days')} · {daysRemaining} {t('dash_left')}
          </p>
        </motion.div>

        {/* Trip switcher pill */}
        {trips.length > 1 && (
          <motion.div variants={itemVariants} className="relative flex justify-center mt-3">
            <Link
              href="/trips"
              aria-label={`עבור לרשימת כל הטיולים — סה״כ ${trips.length}`}
              className="flex items-center gap-2 px-4 py-2 min-h-[36px] rounded-full active:scale-95 transition-all hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)' }}>
              <Plane className="w-3.5 h-3.5 text-primary-dark" aria-hidden="true" />
              <span className="text-xs font-semibold text-primary-dark">{t('dash_all_trips')}</span>
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center" aria-hidden="true">
                <span className="text-[9px] font-bold text-white">{trips.length}</span>
              </div>
            </Link>
          </motion.div>
        )}
      </motion.section>

      {/* ══════════════════════════════════════════════════════
          QUICK ACTIONS — 5 service shortcuts (horizontal scroll)
          ════════════════════════════════════════════════════ */}
      <motion.section
        aria-label={t('dash_quick_actions')}
        variants={staggerContainer}
        initial={reduce ? false : 'initial'}
        animate="animate"
        className="bg-white px-5 pt-5 pb-4 border-b border-gray-50"
      >
        <ul role="list" className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[
            { href: 'https://www.airalo.com',  icon: Smartphone,  label: t('dash_quick_esim'),       color: '#6C47FF', bg: 'rgba(108,71,255,0.12)', external: true  },
            { href: '/documents',              icon: ShieldCheck,  label: t('dash_quick_insurance'), color: '#10B981', bg: 'rgba(16,185,129,0.10)', external: false },
            { href: '/documents',              icon: Building2,    label: t('dash_quick_hotels'),    color: '#0891B2', bg: 'rgba(8,145,178,0.10)',  external: false },
            { href: '/documents',              icon: Car,          label: t('dash_quick_carrental'), color: '#D97706', bg: 'rgba(217,119,6,0.10)',  external: false },
            { href: '/documents',              icon: Plane,        label: t('dash_quick_flights'),   color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', external: false },
          ].map((item, i) => {
            const Inner = (
              <>
                <motion.div
                  whileTap={reduce ? undefined : { scale: 0.88 }}
                  transition={spring.tight}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: item.bg,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}
                  aria-hidden="true"
                >
                  <item.icon className="w-6 h-6" style={{ color: item.color }} strokeWidth={1.8} />
                </motion.div>
                <span className="text-[11px] font-semibold text-gray-700 text-center">{item.label}</span>
              </>
            )
            return (
              <motion.li key={i} variants={itemVariants} className="flex-shrink-0">
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.label} ${t('dash_external_open')}`}
                    className="flex flex-col items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl p-1"
                  >
                    {Inner}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className="flex flex-col items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl p-1"
                  >
                    {Inner}
                  </Link>
                )}
              </motion.li>
            )
          })}
        </ul>
      </motion.section>

      {/* ══════════════════════════════════════════════════════
          GMAIL SCAN BUTTON
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 py-3 border-b border-gray-50">
        <GmailScanButton onScanComplete={(created) => { if (created > 0) fetchExpenses() }} />
      </div>

      {/* ══════════════════════════════════════════════════════
          STATS STRIP — horizontal scroll
          ════════════════════════════════════════════════════ */}
      <motion.section
        aria-label={t('dash_trip_stats')}
        variants={staggerContainer}
        initial={reduce ? false : 'initial'}
        animate="animate"
        className="bg-white px-5 py-3 border-b border-gray-50"
      >
        <ul role="list" className="flex gap-3 overflow-x-auto pb-1">
          {[
            { label: t('dash_avg_daily'), value: convert(avgDaily),  icon: TrendingUp,   color: '#10B981', bg: '#ECFDF5' },
            { label: t('dash_today'),     value: convert(todayTotal), icon: CalendarDays, color: '#F59E0B', bg: '#FFFBEB' },
            { label: t('dash_travel_days'),  value: `${totalTripDays}`, icon: Plane,     color: '#3B82F6', bg: '#EFF6FF' },
          ].map((s, i) => (
            <motion.li
              key={i}
              variants={itemVariants}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl flex-shrink-0"
              style={{
                background: s.bg,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
              }}>
              <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} aria-hidden="true" />
              <div>
                <p className="text-[10px] text-gray-500 font-medium">{s.label}</p>
                <p className="text-sm font-bold text-gray-800 leading-tight tabular-nums">{s.value}</p>
              </div>
            </motion.li>
          ))}
          {/* Weather mini-widget */}
          {currentTrip?.destination && (
            <motion.li variants={itemVariants} className="flex-shrink-0 list-none">
              <WeatherWidget city={getDestinationCity(currentTrip.destination)} />
            </motion.li>
          )}
        </ul>
      </motion.section>

      {/* ══════════════════════════════════════════════════════
          UPCOMING SCHEDULE — from timeline documents
          ════════════════════════════════════════════════════ */}
      <div className="bg-white">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-gray-800">{t('dash_upcoming_short')}</h2>
          </div>
          <Link href="/timeline"
            className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full active:scale-95">
            {t('dash_view_all')}
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
                        {isEvToday ? t('dash_today') : ev.date}
                        {ev.subtitle ? ` · ${ev.subtitle}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Today badge */}
                  {isEvToday && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      {t('dash_today')}
                    </span>
                  )}
                </motion.div>
              )
            })}

            <Link
              href="/timeline"
              aria-label={t('dash_open_timeline')}
              className="flex items-center justify-between px-5 py-3.5 min-h-[48px] border-t border-gray-50 active:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
              <span className="text-sm font-semibold text-primary">{t('dash_full_timeline')}</span>
              <ChevronLeft className="w-4 h-4 text-primary rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          /* Empty state */
          <div className="px-5 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #6C47FF18, #9B7BFF18)' }}>
              <Clock className="w-7 h-7 text-primary/50" />
            </div>
            <p className="text-sm font-bold text-gray-600 mb-1">{t('dash_no_upcoming')}</p>
            <p className="text-xs text-gray-400 mb-5">{t('dash_no_upcoming_hint')}</p>
            <Link href="/scan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
              <ScanLine className="w-4 h-4" />
              {t('dash_add_first_doc')}
            </Link>
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-6 bg-surface-secondary" />
    </div>
  )
}
