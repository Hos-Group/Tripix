'use client'

import { useState, useEffect, useRef } from 'react'
import {
  User, Lock, Bell, Shield, Info, LogOut, ChevronLeft, Save,
  Users, Coins, Mail, Copy, CheckCheck, Eye, EyeOff, Plus,
  Trash2, ScanLine, Edit3, Camera, AlertCircle, Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import GmailConnect from '@/components/GmailConnect'
import { useAuth } from '@/contexts/AuthContext'

type SettingsPage = 'main' | 'account' | 'notifications' | 'security' | 'about' | 'currency' | 'email_inbox' | 'gmail' | 'travelers'

const MENU_ITEMS = [
  { id: 'account'    as const, label: 'פרטי חשבון',         icon: User,    color: 'text-blue-500',    bg: 'bg-blue-50' },
  { id: 'travelers'  as const, label: 'נוסעים קבועים',       icon: Users,   color: 'text-violet-500',  bg: 'bg-violet-50', badge: 'חדש' },
  { id: 'currency'   as const, label: 'מטבע ברירת מחדל',    icon: Coins,   color: 'text-yellow-500',  bg: 'bg-yellow-50' },
  { id: 'email_inbox'as const, label: 'חיבור מייל חכם',     icon: Mail,    color: 'text-emerald-500', bg: 'bg-emerald-50', badge: 'חדש' },
  { id: 'gmail'      as const, label: 'סנכרון Gmail',        icon: Mail,    color: 'text-red-500',     bg: 'bg-red-50' },
  { id: 'notifications' as const, label: 'התראות',           icon: Bell,    color: 'text-purple-500',  bg: 'bg-purple-50' },
  { id: 'security'   as const, label: 'אבטחה ופרטיות',      icon: Shield,  color: 'text-green-500',   bg: 'bg-green-50' },
  { id: 'about'      as const, label: 'אודות',               icon: Info,    color: 'text-gray-500',    bg: 'bg-gray-50' },
]

const CURRENCIES = [
  { code: 'ILS', name: 'שקל ישראלי',       symbol: '₪',   flag: '🇮🇱' },
  { code: 'USD', name: 'דולר אמריקאי',      symbol: '$',   flag: '🇺🇸' },
  { code: 'EUR', name: 'יורו',              symbol: '€',   flag: '🇪🇺' },
  { code: 'GBP', name: 'לירה שטרלינג',     symbol: '£',   flag: '🇬🇧' },
  { code: 'THB', name: 'בהט תאילנדי',      symbol: '฿',   flag: '🇹🇭' },
  { code: 'JPY', name: 'ין יפני',           symbol: '¥',   flag: '🇯🇵' },
  { code: 'AUD', name: 'דולר אוסטרלי',     symbol: 'A$',  flag: '🇦🇺' },
  { code: 'CAD', name: 'דולר קנדי',        symbol: 'C$',  flag: '🇨🇦' },
  { code: 'CHF', name: 'פרנק שווייצרי',    symbol: 'CHF', flag: '🇨🇭' },
  { code: 'TRY', name: 'לירה טורקית',      symbol: '₺',   flag: '🇹🇷' },
  { code: 'INR', name: 'רופי הודי',        symbol: '₹',   flag: '🇮🇳' },
  { code: 'BRL', name: 'ריאל ברזילאי',     symbol: 'R$',  flag: '🇧🇷' },
]

// ─── Regular Traveler interface ────────────────────────────────────────────────
interface RegularTraveler {
  id: string
  firstName: string
  lastName: string
  passportNumber: string
  nationality: string
  dateOfBirth: string
  validUntil: string
  gender: string
  issuingCountry: string
  issueDate: string
}

const emptyTraveler = (): RegularTraveler => ({
  id: `rt_${Date.now()}`,
  firstName: '',
  lastName: '',
  passportNumber: '',
  nationality: '',
  dateOfBirth: '',
  validUntil: '',
  gender: '',
  issuingCountry: '',
  issueDate: '',
})

// ─── Currency sub-page ─────────────────────────────────────────────────────────
interface CurrencyRow { code: string; name: string; symbol: string; flag: string }
interface RateData { code: string; rateFromIls: number; rateToIls: number }

function CurrencySettingsPage({
  defaultCurrency, onChangeCurrency, currencies,
}: { defaultCurrency: string; onChangeCurrency: (code: string) => void; currencies: CurrencyRow[] }) {
  const [rates, setRates] = useState<RateData[]>([])
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesUpdated, setRatesUpdated] = useState<string | null>(null)
  const [baseCurrency, setBaseCurrency] = useState('ILS')

  const fetchRates = async () => {
    setRatesLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`https://api.frankfurter.app/${today}?from=ILS&to=USD,EUR,GBP,THB,JPY,AUD,CAD,CHF,TRY,INR`)
      if (res.ok) {
        const data = await res.json()
        const fetched: RateData[] = Object.entries(data.rates || {}).map(([code, rateFromIls]) => ({
          code,
          rateFromIls: Number(rateFromIls),
          rateToIls: 1 / Number(rateFromIls),
        }))
        setRates(fetched)
        setRatesUpdated(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch { /* silent */ } finally { setRatesLoading(false) }
  }

  useEffect(() => { fetchRates() }, [])

  const getDisplayRate = (r: RateData) => {
    if (baseCurrency === 'ILS') return { label: `1 ₪ = ${r.rateFromIls.toFixed(r.rateFromIls < 0.01 ? 4 : r.rateFromIls < 1 ? 3 : 2)} ${r.code}` }
    if (baseCurrency === r.code) return { label: `1 ${r.code} = ${r.rateToIls.toFixed(2)} ₪` }
    const targetRate = rates.find(x => x.code === baseCurrency)
    if (!targetRate) return { label: '—' }
    const cross = r.rateFromIls / targetRate.rateFromIls
    return { label: `1 ${baseCurrency} = ${cross.toFixed(2)} ${r.code}` }
  }

  const RATE_NAMES: Record<string, string> = {
    USD: '🇺🇸 דולר אמריקאי', EUR: '🇪🇺 יורו',      GBP: '🇬🇧 לירה שטרלינג',
    THB: '🇹🇭 בהט תאילנדי',   JPY: '🇯🇵 ין יפני',   AUD: '🇦🇺 דולר אוסטרלי',
    CAD: '🇨🇦 דולר קנדי',     CHF: '🇨🇭 פרנק שווייצרי', TRY: '🇹🇷 לירה טורקית',
    INR: '🇮🇳 רופי הודי',
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" dir="rtl">
      <h1 className="text-xl font-bold">מטבע ומחירים</h1>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 px-1">מטבע תצוגה ברירת מחדל</p>
        {currencies.map(c => (
          <button key={c.code} onClick={() => onChangeCurrency(c.code)}
            className={`w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all ${defaultCurrency === c.code ? 'ring-2 ring-primary' : ''}`}>
            <span className="text-2xl">{c.flag}</span>
            <div className="flex-1 text-right">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-gray-400">{c.code} · {c.symbol}</p>
            </div>
            {defaultCurrency === c.code && (
              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-500">שערי חליפין בזמן אמת</p>
          <div className="flex items-center gap-2">
            {ratesUpdated && <span className="text-[10px] text-gray-400">עודכן: {ratesUpdated}</span>}
            <button onClick={fetchRates} disabled={ratesLoading}
              className="text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg active:scale-95 disabled:opacity-50">
              {ratesLoading ? '...' : '🔄 עדכן'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {['ILS', 'USD', 'EUR', 'GBP', 'THB'].map(b => (
            <button key={b} onClick={() => setBaseCurrency(b)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${baseCurrency === b ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 shadow-sm'}`}>
              {b}
            </button>
          ))}
        </div>

        {ratesLoading ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 mt-2">טוען שערים...</p>
          </div>
        ) : rates.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {rates.filter(r => baseCurrency === 'ILS' || r.code !== baseCurrency).map((r, i, arr) => (
              <div key={r.code} className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-xl flex-shrink-0">{RATE_NAMES[r.code]?.split(' ')[0] || '💱'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{RATE_NAMES[r.code]?.slice(3) || r.code}</p>
                  <p className="text-[11px] text-gray-500" dir="ltr">{getDisplayRate(r).label}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">
                    {baseCurrency === 'ILS'
                      ? r.rateFromIls.toFixed(r.rateFromIls < 0.01 ? 4 : r.rateFromIls < 1 ? 3 : 2)
                      : getDisplayRate(r).label.split('= ')[1]?.split(' ')[0] || '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">{r.code}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="text-sm text-gray-400">לא ניתן לטעון שערים</p>
            <button onClick={fetchRates} className="text-primary text-sm font-medium mt-2 active:scale-95">נסה שוב</button>
          </div>
        )}
        <p className="text-[10px] text-gray-400 text-center">מקור: Frankfurter / ECB · שערים לצורך מידע בלבד</p>
      </div>
    </motion.div>
  )
}

// ─── Regular Travelers sub-page ────────────────────────────────────────────────
function TravelersSettingsPage({ userId }: { userId: string }) {
  const [travelers, setTravelers] = useState<RegularTraveler[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [addMode, setAddMode] = useState<'manual' | 'scan'>('manual')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RegularTraveler>(emptyTraveler())
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const storageKey = `tripix_travelers_${userId}`

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try { setTravelers(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [storageKey])

  const persist = (list: RegularTraveler[]) => {
    setTravelers(list)
    localStorage.setItem(storageKey, JSON.stringify(list))
  }

  const handleScan = async (file: File) => {
    setScanning(true)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''))
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type, context: 'document' }),
      })
      const json = await res.json()
      if (json.data) {
        const d = json.data
        setForm(prev => ({
          ...prev,
          firstName:      d.first_name      || prev.firstName,
          lastName:       d.last_name       || prev.lastName,
          passportNumber: d.passport_number || prev.passportNumber,
          nationality:    d.nationality     || prev.nationality,
          dateOfBirth:    d.date_of_birth   || prev.dateOfBirth,
          validUntil:     d.valid_until     || prev.validUntil,
          gender:         d.gender          || prev.gender,
          issuingCountry: d.issuing_country || prev.issuingCountry,
          issueDate:      d.issue_date      || prev.issueDate,
        }))
        setAddMode('manual')
        toast.success('פרטי הדרכון נקלטו — אנא בדוק ואשר')
      }
    } catch {
      toast.error('שגיאה בסריקת הדרכון')
    } finally {
      setScanning(false)
    }
  }

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('שם פרטי ושם משפחה חובה')
      return
    }
    setSaving(true)
    try {
      let updated: RegularTraveler[]
      if (editingId) {
        updated = travelers.map(t => t.id === editingId ? { ...form, id: editingId } : t)
      } else {
        updated = [...travelers, { ...form, id: `rt_${Date.now()}` }]
      }
      persist(updated)
      setShowAddForm(false)
      setEditingId(null)
      setForm(emptyTraveler())
      toast.success(editingId ? 'נוסע עודכן' : 'נוסע נוסף בהצלחה')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (t: RegularTraveler) => {
    setForm({ ...t })
    setEditingId(t.id)
    setAddMode('manual')
    setShowAddForm(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('למחוק נוסע זה?')) return
    persist(travelers.filter(t => t.id !== id))
    toast.success('נוסע הוסר')
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingId(null)
    setForm(emptyTraveler())
  }

  const isExpiringSoon = (validUntil: string) => {
    if (!validUntil) return false
    const diff = new Date(validUntil).getTime() - Date.now()
    return diff < 180 * 24 * 60 * 60 * 1000 // 6 months
  }

  const inputClass = 'w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-primary/20 transition-all'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">נוסעים קבועים</h1>
        {!showAddForm && (
          <button
            onClick={() => { setForm(emptyTraveler()); setEditingId(null); setShowAddForm(true) }}
            className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-2xl active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <Plus className="w-4 h-4" />
            הוסף נוסע
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        שמור נוסעים קבועים עם פרטי דרכון — יהיו זמינים בכל טיול חדש שתיצור
      </p>

      {/* Travelers list */}
      {travelers.length > 0 && (
        <div className="space-y-3">
          {travelers.map(t => (
            <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                  {(t.firstName.charAt(0) || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{t.firstName} {t.lastName}</p>
                  {t.passportNumber && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono" dir="ltr">
                      🛂 {t.passportNumber.slice(0, 2)}{'*'.repeat(Math.max(0, t.passportNumber.length - 4))}{t.passportNumber.slice(-2)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {t.nationality && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.nationality}</span>
                    )}
                    {t.validUntil && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isExpiringSoon(t.validUntil) ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isExpiringSoon(t.validUntil) ? '⚠️ ' : '✓ '}תוקף: {t.validUntil}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleEdit(t)}
                    className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center active:scale-90 transition-all">
                    <Edit3 className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center active:scale-90 transition-all">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {travelers.length === 0 && !showAddForm && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">אין נוסעים קבועים עדיין</p>
          <p className="text-xs text-gray-400">הוסף נוסעים כדי לקצר את תהליך יצירת הטיול</p>
        </div>
      )}

      {/* Add / Edit form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">{editingId ? 'עריכת נוסע' : 'הוספת נוסע חדש'}</h2>
            </div>

            {/* Mode toggle */}
            {!editingId && (
              <div className="flex gap-2 p-1 bg-surface-secondary rounded-2xl">
                <button onClick={() => setAddMode('manual')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${addMode === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}>
                  <Edit3 className="w-3.5 h-3.5" />
                  מלא ידנית
                </button>
                <button onClick={() => { setAddMode('scan'); setTimeout(() => fileRef.current?.click(), 100) }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${addMode === 'scan' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}>
                  {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  סרוק דרכון
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f); e.target.value = '' }} />

            {/* Scan CTA */}
            {addMode === 'scan' && !scanning && (
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-primary/30 rounded-2xl py-6 flex flex-col items-center gap-2 bg-primary/5 active:scale-[0.98] transition-all">
                <ScanLine className="w-8 h-8 text-primary/60" />
                <p className="text-sm font-bold text-primary/80">בחר תמונת דרכון או PDF</p>
                <p className="text-xs text-gray-400">פרטים יחולצו אוטומטית על ידי AI</p>
              </button>
            )}

            {scanning && (
              <div className="flex flex-col items-center gap-2 py-6">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-gray-500">מנתח את הדרכון...</p>
              </div>
            )}

            {/* Manual form (always shown after scan extraction) */}
            {addMode === 'manual' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="שם פרטי *" dir="ltr" className={`flex-1 ${inputClass}`} />
                  <input type="text" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                    placeholder="שם משפחה *" dir="ltr" className={`flex-1 ${inputClass}`} />
                </div>
                <input type="text" value={form.passportNumber} onChange={e => setForm(p => ({ ...p, passportNumber: e.target.value }))}
                  placeholder="מספר דרכון" dir="ltr" className={inputClass} />
                <div className="flex gap-2">
                  <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                    className={`flex-1 ${inputClass}`}>
                    <option value="">מין</option>
                    <option value="M">זכר</option>
                    <option value="F">נקבה</option>
                  </select>
                  <input type="text" value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))}
                    placeholder="לאומיות" dir="ltr" className={`flex-1 ${inputClass}`} />
                </div>
                <input type="text" value={form.issuingCountry} onChange={e => setForm(p => ({ ...p, issuingCountry: e.target.value }))}
                  placeholder="מדינה מנפיקה" dir="ltr" className={inputClass} />
                <div>
                  <label className="text-xs text-gray-500 font-medium px-1">תאריך לידה</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
                    className={inputClass} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 font-medium px-1">תאריך הנפקה</label>
                    <input type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))}
                      className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 font-medium px-1">תוקף עד</label>
                    <input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))}
                      className={inputClass} />
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!scanning && addMode === 'manual' && (
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving || !form.firstName.trim() || !form.lastName.trim()}
                  className="flex-1 text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                  {saving ? 'שומר...' : editingId ? 'שמור שינויים' : 'הוסף נוסע'}
                </button>
                <button onClick={handleCancel} className="px-5 bg-gray-100 rounded-2xl py-3 text-gray-500 font-medium active:scale-95">
                  ביטול
                </button>
              </div>
            )}

            {addMode === 'scan' && !scanning && (
              <button onClick={handleCancel} className="w-full bg-gray-100 rounded-2xl py-3 text-gray-500 font-medium active:scale-95">
                ביטול
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info note */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
        <p className="text-xs text-primary/80 font-medium">💡 טיפ</p>
        <p className="text-xs text-gray-500 mt-1">
          הנוסעים יהיו זמינים לבחירה בכל טיול חדש שתיצור. הפרטים נשמרים רק במכשיר זה.
        </p>
      </div>
    </motion.div>
  )
}

// ─── Main Settings Page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, displayName } = useAuth()
  const [page, setPage] = useState<SettingsPage>('main')
  const [defaultCurrency, setDefaultCurrency] = useState('ILS')
  const [inboxKey, setInboxKey] = useState<string | null>(null)
  const [inboxCopied, setInboxCopied] = useState(false)
  const [primaryEmail, setPrimaryEmail] = useState<string>('')
  interface EmailAlias { id: string; email: string; label: string; verified: boolean }
  const [aliases, setAliases] = useState<EmailAlias[]>([])
  const [newAliasEmail, setNewAliasEmail] = useState('')
  const [newAliasLabel, setNewAliasLabel] = useState('personal')
  const [addingAlias, setAddingAlias] = useState(false)
  const [showAddAlias, setShowAddAlias] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Account editing state
  const [editName, setEditName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password change state
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!u) return
        setCurrentUserId(u.id)
        setPrimaryEmail(u.email || '')
        setEditName(u.user_metadata?.full_name || displayName || '')
        const { data } = await supabase.from('profiles').select('inbox_key').eq('id', u.id).single()
        if (data?.inbox_key) setInboxKey(data.inbox_key)
      } catch { /* silent */ }
    }
    const fetchAliases = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch('/api/email-aliases', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (res.ok) setAliases((await res.json()).aliases || [])
      } catch { /* silent */ }
    }
    fetchUserData()
    fetchAliases()
    const saved = localStorage.getItem('tripix_default_currency')
    if (saved) setDefaultCurrency(saved)
  }, [displayName])

  const inboxEmail = inboxKey ? `${inboxKey}@in.tripix.app` : null

  const copyInboxEmail = async () => {
    if (!inboxEmail) return
    await navigator.clipboard.writeText(inboxEmail)
    setInboxCopied(true)
    setTimeout(() => setInboxCopied(false), 2500)
  }

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: editName } })
      if (authError) throw authError
      if (currentUserId) {
        await supabase.from('profiles').upsert({ id: currentUserId, full_name: editName }, { onConflict: 'id' })
      }
      toast.success('הפרופיל עודכן בהצלחה')
    } catch {
      toast.error('שגיאה בשמירת הפרופיל')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPass || newPass !== confirmPass) {
      toast.error('הסיסמאות אינן תואמות')
      return
    }
    if (newPass.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    setSavingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      toast.success('הסיסמה עודכנה בהצלחה')
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה בשינוי הסיסמה'
      toast.error(msg)
    } finally {
      setSavingPass(false)
    }
  }

  const handleAddAlias = async () => {
    if (!newAliasEmail) return
    setAddingAlias(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/email-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newAliasEmail, label: newAliasLabel }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(json.message || 'נשלח מייל אישור')
      setNewAliasEmail('')
      setShowAddAlias(false)
      const r2 = await fetch('/api/email-aliases', { headers: { Authorization: `Bearer ${token}` } })
      if (r2.ok) setAliases((await r2.json()).aliases || [])
    } catch { toast.error('שגיאה') } finally { setAddingAlias(false) }
  }

  const handleRemoveAlias = async (id: string, email: string) => {
    if (!confirm(`הסר את ${email}?`)) return
    const token = await getToken()
    const res = await fetch('/api/email-aliases', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setAliases(prev => prev.filter(a => a.id !== id))
      toast.success('הוסר')
    }
  }

  const LABEL_MAP: Record<string, string> = { personal: '🏠 פרטי', work: '💼 עסקי', other: '📌 אחר' }

  const inputClass = 'w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-primary/20 transition-all'

  if (page !== 'main') {
    return (
      <div className="space-y-4">
        <button onClick={() => setPage('main')}
          className="flex items-center gap-2 text-primary text-sm font-medium active:scale-95 transition-transform">
          <ChevronLeft className="w-4 h-4" />
          חזרה להגדרות
        </button>

        {/* ── Account page ────────────────────────────────────────── */}
        {page === 'account' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">פרטי חשבון</h1>

            {/* Avatar + name */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black"
                  style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                  {(editName || displayName || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{displayName || 'משתמש'}</p>
                  <p className="text-xs text-gray-400">{primaryEmail}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium px-1">שם תצוגה</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="שם מלא" className={`mt-1 ${inputClass}`} />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium px-1">כתובת מייל</label>
                <div className="mt-1 bg-surface-secondary rounded-2xl px-4 py-3 text-sm text-gray-400 font-medium" dir="ltr">
                  {primaryEmail}
                </div>
              </div>

              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="w-full text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                <Save className="w-4 h-4" />
                {savingProfile ? 'שומר...' : 'שמור פרופיל'}
              </button>
            </div>

            {/* Change password */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Lock className="w-4 h-4 text-orange-500" />
                </div>
                <p className="font-bold text-sm">שינוי סיסמה</p>
              </div>

              <div className="relative">
                <label className="text-xs text-gray-500 font-medium px-1">סיסמה חדשה</label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="לפחות 6 תווים"
                  className={`mt-1 ${inputClass} pl-10`}
                  dir="ltr"
                />
                <button
                  onClick={() => setShowNewPass(v => !v)}
                  className="absolute left-3 bottom-3 text-gray-400 active:scale-90">
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium px-1">אימות סיסמה</label>
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="הזן סיסמה שוב"
                  className={`mt-1 ${inputClass}`}
                  dir="ltr"
                />
              </div>

              {newPass && confirmPass && newPass !== confirmPass && (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-xs">הסיסמאות אינן תואמות</p>
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={savingPass || !newPass || !confirmPass || newPass !== confirmPass}
                className="w-full text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)' }}>
                {savingPass ? 'משנה סיסמה...' : 'שנה סיסמה'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Travelers page ───────────────────────────────────────── */}
        {page === 'travelers' && currentUserId && (
          <TravelersSettingsPage userId={currentUserId} />
        )}

        {/* ── Notifications ────────────────────────────────────────── */}
        {page === 'notifications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">התראות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Bell className="w-10 h-10 text-purple-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {/* ── Security ─────────────────────────────────────────────── */}
        {page === 'security' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">אבטחה ופרטיות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Shield className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {/* ── Email Inbox ──────────────────────────────────────────── */}
        {page === 'email_inbox' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold">📬 חיבור מייל חכם</h1>
              <p className="text-xs text-gray-500 mt-1">קבל אישורי הזמנה ישירות לטיול — אוטומטי לחלוטין</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5" />
                <span className="font-bold text-sm">כתובת המייל האישית שלך</span>
              </div>
              {inboxEmail ? (
                <>
                  <div className="bg-white/20 rounded-xl px-4 py-3 font-mono text-sm break-all mt-2 mb-3" dir="ltr">{inboxEmail}</div>
                  <button onClick={copyInboxEmail}
                    className="flex items-center gap-2 bg-white/25 hover:bg-white/35 active:scale-95 transition-all rounded-xl px-4 py-2 text-sm font-medium w-full justify-center">
                    {inboxCopied ? <><CheckCheck className="w-4 h-4" /> הועתק!</> : <><Copy className="w-4 h-4" /> העתק כתובת</>}
                  </button>
                </>
              ) : (
                <p className="text-white/70 text-sm mt-2">טוען...</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="font-bold text-sm">איך זה עובד? 🤔</p>
              {[
                { step: '1', title: 'העתק את הכתובת', desc: 'העתק את כתובת המייל האישית שלמעלה', icon: '📋' },
                { step: '2', title: 'הוסף ל-BCC', desc: 'כשאתה מזמין מלון, טיסה, שכירות רכב — הוסף לשדה BCC לפני השליחה', icon: '✉️' },
                { step: '3', title: 'Tripix יעשה את השאר', desc: 'המערכת תנתח את המייל ותוסיף את ההוצאה אוטומטית', icon: '🤖' },
                { step: '4', title: 'בדוק ואשר', desc: 'תקבל עדכון בטיול שלך — אפשר לשנות בקלות אם צריך', icon: '✅' },
              ].map(item => (
                <div key={item.step} className="flex gap-3 items-start">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-bold text-sm mb-3">פלטפורמות נתמכות 🌐</p>
              <div className="flex flex-wrap gap-2">
                {['Booking.com','Airbnb','Expedia','Hotels.com','אל-על','Ryanair','EasyJet','Wizzair','Rentalcars','Avis','Hertz','GetYourGuide','Viator','eDreams','Trip.com'].map(p => (
                  <span key={p} className="bg-gray-50 text-gray-600 text-xs px-3 py-1 rounded-full border border-gray-200">{p}</span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">📧 מיילים מקושרים</p>
                <button onClick={() => setShowAddAlias(v => !v)}
                  className="text-xs text-primary font-semibold bg-primary/10 px-3 py-1.5 rounded-xl active:scale-95">
                  + הוסף מייל
                </button>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate" dir="ltr">{primaryEmail}</p>
                  <p className="text-[11px] text-gray-400">מייל ראשי</p>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">✓ ראשי</span>
              </div>
              {aliases.map(alias => (
                <div key={alias.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate" dir="ltr">{alias.email}</p>
                    <p className="text-[11px] text-gray-400">{LABEL_MAP[alias.label] || alias.label}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${alias.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {alias.verified ? '✓ מאושר' : '⏳ ממתין'}
                  </span>
                  <button onClick={() => handleRemoveAlias(alias.id, alias.email)} className="text-red-400 active:scale-90 text-xs px-1">✕</button>
                </div>
              ))}
              {showAddAlias && (
                <div className="border border-dashed border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
                  <p className="text-xs font-bold text-primary">הוספת מייל חדש</p>
                  <input type="email" value={newAliasEmail} onChange={e => setNewAliasEmail(e.target.value)}
                    placeholder="your@email.com" dir="ltr"
                    className="w-full bg-white rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 focus:ring-2 focus:ring-primary/20 text-left" />
                  <div className="flex gap-2">
                    {(['personal', 'work', 'other'] as const).map(l => (
                      <button key={l} onClick={() => setNewAliasLabel(l)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${newAliasLabel === l ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                        {LABEL_MAP[l]}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleAddAlias} disabled={addingAlias || !newAliasEmail}
                    className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold active:scale-95 disabled:opacity-50">
                    {addingAlias ? 'שולח אישור...' : 'שלח מייל אישור'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Gmail ───────────────────────────────────────────────── */}
        {page === 'gmail' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold">סנכרון Gmail</h1>
              <p className="text-xs text-gray-500 mt-1">חבר את Gmail לסריקה אוטומטית של אישורי הזמנות</p>
            </div>
            {currentUserId ? <GmailConnect userId={currentUserId} /> : (
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center text-sm text-gray-400">טוען...</div>
            )}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs text-blue-800 font-medium">🔐 פרטיות ואבטחה</p>
              <p className="text-xs text-blue-700 mt-1">Tripix מבקש גישת קריאה בלבד. אנחנו לא שולחים, מוחקים או משנים מיילים.</p>
            </div>
          </motion.div>
        )}

        {/* ── Currency ─────────────────────────────────────────────── */}
        {page === 'currency' && (
          <CurrencySettingsPage
            defaultCurrency={defaultCurrency}
            onChangeCurrency={(code) => {
              setDefaultCurrency(code)
              localStorage.setItem('tripix_default_currency', code)
              toast.success(`מטבע ברירת מחדל: ${code}`)
            }}
            currencies={CURRENCIES}
          />
        )}

        {/* ── About ────────────────────────────────────────────────── */}
        {page === 'about' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">אודות Tripix</h1>

            {/* Hero card */}
            <div className="rounded-2xl p-6 text-white text-center"
              style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
              <p className="text-3xl font-black tracking-tight mb-1">Tripix</p>
              <p className="text-white/80 text-sm">מנהל הטיול החכם שלך</p>
              <div className="mt-3 bg-white/20 rounded-xl px-4 py-1.5 inline-block">
                <p className="text-xs font-bold">גרסה 1.0.0</p>
              </div>
            </div>

            {/* What is Tripix */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <p className="font-bold text-sm">מה זה Tripix? ✈️</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Tripix הוא אפליקציית ניהול נסיעות חכמה שמאחדת את כל הכלים שאתה צריך לטיול מושלם:
                מעקב הוצאות, ניהול מסמכים, עוזר AI, לוח מסע ועוד — הכל במקום אחד.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { icon: '🤖', label: 'עוזר AI חכם' },
                  { icon: '📊', label: 'מעקב הוצאות' },
                  { icon: '📄', label: 'ניהול מסמכים' },
                  { icon: '🗓️', label: 'לוח מסע' },
                  { icon: '🌤️', label: 'מזג אוויר' },
                  { icon: '💱', label: 'המרת מטבע' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2 bg-surface-secondary rounded-xl px-3 py-2.5">
                    <span className="text-base">{f.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical info */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <p className="font-bold text-sm">פרטים טכניים 🛠️</p>
              {[
                { label: 'גרסה',      value: '1.0.0' },
                { label: 'פלטפורמה', value: 'PWA (Progressive Web App)' },
                { label: 'AI Engine', value: 'Anthropic Claude' },
                { label: 'Backend',   value: 'Supabase' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-xs font-medium text-gray-800" dir="ltr">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Legal */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-2">
              <p className="font-bold text-sm">משפטי ⚖️</p>
              <button className="w-full text-right text-xs text-primary font-medium py-1 active:scale-95">תנאי שימוש</button>
              <div className="border-b border-gray-50" />
              <button className="w-full text-right text-xs text-primary font-medium py-1 active:scale-95">מדיניות פרטיות</button>
            </div>

            <p className="text-[10px] text-gray-300 text-center pb-2">
              נבנה עם ❤️ · Tripix © 2025
            </p>
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black"
          style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
          {(displayName || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-800">{displayName || 'משתמש'}</p>
          <p className="text-xs text-gray-400">{primaryEmail || 'טוען...'}</p>
        </div>
      </div>

      <h1 className="text-xl font-bold">הגדרות</h1>

      <div className="space-y-2">
        {MENU_ITEMS.map((item) => (
          <button key={item.id} onClick={() => setPage(item.id)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
            <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <span className="flex-1 text-sm font-medium text-right">{item.label}</span>
            {'badge' in item && item.badge && (
              <span className="bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
            <ChevronLeft className="w-4 h-4 text-gray-300" />
          </button>
        ))}

        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/auth/login' }}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform mt-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <span className="flex-1 text-sm font-medium text-right text-red-500">התנתקות</span>
        </button>
      </div>
    </div>
  )
}
