'use client'

import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { spring, itemVariants } from '@/lib/motion'

interface TransactionRowProps {
  /** Big colored circle icon (left) */
  icon: ReactNode
  /** Background color for the icon circle */
  iconBg: string
  /** Primary line (e.g. merchant / title) */
  title: string
  /** Sublabel (category / time / location) */
  subtitle?: string
  /** Big amount on the right (already formatted) */
  amount: string
  /** Smaller line under amount (foreign currency, etc.) */
  amountSub?: string
  /** Whether amount is positive (income/refund — green) or negative (default) */
  positive?: boolean
  /** Optional aria-label for the row */
  ariaLabel?: string
  /** Optional click handler — if set, row is interactive */
  onClick?: () => void
  /** Optional right-side action buttons (edit, delete, etc.) */
  actions?: ReactNode
  /** Bottom border within a group? */
  withBorder?: boolean
}

/**
 * Revolut-style transaction row.
 *
 * - Left: big colored circle with category icon
 * - Middle: title (bold) + subtitle (smaller, muted)
 * - Right: amount (bold, tabular-nums) + sub-amount (foreign currency)
 * - Optional: action buttons that appear on hover/tap
 */
export default function TransactionRow({
  icon,
  iconBg,
  title,
  subtitle,
  amount,
  amountSub,
  positive = false,
  ariaLabel,
  onClick,
  actions,
  withBorder = true,
}: TransactionRowProps) {
  const reduce = useReducedMotion()

  const content = (
    <div className="flex items-center gap-3.5 w-full">
      {/* Icon circle */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{
          background: iconBg,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate leading-tight">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Amount */}
      <div className="text-end flex-shrink-0">
        <p
          className={`text-sm font-black leading-tight tabular-nums tracking-tight ${
            positive ? 'text-emerald-600' : 'text-gray-900'
          }`}
          dir="ltr"
        >
          {positive ? '+' : '−'}{amount}
        </p>
        {amountSub && (
          <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums" dir="ltr">{amountSub}</p>
        )}
      </div>

      {/* Optional actions */}
      {actions && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  )

  const borderCls = withBorder ? 'border-b border-gray-50 last:border-b-0' : ''

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? title}
        variants={itemVariants}
        layout="position"
        whileTap={reduce ? undefined : { scale: 0.99, backgroundColor: 'rgba(108,71,255,0.04)' }}
        transition={spring.tight}
        className={`w-full px-4 py-3.5 active:bg-gray-50 transition-colors text-start focus-visible:outline-none focus-visible:bg-primary/5 ${borderCls}`}
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      variants={itemVariants}
      layout="position"
      className={`px-4 py-3.5 active:bg-gray-50 transition-colors ${borderCls}`}
    >
      {content}
    </motion.div>
  )
}
