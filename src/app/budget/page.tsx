'use client'

import { useEffect, useState, useCallback } from 'react'
import { Target, TrendingUp, TrendingDown, Edit3, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, getTripDays } from '@/lib/utils'
import { Expense, CATEGORY_META, Category } from '@/types'

export default function BudgetPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [budget, setBudget] = useState<number>(0)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [{ data: expData }, { data: tripData }] = await Promise.all([
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('trips').select('budget_ils').limit(1).single(),
      ])
      setExpenses(expData || [])
      setBudget(tripData?.budget_ils || 0)
      setBudgetInput(String(tripData?.budget_ils || ''))
    } catch {
      console.error('Failed to load budget data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveBudget = async () => {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val <= 0) { toast.error('נא להזין סכום תקין'); return }
    await supabase.from('trips').update({ budget_ils: val }).not('id', 'is', null)
    setBudget(val)
    setEditingBudget(false)
    toast.success('תקציב עודכן')
  }

  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount_ils || 0), 0)
  const remaining = budget - totalSpent
  const percentage = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0
  const tripDays = getTripDays()
  const daysElapsed = Math.max(1, tripDays.filter(d => d <= new Date()).length)
  const daysTotal = tripDays.length
  const avgDaily = totalSpent / daysElapsed
  const projectedTotal = avgDaily * daysTotal

  // Category breakdown
  const categoryBreakdown = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amount_ils || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const isOverBudget = budget > 0 && totalSpent > budget
  const progressColor = isOverBudget ? 'bg-red-500' : percentage > 75 ? 'bg-orange-400' : 'bg-green-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold">מעקב תקציב</h1>
      </div>

      {/* Budget Setting */}
      {budget === 0 || editingBudget ? (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">הגדר תקציב לטיול</span>
          </div>
          <div className="flex gap-2">
            <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="סכום בשקלים" className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
            <button onClick={saveBudget}
              className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-medium active:scale-95">
              שמור
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Budget Progress */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl p-6 shadow-lg ${isOverBudget ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-primary to-primary-dark'} text-white`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm opacity-80">תקציב כולל</p>
                <p className="text-3xl font-bold">{formatMoney(budget)}</p>
              </div>
              <button onClick={() => setEditingBudget(true)} className="active:scale-95">
                <Edit3 className="w-5 h-5 opacity-70" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(percentage, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${isOverBudget ? 'bg-yellow-300' : 'bg-white'}`}
              />
            </div>

            <div className="flex justify-between text-xs opacity-80">
              <span>הוצאות: {formatMoney(totalSpent)}</span>
              <span>{Math.round(percentage)}%</span>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-2xl p-3 text-center ${remaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-[10px] text-gray-500">נותר</p>
              <p className={`text-sm font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatMoney(Math.abs(remaining))}
              </p>
              {remaining < 0 && <p className="text-[9px] text-red-400">חריגה!</p>}
            </div>
            <div className="bg-blue-50 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-gray-500">ממוצע יומי</p>
              <p className="text-sm font-bold text-blue-600">{formatMoney(avgDaily)}</p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-gray-500">צפי סה&quot;כ</p>
              <p className={`text-sm font-bold ${projectedTotal > budget ? 'text-red-500' : 'text-purple-600'}`}>
                {formatMoney(projectedTotal)}
              </p>
              {projectedTotal > budget && (
                <TrendingUp className="w-3 h-3 text-red-400 mx-auto" />
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold">חלוקה לפי קטגוריה</h3>
            {categoryBreakdown.map(([cat, total]) => {
              const meta = CATEGORY_META[cat as Category]
              const catPerc = budget > 0 ? (total / budget) * 100 : 0
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{meta?.icon}</span>
                      <span className="text-xs">{meta?.label}</span>
                    </div>
                    <span className="text-xs font-bold">{formatMoney(total)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(catPerc, 100)}%`, backgroundColor: meta?.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
