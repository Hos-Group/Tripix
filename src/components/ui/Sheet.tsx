'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { backdropVariants, sheetVariants } from '@/lib/motion'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  /** Maximum sheet height (default 90vh). */
  maxHeight?: string
  /** If true, allow dismiss by tapping the backdrop (default true). */
  dismissOnBackdrop?: boolean
  /** Optional id for aria-labelledby. */
  ariaLabel?: string
}

/**
 * Modal bottom sheet with drag-to-dismiss, focus trap, and ESC support.
 *
 * Use instead of inline expanding forms when:
 * - The form has many fields
 * - It's a focused task (booking, edit, share)
 * - You want the rest of the screen visually de-emphasized
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  maxHeight = '90vh',
  dismissOnBackdrop = true,
  ariaLabel,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const previousActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the sheet
    const t = setTimeout(() => {
      const focusable = sheetRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    }, 80)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab' && sheetRef.current) {
        const els = sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (els.length === 0) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previousActive?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-[90] flex items-end justify-center"
          style={{ background: 'rgba(15,12,40,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (dismissOnBackdrop && e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? title}
            aria-describedby={description ? 'sheet-desc' : undefined}
            variants={sheetVariants}
            initial={reduce ? false : 'initial'}
            animate="animate"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 800) onClose()
            }}
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-[0_-12px_48px_rgba(0,0,0,0.18)] overflow-hidden"
            style={{
              maxHeight,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-1.5">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" aria-hidden="true" />
            </div>

            {(title || description) && (
              <div className="px-6 pt-2 pb-3">
                {title && (
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{title}</h2>
                )}
                {description && (
                  <p id="sheet-desc" className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            )}

            <div
              className="px-6 pb-6 overflow-y-auto"
              style={{ maxHeight: `calc(${maxHeight} - 80px)`, WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
