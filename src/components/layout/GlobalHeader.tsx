'use client'

import { usePathname } from 'next/navigation'
import HamburgerMenu from './HamburgerMenu'
import { useLanguage } from '@/contexts/LanguageContext'
import { Lang } from '@/lib/i18n'

// Pages where the global header should NOT appear
const HIDDEN_PATHS = ['/auth/login', '/auth/signup', '/onboarding']

export default function GlobalHeader() {
  const pathname = usePathname()
  const { lang, setLang } = useLanguage()
  if (HIDDEN_PATHS.includes(pathname)) return null

  return (
    <div
      className="fixed top-0 right-0 z-50 p-3 flex items-center gap-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingRight: '16px' }}
    >
      {/* Language quick-switch */}
      <button
        onClick={() => {
          const cycle: Lang[] = ['he', 'en', 'es']
          const current = cycle.indexOf(lang)
          setLang(cycle[(current + 1) % cycle.length])
        }}
        className="w-8 h-8 rounded-xl bg-white/80 flex items-center justify-center text-sm font-bold border border-gray-200 active:scale-90 transition-all"
        title="Change language"
        style={{ fontSize: '12px' }}
      >
        {lang === 'he' ? '🇮🇱' : lang === 'en' ? '🇺🇸' : '🇪🇸'}
      </button>
      <HamburgerMenu />
    </div>
  )
}
