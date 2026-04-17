'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, RefreshCw, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { CURRENCY_SYMBOL, Currency } from '@/types'

interface DebtItem {
  fromName: string
  toName: string
  amount: number
  currency: string
}

interface DebtSummaryProps {
  tripId: string
  onRefresh?: () => void
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function DebtSummary({ tripId, onRefresh }: DebtSummaryProps) {
  const [debts, setDebts] = useState<DebtItem[]>([])
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState<string | null>(null)

  const fetchDebts = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/splits`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setDebts(json.debts || [])
      }
    } catch (err) {
      console.error('[DebtSummary] fetch error:', err)
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchDebts() }, [fetchDebts])

  const handleMarkPaid = async (debt: DebtItem, index: number) => {
    const key = `${debt.fromName}-${debt.toName}-${index}`
    const confirmed = window.confirm(
      `לסמן שהחוב של ${debt.fromName} לטובת ${debt.toName} (${getCurrencySymbol(debt.currency)}${debt.amount.toFixed(2)}) שולם?`
    )
    if (!confirmed) return

    setSettling(key)

    // Find the split where fromName is a participant and toName is the payer
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/splits`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      const splits = json.splits || []

      // Find a split where toName paid and fromName is an unpaid participant
      const targetSplit = splits.find((s: {
        paid_by_name: string
        participants: Array<{ name: string; paid: boolean }>
      }) =>
        s.paid_by_name === debt.toName &&
        s.participants.some((p: { name: string; paid: boolean }) => p.name === debt.fromName && !p.paid)
      )

      if (targetSplit) {
        await fetch(`/api/trips/${tripId}/splits`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            split_id: targetSplit.id,
            participant_name: debt.fromName,
            paid: true,
          }),
        })
      }

      toast.success('סומן כמשולם!')
      fetchDebts()
      onRefresh?.()
    } catch {
      toast.error('שגיאה בסימון')
    }
    setSettling(null)
  }

  function getCurrencySymbol(c: string): string {
    return CURRENCY_SYMBOL[c as Currency] || c
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="w-7 h-7 rounded-full animate-spin"
          style={{ border: '2px solid rgba(108,71,255,0.15)', borderTopColor: '#6C47FF' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: '#6C47FF15' }}
          >
            <Scale className="w-4 h-4" style={{ color: '#6C47FF' }} />
          </div>
          <h3 className="font-bold text-base text-gray-800">סיכום חובות</h3>
        </div>
        <button
          onClick={fetchDebts}
          className="p-2 rounded-xl text-gray-400 active:bg-gray-100 active:scale-90 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Debt cards */}
      <AnimatePresence mode="popLayout">
        {debts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 text-center border border-emerald-100"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="font-bold text-emerald-700 text-sm">הכל מסולק!</p>
            <p className="text-emerald-500 text-xs mt-1">אין חובות פתוחים בין המשתתפים</p>
          </motion.div>
        ) : (
          debts.map((debt, i) => {
            const key = `${debt.fromName}-${debt.toName}-${i}`
            const isSettling = settling === key
            const symbol = getCurrencySymbol(debt.currency)

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-50 flex items-center gap-3"
              >
                {/* From */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: '#EF4444' }}
                    >
                      {debt.fromName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">חייב/ת</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{debt.fromName}</p>
                    </div>
                  </div>
                </div>

                {/* Amount arrow */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <p
                    className="text-base font-black"
                    style={{ color: '#6C47FF' }}
                  >
                    {symbol}{debt.amount.toFixed(2)}
                  </p>
                  <ArrowLeft className="w-4 h-4 text-gray-300" />
                </div>

                {/* To */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: '#10B981' }}
                    >
                      {debt.toName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-xs text-gray-400">לטובת</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{debt.toName}</p>
                    </div>
                  </div>
                </div>

                {/* Mark paid button */}
                <button
                  onClick={() => handleMarkPaid(debt, i)}
                  disabled={isSettling}
                  className="flex-shrink-0 p-2 rounded-xl active:scale-90 transition-all"
                  style={{ background: '#10B98115' }}
                  title="סמן כמשולם"
                >
                  {isSettling ? (
                    <div
                      className="w-4 h-4 rounded-full animate-spin"
                      style={{ border: '2px solid #10B98130', borderTopColor: '#10B981' }}
                    />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </button>
              </motion.div>
            )
          })
        )}
      </AnimatePresence>

      {debts.length > 0 && (
        <p className="text-center text-[11px] text-gray-400">
          {debts.length} חוב/ות פתוח/ות — לחץ על ✓ לסימון כמשולם
        </p>
      )}
    </div>
  )
}
