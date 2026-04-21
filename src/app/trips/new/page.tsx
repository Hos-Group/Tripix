'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plane, ChevronLeft, Users, User, Baby, Heart, Plus, Trash2, Briefcase, Search, X, ChevronDown, Building2, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { searchDestinations, getDestinationCities, hasStates, getCountryStates, getStateCities, getDestinationConfig } from '@/lib/destinations'
import DateRangePicker from '@/components/DateRangePicker'
import { Analytics } from '@/lib/analytics'

const TRIP_TYPES = [
  {
    id: 'business',
    label: 'נסיעה עסקית',
    icon: Briefcase,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    desc: 'כנסים, פגישות, עסקים',
    emoji: '💼',
    welcomeTitle: 'נסיעה עסקית — נסדר הכל בצורה מקצועית 💼',
    welcomeText: 'ניהול הוצאות עסקיות, קבלות להחזר, לוח זמנים — הכל במקום אחד.',
    defaultCount: 1,
    // Business-specific defaults
    defaultCategories: ['hotel', 'taxi', 'food', 'other'],
    suggestExpenseReport: true,
    requireReceipts: true,
  },
  {
    id: 'family',
    label: 'נסיעה משפחתית',
    icon: Baby,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    desc: 'משפחה עם ילדים',
    emoji: '👨‍👩‍👧‍👦',
    welcomeTitle: 'אין כמו נסיעה משפחתית! 👨‍👩‍👧‍👦',
    welcomeText: 'אטרקציות לילדים, בטיחות, רשימת אריזה — הכל מסודר.',
    defaultCount: 4,
    defaultCategories: ['hotel', 'activity', 'food', 'transport'],
    suggestExpenseReport: false,
    requireReceipts: false,
  },
  {
    id: 'solo',
    label: 'נסיעת יחיד',
    icon: User,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    desc: 'מטייל יחיד',
    emoji: '🎒',
    welcomeTitle: 'לצאת לבד — אומץ אמיתי! 🎒',
    welcomeText: 'הרפתקה אישית שלא תשכח. בוא נעזור לך לתכנן אותה.',
    defaultCount: 1,
    defaultCategories: ['hotel', 'food', 'activity', 'transport'],
    suggestExpenseReport: false,
    requireReceipts: false,
  },
  {
    id: 'friends',
    label: 'נסיעת חברים',
    icon: Users,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    desc: 'קבוצת חברים',
    emoji: '🎉',
    welcomeTitle: 'נסיעה עם חברים — הכי כיף! 🎉',
    welcomeText: 'שיתוף הוצאות, לוגיסטיקה קבוצתית, בילויים — הכל מסודר.',
    defaultCount: 4,
    defaultCategories: ['hotel', 'food', 'activity', 'nightlife'],
    suggestExpenseReport: false,
    requireReceipts: false,
  },
  {
    id: 'couple',
    label: 'נסיעה זוגית',
    icon: Heart,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    desc: 'ירח דבש / חופשה זוגית',
    emoji: '💑',
    welcomeTitle: 'רומנטי ומרגש! 💑',
    welcomeText: 'נעזור לכם לתכנן את חופשת החלומות המושלמת.',
    defaultCount: 2,
    defaultCategories: ['hotel', 'food', 'activity', 'transport'],
    suggestExpenseReport: false,
    requireReceipts: false,
  },
]

type TripTypeItem = typeof TRIP_TYPES[0]

