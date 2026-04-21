'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon?: LucideIcon
  emoji?: string
  title: string
  description?: string
  action?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}

export default function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      role="status"
      className={`flex flex-col items-center text-center px-6 py-10 ${className}`}
    >
      <div
        className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(108,71,255,0.10), rgba(155,123,255,0.10))' }}
        aria-hidden="true"
      >
        {Icon ? (
          <Icon className="w-8 h-8 text-primary" strokeWidth={1.75} />
        ) : emoji ? (
          <span className="text-3xl">{emoji}</span>
        ) : null}
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-xs">{description}</p>
      )}
      {action && <div className="w-full max-w-xs">{action}</div>}
      {secondaryAction && (
        <div className="w-full max-w-xs mt-2">{secondaryAction}</div>
      )}
    </motion.div>
  )
}
