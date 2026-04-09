'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronLeft, Trash2, Pencil, X, Check,
  TrendingUp, Calendar, Wallet, LayoutList, BarChart2,
  Plane, Hotel, Car, Briefcase, MapPin, Clock, Users, Paperclip,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { Expense, Category, CATEGORY_META, Currency, CURRENCY_SYMBOL, Document as TripDoc } from '@/types'
import { DocEventIconBadge, CategoryIconBadge } from '@/lib/iconConfig'
import { useTrip } from '@/contexts/TripContext'
import { eachDayOfInterval, parseISO, format, isToday, differenceInDays } from 'date-fns'
import CurrencySelector from '@/components/CurrencySelector'
import DocumentViewer  from '@/components/DocumentViewer'

// ── Types ──────────────────────────────────────────────────────────────────────

/** אירוע שנגזר ממסמך (טיסה/מלון/רכב/שירות) ומוצג בציר הזמן */
interface DocEvent {
  type:     'flight' | 'car_pickup' | 'car_dropoff' | 'hotel_checkin' | 'hotel_stay' | 'hotel_checkout' | 'service'
  title:    string
  subtitle?: string
  icon:     string
  color:    string
  bgColor:  string
  docId:    string
  time?:    string
}

interface DayData {
  date:      string
  dayNumber: number
  isToday:   boolean
  isPast:    boolean
  isFuture:  boolean
  expenses:  Expense[]
  docEvents: DocEvent[]
  totalIls:  number
}

type FilterCat  = 'all' | Category
type ViewMode   = 'timeline' | 'summary'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** מחזיר icon לפי סוג שירות */
function serviceIcon(serviceType: string): string {
  switch (serviceType) {
    case 'airport_transfer': return '🚐'
    case 'vip_lounge':       return '⭐'
    case 'shuttle':          return '🚌'
    case 'meal':             return '🍽️'
    case 'spa':              return '💆'
    case 'activity':         return '🎯'
    default:                 return '✨'
  }
}

/** Sort helper — events with time come first, then by time string */
function sortByTime(a: DocEvent, b: DocEvent): number {
  if (a.time && b.time) return a.time.localeCompare(b.time)
  if (a.time && !b.time) return -1
  if (!a.time && b.time) return 1
  return 0
}