export default function NewTripPage() {
  const { user } = useAuth()
  const { refreshTrips, setCurrentTripId } = useTrip()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(1)
  const [tripCategory, setTripCategory] = useState<'business' | 'pleasure' | null>(null)
  const [selectedType, setSelectedType] = useState<TripTypeItem | null>(null)
  const [destination, setDestination] = useState('')   // country key e.g. "Thailand"
  const [selectedCities, setSelectedCities] = useState<string[]>([])   // multiple cities
  const [customCityInput, setCustomCityInput] = useState('') // manual city input
  const [destSearch, setDestSearch] = useState('')
  const [showDestList, setShowDestList] = useState(false)
  const [selectedState, setSelectedState] = useState('')   // US state / Australian state / Canadian province

  // Pre-fill destination from quiz (?dest=בנגקוק, תאילנד)
  useEffect(() => {
    const destParam = searchParams.get('dest')
    if (destParam) {
      const parts = destParam.split(',').map(p => p.trim())
      const city    = parts[0] || ''
      const country = parts[1] || ''
      if (country) setDestination(country)
      if (city)    setSelectedCities([city])
      setDestSearch(destParam)
    }
  }, [])
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('ILS')
  const [travelers, setTravelers] = useState([{ id: 'traveler_1', name: '', nameEn: '', translating: false }])
  const [saving, setSaving] = useState(false)

  // Business trip details
  const [companyName, setCompanyName]         = useState('')
  const [businessId, setBusinessId]           = useState('')
  const [department, setDepartment]           = useState('')
  const [deptCustom, setDeptCustom]           = useState('')
  const [deptOpen, setDeptOpen]               = useState(false)

  // Company search autocomplete
  const [companySuggestions, setCompanySuggestions] = useState<Array<{ id: number; name: string; nameEn: string; address: string }>>([])
  const [companySearchOpen, setCompanySearchOpen]   = useState(false)
  const [companySearching, setCompanySearching]     = useState(false)
  const companySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const companyWrapperRef  = useRef<HTMLDivElement>(null)

  const searchCompanies = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setCompanySuggestions([]); setCompanySearchOpen(false); return }
    setCompanySearching(true)
    try {
      const res  = await fetch(`/api/company-search?q=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json() as Array<{ id: number; name: string; nameEn: string; address: string }>
      setCompanySuggestions(data)
      setCompanySearchOpen(data.length > 0)
    } catch { /* silent */ } finally { setCompanySearching(false) }
  }, [])

  function handleCompanyInput(val: string) {
    setCompanyName(val)
    if (companySearchTimer.current) clearTimeout(companySearchTimer.current)
    companySearchTimer.current = setTimeout(() => searchCompanies(val), 350)
  }

  function selectCompany(c: { id: number; name: string; nameEn: string; address: string }) {
    setCompanyName(c.name)
    setBusinessId(String(c.id))
    setCompanySearchOpen(false)
    setCompanySuggestions([])
  }

  // ── Traveler name helpers ─────────────────────────────────────────────────
  const HE_REGEX = /[\u0590-\u05FF]/
  // Per-traveler debounce timers and request tokens to prevent stale results
  const translateTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const translateTokens = useRef<Record<number, number>>({})

  async function translateNameToEn(hebrewName: string): Promise<string> {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(hebrewName)}&langpair=he|en`)
      const data = await res.json() as { responseData?: { translatedText?: string } }
      const translated = data.responseData?.translatedText?.trim() || ''
      return translated.replace(/[^a-zA-Z\s'-]/g, '').trim()
    } catch {
      return ''
    }
  }

  function validateTravelerName(name: string): string | null {
    if (!name.trim()) return 'שם נדרש'
    if (/\d/.test(name)) return 'שם לא יכול להכיל מספרים'
    const words = name.trim().split(/\s+/)
    if (words.length < 2) return 'יש להזין שם מלא (שם + משפחה)'
    return null
  }

  function handleTravelerNameChange(i: number, value: string) {
    // Block digits
    if (/\d/.test(value)) return

    // Update name immediately, clear previous suggestion
    setTravelers(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], name: value, nameEn: '', translating: false }
      return updated
    })

    // Cancel pending timer for this traveler
    if (translateTimers.current[i]) clearTimeout(translateTimers.current[i])

    // Debounce: only translate when user stops typing (600ms) + at least 2 Hebrew words
    if (HE_REGEX.test(value) && value.trim().split(/\s+/).length >= 2) {
      // Increment token — any older async call will see a mismatch and discard its result
      const token = (translateTokens.current[i] || 0) + 1
      translateTokens.current[i] = token

      translateTimers.current[i] = setTimeout(async () => {
        // Show spinner
        setTravelers(prev => {
          const updated = [...prev]
          updated[i] = { ...updated[i], translating: true }
          return updated
        })

        const en = await translateNameToEn(value.trim())

        // Only apply if this is still the latest request for this traveler
        if (translateTokens.current[i] !== token) return

        setTravelers(prev => {
          const updated = [...prev]
          // Guard: make sure the Hebrew name hasn't changed while we waited
          if (updated[i].name !== value) return prev
          updated[i] = { ...updated[i], nameEn: en, translating: false }
          return updated
        })
      }, 600)
    }
  }

  function confirmTranslation(i: number) {
    setTravelers(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], name: updated[i].nameEn, nameEn: '', translating: false }
      return updated
    })
  }

  function editTranslation(i: number, value: string) {
    if (/\d/.test(value)) return
    setTravelers(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], nameEn: value }
      return updated
    })
  }

  const filteredDests = searchDestinations(destSearch)

  const handleTypeSelect = (type: TripTypeItem) => {
    setSelectedType(type)
    const defaultTravs = Array.from({ length: type.defaultCount }, (_, i) => ({
      id: `traveler_${i + 1}`,
      name: '', nameEn: '', translating: false,
    }))
    setTravelers(defaultTravs)
    setStep(2)
  }

  const handleSave = async () => {
    if (!destination || !startDate || !endDate) {
      toast.error('נא למלא יעד ותאריכים')
      return
    }

    // Build all cities including any custom input
    const allCities = customCityInput.trim()
      ? [...selectedCities.filter(c => c !== customCityInput), customCityInput.trim()]
      : selectedCities

    // Combine first city + country for display, e.g. "בנגקוק, תאילנד"
    const countryHe = filteredDests.find(d => d.id === destination)?.nameHe || destination
    const destDisplay = allCities.length > 0
      ? `${allCities[0]}, ${countryHe}`
      : countryHe
    const tripName = name.trim() || `נסיעה ל${allCities.length > 0 ? allCities[0] : countryHe}`

    setSaving(true)
    try {
      // Save preferred currency to localStorage for app-wide use
      localStorage.setItem('tripix_currency', currency)

      const insertData: Record<string, unknown> = {
        name: tripName,
        destination: destDisplay,
        start_date: startDate,
        end_date: endDate,
        budget_ils: budget ? parseFloat(budget) : null,
        travelers: travelers
          .filter(t => t.name.trim())
          .map(t => ({ id: t.id, name: t.name.trim() })),
        notes: JSON.stringify({
          type: selectedType?.id || null,
          cities: allCities,
          ...(tripCategory === 'business' && (companyName.trim() || businessId.trim() || department.trim()) ? {
            business: {
              companyName: companyName.trim() || undefined,
              businessId:  businessId.trim()  || undefined,
              department:  (department === 'other' ? deptCustom.trim() : department) || undefined,
            },
          } : {}),
        }),
      }
      if (user?.id) {
        insertData.user_id = user.id
      }

      const { data, error } = await supabase.from('trips').insert(insertData).select('id').single()
      if (error) throw error

      await refreshTrips()
      if (data?.id) setCurrentTripId(data.id)
      Analytics.tripCreated(destDisplay, selectedType?.id || 'unknown')
      toast.success('הנסיעה נוצרה! 🚀')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה ביצירת הנסיעה')
    }
    setSaving(false)
  }

  const travelerLabel = (index: number) => {
    if (!selectedType) return `נוסע ${index + 1}`
    if (selectedType.id === 'solo') return 'מטייל'
    if (selectedType.id === 'business') return index === 0 ? 'נוסע עסקי' : `עמית ${index}`
    if (selectedType.id === 'couple') return index === 0 ? 'שותף/ה 1' : 'שותף/ה 2'
    if (selectedType.id === 'family') {
      if (index === 0) return 'הורה 1'
      if (index === 1) return 'הורה 2'
      return `ילד/ה ${index - 1}`
    }
    if (selectedType.id === 'friends') return index === 0 ? 'מארגן' : `חבר/ה ${index}`
    return `נוסע ${index + 1}`
  }

  const goBack = () => {
    if (step > 1) { setStep(step - 1) }
    else if (tripCategory !== null) { setTripCategory(null) }
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
          <button
            type="button"
            onClick={goBack}
            aria-label="חזרה לשלב הקודם"
            className="w-11 h-11 flex items-center justify-center rounded-2xl active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 rtl:rotate-180" aria-hidden="true" />
          </button>

          {showProgress ? (
            <div
              className="flex gap-1.5 flex-1 justify-center"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={currentProgress}
              aria-label={`שלב ${currentProgress} מתוך ${TOTAL_STEPS}`}
            >
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < currentProgress ? 'w-8' : 'bg-gray-200 w-4'
                  }`}
                  style={i < currentProgress ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}
                />
              ))}
            </div>
          ) : (
            <h1 className="text-xl font-bold">נסיעה חדשה</h1>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1a — Business or Pleasure ── */}
          {step === 1 && tripCategory === null && (
            <motion.div
              key="step1a"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="rounded-3xl p-6 text-white text-center" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                <Plane className="w-10 h-10 mx-auto mb-2" />
                <p className="font-bold text-xl">ביזנס או פלאז׳ר?</p>
                <p className="text-sm opacity-70 mt-1">בחר כדי להתאים את הנסיעה</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTripCategory('business')}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 bg-slate-50 active:scale-[0.97] transition-all"
                >
                  <span className="text-4xl">💼</span>
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-base">ביזנס</p>
                    <p className="text-xs text-slate-500 mt-0.5">עסקים ופגישות</p>
                  </div>
                </button>

                <button
                  onClick={() => setTripCategory('pleasure')}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 active:scale-[0.97] transition-all"
                  style={{ borderColor: '#9B7BFF', background: 'linear-gradient(135deg, #f5f0ff 0%, #ede8ff 100%)' }}
                >
                  <span className="text-4xl">🌴</span>
                  <div className="text-center">
                    <p className="font-bold text-violet-700 text-base">פלאז׳ר</p>
                    <p className="text-xs text-violet-400 mt-0.5">חופשה ובילוי</p>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 1b — Trip Type ── */}
          {step === 1 && tripCategory !== null && (
            <motion.div
              key="step1b"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="rounded-3xl p-5 text-white text-center" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                <p className="font-bold text-lg">מה סוג הנסיעה?</p>
                <p className="text-sm opacity-70 mt-1">בחר כדי להתאים את החוויה</p>
              </div>

              {TRIP_TYPES.filter(t => tripCategory === 'business' ? t.id === 'business' : t.id !== 'business').map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-right active:scale-[0.98] transition-all ${type.color}`}
                >
                  <span className="text-2xl flex-shrink-0">{type.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{type.label}</p>
                      {type.id === 'business' && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full font-medium">קבלות להחזר</span>
                      )}
                    </div>
                    <p className="text-xs opacity-70">{type.desc}</p>
                  </div>
                  <type.icon className="w-5 h-5 flex-shrink-0 opacity-40" />
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
                className="rounded-3xl p-6 text-white text-center" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
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

                {/* Country search */}
                <div className="relative">
                  {/* Flag badge when country selected */}
                  {destination && (() => {
                    const sel = filteredDests.find(d => d.id === destination)
                    return sel ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl leading-none pointer-events-none z-10">
                        {sel.flag}
                      </span>
                    ) : null
                  })()}
                  <input
                    type="text"
                    value={
                      destination
                        ? filteredDests.find(d => d.id === destination)?.nameHe || destination
                        : destSearch
                    }
                    onChange={(e) => {
                      setDestSearch(e.target.value)
                      setDestination('')
                      setSelectedCities([])
                      setCustomCityInput('')
                      setShowDestList(true)
                    }}
                    onFocus={() => setShowDestList(true)}
                    placeholder="חפש מדינה (עברית או אנגלית)..."
                    className={`w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${destination ? 'pr-10' : ''}`}
                  />
                  {showDestList && !destination && (
                    <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border mt-1 max-h-48 overflow-y-auto z-20">
                      {filteredDests.slice(0, 60).map(d => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDestination(d.id)
                            setSelectedCities([])
                            setSelectedState('')
                            setCustomCityInput('')
                            setDestSearch('')
                            setShowDestList(false)
                            // Auto-fill currency from destination config
                            const cfg = getDestinationConfig(d.id)
                            if (cfg?.currency) setCurrency(cfg.currency)
                          }}
                          className="w-full px-4 py-2.5 text-sm text-right hover:bg-gray-50 active:bg-gray-100 flex justify-between items-center gap-2"
                        >
                          <span className="text-gray-400 text-xs flex-shrink-0">{d.currency}</span>
                          <span className="flex items-center gap-2 flex-1 justify-end">
                            <span>{d.nameHe}</span>
                            <span className="text-base leading-none">{d.flag}</span>
                          </span>
                        </button>
                      ))}
                      {filteredDests.length === 0 && (
                        <p className="px-4 py-3 text-xs text-gray-400 text-center">לא נמצא — נסה שם אחר</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Multi-city picker — shown after country is selected */}
                {destination && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      {/* State/Province picker — for USA, Canada, Australia */}
                      {hasStates(destination) && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 font-medium">🗺️ {destination === 'USA' ? 'מדינה' : 'מחוז / מדינה'}</p>
                          <div className="flex flex-wrap gap-2">
                            {getCountryStates(destination).map(state => (
                              <button
                                key={state}
                                onClick={() => {
                                  setSelectedState(state)
                                  setSelectedCities([])
                                }}
                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95 ${
                                  selectedState === state
                                    ? 'text-white border-transparent shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}
                                style={selectedState === state ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}
                              >
                                {selectedState === state ? '✓ ' : ''}{state}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 font-medium">🏙️ ערים שתבקרו</p>
                        {selectedCities.length > 0 && (
                          <p className="text-[10px] text-primary font-medium">{selectedCities.length} נבחרו</p>
                        )}
                      </div>

                      {/* Known cities chips — multi-select */}
                      {(() => {
                        const cities = hasStates(destination) && selectedState
                          ? getStateCities(destination, selectedState)
                          : getDestinationCities(destination)
                        return cities.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {cities.map(city => {
                              const isSelected = selectedCities.includes(city)
                              return (
                                <button
                                  key={city}
                                  onClick={() => {
                                    setSelectedCities(prev =>
                                      isSelected ? prev.filter(c => c !== city) : [...prev, city]
                                    )
                                  }}
                                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95 ${
                                    isSelected
                                      ? 'text-white border-transparent shadow-sm'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                                  }`}
                                  style={isSelected ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}
                                >
                                  {isSelected ? '✓ ' : ''}{city}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                      {hasStates(destination) && !selectedState && (
                        <p className="text-xs text-gray-400 text-center py-1">בחר מדינה כדי לראות ערים</p>
                      )}

                      {/* Selected cities display */}
                      {selectedCities.length > 0 && (
                        <div className="bg-violet-50 rounded-xl px-3 py-2 text-xs text-violet-600 font-medium">
                          מסלול: {selectedCities.join(' → ')}
                        </div>
                      )}

                      {/* Manual city input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customCityInput}
                          onChange={(e) => setCustomCityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customCityInput.trim()) {
                              setSelectedCities(prev =>
                                prev.includes(customCityInput.trim()) ? prev : [...prev, customCityInput.trim()]
                              )
                              setCustomCityInput('')
                            }
                          }}
                          placeholder="הוסיפו עיר ידנית..."
                          className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        {customCityInput.trim() && (
                          <button
                            onClick={() => {
                              if (!selectedCities.includes(customCityInput.trim())) {
                                setSelectedCities(prev => [...prev, customCityInput.trim()])
                              }
                              setCustomCityInput('')
                            }}
                            className="text-white rounded-xl px-3 text-xs font-bold active:scale-95"
                            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
                          >
                            הוסף
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">הוסיפו עיר ולחצו Enter או &quot;הוסף&quot; — ניתן לבחור מספר ערים</p>
                    </motion.div>
                  </AnimatePresence>
                )}

                <button
                  onClick={() => {
                    if (!destination) { toast.error('נא לבחור מדינה'); return }
                    setStep(3)
                  }}
                  className="w-full text-white rounded-2xl py-3 font-bold active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
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
                <p className="text-sm text-gray-500 mt-1">שם מלא בלבד · ניתן להקליד בעברית ולאשר תרגום</p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                {travelers.map((t, i) => {
                  const nameErr = t.name.trim() ? validateTravelerName(t.name) : null
                  return (
                    <div key={t.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">{travelerLabel(i)}</span>
                        {travelers.length > 1 && (
                          <button onClick={() => setTravelers(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 active:scale-95 p-0.5">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => handleTravelerNameChange(i, e.target.value)}
                        placeholder="שם מלא — גם בעברית וגם באנגלית"
                        className={`w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${nameErr ? 'ring-2 ring-red-200' : ''}`}
                        dir="auto"
                      />

                      {/* Name error */}
                      {nameErr && (
                        <p className="text-[11px] text-red-400 px-1">{nameErr}</p>
                      )}

                      {/* Translation suggestion */}
                      {t.translating && (
                        <p className="text-[11px] text-violet-500 px-1 animate-pulse">מתרגם לאנגלית...</p>
                      )}
                      {t.nameEn && !t.translating && (
                        <div className="bg-violet-50 rounded-xl px-3 py-2 space-y-1.5">
                          <p className="text-[11px] text-violet-600 font-medium">
                            תרגום לאנגלית — אשר או ערוך:
                          </p>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={t.nameEn}
                              dir="ltr"
                              onChange={(e) => editTranslation(i, e.target.value)}
                              className="flex-1 bg-white rounded-lg px-3 py-1.5 text-sm outline-none text-left border border-violet-200 focus:ring-2 focus:ring-violet-200"
                            />
                            <button onClick={() => confirmTranslation(i)}
                              className="text-xs px-3 py-1.5 rounded-lg text-white font-bold active:scale-95"
                              style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                              ✓ אשר
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={() => setTravelers(prev => [...prev, { id: `traveler_${Date.now()}`, name: '', nameEn: '', translating: false }])}
                  className="w-full bg-gray-50 text-gray-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 border border-dashed border-gray-300 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> הוסף נוסע
                </button>
              </div>

              <button
                onClick={() => setStep(4)}
                className="w-full text-white rounded-2xl py-3.5 font-bold active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
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
                <h2 className="text-xl font-bold">מתי הנסיעה?</h2>
                <p className="text-sm text-gray-500 mt-1">לחצו על תאריך היציאה ואחר כך על החזרה</p>
              </div>

              {/* Visual date range picker */}
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={setStartDate}
                onEndChange={setEndDate}
              />

              {/* Optional fields */}
              <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium">שם הנסיעה (אופציונלי)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`ברירת מחדל: "נסיעה ל${selectedCities[0] || destination || 'יעד'}"`}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mt-1 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Business trip: company details */}
                {tripCategory === 'business' && (
                  <div className="space-y-3 pt-2 border-t border-dashed border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏢</span>
                      <span className="text-xs font-bold text-slate-700">פרטי חברה / עוסק</span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">אופציונלי</span>
                    </div>
                    <p className="text-[11px] text-gray-400 -mt-1">
                      פרטים אלו יעזרו למשוך אוטומטית חשבוניות ומסמכים מהמייל
                    </p>

                    {/* Company name — autocomplete from רשם החברות */}
                    <div ref={companyWrapperRef} className="relative">
                      <label className="text-xs text-gray-500 font-medium">שם חברה / עוסק מורשה</label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => handleCompanyInput(e.target.value)}
                          onFocus={() => companySuggestions.length > 0 && setCompanySearchOpen(true)}
                          placeholder='לדוגמה: Google Israel, עוסק מורשה שלמה כהן'
                          className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 pr-9"
                          dir="auto"
                          autoComplete="off"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          {companySearching
                            ? <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            : companyName
                              ? <button type="button" className="pointer-events-auto text-gray-400 active:scale-90"
                                  onClick={() => { setCompanyName(''); setBusinessId(''); setCompanySearchOpen(false) }}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              : <Search className="w-3.5 h-3.5 text-gray-300" />
                          }
                        </div>
                      </div>

                      {/* Autocomplete dropdown */}
                      {companySearchOpen && companySuggestions.length > 0 && (
                        <div
                          className="absolute z-50 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                          style={{ maxHeight: 260 }}
                        >
                          {companySuggestions.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => selectCompany(c)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right border-b border-gray-50 last:border-0"
                            >
                              <Building2 className="w-4 h-4 text-primary/40 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-gray-400 font-mono">ח.פ {c.id}</p>
                                  {c.address && <p className="text-[10px] text-gray-400 truncate">{c.address}</p>}
                                </div>
                              </div>
                              {businessId === String(c.id) && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                            </button>
                          ))}
                          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400">מקור: רשם החברות — משרד המשפטים ישראל</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* ח.פ — auto-filled but editable */}
                      <div>
                        <label className="text-xs text-gray-500 font-medium">ח.פ. / מספר עוסק</label>
                        <input
                          type="text"
                          value={businessId}
                          onChange={(e) => setBusinessId(e.target.value)}
                          placeholder="123456789"
                          className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none mt-1 focus:ring-2 focus:ring-primary/20"
                          dir="ltr"
                          inputMode="numeric"
                        />
                      </div>

                      {/* Department — dropdown */}
                      <div className="relative">
                        <label className="text-xs text-gray-500 font-medium">מחלקה</label>
                        <button
                          type="button"
                          onClick={() => setDeptOpen(o => !o)}
                          className="w-full flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <span className={department ? 'text-gray-800' : 'text-gray-400'}>
                            {department === 'other'
                              ? (deptCustom || 'הקלד...')
                              : department || 'בחר מחלקה'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${deptOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {deptOpen && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                            {[
                              { v: 'RnD',        label: 'R&D / פיתוח' },
                              { v: 'Sales',      label: 'Sales / מכירות' },
                              { v: 'Marketing',  label: 'Marketing / שיווק' },
                              { v: 'Finance',    label: 'Finance / כספים' },
                              { v: 'HR',         label: 'HR / משאבי אנוש' },
                              { v: 'Operations', label: 'Operations / תפעול' },
                              { v: 'Legal',      label: 'Legal / משפטי' },
                              { v: 'IT',         label: 'IT / מחשוב' },
                              { v: 'Management', label: 'Management / הנהלה' },
                              { v: 'other',      label: 'אחר — הקלד בחופשי' },
                            ].map(opt => (
                              <button
                                key={opt.v}
                                type="button"
                                onMouseDown={() => { setDepartment(opt.v); setDeptOpen(false) }}
                                className={`w-full text-right px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center justify-between ${department === opt.v ? 'text-primary font-semibold' : 'text-gray-700'}`}
                              >
                                {opt.label}
                                {department === opt.v && <Check className="w-3.5 h-3.5 text-primary" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom department text — shown when "other" is selected */}
                    {department === 'other' && (
                      <div>
                        <input
                          type="text"
                          value={deptCustom}
                          onChange={(e) => setDeptCustom(e.target.value)}
                          placeholder="הקלד שם מחלקה..."
                          className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          dir="auto"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Budget + currency selector */}
                <div>
                  <label className="text-xs text-gray-500 font-medium">
                    תקציב (אופציונלי) — באיזה מטבע תנהל את הנסיעה?
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="סכום"
                      className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 font-medium text-gray-700"
                    >
                      <option value="ILS">₪ שקל</option>
                      <option value="USD">$ דולר</option>
                      <option value="EUR">€ אירו</option>
                      <option value="GBP">£ פאונד</option>
                      <option value="THB">฿ באט</option>
                      <option value="JPY">¥ ין</option>
                      <option value="AED">د.إ דירהם</option>
                      <option value="TRY">₺ לירה</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    המטבע שתבחרו יוצג בכל רחבי המערכת
                  </p>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full text-white rounded-2xl py-4 font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 shadow-md"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
              >
                {saving ? 'יוצרת נסיעה...' : '🚀 יאללה, טסים!'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
