'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Plane, Wifi } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface TravelCardProps {
  /** Trip name (shown small at top of card) */
  tripName?: string
  /** Destination (shown small) */
  destination?: string
  /** Big hero amount */
  amount: string
  /** Currency symbol shown next to amount */
  currencySymbol: string
  /** Footer line (e.g. "12 days · 4 left") */
  footer?: string
  /** Cardholder name (printed on the card) */
  cardholder?: string
  /** Optional gradient override */
  gradient?: string
}

/**
 * Revolut-inspired "virtual travel card" hero.
 *
 * - Embossed credit-card aesthetic (chip + subtle wifi mark + holographic shine)
 * - Massive balance number is the hero
 * - Glassmorphic shine layer on top for depth
 * - Subtle parallax tilt on tap (mobile delight)
 */
export default function TravelCard({
  tripName,
  destination,
  amount,
  currencySymbol,
  footer,
  cardholder,
  gradient = 'linear-gradient(135deg, #0F0C28 0%, #2D1A6B 38%, #6C47FF 78%, #9B7BFF 100%)',
}: TravelCardProps) {
  const reduce = useReducedMotion()
  const { t, lang } = useLanguage()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280, mass: 0.9 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      className="relative w-full aspect-[1.586/1] rounded-3xl overflow-hidden text-white"
      style={{
        background: gradient,
        boxShadow:
          '0 24px 64px rgba(15,12,40,0.32), 0 8px 24px rgba(108,71,255,0.20), inset 0 1px 0 rgba(255,255,255,0.18)',
        perspective: 1000,
      }}
      role="region"
      aria-label={`${tripName ?? 'Trip'} card`}
    >
      {/* Holographic shine — multi-stop gradient that pulses subtly */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0.05) 56%, transparent 70%)',
          mixBlendMode: 'overlay',
        }}
        animate={reduce ? undefined : { backgroundPosition: ['0% 0%', '100% 100%'] }}
        transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
      />

      {/* Aurora orbs */}
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(108,71,255,0.45) 0%, transparent 70%)' }}
      />

      {/* Content */}
      <div className="relative h-full p-5 flex flex-col justify-between">
        {/* Top row: chip-like badge + Tripix branding */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* "Chip" — glassy tile */}
            <div
              className="w-10 h-7 rounded-md flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,221,140,0.95) 0%, rgba(255,180,90,0.85) 60%, rgba(255,150,60,0.85) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.25)',
              }}
              aria-hidden="true"
            >
              <div className="w-7 h-4 rounded-sm" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.10), transparent)' }} />
            </div>
            <div>
              {tripName && (
                <p className="text-white font-bold text-[13px] truncate max-w-[160px] leading-tight">
                  {tripName}
                </p>
              )}
              {destination && (
                <p className="text-white/65 text-[11px] truncate max-w-[160px] mt-0.5">
                  {destination}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-white/70 -rotate-90" aria-hidden="true" />
            <span className="text-white/85 font-black text-sm tracking-tight">Tripix</span>
          </div>
        </div>

        {/* Hero: balance — biggest thing on screen */}
        <div className="flex flex-col items-start">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55 mb-1">
            {t('dash_total_expenses')}
          </p>
          <div className="flex items-end gap-1.5 leading-none">
            <span className="text-2xl font-bold text-white/75 mb-2">{currencySymbol}</span>
            <span
              className="text-[58px] font-black tracking-tight tabular-nums text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
              aria-live="polite"
            >
              {amount}
            </span>
          </div>
          {footer && (
            <p className="text-white/65 text-[11px] mt-2 font-medium">{footer}</p>
          )}
        </div>

        {/* Bottom row: cardholder + plane logo */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
              {lang === 'he' ? 'נושא הכרטיס' : lang === 'es' ? 'Titular' : 'Cardholder'}
            </p>
            <p className="text-white text-sm font-bold tracking-wide truncate max-w-[180px] mt-0.5">
              {cardholder || 'TRAVELER'}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
            aria-hidden="true"
          >
            <Plane className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
