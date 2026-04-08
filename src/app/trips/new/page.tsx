'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plane, Plus, Trash2, ChevronLeft, Users, User, Baby, Heart, PartyPopper, Mountain } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { searchDestinations } from '@/lib/destinations'

const TRIP_TYPES = [
  { id: 'family', label: 'טיול משפחתי', icon: Baby, color: 'bg-blue-50 text-blue-600 border-blue-200', desc: 'זוג / משפחה עם ילדים' },
  { id: 'solo', label: 'טיול בודד', icon: User, color: 'bg-purple-50 text-purple-600 border-purple-200', desc: 'מטייל יחיד' },
  { id: 'friends', label: 'טיול חברים', icon: Users, color: 'bg-orange-50 text-orange-600 border-orange-200', desc: 'קבוצת חברים / רווקים' },
  { id: 'couple', label: 'טיול זוגי', icon: Heart, color: 'bg-pink-50 text-pink-600 border-pink-200', desc: 'ירח דבש / חופשה זוגית' },
]

export default function NewTripPage() {
  const { user } = useAuth()
  const { refreshTrips, setCurrentTripId } = useTrip()
  const router = useRouter()

  const [step, setStep] = useState(1) // 1=type, 2=details
  const [tripType, setTripType] = useState('')
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const [showDestList, setShowDestList] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [travelers, setTravelers] = useState([{ id: 'traveler_1', name: '' }])
  const [saving, setSaving] = useState(false)

  const filteredDests = searchDestinations(destSearch)

  const handleTypeSelect = (type: string) => {
    setTripType(type)
    // Set default travelers based on type
    if (type === 'solo') {
      setTravelers([{ id: 'traveler_1', name: '' }])
    } else if (type === 'couple') {
      setTravelers([{ id: 'traveler_1', name: '' }, { id: 'traveler_2', name: '' }])
    } else if (type === 'family') {
      setTravelers([{ id: 'traveler_1', name: '' }, { id: 'traveler_2', name: '' }, { id: 'traveler_3', name: '' }])
    } else if (type === 'friends') {
      setTravelers([{ id: 'traveler_1', name: '' }, { id: 'traveler_2', name: '' }, { id: 'traveler_3', name: '' }, { id: 'traveler_4', name: '' }])
    }
    setStep(2)
  }

  const handleSave = async () => {
    if (!name.trim() || !destination || !startDate || !endDate) {
      toast.error('נא למלא שם, יעד ותאריכים')
      return
    }

    setSaving(true)
    try {
      const insertData: Record<string, unknown> = {
        name: name.trim(),
        destination,
        start_date: startDate,
        end_date: endDate,
        budget_ils: budget ? parseFloat(budget) : null,
        travelers: travelers.filter(t => t.name.trim()).map(t => ({ id: t.id, name: t.name.trim() })),
        notes: tripType, // Store trip type in notes
      }
      if (user?.id) insertData.user_id = user.id

      const { data, error } = await supabase.from('trips').insert(insertData).select('id').single()

      if (error) throw error

      await refreshTrips()
      if (data?.id) setCurrentTripId(data.id)
      toast.success('הטיול נוצר!')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה ביצירת הטיול')
    }
    setSaving(false)
  }

  const travelerLabel = (index: number) => {
    if (tripType === 'solo') return 'מטייל'
    if (tripType === 'couple') return index === 0 ? 'שותף/ה 1' : 'שותף/ה 2'
    if (tripType === 'family') {
      if (index === 0) return 'הורה 1'
      if (index === 1) return 'הורה 2'
      return `ילד/ה ${index - 1}`
    }
    return index === 0 ? 'מארגן' : `חבר/ה ${index}`
  }

  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
      <div className="px-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => step === 2 ? setStep(1) : router.back()} className="active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-bold">{step === 1 ? 'טיול חדש' : 'פרטי הטיול'}</h1>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1 — Trip Type */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-6 text-white text-center mb-4">
                <Plane className="w-10 h-10 mx-auto mb-2" />
                <p className="font-bold text-lg">מה סוג הטיול?</p>
                <p className="text-sm opacity-70 mt-1">בחר סוג כדי להתאים את החוויה</p>
              </div>

              <div className="space-y-3">
                {TRIP_TYPES.map((type) => (
                  <button key={type.id} onClick={() => handleTypeSelect(type.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-right active:scale-[0.98] transition-all ${type.color}`}>
                    <type.icon className="w-8 h-8 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm">{type.label}</p>
                      <p className="text-xs opacity-70">{type.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2 — Trip Details */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Selected type badge */}
              <div className="flex justify-center mb-3">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  TRIP_TYPES.find(t => t.id === tripType)?.color || 'bg-gray-100'
                }`}>
                  {TRIP_TYPES.find(t => t.id === tripType)?.label}
                </span>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="שם הטיול (למשל: טיול יפן 2026)"
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />

                {/* Destination search */}
                <div className="relative">
                  <input type="text"
                    value={destination ? `${filteredDests.find(d => d.name === destination)?.nameHe || ''} (${destination})` : destSearch}
                    onChange={(e) => { setDestSearch(e.target.value); setDestination(''); setShowDestList(true) }}
                    onFocus={() => setShowDestList(true)}
                    placeholder="חפש יעד (עברית או אנגלית)..."
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  {showDestList && !destination && (
                    <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border mt-1 max-h-48 overflow-y-auto z-20">
                      {filteredDests.slice(0, 20).map(d => (
                        <button key={d.id} onClick={() => { setDestination(d.name); setDestSearch(''); setShowDestList(false) }}
                          className="w-full px-4 py-2.5 text-sm text-right hover:bg-gray-50 active:bg-gray-100 flex justify-between">
                          <span className="text-gray-400 text-xs">{d.currency}</span>
                          <span>{d.nameHe} ({d.name})</span>
                        </button>
                      ))}
                      {filteredDests.length === 0 && (
                        <p className="px-4 py-3 text-xs text-gray-400 text-center">לא נמצא — נסה שם אחר</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mr-1">תאריך התחלה</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mr-1">תאריך סיום</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                </div>

                {/* Budget */}
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                  placeholder="תקציב בשקלים (אופציונלי)"
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />

                {/* Travelers */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">נוסעים (באנגלית)</p>
                  {travelers.map((t, i) => (
                    <div key={t.id} className="flex gap-2 items-center">
                      <span className="text-[11px] text-primary w-16 flex-shrink-0 text-right">
                        {travelerLabel(i)}
                      </span>
                      <input type="text" value={t.name} dir="ltr"
                        onChange={(e) => {
                          const updated = [...travelers]
                          updated[i] = { ...updated[i], name: e.target.value }
                          setTravelers(updated)
                        }}
                        placeholder="Full name"
                        className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none text-left" />
                      {travelers.length > 1 && (
                        <button onClick={() => setTravelers(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 active:scale-95"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setTravelers(prev => [...prev, { id: `traveler_${Date.now()}`, name: '' }])}
                    className="w-full bg-gray-50 text-gray-500 rounded-xl py-2 text-xs font-medium active:scale-95 border border-dashed border-gray-300">
                    <Plus className="w-3 h-3 inline mr-1" /> הוסף נוסע
                  </button>
                </div>

                <button onClick={handleSave} disabled={saving}
                  className="w-full bg-primary text-white rounded-xl py-3.5 font-bold active:scale-95 transition-transform disabled:opacity-50">
                  {saving ? 'יוצר טיול...' : '🚀 צור טיול'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
