'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, ScanLine, FolderOpen, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ראשי', icon: LayoutDashboard },
  { href: '/expenses', label: 'הוצאות', icon: Receipt },
  { href: '/scan', label: 'סרוק', icon: ScanLine, isFab: true },
  { href: '/documents', label: 'מסמכים', icon: FolderOpen },
  { href: '/timeline', label: 'ציר זמן', icon: CalendarDays },
]

const HIDDEN_PATHS = ['/onboarding', '/auth/login', '/auth/signup']

export default function BottomNav() {
  const pathname = usePathname()

  if (HIDDEN_PATHS.includes(pathname)) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          if (item.isFab) {
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center -mt-6">
                <div className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform',
                  isActive ? 'bg-primary' : 'bg-primary/90'
                )}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] mt-0.5 text-primary font-medium">{item.label}</span>
              </Link>
            )
          }

          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 active:scale-95 transition-transform px-3 py-1',
                isActive ? 'text-primary' : 'text-gray-400'
              )}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
