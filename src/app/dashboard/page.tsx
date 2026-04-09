'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  Plane, TrendingUp, CalendarDays, Wallet, Plus,
  ScanLine, FolderOpen, MoreHorizontal, ArrowLeftRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [showChart, setShowChart] = useState(false)

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('expense_date', { ascending: false })

      if (!error) setExpenses(data || [])
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const totalIls = expenses.reduce((sum, e) => sum + (e.amount_ils || 0), 0)

  const tripStart  = currentTrip ? new Date(currentTrip.start_date) : new Date()
  const tripEnd    = currentTrip ? new Date(currentTrip.end_date)   : new Date()
  const totalTripDays = Math.max(1, Math.ceil((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1)
  const daysElapsed   = Math.max(1, Math.ceil((Math.min(Date.now(), tripEnd.getTime()) - tripStart.getTime()) / 86400000) + 1)
  const avgDaily      = totalIls / daysElapsed
  const todayStr      = new Date().toISOString().split('T')[0]
  const todayTotal    = expenses.filter(e => e.expense_date === todayStr).reduce((s, e) => s + (e.amount_ils || 0), 0)
  const daysRemaining = Math.max(0, Math.ceil((tripEnd.getTime() - Date.now()) / 86400000))

  const RATE_FROM_ILS: Record<Currency, number> = {
    ILS: 1, USD: 1 / 3.70, THB: 1 / 0.105, EUR: 1 / 4.00, GBP: 1 / 4.65,
  }
  const convert = (ils: number) => {
    const val = ils * RATE_FROM_ILS[displayCurrency]
    return `${CURRENCY_SYMBOL[displayCurrency]}${Math.round(val).toLocaleString('he-IL')}`
  }

  const categoryData = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amount_ils || 0)
      return acc
    }, {})
  ).map(([cat, total]) => ({
    name:  CATEGORY_META[cat as Category]?.label || cat,
    value: Math.round(total),
    color: CATEGORY_META[cat as Category]?.color || '#888',
  }))

  const recentExpenses = expenses.slice(0, 8)

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || tripsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-10 h-10 rounded-full animate-spin"
          style={{ border: '3px solid rgba(108,71,255,0.15)', borderTopColor: '#6C47FF' }} />
        <p className="text-sm text-gray-400 font-medium">טוען...</p>
      </div>
    )
  }

  // ── No trips empty state ───────────────────────────────────────────────────
  if (!tripsLoading && trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
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
          <Link href="/trips/new"
            className="w-full text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-all shadow-fab"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
            <Plus className="w-5 h-5" />
            צור טיול ראשון
          </Link>
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { emoji: '💰', label: 'מעקב הוצאות' },
              { emoji: '📸', label: 'סריקת קבלות' },
              { emoji: '🧳', label: 'רשימת אריזה' },
            ].map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-white rounded-2xl p-3 shadow-card text-center">
                <div className="text-2xl mb-1">{f.emoji}</div>
                <p className="text-[11px] text-gray-500 font-medium">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Main Revolut-style dashboard ───────────────────────────────────────────
  return (
    <div className="page-enter -mx-4">
      {/* ══════════════════════════════════════════════════════
          HERO SECTION — full-width gradient background
          ════════════════════════════════════════════════════ */}
      <div
        className="relative px-5 pt-4 pb-8 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #EEE9FF 0%, #DDD4FF 35%, #C5B3FF 70%, #A98EFF 100%)',
          minHeight: 260,
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.25)', transform: 'translate(40%, -40%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'rgba(108,71,255,0.12)', transform: 'translate(-30%, 40%)' }} />

        {/* Top row: greeting + currency */}
        <div className="relative flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-dark/70 text-xs font-medium">
              {displayName ? `שלום, ${displayName}` : 'ברוך הבא'}
            </p>
            <p className="text-primary-dark font-bold text-sm truncate max-w-[180px]">
              {currentTrip?.name || 'בחר טיול'}
            </p>
          </div>
          <CurrencySelector value={displayCurrency} onChange={setDisplayCurrency} />
        </div>

        {/* Giant balance */}
        <div className="relative text-center mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-dark/60 mb-1">
            סה״כ הוצאות
          </p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            {/* Split the number like Revolut: integer · decimal */}
            <div className="flex items-end justify-center gap-1 leading-none">
              <span className="text-[52px] font-black tracking-tight text-primary-dark">
                {convert(totalIls).replace(/[^\d,]/g, '').split(',')[0]}
              </span>
              <span className="text-2xl font-bold text-primary-dark/70 mb-2">
                {CURRENCY_SYMBOL[displayCurrency]}
              </span>
            </div>
          </motion.div>
          <p className="text-xs text-primary-dark/55 mt-1 font-medium">
            {currentTrip?.destination} · {totalTripDays} ימים · {daysRemaining} נותרו
          </p>
        </div>

        {/* Trip switcher pill */}
        {trips.length > 1 && (
          <div className="relative flex justify-center mt-3">
            <Link href="/trips"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full active:scale-95 transition-all"
              style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(8px)' }}>
              <Plane className="w-3 h-3 text-primary-dark" />
              <span className="text-xs font-semibold text-primary-dark">כל הטיולים</span>
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{trips.length}</span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          QUICK ACTIONS — 4 circular buttons
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 pt-5 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-around">
          {[
            { href: '/scan',      icon: ScanLine,       label: 'סרוק',    color: '#6C47FF', bg: 'rgba(108,71,255,0.12)' },
            { href: '/expenses',  icon: Plus,           label: 'הוסף',    color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
            { href: '/documents', icon: FolderOpen,     label: 'מסמכים',  color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
            { href: '/tools',     icon: ArrowLeftRight, label: 'המרה',    color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
          ].map((item, i) => (
            <motion.div key={item.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}>
              <Link href={item.href}
                className="flex flex-col items-center gap-1.5 active:scale-90 transition-all">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: item.bg }}>
                  <item.icon className="w-6 h-6" style={{ color: item.color }} strokeWidth={1.8} />
                </div>
                <span className="text-[11px] font-semibold text-gray-600">{item.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          GMAIL SCAN BUTTON
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 py-3 border-b border-gray-50">
        <GmailScanButton onScanComplete={(created) => { if (created > 0) fetchExpenses() }} />
      </div>

      {/* ══════════════════════════════════════════════════════
          STATS STRIP — horizontal scroll
          ════════════════════════════════════════════════════ */}
      <div className="bg-white px-5 py-3 border-b border-gray-50">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[
            { label: 'ממוצע יומי', value: convert(avgDaily),  icon: TrendingUp,   color: '#10B981', bg: '#ECFDF5' },
            { label: 'היום',       value: convert(todayTotal), icon: CalendarDays, color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'ימי טיול',   value: `${totalTripDays}`, icon: Plane,        color: '#3B82F6', bg: '#EFF6FF' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl flex-shrink-0"
              style={{ background: s.bg }}>
              <s.icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
              <div>
                <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                <p className="text-sm font-bold text-gray-800 leading-tight">{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          TRANSACTIONS LIST — Revolut style
          ════════════════════════════════════════════════════ */}
      <div className="bg-white">
        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-800">הוצאות אחרונות</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowChart(c => !c)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all active:scale-95"
              style={{
                background: showChart ? 'rgba(108,71,255,0.10)' : 'transparent',
                color: showChart ? '#6C47FF' : '#9CA3AF',
              }}>
              {showChart ? 'רשימה' : 'גרף'}
            </button>
            <Link href="/expenses"
              className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full active:scale-95">
              הכל
            </Link>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showChart ? (
            /* ── Chart view ── */
            <motion.div key="chart"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 py-4 overflow-hidden">
              {categoryData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="45%" height={140}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" cx="50%" cy="50%"
                        innerRadius={38} outerRadius={60} paddingAngle={4}>
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatMoney(Number(val))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {categoryData.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }} />
                        <span className="flex-1 text-gray-500 truncate">{cat.name}</span>
                        <span className="font-bold text-gray-800">{formatMoney(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">אין נתונים</p>
              )}
            </motion.div>
          ) : (
            /* ── Transaction list ── */
            <motion.div key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}>
              {recentExpenses.length > 0 ? (
                <div>
                  {recentExpenses.map((exp, i) => {
                    const meta = CATEGORY_META[exp.category]
                    const isToday = exp.expense_date === todayStr
                    return (
                      <motion.div key={exp.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-3.5 px-5 py-3.5 active:bg-gray-50 transition-colors
                          ${i < recentExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        {/* Icon */}
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: meta.color + '18' }}>
                          {meta.icon}
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{exp.title}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {isToday ? 'היום' : exp.expense_date}
                            {' · '}{meta.label}
                          </p>
                        </div>

                        {/* Amount */}
                        <div className="text-left flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">
                            -{formatMoney(exp.amount_ils)}
                          </p>
                          {exp.currency !== 'ILS' && (
                            <p className="text-[10px] text-gray-400 text-left">
                              {CURRENCY_SYMBOL[exp.currency as Currency]}{exp.amount}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}

                  {/* "See all" row */}
                  {expenses.length > 8 && (
                    <Link href="/expenses"
                      className="flex items-center justify-between px-5 py-3.5 border-t border-gray-50 active:bg-gray-50 transition-colors">
                      <span className="text-sm font-semibold text-primary">
                        כל ההוצאות ({expenses.length})
                      </span>
                      <ChevronLeft className="w-4 h-4 text-primary" />
                    </Link>
                  )}
                </div>
              ) : (
                /* Empty state */
                <div className="px-5 py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-600 mb-1">אין הוצאות עדיין</p>
                  <p className="text-xs text-gray-400 mb-5">התחל לתעד את הוצאות הטיול</p>
                  <Link href="/scan"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                    <ScanLine className="w-4 h-4" />
                    סרוק קבלה ראשונה
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom padding */}
      <div className="h-6 bg-surface-secondary" />
    </div>
  )
}
