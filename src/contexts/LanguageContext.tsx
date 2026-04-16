'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Lang, LANG_META, TranslationKey, t as translate } from '@/lib/i18n'

interface LanguageContextValue {
  lang:    Lang
  dir:     'rtl' | 'ltr'
  setLang: (lang: Lang) => void
  t:       (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang:    'he',
  dir:     'rtl',
  setLang: () => {},
  t:       (key) => key,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('he')

  // Load persisted language on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tripix_lang') as Lang | null
      if (saved && (saved === 'he' || saved === 'en' || saved === 'es')) {
        setLangState(saved)
      }
    } catch { /* ignore */ }
  }, [])

  // Update HTML element attributes when language changes
  useEffect(() => {
    const meta = LANG_META[lang]
    document.documentElement.lang = lang
    document.documentElement.dir  = meta.dir
    try {
      localStorage.setItem('tripix_lang', lang)
    } catch { /* ignore */ }
  }, [lang])

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
  }, [])

  const tFn = useCallback(
    (key: TranslationKey) => translate(key, lang),
    [lang]
  )

  return (
    <LanguageContext.Provider value={{ lang, dir: LANG_META[lang].dir, setLang, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
