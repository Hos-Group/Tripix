'use client'

/**
 * CategoryBreakdown — collapsible summary card shown above the
 * expense list.  Two views toggled by tabs:
 *
 *   - "לפי מלון"     → total spent per hotel (pre-paid room + incidentals)
 *   - "לפי קטגוריה" → total spent per category (food / flight / …)
 *
 * Totals always reflect the currently-filtered expense list (so flipping
 * a category pill above updates the numbers below).
 */
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatMoney } from '@/lib/utils'
import type { Expense } from '@/types'
import { CATEGORY_META } from '@/types'
import type { HotelStay } from '@/components/hotel/hotelTab'

type View = 'hotel' | 'category'

interface Props {
  expenses: Expense[]
  stays:    HotelStay[]
}

interface Bucket {
  key:     string
  label:   string
  icon:    string
  total:   number
  count:   number
  color?:  string
}

export default function CategoryBreakdown({ expenses, stays }: Props) {
  const [open, setOpen] = useState(true)
  const [view, setView] = useState<View>('hotel')

  const totalAll = expenses.reduce((s, e) => s + (e.amount_ils || 0), 0)

  const byCategory: Bucket[] = useMemo(() => {
    const m = new Map<string, Bucket>()
    for (const e of expenses) {
      const meta = CATEGORY_META[e.category]
      const b = m.get(e.category) || {
        key:   e.category,
        label: meta?.label || e.category,
        icon:  meta?.icon  || '•',
        color: meta?.color,
        total: 0, count: 0,
      }
      b.total += e.amount_ils || 0
      b.count += 1
      m.set(e.category, b)
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total)
  }, [expenses])

  const byHotel: Bucket[] = useMemo(() => {
    // Bucket every expense linked to a hotel doc AND the stay's pre-paid row
    // together. Everything un-linked falls under "ללא מלון".
    const byDoc = new Map<string, Bucket>()
    const unlinked: Bucket = { key: '__none__', label: 'ללא מלון', icon: '🗂️', total: 0, count: 0 }

    // Pre-populate from stays (so hotels with only a booking row and no
    // incidentals still appear).
    for (const s of stays) {
      byDoc.set(s.document_id, {
        key:   s.document_id,
        label: s.name,
        icon:  '🏨',
        total: 0, count: 0,
      })
    }
    for (const e of expenses) {
      const did = (e as unknown as { document_id?: string | null }).document_id
      if (did && byDoc.has(did)) {
        const b = byDoc.get(did)!
        b.total += e.amount_ils || 0
        b.count += 1
      } else {
        unlinked.total += e.amount_ils || 0
        unlinked.count += 1
      }
    }

    const all = Array.from(byDoc.values()).filter(b => b.count > 0 || b.total > 0)
    if (unlinked.total > 0 || unlinked.count > 0) all.push(unlinked)
    return all.sort((a, b) => b.total - a.total)
  }, [expenses, stays])

  const buckets = view === 'hotel' ? byHotel : byCategory

  return (
    <section
      aria-label="סיכום הוצאות"
      className="bg-white rounded-3xl shadow-card border border-gray-50/80 overflow-hidden"
    >
      {/* Header — toggles open/closed */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 uppercase">סיכום</span>
          <span className="text-base font-black text-gray-900">{formatMoney(totalAll)}</span>
          <span className="text-[10px] text-gray-400">({expenses.length} חיובים)</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              {/* View toggle */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
                {([
                  { id: 'hotel',    label: 'לפי מלון' },
                  { id: 'category', label: 'לפי קטגוריה' },
                ] as { id: View; label: string }[]).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setView(t.id)}
                    aria-pressed={view === t.id}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors"
                    style={view === t.id
                      ? { background: 'white', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                      : { color: '#6B7280' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Buckets */}
              {buckets.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">אין נתונים עדיין</p>
              ) : (
                <div className="space-y-1.5">
                  {buckets.map(b => {
                    const pct = totalAll > 0 ? Math.round((b.total / totalAll) * 100) : 0
                    return (
                      <div key={b.key} className="flex items-center gap-2.5 px-1 py-1.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ backgroundColor: (b.color || '#E5E7EB') + '1F' }}
                          aria-hidden="true"
                        >
                          {b.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline gap-2">
                            <p className="text-xs font-bold text-gray-900 truncate">{b.label}</p>
                            <p className="text-xs font-bold text-gray-900 whitespace-nowrap">{formatMoney(b.total)}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all"
                                style={{ width: `${pct}%`, background: b.color || '#6C47FF' }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              {pct}% · {b.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
