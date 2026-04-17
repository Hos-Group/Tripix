'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, DollarSign, Sliders, ChevronDown, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TripMember, SplitParticipant } from '@/types'
import { CURRENCY_SYMBOL, CURRENCIES, Currency } from '@/types'

interface SplitExpenseProps {
  tripId: string
  expenseId?: string
  defaultAmount?: number
  defaultCurrency?: string
  defaultDescription?: string
  onSaved?: () => void
  onClose?: () => void
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

async function fetchMembers(tripId: string): Promise<TripMember[]> {
  const token = await getAuthToken()
  const res = await fetch(`/api/trips/${tripId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.members || []
}

export default function SplitExpense({
  tripId,
  expenseId,
  defaultAmount = 0,
  defaultCurrency = 'ILS',
  defaultDescription = '',
  onSaved,
  onClose,
}: SplitExpenseProps) {
  const [members, setMembers] = useState<TripMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [paidByName, setPaidByName] = useState('')
  const [totalAmount, setTotalAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : '')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency as Currency)
  const [description, setDescription] = useState(defaultDescription)
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})

  const loadMembers = useCallback(async () => {
    setLoading(true)
    const list = await fetchMembers(tripId)
    setMembers(list)

    // Pre-select all active members
    const initial: Record<string, boolean> = {}
    for (const m of list) {
      if (m.status === 'active') initial[m.id] = true
    }
    setSelected(initial)

    // Default payer = first owner/active member
    const owner = list.find(m => m.role === 'owner' && m.status === 'active')
    if (owner) setPaidByName(owner.display_name || owner.invited_name || '')

    setLoading(false)
  }, [tripId])

  useEffect(() => { loadMembers() }, [loadMembers])

  const selectedMembers = members.filter(m => selected[m.id])
  const totalNum = parseFloat(totalAmount) || 0
  const equalShare = selectedMembers.length > 0
    ? Math.round((totalNum / selectedMembers.length) * 100) / 100
    : 0

  const handleSave = async () => {
    if (!paidByName) { toast.error('בחר מי שילם'); return }
    if (!totalAmount || totalNum <= 0) { toast.error('הכנס סכום'); return }
    if (selectedMembers.length === 0) { toast.error('בחר לפחות משתתף אחד'); return }

    // Build participants array
    const participants: SplitParticipant[] = selectedMembers.map(m => {
      const name = m.display_name || m.invited_name || m.invited_email || 'משתתף'
      const amount = splitType === 'equal'
        ? equalShare
        : parseFloat(customAmounts[m.id] || '0')
      return {
        user_id: m.user_id || undefined,
        name,
        email: m.invited_email || undefined,
        amount,
        paid: name === paidByName,
      }
    })

    // Validate custom amounts sum
    if (splitType === 'custom') {
      const sum = participants.reduce((s, p) => s + p.amount, 0)
      if (Math.abs(sum - totalNum) > 0.5) {
        toast.error(`הסכומים לא מסתכמים ל-${totalNum} (כרגע: ${sum.toFixed(2)})`)
        return
      }
    }

    setSaving(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/splits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expense_id: expenseId || undefined,
          paid_by_name: paidByName,
          total_amount: totalNum,
          currency,
          description: description || undefined,
          split_type: splitType,
          participants,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'שגיאה בשמירה')
      } else {
        toast.success('הפיצול נשמר!')
        onSaved?.()
        onClose?.()
      }
    } catch {
      toast.error('שגיאה בחיבור לשרת')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="w-8 h-8 rounded-full animate-spin"
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
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#6C47FF15' }}>
            <Users className="w-4 h-4" style={{ color: '#6C47FF' }} />
          </div>
          <h3 className="font-bold text-base text-gray-800">פיצול הוצאה</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 active:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Description */}
      <input
        type="text"
        placeholder="תיאור (אופציונלי)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20"
      />

      {/* Amount + Currency */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="number"
            placeholder="סכום כולל"
            value={totalAmount}
            onChange={e => setTotalAmount(e.target.value)}
            className="w-full bg-gray-50 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 font-bold"
          />
        </div>
        <div className="relative w-24">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as Currency)}
            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none appearance-none font-medium"
          >
            {CURRENCIES.map(c => (
              <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>
            ))}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Paid by */}
      <div className="relative">
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">מי שילם?</label>
        <select
          value={paidByName}
          onChange={e => setPaidByName(e.target.value)}
          className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none appearance-none font-medium"
        >
          <option value="">בחר משלם</option>
          {members.filter(m => m.status === 'active').map(m => {
            const name = m.display_name || m.invited_name || m.invited_email || 'משתתף'
            return (
              <option key={m.id} value={name}>{name}</option>
            )
          })}
        </select>
        <ChevronDown className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Split type toggle */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">סוג חלוקה</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSplitType('equal')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={
              splitType === 'equal'
                ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
                : { background: '#F3F4F6', color: '#6B7280' }
            }
          >
            <Users className="w-3 h-3" />
            שווה
          </button>
          <button
            onClick={() => setSplitType('custom')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={
              splitType === 'custom'
                ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
                : { background: '#F3F4F6', color: '#6B7280' }
            }
          >
            <Sliders className="w-3 h-3" />
            מותאם
          </button>
        </div>
      </div>

      {/* Participants */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
          משתתפים ({selectedMembers.length})
        </label>
        <div className="space-y-2">
          {members.filter(m => m.status === 'active').map(m => {
            const name = m.display_name || m.invited_name || m.invited_email || 'משתתף'
            const isSelected = !!selected[m.id]

            return (
              <div
                key={m.id}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border shadow-sm transition-all"
                style={{ borderColor: isSelected ? '#6C47FF40' : '#F3F4F6' }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => setSelected(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: isSelected ? '#6C47FF' : '#F3F4F6',
                    border: isSelected ? 'none' : '1.5px solid #D1D5DB',
                  }}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>

                <span className="text-sm font-medium text-gray-800 flex-1">{name}</span>

                {/* Amount display / input */}
                {splitType === 'equal' ? (
                  <span className="text-sm font-bold" style={{ color: '#6C47FF' }}>
                    {isSelected ? `${CURRENCY_SYMBOL[currency]}${equalShare.toFixed(2)}` : '—'}
                  </span>
                ) : (
                  <AnimatePresence>
                    {isSelected && (
                      <motion.input
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 72, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        type="number"
                        placeholder="0"
                        value={customAmounts[m.id] || ''}
                        onChange={e =>
                          setCustomAmounts(prev => ({ ...prev, [m.id]: e.target.value }))
                        }
                        className="bg-purple-50 rounded-lg px-2 py-1 text-sm font-bold text-primary outline-none text-left"
                      />
                    )}
                  </AnimatePresence>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom amounts sum indicator */}
      {splitType === 'custom' && totalNum > 0 && (
        <div className="bg-gray-50 rounded-xl px-4 py-2 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            סה״כ שהוקצה: {CURRENCY_SYMBOL[currency]}
            {selectedMembers
              .reduce((s, m) => s + (parseFloat(customAmounts[m.id] || '0')), 0)
              .toFixed(2)}
          </span>
          <span className="text-xs font-bold" style={{ color: '#6C47FF' }}>
            / {CURRENCY_SYMBOL[currency]}{totalNum.toFixed(2)}
          </span>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full text-white rounded-2xl py-3.5 font-bold text-sm active:scale-95 transition-all disabled:opacity-50 shadow-md"
        style={{ background: saving ? '#9CA3AF' : 'linear-gradient(135deg,#6C47FF,#9B7BFF)' }}
      >
        {saving ? 'שומר...' : 'שמור פיצול'}
      </button>
    </div>
  )
}
