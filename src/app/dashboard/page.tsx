'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Plane, TrendingUp, CalendarDays, Wallet, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, getDaysRemaining, getTripDays } from '@/lib/utils'
import { Expense, Category, CATEGORY_META, Currency, CURRENCY_SYMBOL } from '@/types'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import GmailScanButton from '@/components/GmailScanButton'
import CurrencySelector from '@/components/CurrencySelector'

export default function DashboardPage() {
  const { currentTrip, trips, loading: tripsLoading } = useTrip()
  const { displayName } = useAuth()
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

  if (loading || tripsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-10 h-10 rounded-full animate-spin"
          style={{ border: '3px solid rgba(108,71,255,0.15)', borderTopColor: '#6C47FF' }} />
        <p className="text-sm text-gray-400 font-medium">טוען...</p>
      </div>
    )
  }

  // No trips at all — show welcome / empty state
  if (!tripsLoading && trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Greeting */}
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <Plane className="w-12 h-12 text-white" />
          </div>
          {displayName && (
            <p className="text-gray-400 text-sm mb-1">שלום {displayName} 👋</p>
          )}
          <h2 className="text-2xl font-bold tracking-tight mb-2">מוכן לטיול הראשון?</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            צור טיול ראשון כדי להתחיל לעקוב אחר ההוצאות, המסמכים ולוח הזמנים שלך
          </p>

          {/* CTA */}
          <Link href="/trips/new"
            className="w-full text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-fab"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
            <Plus className="w-5 h-5" />
            צור טיול ראשון
          </Link>

          {/* Feature hints */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { emoji: '💰', label: 'מעקב הוצאות' },
              { emoji: '📸', label: 'סריקת קבלות' },
              { emoji: '🧳', label: 'רשימת אריזה' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-white rounded-2xl p-3 shadow-sm text-center"
              >
                <div className="text-2xl mb-1">{f.emoji}</div>
                <p className="text-[11px] text-gray-500 font-medium">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Tripix</h1>
          {displayName && <p className="text-xs text-gray-400 mt-0.5">שלום, {displayName} 👋</p>}
        </div>
        <CurrencySelector value={displayCurrency} onChange={setDisplayCurrency} />
      </div>

      {/* Total Card */}
      <motion.div
        data-tour="dashboard-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(140deg, #6C47FF 0%, #9B7BFF 60%, #B9A0FF 100%)' }}
      >
        {/* Subtle decorative blobs */}
        <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-white/8 pointer-events-none" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="absolute -bottom-8 -right-6 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="absolute top-4 left-20 w-20 h-20 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.04)' }} />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <Plane className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium opacity-90 truncate">{tripName} · {tripDestination}</span>
          </div>
          <p className="text-xs font-medium opacity-60 mb-1 tracking-wide uppercase">סה״כ הוצאות</p>
          <p className="text-4xl font-bold tracking-tight">{convert(totalIls)}</p>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1.5 text-xs opacity-70">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{totalTripDays} ימים · {daysRemaining} נותרו</span>
            </div>
            <div className="text-xs font-semibold bg-white/20 rounded-full px-2.5 py-0.5 backdrop-blur-sm">
              {displayCurrency}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gmail Scan — instant import button */}
      <GmailScanButton onScanComplete={(created) => { if (created > 0) fetchExpenses() }} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Wallet,       label: 'סה"כ',     value: convert(totalIls),  color: 'text-primary',     bg: 'bg-primary-50' },
          { icon: TrendingUp,   label: 'ממוצע יומי', value: convert(avgDaily), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: CalendarDays, label: 'היום',      value: convert(todayTotal), color: 'text-amber-600',  bg: 'bg-amber-50' },
          { icon: Plane,        label: 'ימי טיול',  value: `${totalTripDays}`, color: 'text-sky-500',    bg: 'bg-sky-50' },
        ].map((stat, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
            className="bg-white rounded-2xl p-4 shadow-card border border-gray-50/80">
            <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-xl font-bold tracking-tight leading-tight">{stat.value}</p>
            <span className="text-xs text-gray-400 font-medium mt-0.5">{stat.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Pie Chart */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-50/80">
          <h3 className="text-sm font-bold mb-3 tracking-tight">חלוקה לפי קטגוריה</h3>
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
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-gray-600 truncate">{cat.name}</span>
                  <span className="font-semibold text-gray-800">{formatMoney(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      {lastFive.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-50/80">
          <h3 className="text-sm font-bold mb-3 tracking-tight">הוצאות אחרונות</h3>
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
