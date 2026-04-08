'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users, ChevronLeft, Plane, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Trip, TRIP_TYPE_META, TripType } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function SharedTripsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [trips, setTrips] = useState<(Trip & { trip_type?: TripType; memberCount?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadTrips()
  }, [])

  async function loadTrips() {
    const { data: tripsData } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })

    if (tripsData) {
      // Get member counts
      const withCounts = await Promise.all(tripsData.map(async (t) => {
        const { count } = await supabase
          .from('trip_members')
          .select('*', { count: 'exact', head: true })
          .eq('trip_id', t.id)
        return { ...t, memberCount: count || 0 }
      }))
      setTrips(withCounts)
    }
    setLoading(false)
  }

  const filtered = trips.filter(t => {
    const tripType = (t as any).trip_type || 'personal'
    return tripType !== 'personal' && (
      !search ||
      t.name.includes(search) ||
      t.destination.includes(search)
    )
  })

  return (
    <div className="px-4 pt-4 pb-32 min-h-screen bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 active:scale-95">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">טיולים משותפים</h1>
        <div className="w-9" />
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-bl from-[#185FA5] to-[#0D3B6E] rounded-2xl p-5 text-white mb-4">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8" />
          <div>
            <h2 className="text-lg font-bold">טיול עם חברים?</h2>
            <p className="text-sm opacity-80">צור טיול משותף, הוסף חברים, חלק הוצאות</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="mt-3 w-full bg-white/20 backdrop-blur rounded-xl py-2.5 text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          צור טיול משותף חדש
        </button>
      </div>

      {/* Search */}
      {filtered.length > 0 && (
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חפש טיול..."
            className="w-full bg-white rounded-xl pr-10 pl-4 py-2.5 text-sm outline-none border border-gray-100 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {/* Trip list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map(trip => (
            <SharedTripCard key={trip.id} trip={trip} onClick={() => router.push(`/shared/${trip.id}`)} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateSharedTrip
            onClose={() => setShowCreate(false)}
            onCreated={(id) => {
              setShowCreate(false)
              router.push(`/shared/${id}`)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function SharedTripCard({ trip, onClick }: { trip: Trip & { trip_type?: TripType; memberCount?: number }; onClick: () => void }) {
  const tripType = (trip as any).trip_type || 'personal'
  const meta = TRIP_TYPE_META[tripType as TripType] || TRIP_TYPE_META.other

  return (
    <motion.button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-4 text-right shadow-sm active:scale-[0.98] transition-transform"
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: meta.color + '15' }}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate">{trip.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: meta.color + '20', color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-xs text-gray-400">{trip.destination}</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {trip.memberCount || 0} משתתפים
            </span>
            <span>
              {new Date(trip.start_date).toLocaleDateString('he-IL')} — {new Date(trip.end_date).toLocaleDateString('he-IL')}
            </span>
          </div>
        </div>
        <ChevronLeft className="w-5 h-5 text-gray-300 mt-1" />
      </div>
    </motion.button>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">🤝</div>
      <h3 className="font-bold text-lg mb-1">אין טיולים משותפים עדיין</h3>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        צור טיול משותף עם חברים, חלק הוצאות<br />ודע בדיוק מי חייב למי
      </p>
      <button
        onClick={onCreateClick}
        className="bg-primary text-white px-6 py-3 rounded-xl font-medium active:scale-95 transition-transform"
      >
        צור טיול משותף ראשון
      </button>
    </div>
  )
}

function CreateSharedTrip({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [tripType, setTripType] = useState<TripType>('friends')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [members, setMembers] = useState<{ name: string; email: string }[]>([{ name: '', email: '' }])
  const [saving, setSaving] = useState(false)

  const tripTypes = Object.entries(TRIP_TYPE_META).filter(([k]) => k !== 'personal')

  async function handleCreate() {
    if (!name.trim()) { toast.error('נא למלא שם טיול'); return }
    if (!startDate || !endDate) { toast.error('נא לבחור תאריכים'); return }

    setSaving(true)
    try {
      // Create trip
      const { data: trip, error } = await supabase.from('trips').insert({
        name: name.trim(),
        destination: destination || 'לא צוין',
        start_date: startDate,
        end_date: endDate,
        trip_type: tripType,
        travelers: [],
        user_id: user?.id,
      }).select().single()

      if (error) throw error

      // Add owner as first member
      await fetch('/api/shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_member',
          trip_id: trip.id,
          display_name: 'אני',
          role: 'owner',
        }),
      })

      // Add other members
      for (const m of members) {
        if (m.name.trim()) {
          await fetch('/api/shared', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_member',
              trip_id: trip.id,
              display_name: m.name.trim(),
              email: m.email || null,
            }),
          })
        }
      }

      toast.success('טיול משותף נוצר!')
      onCreated(trip.id)
    } catch (err: any) {
      toast.error(err.message || 'שגיאה ביצירת הטיול')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-5">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-4 text-center">טיול משותף חדש</h2>

          {/* Trip type selection */}
          <label className="text-xs text-gray-500 mb-2 block">סוג הטיול</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {tripTypes.map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setTripType(key as TripType)}
                className={`flex flex-col items-center p-2.5 rounded-xl text-xs transition-all active:scale-95 ${
                  tripType === key ? 'ring-2 ring-primary bg-primary/5' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl mb-1">{meta.icon}</span>
                <span className="leading-tight text-center">{meta.label}</span>
              </button>
            ))}
          </div>

          {/* Trip name */}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="שם הטיול (למשל: רווקים אמסטרדם)"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mb-3 focus:ring-2 focus:ring-primary/20"
          />

          {/* Destination */}
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="יעד (אופציונלי)"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mb-3 focus:ring-2 focus:ring-primary/20"
          />

          {/* Dates */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mr-1">מתאריך</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mr-1">עד תאריך</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>

          {/* Members */}
          <label className="text-xs text-gray-500 mb-2 block">חברים לטיול</label>
          <div className="space-y-2 mb-3">
            {/* Owner (you) */}
            <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">אני</div>
              <span className="text-sm font-medium">אני (מנהל הטיול)</span>
              <span className="mr-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">מארגן</span>
            </div>

            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={m.name}
                  onChange={e => {
                    const updated = [...members]
                    updated[i].name = e.target.value
                    setMembers(updated)
                  }}
                  placeholder={`חבר ${i + 1} — שם`}
                  className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => setMembers(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 text-xs px-2 active:scale-95"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setMembers(prev => [...prev, { name: '', email: '' }])}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm text-gray-400 active:scale-95 mb-4"
          >
            + הוסף חבר
          </button>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full bg-primary text-white rounded-xl py-3.5 font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Users className="w-5 h-5" />
                צור טיול משותף
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
