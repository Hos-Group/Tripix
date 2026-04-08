'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Bell, Shield, Info, LogOut, ChevronLeft, Save, Users, Coins, Mail, Copy, CheckCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { invalidateTravelersCache } from '@/lib/travelers'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import GmailConnect from '@/components/GmailConnect'

type SettingsPage = 'main' | 'account' | 'password' | 'notifications' | 'security' | 'about' | 'currency' | 'email_inbox' | 'gmail'

const MENU_ITEMS = [
  { id: 'account' as const, label: 'פרטי חשבון', icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'currency' as const, label: 'מטבע ברירת מחדל', icon: Coins, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'email_inbox' as const, label: 'חיבור מייל חכם', icon: Mail, color: 'text-emerald-500', bg: 'bg-emerald-50', badge: 'חדש' },
  { id: 'gmail' as const, label: 'סנכרון Gmail', icon: Mail, color: 'text-red-500', bg: 'bg-red-50', badge: 'חדש' },
  { id: 'password' as const, label: 'שינוי סיסמא', icon: Lock, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'notifications' as const, label: 'התראות', icon: Bell, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'security' as const, label: 'אבטחה ופרטיות', icon: Shield, color: 'text-green-500', bg: 'bg-green-50' },
  { id: 'about' as const, label: 'אודות', icon: Info, color: 'text-gray-500', bg: 'bg-gray-50' },
]

const CURRENCIES = [
  { code: 'ILS', name: 'שקל ישראלי', symbol: '₪', flag: '🇮🇱' },
  { code: 'USD', name: 'דולר אמריקאי', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'יורו', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'לירה שטרלינג', symbol: '£', flag: '🇬🇧' },
  { code: 'THB', name: 'בהט תאילנדי', symbol: '฿', flag: '🇹🇭' },
  { code: 'JPY', name: 'ין יפני', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'דולר אוסטרלי', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'דולר קנדי', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'פרנק שווייצרי', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'TRY', name: 'לירה טורקית', symbol: '₺', flag: '🇹🇷' },
  { code: 'INR', name: 'רופי הודי', symbol: '₹', flag: '🇮🇳' },
  { code: 'BRL', name: 'ריאל ברזילאי', symbol: 'R$', flag: '🇧🇷' },
]

interface Traveler {
  id: string
  name: string
}

// ── Currency settings sub-page with live rates ────────────────────────────────
interface CurrencyRow { code: string; name: string; symbol: string; flag: string }

interface RateData {
  code:    string
  rateFromIls: number  // how many of this currency = 1 ILS
  rateToIls:   number  // how many ILS = 1 unit of this currency
}

