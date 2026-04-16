'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'
import DateRangePicker from '@/components/DateRangePicker'
import { searchDestinations, getDestinationCities } from '@/lib/destinations'

export default function EditTripPage() {
  const router   = useRouter()
  const params   = useParams()
  const tripId   = params.id as string
  const { refreshTrips } = useTrip()

  // Form state
  const [name,       setName]       = useState('')
  const [destination, setDest]      = useState('')  // display string, e.g. "בנגקוק, תאילנד"
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState('')
  const [budget,     setBudget]     = useState('')
  const [currency,   setCurrency]   = useState('ILS')
  const [travelers,  setTravelers]  = useState<{ id: string; name: string }[]>([])
  const [cities,     setCities]     = useState<string[]>([])
  const [cityInput,  setCityInput]  = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [countryKey, setCountryKey] = useState('')   // for city suggestions

  // Destination autocomplete
  const [destSearch,    setDestSearch]    = useState('')
  const [showDestList,  setShowDestList]  = useState(false)
  const filteredDests = searchDestinations(destSearch)

  // Load existing trip data
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      if (error || !data) {
        toast.error('לא ניתן לטעון את הטיול')
        router.back()
        return
      }

      setName(data.name || '')
      setDest(data.destination || '')
      setDestSearch(data.destination || '')
      setStartDate(data.start_date || '')
      setEndDate(data.end_date || '')
      setBudget(data.budget_ils ? String(data.budget_ils) : '')
      const storedCurrency = localStorage.getItem('tripix_currency') || 'ILS'
      setCurrency(storedCurrency)
      const travs = (data.travelers as { id: string; name: string }[] | null) || []
      setTravelers(travs.length > 0 ? travs : [{ id: 'traveler_1', name: '' }])
      try {
        const parsed = JSON.parse(data.notes || '{}')
        setCities(Array.isArray(parsed?.cities) ? parsed.cities : [])
      } catch {
        setCities([])
      }
      setLoading(false)
    }
    load()
  }, [tripId, router])

  const handleSave = async () => {
    if (!destination || !startDate || !endDate) {
      toast.error('נא למלא יעד ותאריכים')
      return
    }
    setSaving(true)
    try {
      localStorage.setItem('tripix_currency', currency)

      const { error } = await supabase
        .from('trips')
        .update({
          name: name.trim() || destination,
          destination,
          notes: JSON.stringify({ type: null, cities }),
          start_date: startDate,
          end_date:   endDate,
          budget_ils: budget ? parseFloat(budget) : null,
          travelers:  travelers
            .filter(t => t.name.trim())
            .map(t => ({ id: t.id, name: t.name.trim() })),
        })
        .eq('id', tripId)

      if (error) throw error

      await refreshTrips()
      toast.success('הטיול עודכן ✓')
      router.push('/trips')
    } catch {
      toast.error('שגיאה בעדכון')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gray-50 pb-32"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    >
      <div className="px-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="active:scale-95 transition-transform p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-bold">עריכת טיול</h1>
        </div>

        {/* Trip name */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-gray-700">✏️ שם הטיול</h3>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="שם הטיול..."
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Destination */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-gray-700">✈️ יעד</h3>
          <div className="relative">
            {/* Flag when not searching */}
            {!showDestList && (() => {
              const sel = filteredDests.find(d => d.nameHe === destination || d.id === destination)
              return sel ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl leading-none pointer-events-none z-10">
                  {sel.flag}
                </span>
              ) : null
            })()}
            <input
              type="text"
              value={showDestList ? destSearch : destination}
              onChange={e => {
                setDestSearch(e.target.value)
                setShowDestList(true)
              }}
              onFocus={() => {
                setDestSearch(destination)
                setShowDestList(true)
              }}
              onBlur={() => setTimeout(() => setShowDestList(false), 150)}
              placeholder="חפש מדינה / עיר..."
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 pr-10"
            />
            {showDestList && filteredDests.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border mt-1 max-h-48 overflow-y-auto z-20">
                {filteredDests.slice(0, 60).map(d => (
                  <button
                    key={d.id}
                    onMouseDown={() => {
                      setDest(d.nameHe)
                      setDestSearch(d.nameHe)
                      setCountryKey(d.name)
                      setShowDestList(false)
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
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            לא מצאתם? ערכו ידנית — הקלידו את שם היעד ישירות בשדה
          </p>
        </div>

        {/* Cities */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-700">🏙️ ערים שתבקרו</h3>
            {cities.length > 0 && (
              <span className="text-[10px] text-primary font-medium">{cities.length} ערים</span>
            )}
          </div>

          {/* Suggested cities from country */}
          {countryKey && getDestinationCities(countryKey).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {getDestinationCities(countryKey).map(city => {
                const isSelected = cities.includes(city)
                return (
                  <button
                    key={city}
                    onClick={() => setCities(prev =>
                      isSelected ? prev.filter(c => c !== city) : [...prev, city]
                    )}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {isSelected ? '✓ ' : ''}{city}
                  </button>
                )
              })}
            </div>
          )}

          {/* Current cities list */}
          {cities.length > 0 && (
            <div className="bg-primary/5 rounded-xl px-3 py-2 space-y-1.5">
              {cities.map((city, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-primary font-medium">{city}</span>
                  <button
                    onClick={() => setCities(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-[10px] text-red-400 active:scale-90 px-1"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom city */}
          <div className="flex gap-2">
            <input
              type="text"
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && cityInput.trim()) {
                  if (!cities.includes(cityInput.trim())) setCities(prev => [...prev, cityInput.trim()])
                  setCityInput('')
                }
              }}
              placeholder="הוסיפו עיר..."
              className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            {cityInput.trim() && (
              <button
                onClick={() => {
                  if (!cities.includes(cityInput.trim())) setCities(prev => [...prev, cityInput.trim()])
                  setCityInput('')
                }}
                className="bg-primary text-white rounded-xl px-3 text-xs font-bold active:scale-95"
              >
                הוסף
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">הערים ישפרו את זיהוי המיילים המשויכים לטיול הזה</p>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-gray-700">📅 תאריכים</h3>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </div>

        {/* Budget + Currency */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-gray-700">💰 תקציב</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="סכום (אופציונלי)"
              className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
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
        </div>

        {/* Travelers */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-gray-700">👥 נוסעים</h3>
          <p className="text-xs text-gray-400 -mt-1">שמות מלאים באנגלית (לצורך חיפוש מיילים)</p>
          {travelers.map((t, i) => (
            <div key={t.id} className="flex gap-2 items-center">
              <span className="text-[11px] text-primary w-14 flex-shrink-0 text-right font-medium">
                נוסע {i + 1}
              </span>
              <input
                type="text"
                value={t.name}
                dir="ltr"
                onChange={e => {
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
            onClick={() => setTravelers(prev => [...prev, { id: `traveler_${Date.now()}`, name: '' }])}
            className="w-full bg-gray-50 text-gray-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 border border-dashed border-gray-300 flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> הוסף נוסע
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base active:scale-95 transition-transform disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  )
}
