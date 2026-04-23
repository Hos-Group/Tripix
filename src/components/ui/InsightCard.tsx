'use client'

import { LucideIcon, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '@/contexts/LanguageContext'
import { itemVariants, spring, staggerContainer } from '@/lib/motion'

interface InsightProps {
  /** Header above value */
  label: string
  /** Big number / value */
  value: string
  /** Optional sublabel under value */
  sub?: string
  /** Trend direction (up = bad for spending; down = good) */
  trend?: 'up' | 'down' | 'flat'
  /** Trend value (e.g. "+12%" / "-3%") */
  trendLabel?: string
  /** Icon */
  icon?: LucideIcon
  /** Color theme */
  tone?: 'violet' | 'emerald' | 'amber' | 'rose' | 'blue'
}

const toneStyles: Record<NonNullable<InsightProps['tone']>, { bg: string; iconBg: string; iconColor: string; accent: string }> = {
  violet:  { bg: 'rgba(108,71,255,0.06)',  iconBg: 'rgba(108,71,255,0.12)',  iconColor: '#6C47FF', accent: '#6C47FF' },
  emerald: { bg: 'rgba(16,185,129,0.06)',  iconBg: 'rgba(16,185,129,0.12)',  iconColor: '#10B981', accent: '#10B981' },
  amber:   { bg: 'rgba(245,158,11,0.06)',  iconBg: 'rgba(245,158,11,0.12)',  iconColor: '#F59E0B', accent: '#F59E0B' },
  rose:    { bg: 'rgba(244,63,94,0.06)',   iconBg: 'rgba(244,63,94,0.12)',   iconColor: '#F43F5E', accent: '#F43F5E' },
  blue:    { bg: 'rgba(59,130,246,0.06)',  iconBg: 'rgba(59,130,246,0.12)',  iconColor: '#3B82F6', accent: '#3B82F6' },
}

export function Insight({ label, value, sub, trend, trendLabel, icon: Icon, tone = 'violet' }: InsightProps) {
  const reduce = useReducedMotion()
  const t = toneStyles[tone]
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor =
    trend === 'down' ? '#10B981'
      : trend === 'up' ? '#F43F5E'
      : '#9CA3AF'

  return (
    <motion.div
      variants={itemVariants}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={spring.tight}
      className="relative rounded-3xl p-4 overflow-hidden border border-gray-50/80 bg-white"
      style={{ boxShadow: '0 2px 12px rgba(15,12,40,0.04), inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      {/* Tone-tinted backdrop wash */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${t.bg} 0%, transparent 65%)` }}
      />

      <div className="relative flex items-start justify-between gap-2 mb-3">
        {Icon && (
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: t.iconBg, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" style={{ color: t.iconColor }} strokeWidth={2} />
          </div>
        )}
        {trendLabel && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{ background: `${trendColor}15`, color: trendColor }}
          >
            <TrendIcon className="w-3 h-3" aria-hidden="true" strokeWidth={2.5} />
            <span className="text-[10px] font-bold tabular-nums">{trendLabel}</span>
          </div>
        )}
      </div>

      <div className="relative">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-500 mt-1.5 font-medium">{sub}</p>}
      </div>
    </motion.div>
  )
}

interface InsightGridProps {
  insights: InsightProps[]
  /** Grid columns (default 2) */
  cols?: 2 | 3
  /** Optional aria label */
  ariaLabel?: string
}

export function InsightGrid({ insights, cols = 2, ariaLabel }: InsightGridProps) {
  const { lang } = useLanguage()
  const defaultLabel =
    lang === 'he' ? 'תובנות' : lang === 'es' ? 'Estadísticas' : 'Insights'

  const reduce = useReducedMotion()
  return (
    <motion.section
      variants={staggerContainer}
      initial={reduce ? false : 'initial'}
      animate="animate"
      aria-label={ariaLabel ?? defaultLabel}
      className={`grid gap-3 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      {insights.map((ins, i) => (
        <Insight key={`${ins.label}-${i}`} {...ins} />
      ))}
    </motion.section>
  )
}
