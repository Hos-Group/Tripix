'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'

interface TourStep {
  target: string   // data-tour value
  title: string
  description: string
  emoji: string
}

const TOUR_STEPS: TourStep[] = [
  { target: 'scan-btn',        title: 'סרוק קבלות',       emoji: '📸', description: 'צלם קבלה והמערכת תחלץ את כל הפרטים אוטומטית עם AI — סכום, קטגוריה, תאריך.' },
  { target: 'dashboard-card',  title: 'תקציב בזמן אמת',   emoji: '💰', description: 'ראה בדיוק כמה הוצאת, מה נשאר לך ואיך מחולק התקציב לפי קטגוריה.' },
  { target: 'expenses-nav',    title: 'כל ההוצאות',        emoji: '🧾', description: 'כל ההוצאות מסודרות לפי תאריך וקטגוריה. חפש, סנן ועדכן בקלות.' },
  { target: 'docs-nav',        title: 'מסמכי הטיול',       emoji: '📄', description: 'שמור כרטיסי טיסה, אישורי מלון ודרכונים — הכל מאורגן ונגיש תמיד.' },
  { target: 'timeline-nav',    title: 'ציר זמן',           emoji: '🗓️', description: 'ראה את כל הטיול יום אחרי יום — הוצאות, מסמכים ואירועים בציר אחד.' },
  { target: 'hamburger-btn',   title: 'כלים נוספים',       emoji: '✨', description: 'גישה לעוזר AI, מזג אוויר, רשימת אריזה, כלי המרה ועוד.' },
]

interface Rect { top: number; left: number; width: number; height: number }

// Approximate tooltip card height for positioning calculations
const TOOLTIP_H = 185
const PAD = 8

function calcTooltipStyle(rect: Rect | null): React.CSSProperties {
  if (!rect) {
    // No target found — center on screen
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(360, window.innerWidth - 24),
      zIndex: 9999,
    }
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const isDesktop = vw >= 768

  if (isDesktop) {
    // Desktop: try to place tooltip to the LEFT of the element first,
    // then right, then below — whatever fits best.
    const cardW = 360
    const spaceLeft  = rect.left - PAD
    const spaceRight = vw - (rect.left + rect.width + PAD)

    let left: number
    if (spaceRight >= cardW) {
      left = rect.left + rect.width + PAD
    } else if (spaceLeft >= cardW) {
      left = rect.left - cardW - PAD
    } else {
      // Not enough horizontal space — center it horizontally near the element
      left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - PAD))
    }

    // Vertically align with the element, but clamp to viewport
    const top = Math.max(PAD, Math.min(rect.top, vh - TOOLTIP_H - PAD))

    return { position: 'fixed', top, left, width: cardW, zIndex: 9999 }
  }

  // Mobile: place above or below the element, never off-screen
  const spaceBelow = vh - (rect.top + rect.height + PAD)
  const spaceAbove = rect.top - PAD

  let top: number
  if (spaceBelow >= TOOLTIP_H) {
    // Enough room below
    top = rect.top + rect.height + PAD
  } else if (spaceAbove >= TOOLTIP_H) {
    // Enough room above
    top = rect.top - TOOLTIP_H - PAD
  } else {
    // Neither side has enough room — place where there's more space, clamped
    top = spaceBelow >= spaceAbove
      ? Math.min(rect.top + rect.height + PAD, vh - TOOLTIP_H - PAD)
      : Math.max(PAD, rect.top - TOOLTIP_H - PAD)
  }

  // Always clamp to viewport
  top = Math.max(PAD, Math.min(top, vh - TOOLTIP_H - PAD))

  return { position: 'fixed', top, left: 12, right: 12, zIndex: 9999 }
}

export default function TourGuide({ userId }: { userId: string }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)

  const storageKey = `tripix_tour_done_${userId}`

  useEffect(() => {
    if (localStorage.getItem(storageKey)) return
    const t = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(t)
  }, [storageKey])

  const findRect = useCallback((target: string): Rect | null => {
    const el = document.querySelector(`[data-tour="${target}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  }, [])

  useEffect(() => {
    if (!visible) return
    const update = () => setRect(findRect(TOUR_STEPS[step].target))
    update()
    // Re-measure on resize (orientation change on mobile)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [step, visible, findRect])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(storageKey, '1')
  }

  const next = () => {
    if (step < TOUR_STEPS.length - 1) { setStep(s => s + 1) }
    else { dismiss() }
  }
  const prev = () => step > 0 && setStep(s => s - 1)

  if (!visible) return null

  const current = TOUR_STEPS[step]
  const tooltipStyle = calcTooltipStyle(rect)

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Full-screen dim overlay — pointer-events none so user can still scroll */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] pointer-events-none"
            style={{
              background: rect
                ? `radial-gradient(ellipse ${rect.width + PAD * 2}px ${rect.height + PAD * 2}px at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, transparent 0%, rgba(0,0,0,0.65) 1px)`
                : 'rgba(0,0,0,0.65)',
            }}
          />

          {/* Spotlight border ring around the target element */}
          {rect && (
            <motion.div
              key={`spotlight-${step}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed z-[9991] rounded-2xl pointer-events-none"
              style={{
                top:    rect.top  - PAD,
                left:   rect.left - PAD,
                width:  rect.width  + PAD * 2,
                height: rect.height + PAD * 2,
                boxShadow: '0 0 0 3px #378ADD, 0 0 0 6px rgba(55,138,221,0.3)',
              }}
            />
          )}

          {/* Tooltip card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={tooltipStyle}
            className="z-[9999] pointer-events-auto"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-5 border border-gray-100" dir="rtl">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{current.emoji}</span>
                  <span className="font-bold text-gray-900 text-base">{current.title}</span>
                </div>
                <button onClick={dismiss} className="text-gray-400 active:scale-90 transition-transform p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-4">{current.description}</p>

              {/* Progress + navigation */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {TOUR_STEPS.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? 'w-5 bg-primary' : 'w-1.5 bg-gray-200'
                    }`} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {step > 0 && (
                    <button onClick={prev}
                      className="flex items-center gap-1 text-xs text-gray-400 active:scale-95 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                      <ChevronRight className="w-3.5 h-3.5" />
                      הקודם
                    </button>
                  )}
                  <button onClick={next}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-4 py-1.5 rounded-lg active:scale-95 transition-transform">
                    {step < TOUR_STEPS.length - 1 ? (
                      <><span>הבא</span><ChevronLeft className="w-3.5 h-3.5" /></>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /><span>בואו נתחיל!</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
