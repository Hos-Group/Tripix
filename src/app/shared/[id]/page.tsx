'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Plus, Users, Receipt, ArrowLeftRight, UserPlus, Trash2, Check, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { Trip, TripMember, TRIP_TYPE_META, TripType, CATEGORY_META, Category, CURRENCY_SYMBOL, Currency } from '@/types'

interface MemberBalance {
  member: TripMember
  totalPaid: number
  totalOwed: number
  balance: number
}

interface Debt {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

type Tab = 'overview' | 'expenses' | 'balances'

export default function SharedTripDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [trip, setTrip] = useState<Trip & { trip_type?: TripType } | null>(null)
  const [members, setMembers] = useState<TripMember[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [balances, setBalances] = useState<MemberBalance[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSettle, setShowSettle] = useState<Debt | null>(null)

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/shared?trip_id=${id}`)
    const data = await res.json()
    setTrip(data.trip)
    setMembers(data.members || [])
    setExpenses(data.expenses || [])
    setBalances(data.memberBalances || [])
    setDebts(data.debts || [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!trip) return (
    <div className="text-center py-20">
      <p className="text-gray-500">טיול לא נמצא</p>
    </div>
  )

  const tripMeta = TRIP_TYPE_META[(trip as any).trip_type as TripType || 'friends']
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount_ils || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-bl from-[#185FA5] to-[#0D3B6E] text-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push('/shared')} className="p-2 rounded-xl hover:bg-white/10 active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">{trip.name}</h1>
          <div className="w-9" />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{tripMeta.icon}</span>
          <span className="text-sm opacity-80">{tripMeta.label}</span>
          <span className="text-xs opacity-60 mr-2">{trip.destination}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-bold">₪{totalExpenses.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</div>
            <div className="text-xs opacity-70">סה״כ הוצאות</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{members.length}</div>
            <div className="text-xs opacity-70">משתתפים</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-bold">₪{members.length > 0 ? Math.round(totalExpenses / members.length).toLocaleString('he-IL') : 0}</div>
            <div className="text-xs opacity-70">לאדם</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b px-2 sticky top-0 z-10">
        {[
          { key: 'overview' as Tab, label: 'סקירה', icon: Users },
          { key: 'expenses' as Tab, label: 'הוצאות', icon: Receipt },
          { key: 'balances' as Tab, label: 'חובות', icon: ArrowLeftRight },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-400'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'overview' && (
          <OverviewTab
            members={members}
            balances={balances}
            onAddMember={() => setShowAddMember(true)}
            onRemoveMember={async (memberId) => {
              await fetch('/api/shared', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove_member', member_id: memberId }),
              })
              toast.success('חבר הוסר')
              loadData()
            }}
          />
        )}

        {tab === 'expenses' && (
          <ExpensesTab
            expenses={expenses}
            members={members}
            onAddExpense={() => setShowAddExpense(true)}
          />
        )}

        {tab === 'balances' && (
          <BalancesTab
            balances={balances}
            debts={debts}
            onSettle={(debt) => setShowSettle(debt)}
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddMember && (
          <AddMemberModal
            tripId={trip.id}
            onClose={() => setShowAddMember(false)}
            onAdded={() => { setShowAddMember(false); loadData() }}
          />
        )}
        {showAddExpense && (
          <AddSharedExpenseModal
            tripId={trip.id}
            members={members}
            onClose={() => setShowAddExpense(false)}
            onAdded={() => { setShowAddExpense(false); loadData() }}
          />
        )}
        {showSettle && (
          <SettleModal
            tripId={trip.id}
            debt={showSettle}
            onClose={() => setShowSettle(null)}
            onSettled={() => { setShowSettle(null); loadData() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function OverviewTab({ members, balances, onAddMember, onRemoveMember }: {
  members: TripMember[]
  balances: MemberBalance[]
  onAddMember: () => void
  onRemoveMember: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">משתתפים ({members.length})</h3>
        <button onClick={onAddMember} className="text-primary text-xs flex items-center gap-1 active:scale-95">
          <UserPlus className="w-4 h-4" />
          הוסף חבר
        </button>
      </div>

      <div className="space-y-2">
        {members.map(m => {
          const bal = balances.find(b => b.member.id === m.id)
          const balance = bal?.balance || 0
          const initials = m.display_name.slice(0, 2)
          const colors = ['#185FA5', '#D85A30', '#639922', '#7F77DD', '#D4537E', '#EF9F27', '#1D9E75', '#888780']
          const color = colors[members.indexOf(m) % colors.length]

          return (
            <div key={m.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: color }}>
                {initials}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{m.display_name}</span>
                  {m.role === 'owner' && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">מארגן</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  שילם: ₪{(bal?.totalPaid || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className={`text-sm font-bold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {balance > 0 ? '+' : ''}₪{balance.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
              </div>
              {m.role !== 'owner' && (
                <button onClick={() => onRemoveMember(m.id)} className="p-1.5 text-gray-300 hover:text-red-400 active:scale-95">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExpensesTab({ expenses, members, onAddExpense }: {
  expenses: any[]
  members: TripMember[]
  onAddExpense: () => void
}) {
  return (
    <div className="space-y-4">
      <button
        onClick={onAddExpense}
        className="w-full bg-primary text-white rounded-xl py-3 font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        הוסף הוצאה משותפת
      </button>

      {expenses.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">אין הוצאות עדיין</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp: any) => {
            const catMeta = CATEGORY_META[exp.category as Category] || CATEGORY_META.other
            const paidByMember = members.find(m => m.id === exp.paid_by)
            return (
              <div key={exp.id} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: catMeta.color + '15' }}>
                    {catMeta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{exp.title}</h4>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {paidByMember ? `שולם ע״י ${paidByMember.display_name}` : ''} · {new Date(exp.expense_date).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold">₪{Number(exp.amount_ils || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</div>
                    {exp.currency !== 'ILS' && (
                      <div className="text-[10px] text-gray-400">
                        {CURRENCY_SYMBOL[exp.currency as Currency] || ''}{Number(exp.amount).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BalancesTab({ balances, debts, onSettle }: {
  balances: MemberBalance[]
  debts: Debt[]
  onSettle: (debt: Debt) => void
}) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="space-y-2">
        {balances.map(b => {
          const isPositive = b.balance > 0
          const isZero = Math.abs(b.balance) < 1
          return (
            <div key={b.member.id} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{b.member.display_name}</span>
                <div className={`text-sm font-bold ${isZero ? 'text-gray-400' : isPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {isZero ? 'מסולק' : isPositive ? `מגיע לו ₪${b.balance.toFixed(0)}` : `חייב ₪${Math.abs(b.balance).toFixed(0)}`}
                </div>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                <span>שילם: ₪{b.totalPaid.toFixed(0)}</span>
                <span>חלקו: ₪{b.totalOwed.toFixed(0)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Debts */}
      {debts.length > 0 && (
        <>
          <h3 className="font-bold text-sm mt-4">העברות נדרשות</h3>
          <div className="space-y-2">
            {debts.map((d, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-red-500">{d.fromName}</span>
                      <ArrowLeftRight className="w-4 h-4 text-gray-300" />
                      <span className="font-medium text-green-600">{d.toName}</span>
                    </div>
                    <div className="text-lg font-bold mt-1">₪{d.amount.toLocaleString('he-IL')}</div>
                  </div>
                  <button
                    onClick={() => onSettle(d)}
                    className="bg-green-50 text-green-600 px-4 py-2 rounded-xl text-sm font-medium active:scale-95 flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    סולק
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {debts.length === 0 && balances.length > 0 && (
        <div className="text-center py-8 text-gray-400">
          <Check className="w-10 h-10 mx-auto mb-2 text-green-500" />
          <p className="text-sm font-medium text-green-600">הכל מסולק!</p>
          <p className="text-xs text-gray-400">אין חובות פתוחים</p>
        </div>
      )}
    </div>
  )
}

function AddMemberModal({ tripId, onClose, onAdded }: { tripId: string; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) { toast.error('נא למלא שם'); return }
    setSaving(true)
    await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_member', trip_id: tripId, display_name: name.trim() }),
    })
    toast.success(`${name} נוסף לטיול!`)
    onAdded()
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="font-bold text-center mb-4">הוסף חבר</h3>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="שם החבר"
        className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mb-4 focus:ring-2 focus:ring-primary/20" autoFocus />
      <button onClick={handleAdd} disabled={saving}
        className="w-full bg-primary text-white rounded-xl py-3 font-medium active:scale-95 disabled:opacity-50">
        {saving ? '...' : 'הוסף'}
      </button>
    </Modal>
  )
}

function AddSharedExpenseModal({ tripId, members, onClose, onAdded }: {
  tripId: string; members: TripMember[]; onClose: () => void; onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('ILS')
  const [category, setCategory] = useState<Category>('food')
  const [paidBy, setPaidBy] = useState(members[0]?.id || '')
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({})
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members.map(m => m.id))
  const [saving, setSaving] = useState(false)

  const categories = Object.entries(CATEGORY_META)

  async function handleAdd() {
    if (!title.trim() || !amount) { toast.error('נא למלא שם וסכום'); return }
    setSaving(true)
    try {
      await fetch('/api/shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_expense',
          trip_id: tripId,
          title: title.trim(),
          amount: Number(amount),
          currency,
          category,
          expense_date: new Date().toISOString().split('T')[0],
          paid_by: paidBy,
          split_type: splitType,
          split_members: selectedMembers,
        }),
      })
      toast.success('הוצאה נוספה!')
      onAdded()
    } catch (err) {
      toast.error('שגיאה')
    } finally {
      setSaving(false)
    }
  }

  const perPerson = selectedMembers.length > 0 ? Number(amount || 0) / selectedMembers.length : 0

  return (
    <Modal onClose={onClose}>
      <h3 className="font-bold text-center mb-4">הוצאה משותפת</h3>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="על מה שילמת?"
        className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none mb-3 focus:ring-2 focus:ring-primary/20" autoFocus />

      {/* Amount + currency */}
      <div className="flex gap-2 mb-3">
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="סכום"
          className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
          className="bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none">
          {(['ILS', 'USD', 'THB', 'EUR', 'GBP'] as Currency[]).map(c => (
            <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>
          ))}
        </select>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {categories.map(([key, meta]) => (
          <button key={key} onClick={() => setCategory(key as Category)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap active:scale-95 transition-all ${
              category === key ? 'text-white' : 'bg-gray-100 text-gray-600'
            }`}
            style={category === key ? { background: meta.color } : undefined}>
            <span>{meta.icon}</span>
            {meta.label}
          </button>
        ))}
      </div>

      {/* Who paid */}
      <label className="text-xs text-gray-500 mb-1.5 block">מי שילם?</label>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {members.map(m => (
          <button key={m.id} onClick={() => setPaidBy(m.id)}
            className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap active:scale-95 ${
              paidBy === m.id ? 'bg-primary text-white' : 'bg-gray-100'
            }`}>
            {m.display_name}
          </button>
        ))}
      </div>

      {/* Split between */}
      <label className="text-xs text-gray-500 mb-1.5 block">לחלק בין:</label>
      <div className="space-y-1.5 mb-3">
        {members.map(m => (
          <label key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={selectedMembers.includes(m.id)}
              onChange={() => setSelectedMembers(prev =>
                prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
              )}
              className="w-4 h-4 rounded text-primary" />
            <span className="text-sm flex-1">{m.display_name}</span>
            {selectedMembers.includes(m.id) && amount && (
              <span className="text-xs text-gray-400">
                {CURRENCY_SYMBOL[currency]}{perPerson.toFixed(0)} לאדם
              </span>
            )}
          </label>
        ))}
      </div>

      <button onClick={handleAdd} disabled={saving}
        className="w-full bg-primary text-white rounded-xl py-3.5 font-bold active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
          <>
            <DollarSign className="w-5 h-5" />
            הוסף הוצאה
          </>
        )}
      </button>
    </Modal>
  )
}

function SettleModal({ tripId, debt, onClose, onSettled }: {
  tripId: string; debt: Debt; onClose: () => void; onSettled: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleSettle() {
    setSaving(true)
    await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'settle',
        trip_id: tripId,
        from_member: debt.from,
        to_member: debt.to,
        amount_ils: debt.amount,
        notes: `סילוק חוב`,
      }),
    })
    toast.success('החוב סולק!')
    onSettled()
  }

  return (
    <Modal onClose={onClose}>
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">💸</div>
        <h3 className="font-bold">סילוק חוב</h3>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="font-medium text-red-500">{debt.fromName}</span>
          <span className="text-gray-300">→</span>
          <span className="font-medium text-green-600">{debt.toName}</span>
        </div>
        <div className="text-2xl font-bold">₪{debt.amount.toLocaleString('he-IL')}</div>
      </div>
      <p className="text-xs text-gray-400 text-center mb-4">
        לאשר ש-{debt.fromName} שילם ל-{debt.toName} את הסכום הזה?
      </p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 bg-gray-100 rounded-xl py-3 text-sm font-medium active:scale-95">ביטול</button>
        <button onClick={handleSettle} disabled={saving}
          className="flex-1 bg-green-500 text-white rounded-xl py-3 text-sm font-medium active:scale-95 disabled:opacity-50">
          {saving ? '...' : 'אישור סילוק'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        {children}
      </motion.div>
    </motion.div>
  )
}
