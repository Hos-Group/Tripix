'use client'

/**
 * QuickChargeSheet — bottom sheet for adding a charge to an active
 * hotel stay in 3 taps: tap preset → type amount → Save.
 *
 * Built for one-handed, distracted use (user is at the pool / lounge
 * / restaurant, with a wet phone).  Keyboard focuses automatically,
 * categories are single-tap chips, location auto-fills from the preset
 * but can be overridden.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { convertToILS } from '@/lib/rates'
import type { HotelStay, LocationTag, QuickPreset } from './hotelTab'
import { QUICK_PRESETS, LOCATION_TAGS, LOCATION_DEFAULT_CATEGORY } from './hotelTab'
import type { Category, Currency } from '@/types'
import { CURRENCIES, CURRENCY_SYMBOL } from '@/types'

interface Props {
  stay:    HotelStay | null
  userId?: string
  onClose: () => void
  onSaved: () => void
}

export default function QuickChargeSheet({ stay, userId, onClose, onSaved }: Props) {
  const [preset,   setPreset]   = useState<QuickPreset>(QUICK_PRESETS[0])
  const [amount,   setAmount]   = useState('')
  const [currency, setCurrency] = useState<Currency>('ILS')
  const [location, setLocation] = useState<LocationTag>('bar')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  // When the sheet opens on a new stay, reset state + auto-focus amount.
  useEffect(() => {
    if (!stay) return
    setPreset(QUICK_PRESETS[0])
    setAmount('')
    setCurrency(stay.currency)
    setLocation(QUICK_PRESETS[0].location)
    setNotes('')
    // Focus after the mount animation settles
    const t = setTimeout(() => amountRef.current?.focus(), 200)
    return () => clearTimeout(t)
  }, [stay?.document_id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!stay) return null

  const selectPreset = (p: QuickPreset) => {
    setPreset(p)
    setLocation(p.location)
  }

  const handleSave = async () => {
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('סכום חייב להיות גדול מ-0')
      return
    }
    setSaving(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      // Clamp the expense date to the stay window — we never want a pool
      // charge dated before check-in or after check-out.
      const expenseDate =
        today < stay.check_in  ? stay.check_in
      : today > stay.check_out ? stay.check_out
      : today

      const amountIls = await convertToILS(n, currency, expenseDate)
      const locLabel  = LOCATION_TAGS.find(l => l.id === location)?.label || location
      const title     = `${stay.name} — ${preset.label}`

      const res = await fetch('/api/expenses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          trip_id:      stay.trip_id,
          user_id:      userId,
          document_id:  stay.document_id,
          title,
          category:     preset.category as Category,
          amount:       n,
          currency,
          amount_ils:   amountIls,
          expense_date: expenseDate,
          source:       'manual',
          location_tag: location,
          notes:        notes.trim() ? `[${locLabel}] ${notes.trim()}` : `[${locLabel}]`,
          // force=true: hotel incidentals routinely have the same ₪ & date
          // (three ₪80 cappuccinos in a row shouldn't be deduped).
          force:        true,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('נוסף לחשבון החדר ✓')
      setAmount('')
      setNotes('')
      onSaved()
    } catch (e) {
      console.error('[QuickChargeSheet] save failed:', e)
      toast.error('שמירה נכשלה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {stay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
          role="dialog"
          aria-modal="true"
          aria-label={`הוסף חיוב ל-${stay.name}`}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-8 space-y-4"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-medium">חיוב לחדר</p>
                <h2 className="text-base font-black text-gray-900">{stay.name}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="סגור"
                className="w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            {/* Category presets */}
            <div>
              <p className="text-[11px] text-gray-500 font-medium mb-2">מה הזמנת?</p>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_PRESETS.map(p => {
                  const active = preset.id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPreset(p)}
                      aria-pressed={active}
                      className="flex flex-col items-center gap-1 py-3 rounded-2xl text-xs font-bold active:scale-95 transition-all"
                      style={active
                        ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
                        : { background: '#F3F4F6', color: '#4B5563' }}
                    >
                      <span className="text-xl" aria-hidden="true">{p.icon}</span>
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Amount + currency — big keyboard-first input */}
            <div>
              <label htmlFor="qc-amount" className="text-[11px] text-gray-500 font-medium mb-2 block">
                סכום
              </label>
              <div className="flex gap-2">
                <input
                  id="qc-amount"
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 bg-surface-secondary rounded-2xl px-4 py-4 text-2xl font-black text-gray-900 outline-none focus-visible:ring-2 ring-primary/30 text-center"
                />
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as Currency)}
                  className="w-24 bg-surface-secondary rounded-2xl px-3 text-sm font-bold outline-none"
                  aria-label="מטבע"
                >
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location chips */}
            <div>
              <p className="text-[11px] text-gray-500 font-medium mb-2">איפה?</p>
              <div className="flex gap-2 flex-wrap">
                {LOCATION_TAGS.map(l => {
                  const active = location === l.id
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLocation(l.id)}
                      aria-pressed={active}
                      className="px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all"
                      style={active
                        ? { background: '#6C47FF', color: 'white' }
                        : { background: '#F3F4F6', color: '#4B5563' }}
                    >
                      <span aria-hidden="true">{l.icon}</span> {l.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Optional notes */}
            <div>
              <label htmlFor="qc-notes" className="text-[11px] text-gray-500 font-medium mb-2 block">
                הערה (רשות)
              </label>
              <input
                id="qc-notes"
                type="text"
                placeholder="למשל: מוחיטו, קוקטייל של אשתי"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 ring-primary/30"
                // Auto-ignores the default category update; user has their own note
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleSave() }
                }}
              />
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full py-4 min-h-[52px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
              style={{ background: saving ? '#9CA3AF' : 'linear-gradient(135deg,#10B981,#34D399)' }}
            >
              <Check className="w-5 h-5" aria-hidden="true" />
              {saving ? 'שומר...' : `חייב ${amount ? `${CURRENCY_SYMBOL[currency]}${amount}` : ''}`.trim()}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
