'use client'

import { useState, useEffect } from 'react'
import { Calculator, RefreshCw, ChevronLeft, ArrowLeftRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CURRENCIES, CURRENCY_SYMBOL, Currency } from '@/types'

const TIP_PRESETS = [5, 10, 15, 20]

export default function ToolsPage() {
  const [tab, setTab] = useState<'converter' | 'tip'>('converter')

  // Currency converter
  const [amount, setAmount] = useState('100')
  const [fromCurrency, setFromCurrency] = useState<Currency>('THB')
  const [toCurrency, setToCurrency] = useState<Currency>('ILS')
  const [rate, setRate] = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)

  // Tip calculator
  const [billAmount, setBillAmount] = useState('')
  const [tipPercent, setTipPercent] = useState(10)
  const [tipCurrency, setTipCurrency] = useState<Currency>('THB')

  useEffect(() => {
    fetchRate()
  }, [fromCurrency, toCurrency]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRate = async () => {
    setLoadingRate(true)
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`)
      if (res.ok) {
        const data = await res.json()
        setRate(data.rates?.[toCurrency] || null)
      }
    } catch {
      // Fallback rates
      const rates: Record<string, Record<string, number>> = {
        THB: { ILS: 0.105, USD: 0.028, EUR: 0.026 },
        ILS: { THB: 9.52, USD: 0.27, EUR: 0.25 },
        USD: { ILS: 3.70, THB: 35.5, EUR: 0.93 },
        EUR: { ILS: 4.00, THB: 38.2, USD: 1.08 },
      }
      setRate(rates[fromCurrency]?.[toCurrency] || 1)
    }
    setLoadingRate(false)
  }

  const swap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const convertedAmount = rate && amount ? (parseFloat(amount) * rate) : 0
  const tipAmount = billAmount ? (parseFloat(billAmount) * tipPercent / 100) : 0
  const totalWithTip = billAmount ? parseFloat(billAmount) + tipAmount : 0

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
          { id: 'converter' as const, label: 'המרת מטבע', icon: ArrowLeftRight },
          { id: 'tip' as const, label: 'מחשבון טיפ', icon: Calculator },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all ${tab === id ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Currency Converter */}
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

      {/* Tip Calculator */}
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
