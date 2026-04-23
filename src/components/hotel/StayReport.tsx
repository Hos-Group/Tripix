'use client'

/**
 * StayReport — end-of-stay summary bottom sheet.
 *
 * Shown when the user taps a stay card whose status is "ended" (or
 * taps a "View report" CTA on an active stay).  Aggregates every
 * incidental charged to the stay's `document_id` — totals by category
 * and by location — and offers Share / Copy exports.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import type { HotelStay, ExpenseRow, ReportBucket } from './hotelTab'
import { summariseStay } from './hotelTab'

interface Props {
  stay:    HotelStay | null
  onClose: () => void
}

type BreakdownView = 'category' | 'location'

export default function StayReport({ stay, onClose }: Props) {
  const [incidentals, setIncidentals] = useState<ExpenseRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [view,        setView]        = useState<BreakdownView>('category')
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    if (!stay) return
    let alive = true
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('expenses')
        .select('id, trip_id, document_id, amount, amount_ils, currency, category, title, expense_date, location_tag, notes')
        .eq('document_id', stay.document_id)
        .neq('category', 'hotel')  // exclude the booking itself
        .order('expense_date', { ascending: true })
        .order('created_at',   { ascending: true })
      if (alive) {
        setIncidentals((data as ExpenseRow[] | null) || [])
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [stay?.document_id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!stay) return null

  const { byCategory, byLocation, total } = summariseStay(incidentals)
  const buckets: ReportBucket[] = view === 'category' ? byCategory : byLocation

  const buildReportText = (): string => {
    const lines: string[] = []
    lines.push(`🏨 ${stay.name}`)
    lines.push(`📅 ${stay.check_in} – ${stay.check_out} (${stay.nights} לילות)`)
    lines.push('')
    lines.push(`💳 חיובים בחדר: ${formatMoney(total)}`)
    lines.push(`   על פני ${incidentals.length} חיובים`)
    if (stay.pre_paid_total_ils > 0) {
      lines.push(`💼 חדר (pre-paid): ${formatMoney(stay.pre_paid_total_ils)}`)
      lines.push(`📊 סה"כ שהייה: ${formatMoney(total + stay.pre_paid_total_ils)}`)
    }
    lines.push('')
    lines.push('לפי קטגוריה:')
    byCategory.forEach(b => lines.push(`  ${b.icon} ${b.label}: ${formatMoney(b.total)} (×${b.count})`))
    lines.push('')
    lines.push('לפי מיקום:')
    byLocation.forEach(b => lines.push(`  ${b.icon} ${b.label}: ${formatMoney(b.total)} (×${b.count})`))
    return lines.join('\n')
  }

  const handleShare = async () => {
    const text = buildReportText()
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `דוח שהייה — ${stay.name}`, text })
      } catch {
        /* user cancelled */
      }
    } else {
      await handleCopy()
    }
  }

  const handleCopy = async () => {
    const text = buildReportText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('הועתק ללוח')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('העתקה נכשלה')
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
          aria-label={`דוח שהייה — ${stay.name}`}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-8 space-y-4"
            style={{ maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-medium">דוח שהייה</p>
                <h2 className="text-lg font-black text-gray-900">{stay.name}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {stay.check_in} – {stay.check_out} · {stay.nights} לילות
                </p>
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

            {/* Totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary-50 rounded-2xl p-3">
                <p className="text-[11px] text-primary font-semibold">חיובים בחדר</p>
                <p className="text-xl font-black text-gray-900">{formatMoney(total)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{incidentals.length} חיובים</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3">
                <p className="text-[11px] text-gray-500 font-semibold">חדר (pre-paid)</p>
                <p className="text-xl font-black text-gray-900">{formatMoney(stay.pre_paid_total_ils)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">סה"כ: {formatMoney(total + stay.pre_paid_total_ils)}</p>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
              {(['category', 'location'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors"
                  style={view === v
                    ? { background: 'white', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                    : { color: '#6B7280' }}
                >
                  {v === 'category' ? 'לפי קטגוריה' : 'לפי מיקום'}
                </button>
              ))}
            </div>

            {/* Breakdown */}
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">טוען…</div>
            ) : buckets.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">אין חיובים בשהייה הזו עדיין.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {buckets.map(b => {
                  const pct = total > 0 ? Math.round((b.total / total) * 100) : 0
                  return (
                    <div key={b.key} className="flex items-center gap-3 px-3 py-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-base flex-shrink-0" aria-hidden="true">
                        {b.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <p className="text-sm font-bold text-gray-900">{b.label}</p>
                          <p className="text-sm font-bold text-gray-900">{formatMoney(b.total)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{pct}% · {b.count}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Detailed list (collapsible-feel by just listing if not many) */}
            {incidentals.length > 0 && incidentals.length <= 50 && (
              <details className="bg-gray-50 rounded-2xl">
                <summary className="px-4 py-3 text-xs font-bold text-gray-600 cursor-pointer select-none">
                  כל החיובים ({incidentals.length})
                </summary>
                <div className="px-4 pb-3 space-y-1.5">
                  {incidentals.map(e => (
                    <div key={e.id} className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 truncate flex-1 pr-2">
                        {e.expense_date.slice(5)} · {e.title}
                      </span>
                      <span className="font-bold text-gray-900 flex-shrink-0">{formatMoney(e.amount_ils)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex-1 py-3 min-h-[48px] rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" /> שיתוף
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="flex-1 py-3 min-h-[48px] rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                {copied ? 'הועתק' : 'העתק'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