function buildDays(
  startDate: string,
  endDate:   string,
  expenses:  Expense[],
  documents: TripDoc[],
): DayData[] {
  const tripStart = parseISO(startDate)
  const tripEnd   = parseISO(endDate)

  // Extend range to cover any expense dates that fall outside the trip window
  const expDates = expenses
    .map(e => parseISO(e.expense_date))
    .filter(d => !isNaN(d.getTime()))

  const start = expDates.length > 0
    ? new Date(Math.min(tripStart.getTime(), ...expDates.map(d => d.getTime())))
    : tripStart
  const end   = expDates.length > 0
    ? new Date(Math.max(tripEnd.getTime(),   ...expDates.map(d => d.getTime())))
    : tripEnd

  const days  = eachDayOfInterval({ start, end })
  const today = new Date()

  return days.map((day) => {
    const dateStr  = format(day, 'yyyy-MM-dd')
    const dayExps  = expenses.filter(e => e.expense_date === dateStr)
    const totalIls = dayExps.reduce((s, e) => s + (e.amount_ils || 0), 0)
    const dayNumber = differenceInDays(day, tripStart) + 1

    // ── Build document events for this day ──────────────────────────────────
    const docEvents: DocEvent[] = []

    for (const doc of documents) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ext = doc.extracted_data as any

      // ── Flight events ───────────────────────────────────────────────────
      if (doc.doc_type === 'flight') {
        const flightNum = ext?.flight_number || ''
        const depCity   = ext?.departure_city || ext?.dep_city || ''
        const arrCity   = ext?.arrival_city   || ext?.arr_city || ''
        const depTime   = ext?.departure_time || ext?.dep_time || ''
        const arrTime   = ext?.arrival_time   || ext?.arr_time || ''
        const depDate   = ext?.departure_date || ext?.dep_date as string | undefined
        const airline   = ext?.airline        || ''

        if (depDate === dateStr) {
          const timeLabel = depTime && arrTime ? `${depTime} → ${arrTime}` : depTime
          const subtitleParts = [
            flightNum || airline,
            timeLabel,
          ].filter(Boolean)
          docEvents.push({
            type:     'flight',
            title:    depCity && arrCity ? `${depCity} → ${arrCity}` : doc.name,
            subtitle: subtitleParts.join(' · ') || undefined,
            icon:     '✈️',
            color:    '#2563eb',
            bgColor:  '#eff6ff',
            docId:    doc.id,
            time:     depTime || undefined,
          })
        }

      }

      // ── Car rental events (detected via extracted_data fields) ─────────
      // car_rental is not a DocType — detect via extracted_data presence
      const hasCarRentalData = ext?.pickup_date || ext?.dropoff_date || ext?.rental_company || ext?.car_type
      if (hasCarRentalData) {
        const company     = ext?.company         || ext?.rental_company  || ''
        const carType     = ext?.car_type        || ext?.vehicle         || ''
        const pickupLoc   = ext?.pickup_location  || ''
        const dropoffLoc  = ext?.dropoff_location || ''
        const pickupDate  = ext?.pickup_date  as string | undefined
        const dropoffDate = ext?.dropoff_date as string | undefined
        const pickupTime  = ext?.pickup_time  || ''

        if (pickupDate === dateStr) {
          docEvents.push({
            type:     'car_pickup',
            title:    `איסוף רכב${company ? ` — ${company}` : ''}`,
            subtitle: [carType, pickupLoc, pickupTime].filter(Boolean).join(' · ') || undefined,
            icon:     '🚗',
            color:    '#d97706',
            bgColor:  '#fffbeb',
            docId:    doc.id,
            time:     pickupTime || undefined,
          })
        }

        if (dropoffDate === dateStr) {
          docEvents.push({
            type:     'car_dropoff',
            title:    `החזרת רכב${company ? ` — ${company}` : ''}`,
            subtitle: [carType, dropoffLoc].filter(Boolean).join(' · ') || undefined,
            icon:     '🏁',
            color:    '#d97706',
            bgColor:  '#fffbeb',
            docId:    doc.id,
            time:     '',
          })
        }
      }

      // ── Hotel events ───────────────────────────────────────────────────────
      if (doc.doc_type === 'hotel') {
        const hotelName   = ext?.hotel_name  || doc.name
        const checkIn     = ext?.check_in    as string | undefined
        const checkOut    = ext?.check_out   as string | undefined
        const checkInTime  = ext?.check_in_time  as string | undefined
        const checkOutTime = ext?.check_out_time as string | undefined
        const roomType    = ext?.room_type   as string | undefined
        const totalNights = checkIn && checkOut
          ? differenceInDays(parseISO(checkOut), parseISO(checkIn))
          : 0

        if (checkIn === dateStr) {
          const parts = [
            roomType,
            totalNights ? `${totalNights} לילות` : undefined,
          ].filter(Boolean)
          docEvents.push({
            type:     'hotel_checkin',
            title:    `צ׳ק אין — ${hotelName}`,
            subtitle: parts.length ? parts.join(' · ') : undefined,
            icon:     '🏨',
            color:    '#16a34a',
            bgColor:  '#f0fdf4',
            docId:    doc.id,
            time:     checkInTime,
          })
        } else if (checkOut === dateStr) {
          docEvents.push({
            type:     'hotel_checkout',
            title:    `צ׳ק אאוט — ${hotelName}`,
            subtitle: checkOutTime ? `עד שעה ${checkOutTime}` : undefined,
            icon:     '🚪',
            color:    '#dc2626',
            bgColor:  '#fef2f2',
            docId:    doc.id,
            time:     checkOutTime,
          })
        }
      }

      // ── Additional services (from any document type) ────────────────────
      const services = ext?.additional_services as Array<{
        service_type: string; name: string; date?: string; time?: string; description?: string
      }> | undefined

      if (services?.length) {
        for (const svc of services) {
          if (svc.date === dateStr) {
            docEvents.push({
              type:     'service',
              title:    svc.name,
              subtitle: svc.time ? `${svc.time}${svc.description ? ` · ${svc.description}` : ''}` : svc.description || undefined,
              icon:     serviceIcon(svc.service_type),
              color:    '#7c3aed',
              bgColor:  '#f5f3ff',
              docId:    doc.id,
              time:     svc.time || undefined,
            })
          }
        }
      }
    }

    // Sort by time
    docEvents.sort(sortByTime)

    return {
      date:      dateStr,
      dayNumber,
      isToday:   isToday(day),
      isPast:    day < today && !isToday(day),
      isFuture:  day > today,
      expenses:  dayExps,
      docEvents,
      totalIls,
    }
  })
}

