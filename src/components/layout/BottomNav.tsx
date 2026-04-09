'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, ScanLine, FolderOpen, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTrip } from '@/contexts/TripContext'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ראשי',    icon: LayoutDashboard },
  { href: '/expenses',  label: 'הוצאות',  icon: Receipt,       tour: 'expenses-nav' },
  { href: '/scan',      label: 'סרוק',    icon: ScanLine,      isFab: true, tour: 'scan-btn' },
  { href: '/documents', label: 'מסמכים',  icon: FolderOpen,    tour: 'docs-nav' },
  { href: '/timeline',  label: 'ציר זמן', icon: CalendarDays,  tour: 'timeline-nav' },
]

const HIDDEN_PATHS = ['/onboarding', '/auth/login', '/auth/signup']

export default function BottomNav() {
  const pathname = usePathname()
  const { trips, loading } = useTrip()

  if (HIDDEN_PATHS.includes(pathname)) return null
  if (loading || trips.length === 0) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[45]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(108,71,255,0.08)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          /* ── Scan FAB ── */
          if (item.isFab) {
            return (
              <Link key={item.href} href={item.href} data-tour={item.tour}
                className="flex flex-col items-center -mt-7">
                <div
                  className={cn(
                    'w-[54px] h-[54px] rounded-full flex items-center justify-center transition-all duration-200',
                    isActive ? 'scale-95' : 'active:scale-90',
                  )}
                  style={{
                    background: 'linear-gradient(140deg, #6C47FF 0%, #9B7BFF 100%)',
                    boxShadow: isActive
                      ? '0 4px 14px rgba(108,71,255,0.30)'
                      : '0 8px 24px rgba(108,71,255,0.40)',
                  }}
                >
                  <ScanLine className="w-6 h-6 text-white" />
                </div>
                <span className={cn(
                  'text-[10px] mt-1 font-semibold tracking-tight transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-gray-400',
                )}>
                  {item.label}
                </span>
              </Link>
            )
          }

          /* ── Regular nav item ── */
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl active:scale-90 transition-all duration-150 relative"
            >
              {/* Active dot */}
              {isActive && (
                <span
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #6C47FF, #9B7BFF)' }}
                />
              )}

              {/* Icon wrapper with pill highlight */}
              <div className={cn(
                'w-9 h-7 rounded-xl flex items-center justify-center transition-all duration-200',
                isActive ? 'bg-primary/10' : 'bg-transparent',
              )}>
                <Icon className={cn(
                  'w-5 h-5 transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-gray-400',
                )} />
              </div>

              <span className={cn(
                'text-[10px] font-semibold tracking-tight transition-colors duration-200',
                isActive ? 'text-primary' : 'text-gray-400',
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
