'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plane, ChevronLeft, Users, User, Baby, Heart, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { searchDestinations } from '@/lib/destinations'

const TRIP_TYPES = [
  {
    id: 'family',
    label: 'טיול משפחתי',
    icon: Baby,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    desc: 'זוג / משפחה עם ילדים',
    emoji: '👨‍👩‍👧‍👦',
    welcomeTitle: 'אין כמו טיול משפחתי! 👨‍👩‍👧‍👦',
    welcomeText: 'מתרגשים לעשות לכם סדר לקראת הטיול. בואו נתחיל!',
    defaultCount: 3,
  },
  {
    id: 'solo',
    label: 'טיול בודד',
    icon: User,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    desc: 'מטייל יחיד',
    emoji: '🌍',
    welcomeTitle: 'לצאת לבד — אומץ אמיתי! 🌍',
    welcomeText: 'הרפתקה אישית שלא תשכח. בוא נעזור לך לתכנן אותה.',
    defaultCount: 1,
  },
  {
    id: 'friends',
    label: 'טיול חברים',
    icon: Users,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    desc: 'קבוצת חברים / רווקים',
    emoji: '🎉',
    welcomeTitle: 'טיול עם חברים — הכי כיף! 🎉',
    welcomeText: 'הזיכרונות הכי טובים נוצרים ביחד. בואו נסדר את הטיול!',
    defaultCount: 4,
  },
  {
    id: 'couple',
    label: 'טיול זוגי',
    icon: Heart,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    desc: 'ירח דבש / חופשה זוגית',
    emoji: '💑',
    welcomeTitle: 'רומנטי ומרגש! 💑',
    welcomeText: 'נעזור לכם לתכנן את חופשת החלומות המושלמת.',
    defaultCount: 2,
  },
]

type TripTypeItem = typeof TRIP_TYPES[0]

