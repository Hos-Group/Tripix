'use client'

import { ReactNode, MouseEvent, KeyboardEvent } from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { spring, tapScale } from '@/lib/motion'

type Elevation = 'flat' | 'sm' | 'md' | 'lg'

const elevationClasses: Record<Elevation, string> = {
  flat: 'shadow-none border border-gray-100',
  sm:   'shadow-card border border-gray-50/80',
  md:   'shadow-[0_6px_24px_rgba(0,0,0,0.08)] border border-gray-50/60',
  lg:   'shadow-[0_12px_40px_rgba(0,0,0,0.10)] border border-gray-50/40',
}

interface CardProps {
  children: ReactNode
  className?: string
  elevation?: Elevation
  /** Inner padding default 'p-4'. Pass 'none' for no padding (e.g. media-edge). */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  as?: 'div' | 'section' | 'article'
}

const paddingClasses = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
}

/** Static container — not pressable. */
export function Card({
  children, className, elevation = 'sm', padding = 'md', as: Tag = 'div',
}: CardProps) {
  return (
    <Tag className={cn('bg-white rounded-2xl', elevationClasses[elevation], paddingClasses[padding], className)}>
      {children}
    </Tag>
  )
}

interface PressableCardProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  className?: string
  elevation?: Elevation
  padding?: 'none' | 'sm' | 'md' | 'lg'
  href?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** Aria label for the press affordance. */
  ariaLabel?: string
}

/**
 * Pressable card — used for tappable rows/items.
 * Has consistent press scale, focus ring, and spring feedback.
 * If `href` is provided, renders as a Next <Link>; otherwise as a <button>.
 */
export function PressableCard({
  children,
  className,
  elevation = 'sm',
  padding = 'md',
  href,
  onClick,
  ariaLabel,
  ...rest
}: PressableCardProps) {
  const reduce = useReducedMotion()
  const cls = cn(
    'bg-white rounded-2xl text-right block w-full',
    'transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    elevationClasses[elevation],
    paddingClasses[padding],
    className,
  )

  if (href) {
    return (
      <motion.div
        whileTap={reduce ? undefined : tapScale}
        transition={spring.tight}
      >
        <Link href={href} aria-label={ariaLabel} className={cls}>
          {children}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={reduce ? undefined : tapScale}
      transition={spring.tight}
      className={cls}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        // Activate on Enter/Space (button does this natively, but ensures consistency)
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault()
          onClick(e as unknown as MouseEvent<HTMLButtonElement>)
        }
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
