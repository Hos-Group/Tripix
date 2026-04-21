'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, RefreshCw, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { CURRENCY_SYMBOL, Currency } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

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
  const [pendingSettle, setPendingSettle] = useState<{ debt: DebtItem; index: number } | null>(null)

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

  const requestMarkPaid = (debt: DebtItem, index: number) => {
    setPendingSettle({ debt, index })
  }

  const handleMarkPaid = async () => {
    if (!pendingSettle) return
    const { debt, index } = pendingSettle
    const key = `${debt.fromName}-${debt.toName}-${index}`
    setPendingSettle(null)
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
      <div role="status" aria-live="polite" aria-label="טוען חובות" className="space-y-3 py-2">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-50 flex items-center gap-3">
            <div className="w-8 h-8 skeleton rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 skeleton rounded-md" />
              <div className="h-2.5 w-1/3 skeleton rounded-md" />
            </div>
            <div className="h-6 w-16 skeleton rounded-md" />
          </div>
        ))}
        <span className="sr-only">טוען…</span>
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
                  type="button"
                  onClick={() => requestMarkPaid(debt, i)}
                  disabled={isSettling}
                  aria-label={`סמן שהחוב של ${debt.fromName} לטובת ${debt.toName} שולם`}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl active:scale-90 transition-all focus-visible:ring-2 focus-visible:ring-emerald-400"
                  style={{ background: '#10B98115' }}
                >
                  {isSettling ? (
                    <div
                      className="w-4 h-4 rounded-full animate-spin"
                      style={{ border: '2px solid #10B98130', borderTopColor: '#10B981' }}
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
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

      <ConfirmDialog
        open={!!pendingSettle}
        title="לסמן את החוב כמשולם?"
        description={
          pendingSettle
            ? `${pendingSettle.debt.fromName} שילם/ה ל${pendingSettle.debt.toName} ${getCurrencySymbol(pendingSettle.debt.currency)}${pendingSettle.debt.amount.toFixed(2)}. סימון יעדכן את הסיכום.`
            : undefined
        }
        confirmLabel="סמן כמשולם"
        cancelLabel="ביטול"
        variant="primary"
        onConfirm={handleMarkPaid}
        onCancel={() => setPendingSettle(null)}
      />
    </div>
  )
}
