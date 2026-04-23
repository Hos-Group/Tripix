'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '@/contexts/LanguageContext'
import { spring } from '@/lib/motion'

interface GreetingHeaderProps {
  /** User display name */
  name?: string
  /** Optional badge count for notifications */
  notifications?: number
  /** Optional notifications href (default /timeline) */
  notificationsHref?: string
}

const GREETINGS_BY_HOUR: Record<string, { he: string; en: string; es: string }> = {
  morning:   { he: 'בוקר טוב', en: 'Good morning',  es: 'Buenos días' },
  afternoon: { he: 'צהריים טובים', en: 'Good afternoon', es: 'Buenas tardes' },
  evening:   { he: 'ערב טוב', en: 'Good evening', es: 'Buenas tardes' },
  night:     { he: 'לילה טוב', en: 'Good night', es: 'Buenas noches' },
}

function timeBucket(): keyof typeof GREETINGS_BY_HOUR {
  if (typeof window === 'undefined') return 'morning'
  const h = new Date().getHours()
  if (h < 5)  return 'night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 22) return 'evening'
  return 'night'
}

function initials(name?: string): string {
  if (!name) return 'T'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || 'T'
}

/**
 * Revolut-style greeting block — "Good morning, Omer" + avatar + notifications bell.
 *
 * Used at the top of the dashboard, just inside the page (above the TravelCard).
 */
export default function GreetingHeader({
  name,
  notifications = 0,
  notificationsHref = '/timeline',
}: GreetingHeaderProps) {
  const { lang, t } = useLanguage()
  const reduce = useReducedMotion()

  const bucket = timeBucket()
  const greeting = GREETINGS_BY_HOUR[bucket][lang]
  const trimName = name?.split(/\s+/)[0]

  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      {/* Avatar + greeting */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <motion.div
          whileTap={reduce ? undefined : { scale: 0.92 }}
          transition={spring.tight}
          className="relative w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-base flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
            boxShadow:
              '0 6px 16px rgba(108,71,255,0.35), inset 0 1px 0 rgba(255,255,255,0.30)',
          }}
          aria-hidden="true"
        >
          {initials(name)}
          {/* Online indicator */}
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-[2px] border-white"
            style={{ background: '#10B981' }}
          />
        </motion.div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 font-medium leading-tight">
            {greeting} 👋
          </p>
          <p className="text-base font-black text-gray-900 truncate leading-tight tracking-tight">
            {trimName || (lang === 'he' ? 'נוסע' : lang === 'es' ? 'Viajero' : 'Traveler')}
          </p>
        </div>
      </div>

      {/* Notifications */}
      <Link
        href={notificationsHref}
        aria-label={
          lang === 'he' ? 'התראות'
            : lang === 'es' ? 'Notificaciones'
            : 'Notifications'
        }
        className="relative w-11 h-11 rounded-2xl flex items-center justify-center bg-white border border-gray-100 active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{
          boxShadow: '0 2px 10px rgba(15,12,40,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <Bell className="w-5 h-5 text-gray-700" aria-hidden="true" />
        {notifications > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-black text-white px-1"
            style={{
              background: 'linear-gradient(135deg, #EF4444, #F87171)',
              boxShadow: '0 2px 6px rgba(239,68,68,0.45)',
            }}
            aria-label={`${notifications} ${lang === 'he' ? 'חדשים' : lang === 'es' ? 'nuevos' : 'new'}`}
          >
            {notifications > 9 ? '9+' : notifications}
          </span>
        )}
      </Link>
    </div>
  )
}
