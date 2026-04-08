'use client'

/**
 * CurrencySelector
 *
 * Compact trigger (single symbol badge) + animated bottom-sheet picker.
 * Replaces the 3-button strip throughout the app.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Currency, CURRENCY_SYMBOL } from '@/types'

export const ALL_CURRENCIES: { code: Currency; name: string; flag: string }[] = [
  { code: 'ILS', name: 'שקל ישראלי',      flag: '🇮🇱' },
  { code: 'USD', name: 'דולר אמריקאי',    flag: '🇺🇸' },
  { code: 'EUR', name: 'יורו',            flag: '🇪🇺' },
  { code: 'GBP', name: 'לירה שטרלינג',   flag: '🇬🇧' },
  { code: 'THB', name: 'בהט תאילנדי',    flag: '🇹🇭' },
]

interface CurrencySelectorProps {
  value:    Currency
  onChange: (c: Currency) => void
  /** Subset of currencies to show; defaults to ALL_CURRENCIES */
  options?: Currency[]
  /** Size variant */
  size?:    'sm' | 'md'
}

export default function CurrencySelector({
  value,
  onChange,
  options,
  size = 'md',
}: CurrencySelectorProps) {
  const [open, setOpen] = useState(false)

  const visibleCurrencies = options
    ? ALL_CURRENCIES.filter(c => options.includes(c.code))
    : ALL_CURRENCIES

  return (
    <>
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 bg-gray-100 rounded-xl font-medium text-gray-700 active:scale-95 transition-all hover:bg-gray-200 ${
          size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'
        }`}
      >
        <span className="font-bold">{CURRENCY_SYMBOL[value]}</span>
        <span className={`text-gray-500 ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{value}</span>
        <ChevronDown className={`text-gray-400 ${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
      </button>

      {/* ── Bottom-sheet overlay ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-4 pb-8 pt-4"
              dir="rtl"
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <p className="text-sm font-bold text-center mb-4 text-gray-800">בחר מטבע תצוגה</p>

              <div className="space-y-2">
                {visibleCurrencies.map(c => (
                  <button
                    key={c.code}
                    onClick={() => { onChange(c.code); setOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] ${
                      value === c.code
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{c.flag}</span>
                    <div className="flex-1 text-right min-w-0">
                      <p className={`text-sm font-semibold ${value === c.code ? 'text-primary' : 'text-gray-800'}`}>
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-400">{c.code}</p>
                    </div>
                    <span className={`text-lg font-bold flex-shrink-0 ${value === c.code ? 'text-primary' : 'text-gray-600'}`}>
                      {CURRENCY_SYMBOL[c.code]}
                    </span>
                    {value === c.code && (
                      <span className="text-primary text-sm font-bold flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
