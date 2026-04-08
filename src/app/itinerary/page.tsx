'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Plane, Hotel, MapPin, Utensils, Clock, ChevronDown, ChevronUp, AlertCircle, Sparkles } from 'lucide-react'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'
import { Expense, Document as TripDoc, CATEGORY_META, Category } from '@/types'

interface DayPlan {
  date: string
  dayNumber: number
  isToday: boolean
  flights: TripDoc[]
  hotels: TripDoc[]
  activities: TripDoc[]
  expenses: Expense[]
  totalIls: number
  hasGap: boolean
}

export default function ItineraryPage() {
  const router = useRouter()
  const { currentTrip } = useTrip()
  const [days, setDays] = useState<DayPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)

  useEffect(() => {
    if (currentTrip) loadItinerary()
  }, [currentTrip])

  async function loadItinerary() {
    if (!currentTrip) return

    const { data: expenses } = await supabase
      .from('expenses').select('*').eq('trip_id', currentTrip.id)
    const { data: documents } = await supabase
      .from('documents').select('*').eq('trip_id', currentTrip.id)

    const start = new Date(currentTrip.start_date)
    const end = new Date(currentTrip.end_date)
    const today = new Date().toISOString().split('T')[0]
    const dayPlans: DayPlan[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const dayNum = Math.floor((d.getTime() - start.getTime()) / 86400000) + 1

      const dayExpenses = (expenses || []).filter(e => e.expense_date === dateStr)
      const dayFlights = (documents || []).filter(doc => {
        if (doc.doc_type !== 'flight') return false
        const ext = doc.extracted_data as any
        return ext?.departure_date === dateStr || ext?.arrival_date === dateStr
      })
      const dayHotels = (documents || []).filter(doc => {
        if (doc.doc_type !== 'hotel') return false
        const ext = doc.extracted_data as any
        return ext?.check_in === dateStr || ext?.check_out === dateStr ||
          (ext?.check_in && ext?.check_out && dateStr >= ext.check_in && dateStr <= ext.check_out)
      })
      const dayActivities = (documents || []).filter(doc => {
        if (doc.doc_type !== 'activity') return false
        const ext = doc.extracted_data as any
        return ext?.date === dateStr
      })

      const totalIls = dayExpenses.reduce((s, e) => s + Number(e.amount_ils || 0), 0)
      const hasGap = dayFlights.length === 0 && dayHotels.length === 0 && dayActivities.length === 0 && dayExpenses.length === 0

      dayPlans.push({
        date: dateStr,
        dayNumber: dayNum,
        isToday: dateStr === today,
        flights: dayFlights,
        hotels: dayHotels,
        activities: dayActivities,
        expenses: dayExpenses,
        totalIls,
        hasGap,
      })

      // Auto-expand today
      if (dateStr === today) setExpandedDay(dayNum)
    }

    setDays(dayPlans)
    setLoading(false)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })

  if (!currentTrip) return (
    <div className="text-center py-20 px-4">
      <p className="text-gray-500">בחר טיול קודם</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-bl from-[#185FA5] to-[#0D3B6E] text-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/10 active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">לוח מסע</h1>
          <div className="w-9" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{currentTrip.name}</p>
            <p className="text-xs opacity-60">{currentTrip.destination}</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-1.5 text-xs">
            {days.length} ימים
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pt-4">
          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-gray-200" />

            {days.map((day, i) => (
              <div key={day.date} className="relative mb-3">
                {/* Dot */}
                <div className={`absolute right-[11px] top-4 w-[18px] h-[18px] rounded-full border-2 z-10 ${
                  day.isToday ? 'bg-primary border-primary ring-4 ring-primary/20' :
                  day.hasGap ? 'bg-gray-200 border-gray-300' :
                  'bg-white border-primary'
                }`} />

                {/* Card */}
                <div className="mr-10">
                  <button
                    onClick={() => setExpandedDay(expandedDay === day.dayNumber ? null : day.dayNumber)}
                    className={`w-full text-right bg-white rounded-xl p-3 shadow-sm active:scale-[0.99] transition-all ${
                      day.isToday ? 'ring-2 ring-primary/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {day.flights.length > 0 && <Plane className="w-4 h-4 text-blue-500" />}
                        {day.hotels.length > 0 && <Hotel className="w-4 h-4 text-green-500" />}
                        {day.hasGap && <AlertCircle className="w-4 h-4 text-gray-300" />}
                        {expandedDay === day.dayNumber ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">יום {day.dayNumber}</span>
                          {day.isToday && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full">היום</span>}
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(day.date)}</span>
                      </div>
                    </div>

                    {/* Mini summary */}
                    {!day.hasGap && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap justify-end">
                        {day.expenses.length > 0 && (
                          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">
                            ₪{day.totalIls.toFixed(0)} · {day.expenses.length} הוצאות
                          </span>
                        )}
                        {day.flights.map((f, fi) => (
                          <span key={fi} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            ✈️ {f.flight_number || 'טיסה'}
                          </span>
                        ))}
                      </div>
                    )}
                    {day.hasGap && (
                      <p className="text-xs text-gray-300 mt-1">אין תוכנית — רוצה רעיונות? 💡</p>
                    )}
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {expandedDay === day.dayNumber && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white rounded-xl mt-1 p-3 shadow-sm space-y-2">
                          {/* Flights */}
                          {day.flights.map((f, fi) => {
                            const ext = f.extracted_data as any
                            return (
                              <div key={fi} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                                <Plane className="w-4 h-4 text-blue-500 mt-0.5" />
                                <div className="text-xs">
                                  <p className="font-medium">{f.flight_number || 'טיסה'} — {f.name}</p>
                                  {ext?.departure && ext?.arrival && (
                                    <p className="text-gray-500">{ext.departure} → {ext.arrival}</p>
                                  )}
                                  {ext?.departure_time && (
                                    <p className="text-gray-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />{ext.departure_time}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}

                          {/* Hotels */}
                          {day.hotels.map((h, hi) => {
                            const ext = h.extracted_data as any
                            return (
                              <div key={hi} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
                                <Hotel className="w-4 h-4 text-green-500 mt-0.5" />
                                <div className="text-xs">
                                  <p className="font-medium">{ext?.hotel_name || h.name}</p>
                                  {ext?.check_in === day.date && <span className="text-green-600">צ׳ק אין</span>}
                                  {ext?.check_out === day.date && <span className="text-red-500">צ׳ק אאוט</span>}
                                </div>
                              </div>
                            )
                          })}

                          {/* Expenses */}
                          {day.expenses.length > 0 && (
                            <div className="border-t pt-2 mt-2">
                              <p className="text-xs font-medium mb-1.5 text-gray-500">הוצאות</p>
                              {day.expenses.map(e => {
                                const cat = CATEGORY_META[e.category as Category] || CATEGORY_META.other
                                return (
                                  <div key={e.id} className="flex items-center justify-between py-1">
                                    <span className="text-xs text-gray-500">₪{Number(e.amount_ils).toFixed(0)}</span>
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <span>{e.title}</span>
                                      <span>{cat.icon}</span>
                                    </div>
                                  </div>
                                )
                              })}
                              <div className="flex items-center justify-between pt-1 border-t mt-1">
                                <span className="text-xs font-bold">₪{day.totalIls.toFixed(0)}</span>
                                <span className="text-xs font-bold">סה״כ</span>
                              </div>
                            </div>
                          )}

                          {day.hasGap && (
                            <div className="text-center py-3">
                              <Sparkles className="w-5 h-5 text-primary mx-auto mb-1" />
                              <p className="text-xs text-gray-400">יום חופשי!</p>
                              <button
                                onClick={() => router.push('/assistant')}
                                className="mt-2 text-xs text-primary font-medium active:scale-95"
                              >
                                שאל את Tripix AI לרעיונות →
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
