'use client'

import { useEffect, useState, useCallback } from 'react'
import { Target, TrendingUp, Edit3, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, getTripDays } from '@/lib/utils'
import { Expense, CATEGORY_META, Category } from '@/types'
import { CategoryIconBadge } from '@/lib/iconConfig'
import { useLanguage } from '@/contexts/LanguageContext'

export default function BudgetPage() {
  const { t, dir } = useLanguage()
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
  const progressColor = isOverBudget ? '#EF4444' : percentage > 75 ? '#F97316' : '#10B981'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('budget_title')}</h1>
        </div>
      </div>

      {/* Budget Setting */}
      {budget === 0 || editingBudget ? (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
              <Target className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold">{t('budget_set')}</span>
          </div>
          <div className="flex gap-2">
            <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="סכום בשקלים" className="flex-1 bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none border border-gray-100" />
            <button onClick={saveBudget}
              className="text-white rounded-2xl px-6 py-3 text-sm font-bold active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
              {t('save')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Budget Progress Hero */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-6 shadow-lg text-white"
            style={{ background: isOverBudget ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm opacity-80 mb-1">תקציב כולל</p>
                <p className="text-3xl font-black">{formatMoney(budget)}</p>
              </div>
              <button onClick={() => setEditingBudget(true)} className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition-all">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-white/20 rounded-full overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(percentage, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-white"
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="opacity-80">הוצאות: <span className="font-bold">{formatMoney(totalSpent)}</span></span>
              <span className="font-bold opacity-90">{Math.round(percentage)}%</span>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-2xl p-3 text-center border ${remaining >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <p className="text-[10px] text-gray-500 mb-1">{t('budget_remaining')}</p>
              <p className={`text-sm font-black ${remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatMoney(Math.abs(remaining))}
              </p>
              {remaining < 0 && <p className="text-[9px] text-red-400 font-bold">חריגה!</p>}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">ממוצע יומי</p>
              <p className="text-sm font-black text-blue-600">{formatMoney(avgDaily)}</p>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">צפי סה&quot;כ</p>
              <p className={`text-sm font-black ${projectedTotal > budget ? 'text-red-500' : 'text-violet-600'}`}>
                {formatMoney(projectedTotal)}
              </p>
              {projectedTotal > budget && (
                <TrendingUp className="w-3 h-3 text-red-400 mx-auto mt-0.5" />
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">חלוקה לפי קטגוריה</h3>
              {categoryBreakdown.map(([cat, total]) => {
                const meta = CATEGORY_META[cat as Category]
                const catPerc = budget > 0 ? (total / budget) * 100 : 0
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CategoryIconBadge category={cat as Category} size="sm" />
                        <span className="text-xs font-medium text-gray-700">{meta?.label}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-800">{formatMoney(total)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(catPerc, 100)}%`, backgroundColor: meta?.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
