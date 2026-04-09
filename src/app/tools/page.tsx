'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calculator, RefreshCw, ChevronLeft, ArrowLeftRight, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CURRENCIES, CURRENCY_SYMBOL, Currency } from '@/types'

const TIP_PRESETS = [5, 10, 15, 20]

// Major world currencies to show in the rates board (all vs ILS)
const MAJOR_CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', name: 'דולר אמריקאי' },
  { code: 'EUR', flag: '🇪🇺', name: 'אירו' },
  { code: 'GBP', flag: '🇬🇧', name: 'לירה שטרלינג' },
  { code: 'JPY', flag: '🇯🇵', name: 'ין יפני' },
  { code: 'THB', flag: '🇹🇭', name: 'בהט תאילנדי' },
  { code: 'AED', flag: '🇦🇪', name: 'דירהם אמיראתי' },
  { code: 'SGD', flag: '🇸🇬', name: 'דולר סינגפורי' },
  { code: 'TRY', flag: '🇹🇷', name: 'לירה טורקית' },
  { code: 'CHF', flag: '🇨🇭', name: 'פרנק שוויצרי' },
  { code: 'CAD', flag: '🇨🇦', name: 'דולר קנדי' },
  { code: 'AUD', flag: '🇦🇺', name: 'דולר אוסטרלי' },
  { code: 'INR', flag: '🇮🇳', name: 'רופי הודי' },
  { code: 'EGP', flag: '🇪🇬', name: 'לירה מצרית' },
  { code: 'IDR', flag: '🇮🇩', name: 'רופיה אינדונזית' },
]

type TabType = 'rates' | 'converter' | 'tip'

