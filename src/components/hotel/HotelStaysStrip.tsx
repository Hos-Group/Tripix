'use client'

/**
 * HotelStaysStrip — horizontal row of active hotel stays at the top of the
 * Expenses page.  Each card shows running total + nights + status chip,
 * tap opens the Quick Charge sheet.
 */
import { motion } from 'framer-motion'
import { Hotel, FileText } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import type { HotelStay } from './hotelTab'
import { STATUS_LABELS } from './hotelTab'

interface Props {
  stays:         HotelStay[]
  onCharge:      (stay: HotelStay) => void
  onViewReport:  (stay: HotelStay) => void
}

export default function HotelStaysStrip({ stays, onCharge, onViewReport }: Props) {
  if (!stays.length) return null

  // Sort: active → upcoming (soon) → ended (recent).  Active is the default
  // thing the user wants to tap while at the pool.
  const sorted = [...stays].sort((a, b) => {
    const rank = { active: 0, upcoming: 1, ended: 2 } as const
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    return a.check_in.localeCompare(b.check_in)
  })

  return (
    <section aria-label="שהיות במלון" className="-mx-4 px-4 overflow-x-auto">
      <div className="flex gap-3 pb-1 snap-x snap-mandatory">
        {sorted.map(stay => {
          const isEnded = stay.status === 'ended'
          const status  = STATUS_LABELS[stay.status]
          return (
            <motion.button
              key={stay.document_id}
              type="button"
              onClick={() => (isEnded ? onViewReport(stay) : onCharge(stay))}
              whileTap={{ scale: 0.97 }}
              className="snap-start shrink-0 w-[260px] bg-white rounded-3xl p-4 shadow-card border border-gray-50/80 text-right active:bg-gray-50/40 transition-colors"
              aria-label={`${stay.name} — ${isEnded ? 'דוח שהייה' : 'הוסף חיוב'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="w-9 h-9 rounded-2xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Hotel className="w-4 h-4 text-primary" aria-hidden="true" />
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: status.color + '1A', color: status.color }}
                >
                  {status.label}
                </span>
              </div>

              <p className="text-sm font-bold text-gray-900 leading-tight line-clamp-2 min-h-[2.6em]">
                {stay.name}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {stay.check_in} · {stay.nights} לילות
              </p>

              <div className="mt-3 pt-3 border-t border-gray-50 flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-medium">חיובים בחדר</p>
                  <p className="text-base font-black text-gray-900 leading-tight">
                    {formatMoney(stay.incidentals_total_ils)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {stay.incidentals_count} חיובים
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
                  {isEnded ? (
                    <>
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                      דוח
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">+</span>
                      הוסף חיוב
                    </>
                  )}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
