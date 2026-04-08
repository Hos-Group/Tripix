'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Plane, ChevronLeft, Check, Trash2, Calendar, MapPin, Users, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

export default function TripsPage() {
  const { trips, currentTrip, setCurrentTripId, refreshTrips, loading } = useTrip()
  const router = useRouter()
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (tripId: string) => {
    setDeleting(true)
    try {
      // Delete related data first
      await supabase.from('trip_memories').delete().eq('trip_id', tripId)
      await supabase.from('documents').delete().eq('trip_id', tripId)
      await supabase.from('expenses').delete().eq('trip_id', tripId)
      const { error } = await supabase.from('trips').delete().eq('id', tripId)
      if (error) throw error

      // If deleted trip was the active one, clear selection
      if (currentTrip?.id === tripId) {
        setCurrentTripId(null as unknown as string)
      }

      await refreshTrips()
      toast.success('הטיול נמחק')
      setConfirmDelete(null)
    } catch {
      toast.error('שגיאה במחיקה')
    }
    setDeleting(false)
  }

  const getDayCount = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.ceil(diff / 86400000) + 1
  }

  const getTripTypeLabel = (notes: string | null) => {
    if (!notes) return null
    const types: Record<string, string> = {
      family: '👶 משפחתי',
      solo: '🧑 בודד',
      friends: '👥 חברים',
      couple: '💕 זוגי',
    }
    return types[notes] || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="px-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="active:scale-95 transition-transform">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <h1 className="text-xl font-bold">הטיולים שלי</h1>
          </div>
          <Link href="/trips/new"
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium active:scale-95 transition-transform flex items-center gap-1">
            <Plus className="w-4 h-4" /> טיול חדש
          </Link>
        </div>

        {/* Empty state */}
        {trips.length === 0 && (
          <div className="text-center py-16">
            <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">עדיין אין טיולים</p>
            <Link href="/trips/new"
              className="inline-flex items-center gap-1 bg-primary text-white rounded-xl px-6 py-3 text-sm font-medium active:scale-95">
              <Plus className="w-4 h-4" /> צור טיול ראשון
            </Link>
          </div>
        )}

        {/* Trip list */}
        <div className="space-y-3">
          {trips.map((trip, i) => {
            const isActive = currentTrip?.id === trip.id
            const isExpanded = expandedTrip === trip.id
            const days = getDayCount(trip.start_date, trip.end_date)
            const travelers = (trip.travelers as { id: string; name: string }[]) || []
            const typeLabel = getTripTypeLabel(trip.notes)

            return (
              <motion.div key={trip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isActive ? 'ring-2 ring-primary' : ''}`}>

                {/* Main row — tap to select trip */}
                <button
                  onClick={() => { setCurrentTripId(trip.id); router.push('/dashboard') }}
                  className="w-full p-4 text-right active:scale-[0.99] transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary' : 'bg-gray-100'}`}>
                      <Plane className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{trip.name}</p>
                        {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{trip.destination}</span>
                        {typeLabel && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{typeLabel}</span>}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatDate(trip.start_date)} — {formatDate(trip.end_date)} · {days} ימים
                      </p>
                    </div>
                  </div>
                </button>

                {/* Expand button */}
                <div className="flex border-t">
                  <button onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-gray-400 active:bg-gray-50">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExpanded ? 'פחות' : 'פרטים'}
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(trip.id) }}
                    className="px-4 py-2 text-xs text-red-400 active:bg-red-50 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> מחק
                  </button>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50/50">
                        {/* Dates */}
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="text-gray-600">
                            {formatDate(trip.start_date)} — {formatDate(trip.end_date)} ({days} ימים)
                          </span>
                        </div>

                        {/* Destination */}
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-green-500" />
                          <span className="text-gray-600">{trip.destination}</span>
                        </div>

                        {/* Budget */}
                        {trip.budget_ils && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                            <span className="text-gray-600">תקציב: ₪{Number(trip.budget_ils).toLocaleString()}</span>
                          </div>
                        )}

                        {/* Travelers */}
                        {travelers.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <Users className="w-4 h-4 text-purple-500 mt-0.5" />
                            <div>
                              <span className="text-gray-600">{travelers.length} נוסעים:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {travelers.map((t, ti) => (
                                  <span key={ti} className="text-xs bg-white px-2 py-0.5 rounded-full border">
                                    {t.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Trip type */}
                        {typeLabel && (
                          <div className="text-xs text-gray-400">
                            סוג: {typeLabel}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6"
            onClick={() => setConfirmDelete(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
              <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-1">מחיקת טיול</h3>
              <p className="text-sm text-gray-500 mb-1">
                {trips.find(t => t.id === confirmDelete)?.name}
              </p>
              <p className="text-xs text-red-400 mb-5">
                כל ההוצאות, המסמכים והזיכרונות של הטיול יימחקו לצמיתות
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 bg-gray-100 rounded-xl py-3 text-sm font-medium active:scale-95">
                  ביטול
                </button>
                <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                  className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-medium active:scale-95 disabled:opacity-50">
                  {deleting ? 'מוחק...' : 'מחק טיול'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
