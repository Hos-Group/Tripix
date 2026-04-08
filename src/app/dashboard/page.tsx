'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Plane, TrendingUp, CalendarDays, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, getDaysRemaining, getTripDays } from '@/lib/utils'
import { Expense, Category, CATEGORY_META, Currency, CURRENCY_SYMBOL } from '@/types'
import HamburgerMenu from '@/components/layout/HamburgerMenu'
import { useTrip } from '@/contexts/TripContext'

export default function DashboardPage() {
  const { currentTrip } = useTrip()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('ILS')

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('expense_date', { ascending: false })

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

  const totalIls = expenses.reduce((sum, e) => sum + (e.amount_ils || 0), 0)

  // Use currentTrip dates instead of hardcoded env
  const tripStart = currentTrip ? new Date(currentTrip.start_date) : new Date()
  const tripEnd = currentTrip ? new Date(currentTrip.end_date) : new Date()
  const totalTripDays = Math.max(1, Math.ceil((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1)
  const daysElapsed = Math.max(1, Math.ceil((Math.min(Date.now(), tripEnd.getTime()) - tripStart.getTime()) / 86400000) + 1)
  const avgDaily = totalIls / daysElapsed
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTotal = expenses
    .filter(e => e.expense_date === todayStr)
    .reduce((sum, e) => sum + (e.amount_ils || 0), 0)
  const daysRemaining = Math.max(0, Math.ceil((tripEnd.getTime() - Date.now()) / 86400000))
  const tripName = currentTrip?.name || 'טיול'
  const tripDestination = currentTrip?.destination || ''

  const RATE_FROM_ILS: Record<Currency, number> = {
    ILS: 1, USD: 1 / 3.70, THB: 1 / 0.105, EUR: 1 / 4.00, GBP: 1 / 4.65,
  }

  const convert = (ils: number) => {
    const val = ils * RATE_FROM_ILS[displayCurrency]
    return `${CURRENCY_SYMBOL[displayCurrency]}${Math.round(val).toLocaleString('he-IL')}`
  }

  // Category breakdown for chart
  const categoryData = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amount_ils || 0)
      return acc
    }, {})
  ).map(([cat, total]) => ({
    name: CATEGORY_META[cat as Category]?.label || cat,
    value: Math.round(total),
    color: CATEGORY_META[cat as Category]?.color || '#888',
  }))

  const lastFive = expenses.slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <HamburgerMenu />
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold">Tripix</h1>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['ILS', 'THB', 'USD'] as Currency[]).map(c => (
            <button key={c} onClick={() => setDisplayCurrency(c)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all active:scale-95 ${displayCurrency === c ? 'bg-white shadow text-primary' : 'text-gray-500'}`}>
              {CURRENCY_SYMBOL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Total Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-6 text-white shadow-lg">
        <p className="text-sm opacity-80 mb-1">סה&quot;כ הוצאות</p>
        <p className="text-4xl font-bold">{convert(totalIls)}</p>
        <div className="flex items-center gap-1 mt-2 text-sm opacity-70">
          <Plane className="w-4 h-4" />
          <span>{tripName} · {totalTripDays} ימים</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Wallet, label: 'סה"כ', value: convert(totalIls), color: 'text-primary' },
          { icon: TrendingUp, label: 'ממוצע יומי', value: convert(avgDaily), color: 'text-green-600' },
          { icon: CalendarDays, label: 'היום', value: convert(todayTotal), color: 'text-orange-500' },
          { icon: Plane, label: 'מספר ימי נסיעה', value: `${totalTripDays}`, color: 'text-purple-500' },
        ].map((stat, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <p className="text-lg font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Pie Chart */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">חלוקה לפי קטגוריה</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" cx="50%" cy="50%"
                  innerRadius={40} outerRadius={65} paddingAngle={3}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatMoney(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 pr-2">
              {categoryData.map((cat, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-gray-600">{cat.name}</span>
                  <span className="font-medium">{formatMoney(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      {lastFive.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">הוצאות אחרונות</h3>
          <div className="space-y-3">
            {lastFive.map(exp => {
              const meta = CATEGORY_META[exp.category]
              return (
                <div key={exp.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: meta.color + '20' }}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exp.title}</p>
                    <p className="text-xs text-gray-400">{meta.label} · {exp.expense_date}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{formatMoney(exp.amount_ils)}</p>
                    {exp.currency !== 'ILS' && (
                      <p className="text-[10px] text-gray-400">
                        {CURRENCY_SYMBOL[exp.currency]}{exp.amount}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="text-4xl mb-3">✈️</div>
          <p className="font-bold mb-1">אין הוצאות עדיין</p>
          <p className="text-sm text-gray-500">התחילו לתעד את ההוצאות מהטיול!</p>
        </div>
      )}
    </div>
  )
}
