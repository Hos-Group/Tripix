'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Lang, LANG_META, TranslationKey, t as translate } from '@/lib/i18n'

interface LanguageContextValue {
  lang:    Lang
  dir:     'rtl' | 'ltr'
  setLang: (lang: Lang) => void
  t:       (key: TranslationKey) => string
}

const STORAGE_KEY = 'tripix_lang'

const LanguageContext = createContext<LanguageContextValue>({
  lang:    'he',
  dir:     'rtl',
  setLang: () => {},
  t:       (key) => key,
})

function readSavedLang(): Lang {
  if (typeof window === 'undefined') return 'he'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'he' || saved === 'en' || saved === 'es') return saved
  } catch { /* ignore */ }
  return 'he'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads from localStorage on first render — this prevents
  // the previous race where the "save current lang" effect would overwrite the
  // stored value before the "load saved lang" effect could apply it.
  const [lang, setLangState] = useState<Lang>(() => readSavedLang())

  // Whenever lang changes, sync HTML attributes + localStorage.
  useEffect(() => {
    const meta = LANG_META[lang]
    document.documentElement.lang = lang
    document.documentElement.dir  = meta.dir
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch { /* ignore */ }
  }, [lang])

  // Cross-tab sync: if the user changes the language in another tab,
  // mirror the change here.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      if (e.newValue === 'he' || e.newValue === 'en' || e.newValue === 'es') {
        setLangState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
