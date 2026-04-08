'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate, buildDailySummaries, type DailySummary } from '@/lib/utils'
import { Expense, CATEGORY_META, Category, CURRENCY_SYMBOL } from '@/types'

export default function TimelinePage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: true })

      if (error) {
        console.error(error)
      } else {
        setExpenses(data || [])
      }
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const summaries = buildDailySummaries(expenses)
  const maxDayTotal = Math.max(...summaries.map(s => s.totalIls), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">ציר זמן</h1>
      <p className="text-sm text-gray-500">21 ימי הטיול — 11.4 עד 1.5</p>

      <div className="space-y-2">
        {summaries.map((day: DailySummary) => {
          const isExpanded = expandedDay === day.date
          const progress = day.totalIls / maxDayTotal
          const categories = Array.from(new Set(day.expenses.map(e => e.category)))

          return (
            <motion.div key={day.date}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}>
              <button
                onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                className={`w-full bg-white rounded-2xl p-3 shadow-sm text-right active:scale-[0.98] transition-all ${day.isToday ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                <div className="flex items-center gap-3">
                  {/* Day number */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${day.isToday ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {day.dayNumber}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">{formatDate(day.date)}</span>
                      <span className="text-xs font-bold">
                        {day.totalIls > 0 ? formatMoney(day.totalIls) : ''}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="h-full rounded-full bg-gradient-to-l from-primary to-primary-light"
                      />
                    </div>

                    {/* Category dots */}
                    {categories.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {categories.map(cat => (
                          <div key={cat} className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: CATEGORY_META[cat]?.color }} />
                        ))}
                      </div>
                    )}
                  </div>

                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Expanded: day expenses */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="pt-2 pr-14 space-y-2">
                      {day.expenses.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">אין הוצאות</p>
                      ) : (
                        day.expenses.map(exp => {
                          const meta = CATEGORY_META[exp.category as Category]
                          return (
                            <div key={exp.id} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                              <span className="text-sm">{meta?.icon}</span>
                              <span className="flex-1 text-xs truncate">{exp.title}</span>
                              <div className="text-left flex-shrink-0">
                                <span className="text-xs font-bold">{formatMoney(exp.amount_ils)}</span>
                                {exp.currency !== 'ILS' && (
                                  <span className="text-[10px] text-gray-400 mr-1">
                                    {CURRENCY_SYMBOL[exp.currency]}{exp.amount}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
