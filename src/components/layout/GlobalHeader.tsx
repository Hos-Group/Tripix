'use client'

import { usePathname } from 'next/navigation'
import HamburgerMenu from './HamburgerMenu'
import { useLanguage } from '@/contexts/LanguageContext'
import { Lang } from '@/lib/i18n'

// Pages where the global header should NOT appear
const HIDDEN_PATHS = ['/auth/login', '/auth/signup', '/onboarding']

const LANG_META: Record<Lang, { flag: string; name: string; next: Lang }> = {
  he: { flag: '🇮🇱', name: 'עברית',  next: 'en' },
  en: { flag: '🇺🇸', name: 'English', next: 'es' },
  es: { flag: '🇪🇸', name: 'Español', next: 'he' },
}

export default function GlobalHeader() {
  const pathname = usePathname()
  const { lang, setLang } = useLanguage()
  if (HIDDEN_PATHS.includes(pathname)) return null

  const meta = LANG_META[lang]
  const nextMeta = LANG_META[meta.next]

  return (
    <div
      className="fixed top-0 right-0 z-50 p-3 flex items-center gap-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingRight: '16px' }}
    >
      {/* Language quick-switch */}
      <button
        type="button"
        onClick={() => setLang(meta.next)}
        aria-label={`שפה נוכחית: ${meta.name}. החלף ל${nextMeta.name}`}
        className="w-11 h-11 rounded-2xl bg-white/85 flex items-center justify-center text-base font-bold border border-gray-200/80 active:scale-90 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
      >
        <span aria-hidden="true">{meta.flag}</span>
      </button>
      <HamburgerMenu />
    </div>
  )
}