export default function ToolsPage() {
  const [tab, setTab] = useState<TabType>('rates')

  // Live rates
  const [rates, setRates]           = useState<Record<string, number>>({})
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesError, setRatesError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Currency converter
  const [amount, setAmount]         = useState('100')
  const [fromCurrency, setFromCurrency] = useState<Currency>('THB')
  const [toCurrency, setToCurrency] = useState<Currency>('ILS')
  const [rate, setRate]             = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)

  // Tip calculator
  const [billAmount, setBillAmount] = useState('')
  const [tipPercent, setTipPercent] = useState(10)
  const [tipCurrency, setTipCurrency] = useState<Currency>('THB')

  // ── Fetch all major currency rates vs ILS ──────────────────────────────
  const fetchAllRates = useCallback(async () => {
    setRatesLoading(true)
    setRatesError(false)
    try {
      // Call our server-side proxy to avoid CORS and get more currencies
      const res = await fetch('/api/rates/all')
      if (!res.ok) throw new Error('failed')
      const data = await res.json() as { rates: Record<string, number> }
      setRates(data.rates)
      setLastUpdated(new Date())
    } catch {
      setRatesError(true)
    }
    setRatesLoading(false)
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchAllRates()
    const timer = setInterval(fetchAllRates, 60_000)
    return () => clearInterval(timer)
  }, [fetchAllRates])

  // ── Fetch single pair rate for converter ──────────────────────────────
  const fetchRate = useCallback(async () => {
    setLoadingRate(true)
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`)
      if (res.ok) {
        const data = await res.json()
        setRate(data.rates?.[toCurrency] || null)
      }
    } catch {
      const fallback: Record<string, Record<string, number>> = {
        THB: { ILS: 0.105, USD: 0.028, EUR: 0.026 },
        ILS: { THB: 9.52, USD: 0.27, EUR: 0.25 },
        USD: { ILS: 3.70, THB: 35.5, EUR: 0.93 },
        EUR: { ILS: 4.00, THB: 38.2, USD: 1.08 },
      }
      setRate(fallback[fromCurrency]?.[toCurrency] || 1)
    }
    setLoadingRate(false)
  }, [fromCurrency, toCurrency])

  useEffect(() => { fetchRate() }, [fetchRate])

  const swap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const convertedAmount = rate && amount ? (parseFloat(amount) * rate) : 0
  const tipAmount       = billAmount ? (parseFloat(billAmount) * tipPercent / 100) : 0
  const totalWithTip    = billAmount ? parseFloat(billAmount) + tipAmount : 0

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold">כלים</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { id: 'rates'     as const, label: 'שערי מטבע', icon: TrendingUp },
          { id: 'converter' as const, label: 'המרה',       icon: ArrowLeftRight },
          { id: 'tip'       as const, label: 'טיפ',        icon: Calculator },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${tab === id ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Live Rates Board ── */}
      {tab === 'rates' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-400">
              {lastUpdated ? `עודכן: ${fmtTime(lastUpdated)}` : 'טוען...'}
            </p>
            <button onClick={fetchAllRates} disabled={ratesLoading}
              className="flex items-center gap-1 text-xs text-primary active:scale-95 transition-transform">
              <RefreshCw className={`w-3.5 h-3.5 ${ratesLoading ? 'animate-spin' : ''}`} />
              רענן
            </button>
          </div>

          {ratesError && (
            <div className="bg-red-50 text-red-500 text-xs text-center p-3 rounded-xl">
              שגיאה בטעינת הנתונים — בדוק חיבור אינטרנט
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="flex-1 text-[10px] text-gray-400 font-medium">מטבע</span>
              <span className="text-[10px] text-gray-400 font-medium">1 יחידה = ₪</span>
            </div>

            {MAJOR_CURRENCIES.map(({ code, flag, name }, idx) => {
              const r = rates[code]
              const isEven = idx % 2 === 0
              return (
                <div key={code}
                  className={`flex items-center px-4 py-3 ${isEven ? '' : 'bg-gray-50/50'} ${idx < MAJOR_CURRENCIES.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{flag}</span>
                    <div>
                      <p className="text-sm font-bold">{code}</p>
                      <p className="text-[10px] text-gray-400">{name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {ratesLoading && !r ? (
                      <div className="w-14 h-4 bg-gray-200 rounded animate-pulse" />
                    ) : r ? (
                      <p className="text-sm font-bold text-gray-800" dir="ltr">
                        ₪{r < 0.01 ? r.toFixed(5) : r < 1 ? r.toFixed(4) : r.toFixed(3)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300">—</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[10px] text-gray-300 text-center">מקור: Frankfurter · מתעדכן כל דקה</p>
        </motion.div>
      )}

      {/* ── Currency Converter ── */}
      {tab === 'converter' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500">מ-</label>
              <div className="flex gap-2">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-lg font-bold outline-none text-left" dir="ltr" />
                <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value as Currency)}
                  className="bg-gray-50 rounded-xl px-3 py-3 text-sm font-medium outline-none w-20">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={swap}
                className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center active:scale-90 transition-transform">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">ל-</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-primary/5 rounded-xl px-4 py-3 text-left" dir="ltr">
                  <p className="text-2xl font-bold text-primary">
                    {loadingRate ? '...' : `${CURRENCY_SYMBOL[toCurrency]}${convertedAmount.toFixed(2)}`}
                  </p>
                </div>
                <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value as Currency)}
                  className="bg-gray-50 rounded-xl px-3 py-3 text-sm font-medium outline-none w-20">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {rate && (
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>1 {fromCurrency} = {rate.toFixed(4)} {toCurrency}</span>
                <button onClick={fetchRate} className="active:scale-95">
                  <RefreshCw className={`w-3 h-3 ${loadingRate ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Tip Calculator ── */}
      {tab === 'tip' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-xs text-gray-500">סכום החשבון</p>
            <div className="flex gap-2">
              <input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)}
                placeholder="0" className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-lg font-bold outline-none text-left" dir="ltr" />
              <select value={tipCurrency} onChange={(e) => setTipCurrency(e.target.value as Currency)}
                className="bg-gray-50 rounded-xl px-3 py-3 text-sm font-medium outline-none w-20">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <p className="text-xs text-gray-500">אחוז טיפ</p>
            <div className="flex gap-2">
              {TIP_PRESETS.map(p => (
                <button key={p} onClick={() => setTipPercent(p)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all ${tipPercent === p ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {p}%
                </button>
              ))}
            </div>

            {billAmount && parseFloat(billAmount) > 0 && (
              <div className="bg-green-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">טיפ</span>
                  <span className="font-bold text-green-600">{CURRENCY_SYMBOL[tipCurrency]}{tipAmount.toFixed(0)}</span>
                </div>
                <div className="border-t border-green-200 pt-2 flex justify-between">
                  <span className="font-bold">סה&quot;כ לתשלום</span>
                  <span className="text-lg font-bold text-green-700">{CURRENCY_SYMBOL[tipCurrency]}{totalWithTip.toFixed(0)}</span>
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-400 text-center">
              בתאילנד נהוג לתת טיפ של 10-20 באט לשירות רגיל, 50-100 באט למסעדות
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