// ── Summary view helpers ───────────────────────────────────────────────────────

interface FlightSummary {
  title:    string
  date:     string
  notes:    string | null
  amountIls: number
  currency:  Currency
  amount:    number
}

interface HotelStay {
  title:    string
  checkIn:  string
  checkOut: string | null
  nights:   number
  amountIls: number
}

interface CarRental {
  title:    string
  pickup:   string
  dropoff:  string | null
  amountIls: number
}

interface SummaryData {
  flights:      FlightSummary[]
  destinations: string[]
  hotels:       HotelStay[]
  cars:         CarRental[]
  activities:   Expense[]
  totalDays:    number
  totalFlights: number
  totalIls:     number
}

function buildSummary(expenses: Expense[], tripStart: string, tripEnd: string): SummaryData {
  const totalDays = differenceInDays(parseISO(tripEnd), parseISO(tripStart)) + 1

  // Flights — each leg is a separate expense with category='flight'
  const flightExps = expenses
    .filter(e => e.category === 'flight')
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date))

  const flights: FlightSummary[] = flightExps.map(e => ({
    title:     e.title,
    date:      e.expense_date,
    notes:     e.notes,
    amountIls: e.amount_ils || 0,
    currency:  e.currency,
    amount:    e.amount,
  }))

  // Destinations: extract arrival city from flight titles ("TLV → Bangkok")
  const destinations: string[] = []
  flightExps.forEach(e => {
    const parts = e.title.split('→')
    if (parts.length === 2) {
      const dest = parts[1].trim()
      if (dest && !destinations.includes(dest)) destinations.push(dest)
    }
  })

  // Hotels
  const hotelExps = expenses
    .filter(e => e.category === 'hotel')
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date))

  const hotels: HotelStay[] = hotelExps.map((e, i) => {
    const nextDate = hotelExps[i + 1]?.expense_date || tripEnd
    const nights = differenceInDays(parseISO(nextDate), parseISO(e.expense_date))
    return {
      title:     e.title,
      checkIn:   e.expense_date,
      checkOut:  nextDate || null,
      nights:    Math.max(1, nights),
      amountIls: e.amount_ils || 0,
    }
  })

  // Car rentals (taxi category in the system)
  const carExps = expenses
    .filter(e => e.category === 'taxi')
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date))

  const cars: CarRental[] = carExps.map((e, i) => {
    const nextDate = carExps[i + 1]?.expense_date || null
    return {
      title:     e.title,
      pickup:    e.expense_date,
      dropoff:   nextDate,
      amountIls: e.amount_ils || 0,
    }
  })

  // Activities
  const activities = expenses
    .filter(e => e.category === 'activity')
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date))

  const totalIls = expenses.reduce((s, e) => s + (e.amount_ils || 0), 0)

  return {
    flights,
    destinations,
    hotels,
    cars,
    activities,
    totalDays,
    totalFlights: flights.length,
    totalIls,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Extracts a document UUID from an expense's notes field (pattern: "doc:UUID") */
function extractDocId(notes: string | null | undefined): string | null {
  if (!notes) return null
  const match = notes.match(/doc:([0-9a-f-]{36})/i)
  return match ? match[1] : null
}

// ── Hebrew weekday names ───────────────────────────────────────────────────────
const HEB_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function hebrewWeekday(dateStr: string): string {
  const d = parseISO(dateStr)
  return HEB_WEEKDAYS[d.getDay()]
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const { currentTrip } = useTrip()

  const [expenses,    setExpenses]    = useState<Expense[]>([])
  const [documents,   setDocuments]   = useState<TripDoc[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterCat,   setFilterCat]   = useState<FilterCat>('all')
  const [viewMode,    setViewMode]    = useState<ViewMode>('timeline')
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editTitle,   setEditTitle]   = useState('')
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [currency,    setCurrency]    = useState<Currency>('ILS')

  // Per-day expense expansion state
  const [expandedExpDay, setExpandedExpDay] = useState<string | null>(null)

  // ── Document viewer state ────────────────────────────────────────────────
  const [viewerDoc,    setViewerDoc]    = useState<{ url: string; title: string; docType: string } | null>(null)
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null)

  // ── Auto-scroll to today ────────────────────────────────────────────────
  const todayRef = useRef<HTMLDivElement | null>(null)

  // ── Fetch expenses + documents ─────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setDocuments([]); setLoading(false); return }

    const [{ data: expData, error: expErr }, { data: docData }] = await Promise.all([
      supabase.from('expenses').select('*').eq('trip_id', currentTrip.id).order('expense_date', { ascending: true }),
      supabase.from('documents').select('*').eq('trip_id', currentTrip.id),
    ])
    if (!expErr) setExpenses(expData || [])
    setDocuments(docData || [])
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // Auto-scroll to today after load
  useEffect(() => {
    if (!loading && todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [loading])

  // ── Derived data ──────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (!currentTrip) return []
    return buildDays(currentTrip.start_date, currentTrip.end_date, expenses, documents)
  }, [currentTrip, expenses, documents])

  const filteredDays = useMemo(() => {
    if (filterCat === 'all') return days
    return days.map(d => ({
      ...d,
      expenses:  d.expenses.filter(e => e.category === filterCat),
      totalIls:  d.expenses.filter(e => e.category === filterCat)
                   .reduce((s, e) => s + (e.amount_ils || 0), 0),
    }))
  }, [days, filterCat])

  const totalIls      = expenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
  const daysWithSpend = days.filter(d => d.totalIls > 0).length
  const avgPerDay     = daysWithSpend > 0 ? totalIls / daysWithSpend : 0

  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category))
    return Array.from(cats) as Category[]
  }, [expenses])

  const summary = useMemo(() => {
    if (!currentTrip) return null
    return buildSummary(expenses, currentTrip.start_date, currentTrip.end_date)
  }, [expenses, currentTrip])

  // Currency conversion
  const RATE: Record<Currency, number> = { ILS: 1, USD: 1/3.70, THB: 1/0.105, EUR: 1/4.00, GBP: 1/4.65 }
  const convert = (ils: number) => {
    const val = ils * RATE[currency]
    return `${CURRENCY_SYMBOL[currency]}${Math.round(val).toLocaleString('he-IL')}`
  }

  // ── Inline rename ─────────────────────────────────────────────────────────
  const handleRename = async (exp: Expense) => {
    if (!editTitle.trim() || editTitle === exp.title) { setEditingId(null); return }
    const { error } = await supabase.from('expenses').update({ title: editTitle }).eq('id', exp.id)
    if (error) { toast.error('שגיאה בשמירה'); return }
    setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, title: editTitle } : e))
    setEditingId(null)
    toast.success('עודכן')
  }

  // ── Delete expense ────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה'); setDeletingId(null); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
    toast.success('נמחק')
  }

  // ── Open document from expense ────────────────────────────────────────────
  const handleOpenDoc = async (exp: Expense) => {
    const docId = extractDocId(exp.notes)
    if (!docId) return

    setLoadingDocId(exp.id)
    const { data, error } = await supabase
      .from('documents')
      .select('file_url, name, doc_type')
      .eq('id', docId)
      .single()

    setLoadingDocId(null)

    if (error || !data?.file_url) {
      toast.error('לא נמצא המסמך')
      return
    }

    setViewerDoc({
      url:     data.file_url,
      title:   data.name  || exp.title,
      docType: data.doc_type || exp.category,
    })
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-6">
        <p className="text-gray-400">לא נבחר טיול</p>
        <Link href="/trips" className="text-primary text-sm font-medium">בחר טיול →</Link>
      </div>
    )
  }

  const totalDays     = differenceInDays(parseISO(currentTrip.end_date), parseISO(currentTrip.start_date)) + 1
  const daysRemaining = Math.max(0, differenceInDays(parseISO(currentTrip.end_date), new Date()))

  return (
    <div className="space-y-4 pb-8" dir="rtl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-black gradient-text">ציר זמן</h1>
            <p className="text-xs text-gray-400 mt-0.5">{currentTrip?.destination || ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle — pill style */}
          <div className="flex items-center p-0.5 bg-surface-secondary rounded-2xl">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
              title="ציר זמן"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'summary' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
              title="סיכום נסיעה"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <CurrencySelector value={currency} onChange={setCurrency} size="sm" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SUMMARY VIEW
      ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {viewMode === 'summary' && summary && (
          <motion.div key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4">

            {/* ── Trip header ───────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="text-base font-bold mb-0.5">סיכום נסיעה</h2>
              <p className="text-xs text-gray-400">{currentTrip.destination} · {formatDate(currentTrip.start_date)} — {formatDate(currentTrip.end_date)}</p>
            </div>

            {/* ── Trip stats strip ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs text-gray-500">משך הנסיעה</span>
                </div>
                <p className="text-xl font-bold">{summary.totalDays}</p>
                <p className="text-xs text-gray-400">ימים סה&quot;כ</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Plane className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-500">טיסות</span>
                </div>
                <p className="text-xl font-bold">{summary.totalFlights}</p>
                <p className="text-xs text-gray-400">רגלי טיסה</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Hotel className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-gray-500">לינות</span>
                </div>
                <p className="text-xl font-bold">{summary.hotels.reduce((s, h) => s + h.nights, 0)}</p>
                <p className="text-xs text-gray-400">לילות</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-gray-500">סה&quot;כ הוצאות</span>
                </div>
                <p className="text-lg font-bold">{formatMoney(summary.totalIls)}</p>
                <p className="text-xs text-gray-400">כל הקטגוריות</p>
              </div>
            </div>

            {/* ── Destinations list ─────────────────────────────────────── */}
            {summary.destinations.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-bold">יעדים בנסיעה</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.destinations.map((dest, i) => (
                    <span key={i}
                      className="flex items-center gap-1 bg-red-50 text-red-700 text-xs px-3 py-1.5 rounded-full font-medium">
                      📍 {dest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Flights breakdown — table style ───────────────────────── */}
            {summary.flights.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Plane className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-bold">לוח טיסות</h3>
                  <span className="text-xs text-gray-400 mr-auto">{summary.flights.length} רגלים</span>
                </div>
                <div className="space-y-2">
                  {summary.flights.map((fl, i) => {
                    const isReturn = fl.notes?.includes('כלול במחיר הכרטיס') || fl.amountIls === 0
                    const isConnection = fl.notes?.includes('קונקשיין')
                    return (
                      <div key={i}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                          isConnection ? 'bg-orange-50' :
                          isReturn ? 'bg-gray-50' : 'bg-blue-50'
                        }`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isConnection ? 'bg-orange-100' :
                          isReturn ? 'bg-gray-200' : 'bg-blue-100'
                        }`}>
                          <span className="text-sm">{isConnection ? '🔄' : '✈️'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{fl.title}</p>
                          <p className="text-[10px] text-gray-500">
                            {formatDate(fl.date)}
                            {isConnection && ' · קונקשיין'}
                            {isReturn && !isConnection && ' · כלול בכרטיס'}
                          </p>
                        </div>
                        {fl.amountIls > 0 && (
                          <span className="text-xs font-bold text-blue-700 flex-shrink-0">
                            {formatMoney(fl.amountIls)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Hotels breakdown — timeline style ─────────────────────── */}
            {summary.hotels.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Hotel className="w-4 h-4 text-teal-600" />
                  </div>
                  <h3 className="text-sm font-bold">לינות</h3>
                </div>
                <div className="space-y-2">
                  {summary.hotels.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 bg-emerald-50 rounded-xl px-3 py-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">🏨</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{h.title}</p>
                        <p className="text-[10px] text-gray-500">
                          {formatDate(h.checkIn)} → {h.checkOut ? formatDate(h.checkOut) : '?'} · {h.nights} לילות
                        </p>
                      </div>
                      {h.amountIls > 0 && (
                        <span className="text-xs font-bold text-emerald-700 flex-shrink-0">
                          {formatMoney(h.amountIls)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Car rentals breakdown ─────────────────────────────────── */}
            {summary.cars.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-bold">השכרת רכב / הסעות</h3>
                </div>
                <div className="space-y-2">
                  {summary.cars.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 bg-amber-50 rounded-xl px-3 py-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">🚕</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{c.title}</p>
                        <p className="text-[10px] text-gray-500">
                          {formatDate(c.pickup)}
                          {c.dropoff ? ` → ${formatDate(c.dropoff)}` : ''}
                        </p>
                      </div>
                      {c.amountIls > 0 && (
                        <span className="text-xs font-bold text-amber-700 flex-shrink-0">
                          {formatMoney(c.amountIls)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Activities / Meetings ─────────────────────────────────── */}
            {summary.activities.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-violet-600" />
                  </div>
                  <h3 className="text-sm font-bold">פעילויות ואירועים</h3>
                  <span className="text-xs text-gray-400 mr-auto">{summary.activities.length}</span>
                </div>
                <div className="space-y-2">
                  {summary.activities.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 bg-purple-50 rounded-xl px-3 py-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">🎯</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{a.title}</p>
                        <p className="text-[10px] text-gray-500">{formatDate(a.expense_date)}</p>
                      </div>
                      {(a.amount_ils || 0) > 0 && (
                        <span className="text-xs font-bold text-purple-700 flex-shrink-0">
                          {formatMoney(a.amount_ils)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Trip schedule (all doc events chronologically) ────────── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-bold">לוח נסיעה מהיר</h3>
              </div>
              <div className="space-y-1">
                {days
                  .filter(d => d.docEvents.length > 0)
                  .map(d => (
                    <div key={d.date}>
                      <p className="text-[10px] font-semibold text-gray-400 px-1 pt-2 pb-0.5">
                        יום {d.dayNumber} · {formatDate(d.date)}
                      </p>
                      {d.docEvents.map((ev, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${d.isToday ? 'bg-primary/5' : 'bg-gray-50'}`}>
                          <span className="text-sm">{ev.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{ev.title}</p>
                            {ev.subtitle && <p className="text-[10px] text-gray-400">{ev.subtitle}</p>}
                          </div>
                          {ev.time && <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">{ev.time}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                {days.every(d => d.docEvents.length === 0) && (
                  <p className="text-xs text-gray-400 text-center py-2">אין אירועים ממסמכים</p>
                )}
              </div>
            </div>

            {/* ── Travelers ─────────────────────────────────────────────── */}
            {currentTrip.travelers && (currentTrip.travelers as {id: string; name: string}[]).length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold">נוסעים</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(currentTrip.travelers as {id: string; name: string}[]).map((t, i) => (
                    <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-3 py-1.5 rounded-full font-medium">
                      👤 {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {summary.flights.length === 0 && summary.hotels.length === 0 && summary.activities.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-3">✈️</div>
                <p className="font-bold mb-1">אין נתונים עדיין</p>
                <p className="text-sm text-gray-400">הוסף הוצאות ומסמכים כדי לראות את סיכום הנסיעה</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TIMELINE VIEW
        ══════════════════════════════════════════════════════════════════ */}
        {viewMode === 'timeline' && (
          <motion.div key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4">

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Wallet,     label: 'סה״כ',        value: convert(totalIls),       iconBg: 'bg-violet-100', iconColor: 'text-primary' },
                { icon: TrendingUp, label: 'ממוצע / יום',  value: convert(avgPerDay),       iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                { icon: Calendar,   label: 'נותרו',        value: `${daysRemaining} ימים`, iconBg: 'bg-orange-100', iconColor: 'text-orange-500' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-3.5 shadow-sm text-center">
                  <div className={`w-7 h-7 rounded-xl ${s.iconBg} flex items-center justify-center mx-auto mb-2`}>
                    <s.icon className={`w-3.5 h-3.5 ${s.iconColor}`} />
                  </div>
                  <p className="text-lg font-black text-gray-900 leading-tight">{s.value}</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Budget bar */}
            {currentTrip.budget_ils && (
              <div className="bg-white rounded-2xl px-4 py-3.5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">תקציב</span>
                  <span className="font-semibold text-gray-700">
                    סה&quot;כ {convert(totalIls)} מתוך {convert(currentTrip.budget_ils)}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((totalIls / currentTrip.budget_ils) * 100, 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      totalIls / currentTrip.budget_ils > 0.9 ? 'bg-red-400' :
                      totalIls / currentTrip.budget_ils > 0.7 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-left">
                  {Math.round((totalIls / currentTrip.budget_ils) * 100)}% מהתקציב
                </p>
              </div>
            )}

            {/* Category filter */}
            {usedCategories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setFilterCat('all')}
                  className={`flex-shrink-0 rounded-2xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    filterCat === 'all' ? 'text-white shadow-sm' : 'bg-white shadow-sm text-gray-500'
                  }`}
                  style={filterCat === 'all' ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : {}}>
                  הכל
                </button>
                {usedCategories.map(cat => (
                  <button key={cat}
                    onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                    className={`flex-shrink-0 rounded-2xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      filterCat === cat ? 'text-white shadow-sm' : 'bg-white shadow-sm text-gray-500'
                    }`}
                    style={filterCat === cat ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : {}}>
                    <span>{CATEGORY_META[cat].icon}</span>
                    {CATEGORY_META[cat].label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Day cards ────────────────────────────────────────────── */}
            <div className="space-y-3">
              {filteredDays.map((day) => {
                const hasDocEvents = day.docEvents.length > 0
                const hasExpenses  = day.expenses.length > 0
                const hasContent   = hasDocEvents || hasExpenses
                const isExpExpanded = expandedExpDay === day.date

                // Empty days — very compact
                if (!hasContent) {
                  return (
                    <div
                      key={day.date}
                      ref={day.isToday ? todayRef : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                        day.isToday
                          ? 'bg-primary/5 ring-1 ring-primary/20'
                          : day.isFuture ? 'opacity-30' : 'opacity-50'
                      }`}>
                      <div
                        className={`w-8 h-8 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center ${
                          !day.isToday && day.isPast ? 'bg-gray-300 text-white' :
                          !day.isToday ? 'bg-gray-100 text-gray-400' : ''
                        }`}
                        style={day.isToday ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', color: 'white' } : {}}>
                        {day.dayNumber >= 1 ? (
                          <>
                            <span className="text-[9px] leading-none opacity-70">יום</span>
                            <span className="text-xs font-bold">{day.dayNumber}</span>
                          </>
                        ) : (
                          <span className="text-[9px] leading-none">—</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {hebrewWeekday(day.date)}, {format(parseISO(day.date), 'dd.MM')}
                      </span>
                      {day.isToday && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">היום</span>
                      )}
                    </div>
                  )
                }

                // Day with content — full card
                return (
                  <motion.div
                    key={day.date}
                    ref={day.isToday ? todayRef : undefined}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden ${
                      day.isToday ? 'ring-2 ring-primary ring-offset-1' : ''
                    }`}>

                    {/* Day header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                      <div
                        className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center ${
                          !day.isToday && day.isPast ? 'bg-gray-800 text-white' :
                          !day.isToday ? 'bg-gray-100 text-gray-500' : ''
                        }`}
                        style={day.isToday ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', color: 'white' } : {}}>
                        {day.dayNumber >= 1 ? (
                          <>
                            <span className="text-[10px] font-normal leading-none opacity-70">יום</span>
                            <span className="text-sm font-bold leading-tight">{day.dayNumber}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] leading-none">לפני</span>
                            <span className="text-[9px] leading-none">הטיול</span>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">
                            {hebrewWeekday(day.date)}, {format(parseISO(day.date), 'dd.MM')}
                          </span>
                          {day.isToday && (
                            <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-medium">היום</span>
                          )}
                        </div>
                        {hasDocEvents && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {day.docEvents.map(ev => ev.icon).slice(0, 4).join(' ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Doc events — always visible */}
                    {hasDocEvents && (
                      <div className="px-4 py-3 space-y-0">
                        {day.docEvents.map((ev, i) => {
                          const isLast = i === day.docEvents.length - 1 && !hasExpenses
                          return (
                            <div key={`ev-${i}`} className="flex gap-3 items-start">
                              <div className="flex flex-col items-center">
                                <DocEventIconBadge type={ev.type} size={8} />
                                {!isLast && <div className="w-0.5 h-3 bg-gray-100 mt-1" />}
                              </div>
                              <div className="flex-1 pb-3 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {ev.time && (
                                    <span className="text-[11px] font-bold tabular-nums" style={{ color: ev.color }}>
                                      {ev.time}
                                    </span>
                                  )}
                                  <p className="text-sm font-semibold text-gray-900">{ev.title}</p>
                                </div>
                                {ev.subtitle && (
                                  <p className="text-xs text-gray-400 mt-0.5">{ev.subtitle}</p>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  const { data } = await supabase
                                    .from('documents')
                                    .select('file_url, name, doc_type')
                                    .eq('id', ev.docId)
                                    .single()
                                  if (data?.file_url) setViewerDoc({ url: data.file_url, title: data.name, docType: data.doc_type })
                                }}
                                className="w-6 h-6 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0 mt-1 active:scale-90"
                                title="צפה במסמך">
                                <Paperclip className="w-3 h-3 text-gray-300" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Expenses summary pill */}
                    {hasExpenses && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => setExpandedExpDay(isExpExpanded ? null : day.date)}
                          className="w-full flex items-center gap-2 bg-surface-secondary active:bg-gray-100 active:scale-[0.98] transition-all rounded-2xl px-4 py-2.5">
                          <div className="flex items-center gap-0.5">
                            {Array.from(new Set(day.expenses.map(e => e.category))).slice(0, 4).map(cat => (
                              <span key={cat} className="text-xs">{CATEGORY_META[cat as Category]?.icon}</span>
                            ))}
                          </div>
                          <span className="text-sm font-bold text-gray-800 flex-1 text-right">
                            {convert(day.totalIls)}
                          </span>
                          <span className="text-[10px] text-gray-400">{day.expenses.length} פריטים</span>
                          <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${isExpExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Expanded expense list */}
                        <AnimatePresence>
                          {isExpExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden">
                              <div className="pt-2 space-y-1.5">
                                {day.expenses.map(exp => {
                                  const meta      = CATEGORY_META[exp.category as Category]
                                  const isEditing  = editingId === exp.id
                                  const isDeleting = deletingId === exp.id

                                  return (
                                    <div key={exp.id}
                                      className="flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 shadow-sm border border-gray-50">
                                      <CategoryIconBadge category={exp.category as Category} size="sm" />

                                      <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                          <input
                                            autoFocus
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') handleRename(exp)
                                              if (e.key === 'Escape') setEditingId(null)
                                            }}
                                            className="w-full text-xs border-b border-primary outline-none bg-transparent pb-0.5"
                                            dir="rtl"
                                          />
                                        ) : (
                                          <p className="text-xs font-semibold text-gray-800 truncate">{exp.title}</p>
                                        )}
                                        <p className="text-[10px] text-gray-400">{meta.label}</p>
                                      </div>

                                      <div className="text-left flex-shrink-0">
                                        <p className="text-xs font-bold">{convert(exp.amount_ils)}</p>
                                        {exp.currency !== 'ILS' && (
                                          <p className="text-[10px] text-gray-400">
                                            {CURRENCY_SYMBOL[exp.currency]}{exp.amount}
                                          </p>
                                        )}
                                      </div>

                                      {isEditing ? (
                                        <div className="flex gap-1 flex-shrink-0">
                                          <button onClick={() => handleRename(exp)}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 active:scale-90">
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingId(null)}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 active:scale-90">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex gap-1 flex-shrink-0">
                                          {extractDocId(exp.notes) && (
                                            <button
                                              onClick={() => handleOpenDoc(exp)}
                                              disabled={loadingDocId === exp.id}
                                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-400 active:scale-90 hover:bg-indigo-100 hover:text-indigo-600 transition-colors disabled:opacity-30"
                                              title="צפה במסמך">
                                              {loadingDocId === exp.id
                                                ? <span className="text-[9px] animate-spin">⏳</span>
                                                : <Paperclip className="w-3 h-3" />
                                              }
                                            </button>
                                          )}
                                          <button
                                            onClick={() => { setEditingId(exp.id); setEditTitle(exp.title) }}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 active:scale-90 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDelete(exp.id)}
                                            disabled={isDeleting}
                                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 active:scale-90 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30">
                                            {isDeleting
                                              ? <span className="text-[9px] animate-spin">⏳</span>
                                              : <Trash2 className="w-3 h-3" />
                                            }
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {expenses.length === 0 && days.every(d => d.docEvents.length === 0) && (
              <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <p className="font-bold text-gray-800 mb-1">הציר ריק עדיין</p>
                <p className="text-sm text-gray-400">הוסף מסמכים כדי לראות את לוח הנסיעה</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Document Viewer ──────────────────────────────────────────────── */}
      {viewerDoc && (
        <DocumentViewer
          url={viewerDoc.url}
          title={viewerDoc.title}
          docType={viewerDoc.docType}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  )
}
