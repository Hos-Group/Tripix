'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DateRangePickerProps {
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
}

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const DAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] // Sun → Sat

function parseDate(str: string): Date | null {
  if (!str) return null
  const d = new Date(str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}
function formatDate(d: Date): string {
  // Use local date methods to avoid UTC timezone offset shifting the date
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function toLocaleDateHE(str: string): string {
  if (!str) return ''
  return new Date(str + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
}

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }: DateRangePickerProps) {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const initYear = startDate ? new Date(startDate + 'T00:00:00').getFullYear() : today.getFullYear()
  const initMonth = startDate ? new Date(startDate + 'T00:00:00').getMonth() : today.getMonth()

  const [viewYear, setViewYear]   = useState(initYear)
  const [viewMonth, setViewMonth] = useState(initMonth)
  // 'start' = user should pick departure, 'end' = pick return
  const [phase, setPhase] = useState<'start' | 'end'>(startDate && !endDate ? 'end' : 'start')

  const start = parseDate(startDate)
  const end   = parseDate(endDate)

  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sun

  const nights = start && end
    ? Math.round((end.getTime() - start.getTime()) / 86400000)
    : 0

  // Navigation
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleDayClick = (day: number) => {
    const clicked = new Date(viewYear, viewMonth, day)
    if (clicked < today) return
    const clickedStr = formatDate(clicked)

    if (phase === 'start') {
      onStartChange(clickedStr)
      onEndChange('')
      setPhase('end')
    } else {
      if (start && clicked <= start) {
        // clicked same or before start → restart
        onStartChange(clickedStr)
        onEndChange('')
        setPhase('end')
      } else {
        onEndChange(clickedStr)
        setPhase('start')
      }
    }
  }

  const dayState = (day: number) => {
    const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0)
    const isPast    = d < today
    const isToday   = d.getTime() === today.getTime()
    const isStart   = !!start && d.getTime() === start.getTime()
    const isEnd     = !!end   && d.getTime() === end.getTime()
    const inRange   = !!start && !!end && d > start && d < end
    return { isPast, isToday, isStart, isEnd, inRange }
  }

  return (
    <div className="space-y-3">
      {/* ── Phase header ── */}
      <div className="text-center">
        <p className="text-xs text-gray-400">
          {phase === 'start' ? '👆 לחצו על תאריך היציאה' : '👆 עכשיו בחרו את תאריך החזרה'}
        </p>
      </div>

      {/* ── Selected dates pill row ── */}
      <div className="flex gap-2">
        <button
          onClick={() => { setPhase('start') }}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all border ${
            phase === 'start'
              ? 'bg-primary text-white border-primary shadow-sm'
              : startDate
              ? 'bg-primary/8 text-primary border-primary/20'
              : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}
        >
          ✈️ {startDate ? toLocaleDateHE(startDate) : 'יציאה'}
        </button>
        <div className="flex items-center text-gray-300 text-lg">→</div>
        <button
          onClick={() => startDate && setPhase('end')}
          className={`flex-1 py-2.5 rounded-2xl text-sm font-medium transition-all border ${
            phase === 'end'
              ? 'bg-primary text-white border-primary shadow-sm'
              : endDate
              ? 'bg-primary/8 text-primary border-primary/20'
              : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}
        >
          🏠 {endDate ? toLocaleDateHE(endDate) : 'חזרה'}
        </button>
      </div>

      {/* ── Duration badge ── */}
      <AnimatePresence>
        {nights > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex justify-center"
          >
            <span className="bg-green-50 text-green-600 text-xs px-4 py-1.5 rounded-full font-bold border border-green-100">
              🌙 {nights} לילות · {nights + 1} ימים
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Calendar ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm" dir="ltr">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="font-bold text-sm" dir="rtl">
            {MONTHS_HE[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_HE.map(d => (
            <div key={d} className="text-center text-[10px] text-gray-400 font-semibold py-1" dir="rtl">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Leading empty cells */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e${i}`} />)}

          {/* Day buttons */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const { isPast, isToday, isStart, isEnd, inRange } = dayState(day)

            let cellClass = 'relative h-9 flex items-center justify-center text-sm font-medium transition-all select-none '
            let innerClass = 'w-8 h-8 flex items-center justify-center rounded-xl z-10 relative '

            if (isStart || isEnd) {
              innerClass += 'bg-primary text-white shadow-md font-bold '
            } else if (inRange) {
              cellClass  += 'bg-primary/12 '
              innerClass += 'text-primary font-semibold '
            } else if (isToday) {
              innerClass += 'text-primary font-bold border border-primary/30 '
            } else if (isPast) {
              innerClass += 'text-gray-200 '
            } else {
              innerClass += 'text-gray-700 '
            }

            if (inRange) {
              if (day === 1 || firstDayOfMonth + day - 1 === Math.ceil((firstDayOfMonth + day - 1) / 7) * 7 - 6) {
                cellClass += 'rounded-l-full '
              }
            }

            return (
              <div key={day} className={cellClass}>
                <button
                  onClick={() => !isPast && handleDayClick(day)}
                  disabled={isPast}
                  className={`${innerClass} ${!isPast && !isStart && !isEnd ? 'active:scale-90' : ''} ${isPast ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
