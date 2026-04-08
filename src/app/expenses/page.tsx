'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, getTripDays, formatDateShort } from '@/lib/utils'
import { Expense, Category, Currency, CATEGORY_META, CURRENCIES, CURRENCY_SYMBOL } from '@/types'
import { format } from 'date-fns'
import { convertToILS } from '@/lib/rates'
import { useTrip } from '@/contexts/TripContext'

const CATEGORIES: Category[] = ['food', 'taxi', 'activity', 'shopping', 'hotel', 'flight', 'ferry', 'other']

export default function ExpensesPage() {
  const { currentTrip } = useTrip()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('food')
  const [expenseDate, setExpenseDate] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('THB')
  const [notes, setNotes] = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        setExpenses(data || [])
      }
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

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
      setTitle('')
      setAmount('')
      setNotes('')
      setShowForm(false)
      fetchExpenses()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('אתה בטוח שאתה רוצה למחוק? ההוצאה תימחק לצמיתות.')
    if (!confirmed) return

    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      toast.error('שגיאה במחיקה')
    } else {
      toast.success('ההוצאה נמחקה')
      setExpenses(prev => prev.filter(e => e.id !== id))
    }
  }

  const filtered = expenses.filter(e => {
    if (filterCat && e.category !== filterCat) return false
    if (search && !e.title.includes(search)) return false
    return true
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, Expense[]>>((acc, e) => {
    const key = e.expense_date
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הוצאות</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="חיפוש הוצאה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white rounded-xl pr-10 pl-4 py-3 text-sm shadow-sm border-0 outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setFilterCat(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all ${!filterCat ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>
          הכל
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => setFilterCat(filterCat === cat ? null : cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all ${filterCat === cat ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>
            {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* Add Button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-primary text-white rounded-2xl py-3 flex items-center justify-center gap-2 font-medium active:scale-95 transition-transform shadow-sm">
        {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        {showForm ? 'סגור' : 'הוסף הוצאה'}
      </button>

      {/* Inline Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3 overflow-hidden">
            <input
              type="text"
              placeholder="שם ההוצאה"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />

            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none">
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}</option>
              ))}
            </select>

            <select value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none">
              <option value="">בחר תאריך</option>
              {tripDays.map(day => {
                const val = format(day, 'yyyy-MM-dd')
                return <option key={val} value={val}>{formatDateShort(day)} — יום {tripDays.indexOf(day) + 1}</option>
              })}
            </select>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="סכום"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-24 bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none">
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="הערות (אופציונלי)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />

            <button onClick={handleSubmit} disabled={saving}
              className="w-full bg-green-500 text-white rounded-xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50">
              {saving ? 'שומר...' : 'שמור הוצאה'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expenses List Grouped by Day */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-3xl mb-2">💰</div>
          <p className="text-sm text-gray-500">אין הוצאות להצגה</p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dayExpenses]) => {
            const dayTotal = dayExpenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-500">{formatDateShort(date)}</span>
                  <span className="text-xs font-bold text-primary">{formatMoney(dayTotal)}</span>
                </div>
                {dayExpenses.map(exp => {
                  const meta = CATEGORY_META[exp.category]
                  return (
                    <motion.div key={exp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: meta.color + '20' }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{exp.title}</p>
                        <p className="text-xs text-gray-400">{meta.label}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="text-sm font-bold">{formatMoney(exp.amount_ils)}</p>
                        {exp.currency !== 'ILS' && (
                          <p className="text-[10px] text-gray-400">{CURRENCY_SYMBOL[exp.currency]}{exp.amount}</p>
                        )}
                      </div>
                      <button onClick={() => handleDelete(exp.id)}
                        className="text-gray-300 hover:text-red-400 active:scale-95 transition-all p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )
          })
      )}
    </div>
  )
}
