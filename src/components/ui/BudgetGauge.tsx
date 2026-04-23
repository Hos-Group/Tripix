'use client'

import Link from 'next/link'
import { ChevronLeft, Target } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '@/contexts/LanguageContext'
import { spring } from '@/lib/motion'

interface BudgetGaugeProps {
  /** Total budget */
  budget: number
  /** Spent so far (same currency) */
  spent: number
  /** Currency symbol */
  currencySymbol?: string
  /** Link to full budget page */
  href?: string
}

const COPY = {
  he: { title: 'תקציב הטיול', remaining: 'נשאר', used: 'נוצל', set: 'הגדר תקציב', over: 'חרגת מהתקציב', noBudget: 'הגדר תקציב כדי לעקוב אחר ההוצאות' },
  en: { title: 'Trip budget',  remaining: 'left',  used: 'used', set: 'Set budget', over: 'Over budget',         noBudget: 'Set a budget to track spending' },
  es: { title: 'Presupuesto',  remaining: 'queda', used: 'usado', set: 'Establecer', over: 'Sobre el presupuesto', noBudget: 'Establece un presupuesto para rastrear gastos' },
}

function formatNum(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('he-IL')
}

/**
 * Revolut-style budget visual — circular ring + numerical readout.
 * Tap to open full budget page.
 */
export default function BudgetGauge({ budget, spent, currencySymbol = '₪', href = '/budget' }: BudgetGaugeProps) {
  const { lang } = useLanguage()
  const copy = COPY[lang]
  const reduce = useReducedMotion()

  const noBudget = !budget || budget <= 0
  const pct = noBudget ? 0 : Math.min((spent / budget) * 100, 100)
  const remaining = budget - spent
  const isOver = !noBudget && spent > budget

  const trackColor = isOver ? '#FCA5A5' : pct > 80 ? '#FED7AA' : '#D1FAE5'
  const fillColor = isOver
    ? 'linear-gradient(135deg, #EF4444, #F87171)'
    : pct > 80
      ? 'linear-gradient(135deg, #F59E0B, #FBBF24)'
      : 'linear-gradient(135deg, #10B981, #34D399)'

  const SIZE = 140
  const STROKE = 14
  const RADIUS = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * RADIUS
  const offset = CIRC * (1 - pct / 100)

  // Empty state
  if (noBudget) {
    return (
      <Link
        href={href}
        aria-label={copy.set}
        className="block bg-white rounded-3xl p-5 border border-gray-50/80 active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ boxShadow: '0 2px 12px rgba(15,12,40,0.04), inset 0 1px 0 rgba(255,255,255,0.6)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)', boxShadow: '0 4px 12px rgba(108,71,255,0.30)' }}
            aria-hidden="true"
          >
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{copy.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{copy.noBudget}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-gray-400 flex-shrink-0 rtl:rotate-180" aria-hidden="true" />
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      aria-label={copy.title}
      className="block bg-white rounded-3xl p-5 border border-gray-50/80 active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      style={{ boxShadow: '0 2px 12px rgba(15,12,40,0.04), inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Circular gauge */}
        <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <defs>
              <linearGradient id="bg-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isOver ? '#EF4444' : pct > 80 ? '#F59E0B' : '#10B981'} />
                <stop offset="100%" stopColor={isOver ? '#F87171' : pct > 80 ? '#FBBF24' : '#34D399'} />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={trackColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              opacity={0.45}
            />
            {/* Fill */}
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="url(#bg-fill)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={reduce ? false : { strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          {/* Center number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-gray-900 leading-none tabular-nums tracking-tight">
              {Math.round(pct)}<span className="text-base font-bold text-gray-400">%</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mt-1">
              {copy.used}
            </span>
          </div>
        </div>

        {/* Right: title + amounts */}
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-sm font-bold text-gray-900">{copy.title}</p>

          <div className="space-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                {isOver ? copy.over : copy.remaining}
              </p>
              <p
                className="text-xl font-black tabular-nums leading-tight tracking-tight"
                style={{ color: isOver ? '#F43F5E' : '#10B981' }}
              >
                {currencySymbol}{formatNum(remaining)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                {copy.title}
              </p>
              <p className="text-sm font-bold text-gray-700 tabular-nums">
                {currencySymbol}{formatNum(spent)} / {currencySymbol}{formatNum(budget)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