export default function NewTripPage() {
  const { user } = useAuth()
  const { refreshTrips, setCurrentTripId } = useTrip()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<TripTypeItem | null>(null)
  const [destination, setDestination] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const [showDestList, setShowDestList] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [travelers, setTravelers] = useState([{ id: 'traveler_1', name: '' }])
  const [saving, setSaving] = useState(false)

  const filteredDests = searchDestinations(destSearch)

  const handleTypeSelect = (type: TripTypeItem) => {
    setSelectedType(type)
    const defaultTravs = Array.from({ length: type.defaultCount }, (_, i) => ({
      id: `traveler_${i + 1}`,
      name: '',
    }))
    setTravelers(defaultTravs)
    setStep(2)
  }

  const handleSave = async () => {
    if (!destination || !startDate || !endDate) {
      toast.error('נא למלא יעד ותאריכים')
      return
    }

    const tripName = name.trim() || `טיול ל${destination}`

    setSaving(true)
    try {
      const insertData: Record<string, unknown> = {
        name: tripName,
        destination,
        start_date: startDate,
        end_date: endDate,
        budget_ils: budget ? parseFloat(budget) : null,
        travelers: travelers
          .filter(t => t.name.trim())
          .map(t => ({ id: t.id, name: t.name.trim() })),
        notes: selectedType?.id || '',
      }
      if (user?.id) insertData.user_id = user.id

      const { data, error } = await supabase.from('trips').insert(insertData).select('id').single()
      if (error) throw error

      await refreshTrips()
      if (data?.id) setCurrentTripId(data.id)
      toast.success('הטיול נוצר! 🚀')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה ביצירת הטיול')
    }
    setSaving(false)
  }

  const travelerLabel = (index: number) => {
    if (!selectedType) return `נוסע ${index + 1}`
    if (selectedType.id === 'solo') return 'מטייל'
    if (selectedType.id === 'couple') return index === 0 ? 'שותף/ה 1' : 'שותף/ה 2'
    if (selectedType.id === 'family') {
      if (index === 0) return 'הורה 1'
      if (index === 1) return 'הורה 2'
      return `ילד/ה ${index - 1}`
    }
    return index === 0 ? 'מארגן' : `חבר/ה ${index}`
  }

  const goBack = () => {
    if (step > 1) setStep(step - 1)
    else router.back()
  }

  // Progress dots for steps 2-4
  const showProgress = step > 1
  const TOTAL_STEPS = 3 // steps 2, 3, 4
  const currentProgress = step - 1 // 1, 2, 3

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)',
      }}
    >
      <div className="px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={goBack} className="active:scale-95 transition-transform p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>

          {showProgress ? (
            <div className="flex gap-1.5 flex-1 justify-center">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < currentProgress ? 'bg-primary w-8' : 'bg-gray-200 w-4'
                  }`}
                />
              ))}
            </div>
          ) : (
            <h1 className="text-xl font-bold">טיול חדש</h1>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1 — Trip Type ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-6 text-white text-center">
                <Plane className="w-10 h-10 mx-auto mb-2" />
                <p className="font-bold text-lg">מה סוג הטיול?</p>
                <p className="text-sm opacity-70 mt-1">בחר סוג כדי להתאים את החוויה</p>
              </div>

              {TRIP_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-right active:scale-[0.98] transition-all ${type.color}`}
                >
                  <type.icon className="w-8 h-8 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm">{type.label}</p>
                    <p className="text-xs opacity-70">{type.desc}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Step 2 — Welcome + Destination ── */}
          {step === 2 && selectedType && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Personalised welcome banner */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-6 text-white text-center"
              >
                <div className="text-5xl mb-3">{selectedType.emoji}</div>
                <h2 className="text-xl font-bold mb-1">{selectedType.welcomeTitle}</h2>
                <p className="text-sm opacity-80 leading-relaxed">{selectedType.welcomeText}</p>
              </motion.div>

              {/* Destination */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="bg-white rounded-2xl p-5 shadow-sm space-y-3"
              >
                <h3 className="font-bold text-base">✈️ לאן טסים?</h3>
                <p className="text-xs text-gray-400 -mt-1">בחרו את מדינת היעד</p>
                <div className="relative">
                  <input
                    type="text"
                    value={
                      destination
                        ? filteredDests.find(d => d.name === destination)?.nameHe
                          ? `${filteredDests.find(d => d.name === destination)!.nameHe} (${destination})`
                          : destination
                        : destSearch
                    }
                    onChange={(e) => {
                      setDestSearch(e.target.value)
                      setDestination('')
                      setShowDestList(true)
                    }}
                    onFocus={() => setShowDestList(true)}
                    placeholder="חפש יעד (עברית או אנגלית)..."
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {showDestList && !destination && (
                    <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border mt-1 max-h-52 overflow-y-auto z-20">
                      {filteredDests.slice(0, 20).map(d => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDestination(d.name)
                            setDestSearch('')
                            setShowDestList(false)
                          }}
                          className="w-full px-4 py-2.5 text-sm text-right hover:bg-gray-50 active:bg-gray-100 flex justify-between items-center"
                        >
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

                <button
                  onClick={() => {
                    if (!destination) { toast.error('נא לבחור יעד'); return }
                    setStep(3)
                  }}
                  className="w-full bg-primary text-white rounded-xl py-3 font-bold active:scale-95 transition-transform"
                >
                  המשך →
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── Step 3 — Travelers ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="text-4xl mb-2">👥</div>
                <h2 className="text-xl font-bold">מי טס?</h2>
                <p className="text-sm text-gray-500 mt-1">הוסף את שמות הנוסעים (באנגלית)</p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                {travelers.map((t, i) => (
                  <div key={t.id} className="flex gap-2 items-center">
                    <span className="text-[11px] text-primary w-16 flex-shrink-0 text-right font-medium">
                      {travelerLabel(i)}
                    </span>
                    <input
                      type="text"
                      value={t.name}
                      dir="ltr"
                      onChange={(e) => {
                        const updated = [...travelers]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setTravelers(updated)
                      }}
                      placeholder="Full name"
                      className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none text-left focus:ring-2 focus:ring-primary/20"
                    />
                    {travelers.length > 1 && (
                      <button
                        onClick={() => setTravelers(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 active:scale-95 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() =>
                    setTravelers(prev => [...prev, { id: `traveler_${Date.now()}`, name: '' }])
                  }
                  className="w-full bg-gray-50 text-gray-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 border border-dashed border-gray-300 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> הוסף נוסע
                </button>
              </div>

              <button
                onClick={() => setStep(4)}
                className="w-full bg-primary text-white rounded-xl py-3.5 font-bold active:scale-95 transition-transform"
              >
                המשך →
              </button>
            </motion.div>
          )}

          {/* ── Step 4 — Dates + optional details ── */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="text-4xl mb-2">📅</div>
                <h2 className="text-xl font-bold">מתי הטיול?</h2>
                <p className="text-sm text-gray-500 mt-1">בחר תאריכי יציאה וחזרה</p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 font-medium">✈️ יציאה</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 font-medium">🏠 חזרה</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-medium">שם הטיול (אופציונלי)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`ברירת מחדל: "טיול ל${destination || 'יעד'}"`}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mt-1 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-medium">תקציב בשקלים (אופציונלי)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="לדוגמא: 15000"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mt-1"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 shadow-md"
              >
                {saving ? 'יוצר טיול...' : '🚀 יאללה, טסים!'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
