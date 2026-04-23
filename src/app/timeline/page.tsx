'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Calendar, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Document as TripDoc } from '@/types'
import { DocEventIconBadge } from '@/lib/iconConfig'
import { useTrip } from '@/contexts/TripContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { eachDayOfInterval, parseISO, format, isToday, differenceInDays } from 'date-fns'
import DocumentViewer from '@/components/DocumentViewer'

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
  docEvents: DocEvent[]
}

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
  documents: TripDoc[],
): DayData[] {
  const tripStart = parseISO(startDate)
  const tripEnd   = parseISO(endDate)

  // טווח לפי תאריכי הנסיעה בלבד — לא מתרחב לפי הוצאות
  const days  = eachDayOfInterval({ start: tripStart, end: tripEnd })
  const today = new Date()

  return days.map((day) => {
    const dateStr   = format(day, 'yyyy-MM-dd')
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
      const hasCarRentalData = ext?.pickup_date || ext?.dropoff_date || ext?.rental_company || ext?.car_type
      if (hasCarRentalData) {
        const company     = ext?.company         || ext?.rental_company  || ''
        const carType     = ext?.car_type        || ext?.vehicle         || ''
        const pickupLoc   = ext?.pickup_location  || ''
        const dropoffLoc  = ext?.dropoff_location || ''
        const pickupDate  = ext?.pickup_date  as string | undefined
        const dropoffDate = ext?.dropoff_date as string | undefined
        const pickupTime  = ext?.pickup_time  || ''
        const dropoffTime = ext?.dropoff_time || ''

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
            subtitle: [carType, dropoffLoc, dropoffTime && `עד ${dropoffTime}`].filter(Boolean).join(' · ') || undefined,
            icon:     '🏁',
            color:    '#d97706',
            bgColor:  '#fffbeb',
            docId:    doc.id,
            time:     dropoffTime || undefined,
          })
        }
      }

      // ── Hotel events ───────────────────────────────────────────────────────
      if (doc.doc_type === 'hotel') {
        const hotelName    = ext?.hotel_name  || doc.name
        const checkIn      = ext?.check_in    as string | undefined
        const checkOut     = ext?.check_out   as string | undefined
        const checkInTime  = ext?.check_in_time  as string | undefined
        const checkOutTime = ext?.check_out_time as string | undefined
        const roomType     = ext?.room_type   as string | undefined
        const totalNights = checkIn && checkOut
          ? differenceInDays(parseISO(checkOut), parseISO(checkIn))
          : 0

        if (checkIn === dateStr) {
          const parts = [
            roomType,
            totalNights ? `${totalNights} לילות` : undefined,
            checkInTime ? `מ־${checkInTime}` : undefined,
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
            subtitle: checkOutTime ? `עד ${checkOutTime}` : undefined,
            icon:     '🚪',
            color:    '#dc2626',
            bgColor:  '#fef2f2',
            docId:    doc.id,
            time:     checkOutTime,
          })
        } else if (checkIn && checkOut) {
          // יום בתוך שהייה — מציגים אינדיקציה דקה
          const inDate  = parseISO(checkIn)
          const outDate = parseISO(checkOut)
          const curr    = parseISO(dateStr)
          if (curr > inDate && curr < outDate) {
            docEvents.push({
              type:     'hotel_stay',
              title:    `שהייה — ${hotelName}`,
              subtitle: roomType || undefined,
              icon:     '🛏️',
              color:    '#16a34a',
              bgColor:  '#f0fdf4',
              docId:    doc.id,
            })
          }
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
      docEvents,
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeekday(dateStr: string, weekdays: string[]): string {
  const d = parseISO(dateStr)
  return weekdays[d.getDay()]
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const { currentTrip } = useTrip()
  const { t, dir } = useLanguage()
  const WEEKDAYS = [t('day_sun'), t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat')]

  const [documents, setDocuments] = useState<TripDoc[]>([])
  const [loading,   setLoading]   = useState(true)

  // ── Document viewer state ────────────────────────────────────────────────
  const [viewerDoc, setViewerDoc] = useState<{ url: string; title: string; docType: string } | null>(null)

  // ── Auto-scroll to today ────────────────────────────────────────────────
  const todayRef = useRef<HTMLDivElement | null>(null)

  // ── Fetch documents ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!currentTrip) { setDocuments([]); setLoading(false); return }

    const { data: docData } = await supabase
      .from('documents')
      .select('*')
      .eq('trip_id', currentTrip.id)

    setDocuments(docData || [])
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchData() }, [fetchData])

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
    return buildDays(currentTrip.start_date, currentTrip.end_date, documents)
  }, [currentTrip, documents])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label="טוען ציר זמן" className="space-y-4 pt-2">
        <div className="h-12 w-40 skeleton rounded-2xl" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-card p-4 space-y-3">
              <div className="h-3 w-1/3 skeleton rounded-md" />
              <div className="h-3 w-2/3 skeleton rounded-md" />
              <div className="h-3 w-1/2 skeleton rounded-md" />
            </div>
          ))}
        </div>
        <span className="sr-only">טוען…</span>
      </div>
    )
  }

  if (!currentTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-100">
          <Calendar className="w-8 h-8 text-gray-300" />
        </div>
        <div>
          <p className="font-bold text-gray-700 mb-1">לא נבחרה נסיעה</p>
          <p className="text-sm text-gray-400">כדי לראות ציר זמן בחר נסיעה תחילה</p>
        </div>
        <Link href="/trips" className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform">
          בחר נסיעה
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8" dir={dir}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label={t('back_to_dashboard')}
            className="w-11 h-11 flex items-center justify-center rounded-2xl active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 rtl:rotate-180" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-black gradient-text">ציר זמן</h1>
            <p className="text-xs text-gray-500 mt-0.5">{currentTrip?.destination || ''}</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TIMELINE — actions only
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3">

        {days.map((day) => {
          const hasDocEvents = day.docEvents.length > 0

          // Empty days — very compact
          if (!hasDocEvents) {
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
                  <span className="text-[9px] leading-none opacity-70">{t('timeline_day')}</span>
                  <span className="text-xs font-bold">{day.dayNumber}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {getWeekday(day.date, WEEKDAYS)}, {format(parseISO(day.date), 'dd.MM')}
                </span>
                {day.isToday && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">היום</span>
                )}
              </div>
            )
          }

          // Day with events — full card
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
              <div className={cn(
                'flex items-center gap-3 px-4 py-3 border-b border-gray-50 sticky top-0 z-10',
                day.isToday ? 'bg-primary/[0.03]' : 'bg-white'
              )}>
                {/* Day-number pill */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-center shadow-sm',
                    !day.isToday && day.isPast ? 'bg-gray-700 text-white' :
                    !day.isToday ? 'bg-gray-100 text-gray-500' : ''
                  )}
                  style={day.isToday ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', color: 'white' } : {}}>
                  <span className="text-[9px] font-medium leading-none opacity-60 tracking-wide">{t('timeline_day')}</span>
                  <span className="text-base font-black leading-tight">{day.dayNumber}</span>
                </div>

                {/* Date + weekday info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-sm font-bold',
                      day.isToday ? 'text-primary' : day.isPast ? 'text-gray-700' : 'text-gray-800'
                    )}>
                      {t('timeline_day')} {getWeekday(day.date, WEEKDAYS)}
                    </span>
                    <span className="text-xs text-gray-400 font-medium tabular-nums">
                      {format(parseISO(day.date), 'dd.MM.yyyy')}
                    </span>
                    {day.isToday && (
                      <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold tracking-wide">היום</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                    {day.docEvents.map(ev => ev.icon).slice(0, 5).join(' ')}
                  </p>
                </div>
              </div>

              {/* Doc events */}
              <div className="px-4 py-3 space-y-0">
                {day.docEvents.map((ev, i) => {
                  const isLast = i === day.docEvents.length - 1
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
            </motion.div>
          )
        })}

        {days.every(d => d.docEvents.length === 0) && (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
            <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <p className="text-lg font-black text-gray-800 mb-1.5">{t('timeline_empty')}</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              הוסף מסמכים (טיסות, מלונות, רכב)<br />כדי לראות את לוח הנסיעה
            </p>
          </div>
        )}
      </motion.div>

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
