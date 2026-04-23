'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Globe, Check } from 'lucide-react'
import { Lang, LANG_META } from '@/lib/i18n'
import { useLanguage } from '@/contexts/LanguageContext'
import { spring, dialogVariants, backdropVariants } from '@/lib/motion'

const LANGS: Lang[] = ['he', 'en', 'es']

const COPY: Record<Lang, { title: string; subtitle: string; current: string; aria: string }> = {
  he: {
    title:    'בחר שפה',
    subtitle: 'הממשק כולו ישתנה לשפה הנבחרת',
    current:  'נוכחי',
    aria:     'בחירת שפה',
  },
  en: {
    title:    'Choose language',
    subtitle: 'The entire interface will switch to your chosen language',
    current:  'Current',
    aria:     'Language selection',
  },
  es: {
    title:    'Elegir idioma',
    subtitle: 'Toda la interfaz cambiará al idioma elegido',
    current:  'Actual',
    aria:     'Selección de idioma',
  },
}

export default function LanguageSwitcher() {
  const { lang, setLang, dir } = useLanguage()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const copy = COPY[lang]

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus first language button after open
    const t = setTimeout(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>('[data-lang-option]')
      first?.focus()
    }, 80)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === 'Tab' && sheetRef.current) {
        const els = sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (els.length === 0) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Arrow nav between language options
        const opts = Array.from(
          sheetRef.current?.querySelectorAll<HTMLElement>('[data-lang-option]') ?? [],
        )
        const idx = opts.indexOf(document.activeElement as HTMLElement)
        if (idx >= 0) {
          e.preventDefault()
          const next = e.key === 'ArrowDown'
            ? (idx + 1) % opts.length
            : (idx - 1 + opts.length) % opts.length
          opts[next]?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      triggerRef.current?.focus()
    }
  }, [open])

  function handleSelect(next: Lang) {
    setLang(next)
    setOpen(false)
  }

  const meta = LANG_META[lang]

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${copy.aria}. ${COPY[lang].current}: ${meta.nativeName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-11 h-11 rounded-2xl flex items-center justify-center gap-1 active:scale-90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        <Globe className="w-4 h-4 text-gray-600" aria-hidden="true" />
        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">
          {lang}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-[95] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,12,40,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
            dir={dir}
          >
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lang-switcher-title"
              aria-describedby="lang-switcher-desc"
              variants={dialogVariants}
              initial={reduce ? false : 'initial'}
              animate="animate"
              exit="exit"
              className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_20px_64px_rgba(15,12,40,0.32)]"
            >
              {/* Header */}
              <div
                className="px-6 pt-6 pb-5 text-center text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                />
                <div
                  className="relative w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
                  aria-hidden="true"
                >
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h2 id="lang-switcher-title" className="text-lg font-black tracking-tight relative">
                  {copy.title}
                </h2>
                <p id="lang-switcher-desc" className="text-white/85 text-xs mt-1 leading-relaxed relative">
                  {copy.subtitle}
                </p>
              </div>

              {/* Language options */}
              <ul role="list" className="p-2 space-y-1">
                {LANGS.map((code) => {
                  const m = LANG_META[code]
                  const isActive = code === lang
                  return (
                    <li key={code}>
                      <motion.button
                        type="button"
                        data-lang-option
                        onClick={() => handleSelect(code)}
                        aria-current={isActive ? 'true' : undefined}
                        whileTap={reduce ? undefined : { scale: 0.97 }}
                        transition={spring.tight}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[60px] rounded-2xl text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                          isActive
                            ? 'bg-primary/8'
                            : 'hover:bg-gray-50 active:bg-gray-100'
                        }`}
                        dir={m.dir}
                      >
                        <span className="text-3xl flex-shrink-0" aria-hidden="true">
                          {m.flag}
                        </span>
                        <div className="flex-1 min-w-0 text-start">
                          <p className={`text-base font-bold leading-tight ${isActive ? 'text-primary' : 'text-gray-900'}`}>
                            {m.nativeName}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wider">
                            {code}
                          </p>
                        </div>
                        {isActive ? (
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                              {copy.current}
                            </span>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}
                              aria-hidden="true"
                            >
                              <Check className="w-4 h-4 text-white" strokeWidth={3} />
                            </div>
                          </span>
                        ) : (
                          <span
                            className="w-7 h-7 rounded-full border-2 border-gray-200 flex-shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </motion.button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