function CurrencySettingsPage({
  defaultCurrency,
  onChangeCurrency,
  currencies,
}: {
  defaultCurrency: string
  onChangeCurrency: (code: string) => void
  currencies: CurrencyRow[]
}) {
  const [rates,      setRates]      = useState<RateData[]>([])
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesUpdated, setRatesUpdated] = useState<string | null>(null)
  const [baseCurrency, setBaseCurrency] = useState('ILS')

  const fetchRates = async () => {
    setRatesLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      // Use frankfurter.app — free, no key needed
      // Get all rates FROM ILS in one call
      const res = await fetch(`https://api.frankfurter.app/${today}?from=ILS&to=USD,EUR,GBP,THB,JPY,AUD,CAD,CHF,TRY,INR`)
      if (res.ok) {
        const data = await res.json()
        const fetched: RateData[] = Object.entries(data.rates || {}).map(([code, rateFromIls]) => ({
          code,
          rateFromIls: Number(rateFromIls),
          rateToIls:   1 / Number(rateFromIls),
        }))
        setRates(fetched)
        setRatesUpdated(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch { /* silent */ } finally {
      setRatesLoading(false)
    }
  }

  useEffect(() => { fetchRates() }, [])

  // Build display: how much of `baseCurrency` you get for 1 ILS, or vice-versa
  const getDisplayRate = (r: RateData) => {
    if (baseCurrency === 'ILS') {
      // 1 ILS = X foreign
      return { label: `1 ₪ = ${r.rateFromIls.toFixed(r.rateFromIls < 0.01 ? 4 : r.rateFromIls < 1 ? 3 : 2)} ${r.code}` }
    } else if (baseCurrency === r.code) {
      return { label: `1 ${r.code} = ${r.rateToIls.toFixed(2)} ₪` }
    }
    // Cross rate: find both from ILS
    const targetRate = rates.find(x => x.code === baseCurrency)
    if (!targetRate) return { label: '—' }
    const cross = r.rateFromIls / targetRate.rateFromIls
    return { label: `1 ${baseCurrency} = ${cross.toFixed(2)} ${r.code}` }
  }

  const RATE_NAMES: Record<string, string> = {
    USD: '🇺🇸 דולר אמריקאי', EUR: '🇪🇺 יורו', GBP: '🇬🇧 לירה שטרלינג',
    THB: '🇹🇭 בהט תאילנדי',   JPY: '🇯🇵 ין יפני',   AUD: '🇦🇺 דולר אוסטרלי',
    CAD: '🇨🇦 דולר קנדי',     CHF: '🇨🇭 פרנק שווייצרי', TRY: '🇹🇷 לירה טורקית',
    INR: '🇮🇳 רופי הודי',
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" dir="rtl">
      <h1 className="text-xl font-bold">מטבע ומחירים</h1>

      {/* ── Default currency picker ──────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 px-1">מטבע תצוגה ברירת מחדל</p>
        {currencies.map(c => (
          <button key={c.code}
            onClick={() => onChangeCurrency(c.code)}
            className={`w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all ${
              defaultCurrency === c.code ? 'ring-2 ring-primary' : ''
            }`}>
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

      {/* ── Live exchange rates ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-500">שערי חליפין בזמן אמת</p>
          <div className="flex items-center gap-2">
            {ratesUpdated && (
              <span className="text-[10px] text-gray-400">עודכן: {ratesUpdated}</span>
            )}
            <button
              onClick={fetchRates}
              disabled={ratesLoading}
              className="text-[11px] text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg active:scale-95 disabled:opacity-50"
            >
              {ratesLoading ? '...' : '🔄 עדכן'}
            </button>
          </div>
        </div>

        {/* Base currency selector */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {['ILS', 'USD', 'EUR', 'GBP', 'THB'].map(b => (
            <button key={b}
              onClick={() => setBaseCurrency(b)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                baseCurrency === b ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 shadow-sm'
              }`}>
              {b}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 px-1">
          מציג שערים יחסית ל-{baseCurrency === 'ILS' ? 'שקל ישראלי' : baseCurrency}
        </p>

        {ratesLoading ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 mt-2">טוען שערים...</p>
          </div>
        ) : rates.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {rates
              .filter(r => baseCurrency === 'ILS' || r.code !== baseCurrency)
              .map((r, i, arr) => {
                const display = getDisplayRate(r)
                const isPositive = true // rates are always positive
                return (
                  <div key={r.code}
                    className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <span className="text-xl flex-shrink-0">{RATE_NAMES[r.code]?.split(' ')[0] || '💱'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">
                        {RATE_NAMES[r.code]?.slice(3) || r.code}
                      </p>
                      <p className="text-[11px] text-gray-500" dir="ltr">{display.label}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {baseCurrency === 'ILS' ? (
                        <p className="text-sm font-bold text-gray-800">
                          {r.rateFromIls.toFixed(r.rateFromIls < 0.01 ? 4 : r.rateFromIls < 1 ? 3 : 2)}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-gray-800">
                          {getDisplayRate(r).label.split('= ')[1]?.split(' ')[0] || '—'}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">{r.code}</p>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="text-sm text-gray-400">לא ניתן לטעון שערים — בדוק חיבור לאינטרנט</p>
            <button onClick={fetchRates} className="text-primary text-sm font-medium mt-2 active:scale-95">נסה שוב</button>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center">
          מקור: Frankfurter / ECB · שערים לצורך מידע בלבד
        </p>
      </div>
    </motion.div>
  )
}

export default function SettingsPage() {
  const [page, setPage] = useState<SettingsPage>('main')
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const [savingTravelers, setSavingTravelers] = useState(false)
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

  useEffect(() => {
    const fetchTravelers = async () => {
      try {
        const { data } = await supabase.from('trips').select('travelers').limit(1).single()
        if (data?.travelers) {
          setTravelers(data.travelers as Traveler[])
        }
      } catch {
        console.error('Failed to load travelers')
      }
    }
    const fetchInboxKey = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setCurrentUserId(user.id)
        setPrimaryEmail(user.email || '')
        const { data } = await supabase
          .from('profiles')
          .select('inbox_key')
          .eq('id', user.id)
          .single()
        if (data?.inbox_key) setInboxKey(data.inbox_key)
      } catch {
        console.error('Failed to load inbox key')
      }
    }
    const fetchAliases = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch('/api/email-aliases', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const json = await res.json()
          setAliases(json.aliases || [])
        }
      } catch { /* silent */ }
    }
    fetchTravelers()
    fetchInboxKey()
    fetchAliases()
    // Load saved currency preference
    const saved = localStorage.getItem('tripix_default_currency')
    if (saved) setDefaultCurrency(saved)
  }, [])

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

  const LABEL_MAP: Record<string, string> = {
    personal: '🏠 פרטי',
    work:     '💼 עסקי',
    other:    '📌 אחר',
  }

  const handleSaveTravelers = async () => {
    setSavingTravelers(true)
    try {
      const { error } = await supabase
        .from('trips')
        .update({ travelers })
        .not('id', 'is', null)
      if (error) throw error
      invalidateTravelersCache()
      toast.success('שמות הנוסעים עודכנו')
    } catch {
      toast.error('שגיאה בשמירה')
    }
    setSavingTravelers(false)
  }

  if (page !== 'main') {
    return (
      <div className="space-y-4">
        <button onClick={() => setPage('main')}
          className="flex items-center gap-2 text-primary text-sm font-medium active:scale-95 transition-transform">
          <ChevronLeft className="w-4 h-4" />
          חזרה להגדרות
        </button>

        {page === 'account' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">פרטי חשבון</h1>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold">נוסעים</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-3">שמות באנגלית בלבד — כפי שמופיע בדרכון</p>

              {travelers.map((t, i) => (
                <div key={t.id} className="flex gap-2 items-center">
                  <span className="text-xs text-primary font-medium w-16 flex-shrink-0">
                    {i === 0 ? 'נוסע ראשי' : `נוסע ${i + 1}`}
                  </span>
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) => {
                      const updated = [...travelers]
                      updated[i] = { ...updated[i], name: e.target.value }
                      setTravelers(updated)
                    }}
                    placeholder="Full name in English"
                    dir="ltr"
                    className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left"
                  />
                  {travelers.length > 1 && i > 0 && (
                    <button onClick={() => setTravelers(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 active:scale-95 px-1">✕</button>
                  )}
                </div>
              ))}

              <button onClick={() => setTravelers(prev => [...prev, { id: `traveler_${prev.length + 1}`, name: '' }])}
                className="w-full bg-gray-50 text-gray-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 transition-transform border border-dashed border-gray-300">
                + הוספת נוסע
              </button>

              <button onClick={handleSaveTravelers} disabled={savingTravelers}
                className="w-full bg-primary text-white rounded-xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {savingTravelers ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </motion.div>
        )}

        {page === 'password' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">שינוי סיסמא</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Lock className="w-10 h-10 text-orange-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {page === 'notifications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">התראות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Bell className="w-10 h-10 text-purple-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {page === 'security' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">אבטחה ופרטיות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Shield className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {page === 'email_inbox' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold">📬 חיבור מייל חכם</h1>
              <p className="text-xs text-gray-500 mt-1">
                קבל אישורי הזמנה ישירות לטיול — אוטומטי לחלוטין
              </p>
            </div>

            {/* Unique inbox email card */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5" />
                <span className="font-bold text-sm">כתובת המייל האישית שלך</span>
              </div>
              {inboxEmail ? (
                <>
                  <div className="bg-white/20 rounded-xl px-4 py-3 font-mono text-sm break-all mt-2 mb-3" dir="ltr">
                    {inboxEmail}
                  </div>
                  <button
                    onClick={copyInboxEmail}
                    className="flex items-center gap-2 bg-white/25 hover:bg-white/35 active:scale-95 transition-all rounded-xl px-4 py-2 text-sm font-medium w-full justify-center"
                  >
                    {inboxCopied
                      ? <><CheckCheck className="w-4 h-4" /> הועתק!</>
                      : <><Copy className="w-4 h-4" /> העתק כתובת</>
                    }
                  </button>
                </>
              ) : (
                <p className="text-white/70 text-sm mt-2">טוען...</p>
              )}
            </div>

            {/* How to use */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="font-bold text-sm">איך זה עובד? 🤔</p>

              <div className="space-y-3">
                {[
                  {
                    step: '1',
                    title: 'העתק את הכתובת',
                    desc: 'העתק את כתובת המייל האישית שלמעלה',
                    icon: '📋',
                  },
                  {
                    step: '2',
                    title: 'הוסף ל-BCC',
                    desc: 'כשאתה מזמין מלון, טיסה, שכירות רכב — הוסף את הכתובת לשדה BCC לפני שאתה שולח',
                    icon: '✉️',
                  },
                  {
                    step: '3',
                    title: 'Tripix יעשה את השאר',
                    desc: 'המערכת תנתח את המייל, תזהה את הטיול הרלוונטי ותוסיף את ההוצאה אוטומטית',
                    icon: '🤖',
                  },
                  {
                    step: '4',
                    title: 'בדוק ואשר',
                    desc: 'תקבל עדכון בטיול שלך — אם ההשמה לא נכונה אפשר לשנות בקלות',
                    icon: '✅',
                  },
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
            </div>

            {/* Supported platforms */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-bold text-sm mb-3">פלטפורמות נתמכות 🌐</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Booking.com', 'Airbnb', 'Expedia', 'Hotels.com',
                  'אל-על', 'Ryanair', 'EasyJet', 'Wizzair',
                  'Rentalcars', 'Avis', 'Hertz', 'GetYourGuide',
                  'Viator', 'eDreams', 'Trip.com',
                ].map(p => (
                  <span key={p} className="bg-gray-50 text-gray-600 text-xs px-3 py-1 rounded-full border border-gray-200">
                    {p}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                כל מייל אישור הזמנה עם סכום ויעד — גם אם הפלטפורמה לא ברשימה
              </p>
            </div>

            {/* ── Connected email addresses ── */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">📧 מיילים מקושרים</p>
                <button
                  onClick={() => setShowAddAlias(v => !v)}
                  className="text-xs text-primary font-semibold bg-primary/10 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  + הוסף מייל
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                כל מייל שישלח מכתובות אלה — יזוהה ויתווסף לטיול הנכון אוטומטית
              </p>

              {/* Primary email (always shown, always verified) */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate" dir="ltr">{primaryEmail}</p>
                  <p className="text-[11px] text-gray-400">מייל ראשי</p>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                  ✓ ראשי
                </span>
              </div>

              {/* Aliases */}
              {aliases.map(alias => (
                <div key={alias.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate" dir="ltr">{alias.email}</p>
                    <p className="text-[11px] text-gray-400">{LABEL_MAP[alias.label] || alias.label}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                    alias.verified
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {alias.verified ? '✓ מאושר' : '⏳ ממתין'}
                  </span>
                  <button
                    onClick={() => handleRemoveAlias(alias.id, alias.email)}
                    className="text-red-400 active:scale-90 text-xs px-1"
                  >✕</button>
                </div>
              ))}

              {aliases.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  אין מיילים מקושרים עדיין
                </p>
              )}

              {/* Add alias form */}
              {showAddAlias && (
                <div className="border border-dashed border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
                  <p className="text-xs font-bold text-primary">הוספת מייל חדש</p>
                  <input
                    type="email"
                    value={newAliasEmail}
                    onChange={e => setNewAliasEmail(e.target.value)}
                    placeholder="your@email.com"
                    dir="ltr"
                    className="w-full bg-white rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 focus:ring-2 focus:ring-primary/20 text-left"
                  />
                  <div className="flex gap-2">
                    {(['personal', 'work', 'other'] as const).map(l => (
                      <button
                        key={l}
                        onClick={() => setNewAliasLabel(l)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                          newAliasLabel === l
                            ? 'bg-primary text-white'
                            : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                      >
                        {LABEL_MAP[l]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAddAlias}
                    disabled={addingAlias || !newAliasEmail}
                    className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold active:scale-95 disabled:opacity-50"
                  >
                    {addingAlias ? 'שולח אישור...' : 'שלח מייל אישור'}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">
                    ישלח מייל לכתובת החדשה לצורך אישור
                  </p>
                </div>
              )}
            </div>

            {/* Note about matching */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs text-amber-800 font-medium">💡 איך הטיול נזוהה?</p>
              <p className="text-xs text-amber-700 mt-1">
                המערכת משווה את עיר היעד ואת התאריכים שבמייל לטיולים שיצרת.
                אם הזמנת מלון בברצלונה — Tripix ידע לשייך אותו לטיול ברצלונה שלך.
                אם אין טיול תואם — ההוצאה תמתין לשיוך ידני.
              </p>
            </div>
          </motion.div>
        )}

        {page === 'gmail' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold">סנכרון Gmail</h1>
              <p className="text-xs text-gray-500 mt-1">
                חבר את Gmail לסריקה אוטומטית של אישורי הזמנות
              </p>
            </div>

            {currentUserId ? (
              <GmailConnect userId={currentUserId} />
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center text-sm text-gray-400">
                טוען...
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs text-blue-800 font-medium">🔐 פרטיות ואבטחה</p>
              <p className="text-xs text-blue-700 mt-1">
                Tripix מבקש גישת קריאה בלבד. אנחנו לא שולחים, מוחקים או משנים מיילים.
                הגישה ניתנת לביטול בכל עת מהגדרות חשבון Google שלך.
              </p>
            </div>
          </motion.div>
        )}

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

        {page === 'about' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">אודות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-2">
              <p className="text-2xl font-bold text-primary">Tripix</p>
              <p className="text-sm text-gray-500">מערכת ניהול טיול חכמה</p>
              <p className="text-xs text-gray-400">גרסה 1.0.0</p>
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
            <ChevronLeft className="w-4 h-4 text-gray-300" />
          </button>
        ))}

        <button
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
