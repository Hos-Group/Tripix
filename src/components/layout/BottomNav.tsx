'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { LayoutDashboard, Receipt, ScanLine, FolderOpen, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { spring } from '@/lib/motion'
import { useTrip } from '@/contexts/TripContext'
import { useLanguage } from '@/contexts/LanguageContext'

const HIDDEN_PATHS = ['/onboarding', '/auth/login', '/auth/signup']

export default function BottomNav() {
  const pathname = usePathname()
  const { trips, loading } = useTrip()
  const { t } = useLanguage()
  const reduce = useReducedMotion()

  const NAV_ITEMS = [
    { href: '/dashboard', labelKey: 'nav_home' as const,      icon: LayoutDashboard },
    { href: '/expenses',  labelKey: 'nav_expenses' as const,  icon: Receipt,       tour: 'expenses-nav' },
    { href: '/scan',      labelKey: 'nav_scan' as const,      icon: ScanLine,      isFab: true, tour: 'scan-btn' },
    { href: '/documents', labelKey: 'nav_documents' as const, icon: FolderOpen,    tour: 'docs-nav' },
    { href: '/timeline',  labelKey: 'nav_timeline' as const,  icon: CalendarDays,  tour: 'timeline-nav' },
  ]

  if (HIDDEN_PATHS.includes(pathname)) return null
  if (loading || trips.length === 0) return null

  return (
    <nav
      aria-label={t('nav_main_label')}
      className="fixed bottom-0 left-0 right-0 z-[45]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderTop: '1px solid rgba(108,71,255,0.10)',
        boxShadow: '0 -10px 36px rgba(15,12,40,0.06)',
      }}
    >
      <ul className="flex items-center justify-around h-[68px] max-w-lg mx-auto px-2" role="list">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const label = t(item.labelKey)

          if (item.isFab) {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-tour={item.tour}
                  aria-label={`${label}${isActive ? ' ' + t('nav_current_page') : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex flex-col items-center -mt-7 min-w-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                >
                  <motion.div
                    whileTap={reduce ? undefined : { scale: 0.88 }}
                    animate={isActive ? { scale: 0.96 } : { scale: 1 }}
                    transition={spring.tight}
                    className="w-[58px] h-[58px] rounded-full flex items-center justify-center relative"
                    style={{
                      background: 'linear-gradient(140deg, #6C47FF 0%, #9B7BFF 100%)',
                      boxShadow: isActive
                        ? '0 4px 14px rgba(108,71,255,0.30), inset 0 1px 0 rgba(255,255,255,0.25)'
                        : '0 10px 28px rgba(108,71,255,0.42), inset 0 1px 0 rgba(255,255,255,0.30)',
                    }}
                  >
                    {/* Pulsing halo when active */}
                    {isActive && !reduce && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'rgba(155,123,255,0.45)' }}
                        animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
                      />
                    )}
                    <ScanLine className="w-6 h-6 text-white relative" aria-hidden="true" />
                  </motion.div>
                  <span className={cn(
                    'text-[11px] mt-1 font-bold tracking-tight transition-colors',
                    isActive ? 'text-primary' : 'text-gray-500',
                  )}>
                    {label}
                  </span>
                </Link>
              </li>
            )
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-tour={item.tour}
                aria-label={`${label}${isActive ? ' (עמוד נוכחי)' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center gap-0.5 px-3 py-2 min-w-[60px] min-h-[56px] rounded-2xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {/* Animated active background — uses layoutId for smooth slide */}
                {isActive && (
                  <motion.span
                    layoutId="bottomnav-active"
                    aria-hidden="true"
                    className="absolute inset-x-1.5 inset-y-1 rounded-2xl"
                    style={{ background: 'rgba(108,71,255,0.10)' }}
                    transition={reduce ? { duration: 0 } : spring.ui}
                  />
                )}
                {/* Top accent bar (also animated) */}
                {isActive && (
                  <motion.span
                    layoutId="bottomnav-bar"
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-b-full"
                    style={{ background: 'linear-gradient(90deg, #6C47FF, #9B7BFF)' }}
                    transition={reduce ? { duration: 0 } : spring.ui}
                  />
                )}
                <motion.div
                  whileTap={reduce ? undefined : { scale: 0.85 }}
                  transition={spring.tight}
                  className={cn(
                    'w-10 h-7 rounded-xl flex items-center justify-center relative z-10',
                  )}
                  aria-hidden="true"
                >
                  <Icon className={cn(
                    'w-5 h-5 transition-colors duration-200',
                    isActive ? 'text-primary' : 'text-gray-500',
                  )} />
                </motion.div>
                <span className={cn(
                  'text-[11px] font-semibold tracking-tight transition-colors duration-200 relative z-10',
                  isActive ? 'text-primary' : 'text-gray-500',
                )}>
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
