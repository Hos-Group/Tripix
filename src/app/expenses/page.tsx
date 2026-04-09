'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Trash2, X, ChevronDown, Wallet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, getTripDays, formatDateShort } from '@/lib/utils'
import { Expense, Category, Currency, CATEGORY_META, CURRENCIES, CURRENCY_SYMBOL } from '@/types'
import { format } from 'date-fns'
import { convertToILS } from '@/lib/rates'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'

const CATEGORIES: Category[] = ['food', 'taxi', 'activity', 'shopping', 'hotel', 'flight', 'ferry', 'other']

export default function ExpensesPage() {
  const { currentTrip } = useTrip()
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState<Category>('food')
  const [expenseDate, setExpenseDate] = useState('')
  const [amount, setAmount]         = useState('')
  const [currency, setCurrency]     = useState<Currency>('THB')
  const [notes, setNotes]           = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (!error) setExpenses(data || [])
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const tripDays = getTripDays()

  const handleSubmit = async () => {
    if (!title.trim() || !amount || !expenseDate) {
      toast.error('נא למלא שם, סכום ותאריך')
      return
    }
    setSaving(true)
    if (!currentTrip) { toast.error('בחר טיול קודם'); setSaving(false); return }

    const amountIls = await convertToILS(parseFloat(amount), currency, expenseDate)
    const { error } = await supabase.from('expenses').insert({
      trip_id: currentTrip.id,
      user_id: user?.id,
      title: title.trim(),
      category,
      amount: parseFloat(amount),
      currency,
      amount_ils: amountIls,
      expense_date: expenseDate,
      notes: notes.trim() || null,
      source: 'manual',
    })

    if (error) {
      toast.error('שגיאה בשמירה')
    } else {
      toast.success('ההוצאה נשמרה!')
      setTitle(''); setAmount(''); setNotes(''); setShowForm(false)
      fetchExpenses()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('אתה בטוח שאתה רוצה למחוק?')
    if (!confirmed) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה') }
    else { toast.success('נמחק'); setExpenses(prev => prev.filter(e => e.id !== id)) }
  }

  const filtered = expenses.filter(e => {
    if (filterCat && e.category !== filterCat) return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = filtered.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.expense_date]) acc[e.expense_date] = []
    acc[e.expense_date].push(e)
    return acc
  }, {})

  const totalIls = expenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTotal = expenses.filter(e => e.expense_date === todayStr).reduce((s, e) => s + (e.amount_ils || 0), 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-10 h-10 rounded-full animate-spin"
          style={{ border: '3px solid rgba(108,71,255,0.15)', borderTopColor: '#6C47FF' }} />
        <p className="text-sm text-gray-400 font-medium">טוען...</p>
      </div>
    )
  }

  return (
    <div className="page-enter space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-2xl font-black tracking-tight gradient-text">הוצאות</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 transition-all text-white"
          style={{ background: showForm ? '#EF4444' : 'linear-gradient(135deg,#6C47FF,#9B7BFF)' }}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-card border border-gray-50/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">סה״כ</p>
            <p className="text-base font-black text-gray-900 leading-tight">{formatMoney(totalIls)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl px-4 py-3 shadow-card border border-gray-50/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <span className="text-base">📅</span>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">היום</p>
            <p className="text-base font-black text-gray-900 leading-tight">{formatMoney(todayTotal)}</p>
          </div>
        </div>
      </div>

      {/* ── Add Expense Form (slide-down sheet) ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-3xl p-5 shadow-card-hover border border-gray-50 space-y-3"
          >
            <p className="text-sm font-bold text-gray-800 mb-1">הוצאה חדשה</p>

            {/* Title */}
            <input type="text" placeholder="שם ההוצאה" value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-primary/20 transition-all"
            />

            {/* Category */}
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value as Category)}
                className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none appearance-none">
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Date */}
            <div className="relative">
              <select value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none appearance-none">
                <option value="">בחר תאריך</option>
                {tripDays.map(day => {
                  const val = format(day, 'yyyy-MM-dd')
                  return <option key={val} value={val}>{formatDateShort(day)} — יום {tripDays.indexOf(day) + 1}</option>
                })}
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Amount + Currency */}
            <div className="flex gap-2">
              <input type="number" placeholder="סכום" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-primary/20 transition-all"
              />
              <div className="relative w-24">
                <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
                  className="w-full bg-surface-secondary rounded-2xl px-3 py-3 text-sm font-medium outline-none appearance-none">
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Notes */}
            <input type="text" placeholder="הערות (אופציונלי)" value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-primary/20 transition-all"
            />

            {/* Save button */}
            <button onClick={handleSubmit} disabled={saving}
              className="w-full text-white rounded-2xl py-3.5 font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
              style={{ background: saving ? '#9CA3AF' : 'linear-gradient(135deg,#10B981,#34D399)' }}>
              {saving ? 'שומר...' : '✓ שמור הוצאה'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="חיפוש הוצאות..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white rounded-2xl pr-10 pl-4 py-3 text-sm font-medium shadow-card outline-none focus:ring-2 ring-primary/20 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* ── Category filter pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterCat(null)}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all"
          style={!filterCat
            ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
            : { background: 'white', color: '#6B7280' }}>
          הכל
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(filterCat === cat ? null : cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all"
            style={filterCat === cat
              ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
              : { background: 'white', color: '#6B7280' }}>
            {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* ── Expense list grouped by date ── */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-600 mb-1">
            {search || filterCat ? 'לא נמצאו תוצאות' : 'אין הוצאות עדיין'}
          </p>
          <p className="text-xs text-gray-400">
            {search || filterCat ? 'נסה לשנות את הסינון' : 'הוסף הוצאה ראשונה'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayExpenses]) => {
              const dayTotal = dayExpenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
              const isToday = date === todayStr
              return (
                <div key={date}>
                  {/* Date header */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">{formatDateShort(date)}</span>
                      {isToday && (
                        <span className="text-[10px] font-bold text-primary bg-primary-50 px-2 py-0.5 rounded-full">
                          היום
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-700">{formatMoney(dayTotal)}</span>
                  </div>

                  {/* Day expenses card */}
                  <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-50/80">
                    {dayExpenses.map((exp, i) => {
                      const meta = CATEGORY_META[exp.category]
                      return (
                        <motion.div key={exp.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`flex items-center gap-3.5 px-4 py-3.5 active:bg-gray-50 transition-colors
                            ${i < dayExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          {/* Icon */}
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: meta.color + '18' }}>
                            {meta.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{exp.title}</p>
                            <p className="text-[11px] text-gray-400">{meta.label}</p>
                          </div>

                          {/* Amount */}
                          <div className="text-left flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">-{formatMoney(exp.amount_ils)}</p>
                            {exp.currency !== 'ILS' && (
                              <p className="text-[10px] text-gray-400 text-left">
                                {CURRENCY_SYMBOL[exp.currency as Currency]}{exp.amount}
                              </p>
                            )}
                          </div>

                          {/* Delete */}
                          <button onClick={() => handleDelete(exp.id)}
                            className="p-1.5 rounded-xl text-gray-300 active:text-red-400 active:bg-red-50 transition-all active:scale-90">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
