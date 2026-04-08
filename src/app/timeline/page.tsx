'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronLeft, Trash2, Pencil, X, Check, TrendingUp, Calendar, Wallet } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/utils'
import { Expense, Category, CATEGORY_META, Currency, CURRENCY_SYMBOL } from '@/types'
import { useTrip } from '@/contexts/TripContext'
import { eachDayOfInterval, parseISO, format, isToday, differenceInDays } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────
interface DayData {
  date:       string   // yyyy-MM-dd
  dayNumber:  number
  isToday:    boolean
  isPast:     boolean
  isFuture:   boolean
  expenses:   Expense[]
  totalIls:   number
}

type FilterCat = 'all' | Category

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildDays(startDate: string, endDate: string, expenses: Expense[]): DayData[] {
  const start = parseISO(startDate)
  const end   = parseISO(endDate)
  const days  = eachDayOfInterval({ start, end })
  const today = new Date()

  return days.map((day, idx) => {
    const dateStr  = format(day, 'yyyy-MM-dd')
    const dayExps  = expenses.filter(e => e.expense_date === dateStr)
    const totalIls = dayExps.reduce((s, e) => s + (e.amount_ils || 0), 0)
    return {
      date:      dateStr,
      dayNumber: idx + 1,
      isToday:   isToday(day),
      isPast:    day < today && !isToday(day),
      isFuture:  day > today,
      expenses:  dayExps,
      totalIls,
    }
  })
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const { currentTrip } = useTrip()

  const [expenses,    setExpenses]    = useState<Expense[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [filterCat,   setFilterCat]   = useState<FilterCat>('all')
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editTitle,   setEditTitle]   = useState('')
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [currency,    setCurrency]    = useState<Currency>('ILS')

  // ── Fetch expenses for current trip ───────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', currentTrip.id)
      .order('expense_date', { ascending: true })
    if (!error) setExpenses(data || [])
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // ── Derived data ──────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (!currentTrip) return []
    return buildDays(currentTrip.start_date, currentTrip.end_date, expenses)
  }, [currentTrip, expenses])

  const filteredDays = useMemo(() => {
    if (filterCat === 'all') return days
    return days.map(d => ({
      ...d,
      expenses:  d.expenses.filter(e => e.category === filterCat),
      totalIls:  d.expenses.filter(e => e.category === filterCat)
                   .reduce((s, e) => s + (e.amount_ils || 0), 0),
    }))
  }, [days, filterCat])

  const maxDayTotal = useMemo(
    () => Math.max(...filteredDays.map(d => d.totalIls), 1),
    [filteredDays],
  )

  const totalIls     = expenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
  const daysWithSpend = days.filter(d => d.totalIls > 0).length
  const avgPerDay    = daysWithSpend > 0 ? totalIls / daysWithSpend : 0
  const highestDay   = days.reduce((m, d) => d.totalIls > m.totalIls ? d : m, days[0] || { totalIls: 0, date: '' })

  // used categories in the data
  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category))
    return Array.from(cats) as Category[]
  }, [expenses])

  // Currency conversion
  const RATE: Record<Currency, number> = { ILS: 1, USD: 1/3.70, THB: 1/0.105, EUR: 1/4.00, GBP: 1/4.65 }
  const convert = (ils: number) => {
    const val = ils * RATE[currency]
    return `${CURRENCY_SYMBOL[currency]}${Math.round(val).toLocaleString('he-IL')}`
  }

  // ── Inline rename ─────────────────────────────────────────────────────────
  const handleRename = async (exp: Expense) => {
    if (!editTitle.trim() || editTitle === exp.title) { setEditingId(null); return }
    const { error } = await supabase.from('expenses').update({ title: editTitle }).eq('id', exp.id)
    if (error) { toast.error('שגיאה בשמירה'); return }
    setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, title: editTitle } : e))
    setEditingId(null)
    toast.success('עודכן')
  }

  // ── Delete expense ────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error('שגיאה במחיקה'); setDeletingId(null); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
    toast.success('נמחק')
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-6">
        <p className="text-gray-400">לא נבחר טיול</p>
        <Link href="/trips" className="text-primary text-sm font-medium">בחר טיול →</Link>
      </div>
    )
  }

  const totalDays     = differenceInDays(parseISO(currentTrip.end_date), parseISO(currentTrip.start_date)) + 1
  const daysRemaining = Math.max(0, differenceInDays(parseISO(currentTrip.end_date), new Date()))

  return (
    <div className="space-y-4 pb-8" dir="rtl">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">ציר זמן</h1>
            <p className="text-xs text-gray-400">{currentTrip.destination} · {totalDays} ימים</p>
          </div>
        </div>

        {/* Currency selector */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['ILS', 'USD', 'THB'] as Currency[]).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all ${currency === c ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
              {CURRENCY_SYMBOL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Wallet,    label: 'סה״כ',       value: convert(totalIls),  color: 'text-primary' },
          { icon: TrendingUp, label: 'ממוצע / יום', value: convert(avgPerDay), color: 'text-green-600' },
          { icon: Calendar,  label: 'נותרו',       value: `${daysRemaining} ימים`, color: 'text-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
            <p className="text-sm font-bold">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Budget bar (if trip has budget) ─────────────────────────────── */}
      {currentTrip.budget_ils && (
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">תקציב</span>
            <span className="font-semibold">
              {convert(totalIls)} / {convert(currentTrip.budget_ils)}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalIls / currentTrip.budget_ils) * 100, 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                totalIls / currentTrip.budget_ils > 0.9 ? 'bg-red-400' :
                totalIls / currentTrip.budget_ils > 0.7 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-left">
            {Math.round((totalIls / currentTrip.budget_ils) * 100)}% מהתקציב
          </p>
        </div>
      )}

      {/* ── Category filter ──────────────────────────────────────────────── */}
      {usedCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setFilterCat('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filterCat === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 shadow-sm'
            }`}
          >
            הכל
          </button>
          {usedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filterCat === cat ? 'text-white shadow-sm' : 'bg-white text-gray-500 shadow-sm'
              }`}
              style={filterCat === cat ? { backgroundColor: CATEGORY_META[cat].color } : {}}
            >
              <span>{CATEGORY_META[cat].icon}</span>
              {CATEGORY_META[cat].label}
            </button>
          ))}
        </div>
      )}

      {/* ── Day list ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filteredDays.map((day) => {
          const isExpanded = expandedDay === day.date
          const progress   = maxDayTotal > 0 ? day.totalIls / maxDayTotal : 0
          const isHighest  = day.date === highestDay.date && day.totalIls > 0 && filterCat === 'all'
          const cats       = Array.from(new Set(day.expenses.map(e => e.category))) as Category[]

          return (
            <motion.div key={day.date}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}>

              {/* Day header row */}
              <button
                onClick={() => day.expenses.length > 0 && setExpandedDay(isExpanded ? null : day.date)}
                className={`w-full bg-white rounded-2xl px-3 py-2.5 shadow-sm text-right transition-all
                  ${day.isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
                  ${day.expenses.length > 0 ? 'active:scale-[0.99]' : 'cursor-default'}
                  ${day.isFuture && day.expenses.length === 0 ? 'opacity-40' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Day badge */}
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center ${
                    day.isToday   ? 'bg-primary text-white' :
                    day.isPast    ? 'bg-gray-800 text-white' :
                                    'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="text-[10px] font-normal leading-none opacity-70">יום</span>
                    <span className="text-sm font-bold leading-tight">{day.dayNumber}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">{formatDate(day.date)}</span>
                        {day.isToday && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">היום</span>
                        )}
                        {isHighest && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">🏆 הגבוה</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-800">
                        {day.totalIls > 0 ? convert(day.totalIls) : ''}
                      </span>
                    </div>

                    {/* Spending bar */}
                    {day.totalIls > 0 && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            isHighest ? 'bg-amber-400' :
                            day.isToday ? 'bg-primary' :
                            'bg-gray-400'
                          }`}
                        />
                      </div>
                    )}

                    {/* Category chips */}
                    {cats.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {cats.map(cat => (
                          <span key={cat}
                            className="text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: CATEGORY_META[cat].color + '20', color: CATEGORY_META[cat].color }}>
                            {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                          </span>
                        ))}
                        <span className="text-[10px] text-gray-400 mr-auto">
                          {day.expenses.length} פריטים
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-300">אין הוצאות</p>
                    )}
                  </div>

                  {day.expenses.length > 0 && (
                    <ChevronDown className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </div>
              </button>

              {/* Expanded expense list */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="pt-1.5 pr-4 pl-1 space-y-1.5">
                      {day.expenses.map(exp => {
                        const meta = CATEGORY_META[exp.category as Category]
                        const isEditing  = editingId === exp.id
                        const isDeleting = deletingId === exp.id

                        return (
                          <div key={exp.id}
                            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-50">

                            {/* Category icon */}
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                              style={{ backgroundColor: meta.color + '20' }}>
                              {meta.icon}
                            </div>

                            {/* Title / edit input */}
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={editTitle}
                                  onChange={e => setEditTitle(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRename(exp)
                                    if (e.key === 'Escape') setEditingId(null)
                                  }}
                                  className="w-full text-xs border-b border-primary outline-none bg-transparent pb-0.5"
                                  dir="rtl"
                                />
                              ) : (
                                <p className="text-xs font-medium truncate">{exp.title}</p>
                              )}
                              <p className="text-[10px] text-gray-400">{meta.label}</p>
                            </div>

                            {/* Amount */}
                            <div className="text-left flex-shrink-0">
                              <p className="text-xs font-bold">{convert(exp.amount_ils)}</p>
                              {exp.currency !== 'ILS' && (
                                <p className="text-[10px] text-gray-400">
                                  {CURRENCY_SYMBOL[exp.currency]}{exp.amount}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            {isEditing ? (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => handleRename(exp)}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 active:scale-90">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 active:scale-90">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => { setEditingId(exp.id); setEditTitle(exp.title) }}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 active:scale-90 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDelete(exp.id)}
                                  disabled={isDeleting}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 active:scale-90 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30">
                                  {isDeleting
                                    ? <span className="text-[9px] animate-spin">⏳</span>
                                    : <Trash2 className="w-3 h-3" />
                                  }
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {expenses.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-4xl mb-3">✈️</div>
          <p className="font-bold mb-1">אין הוצאות עדיין</p>
          <p className="text-sm text-gray-400">הוצאות שתוסיף יופיעו כאן לפי ימי הטיול</p>
        </div>
      )}

    </div>
  )
}
