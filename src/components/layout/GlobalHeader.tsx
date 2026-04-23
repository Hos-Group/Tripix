'use client'

import { usePathname } from 'next/navigation'
import HamburgerMenu from './HamburgerMenu'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

// Pages where the global header should NOT appear
const HIDDEN_PATHS = ['/auth/login', '/auth/signup', '/onboarding']

export default function GlobalHeader() {
  const pathname = usePathname()
  if (HIDDEN_PATHS.includes(pathname)) return null

  return (
    <div
      className="fixed top-0 right-0 z-50 p-3 flex items-center gap-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingRight: '16px' }}
    >
      <LanguageSwitcher />
      <HamburgerMenu />
    </div>
  )
}
