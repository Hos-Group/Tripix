'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import Button from './Button'
import { useLanguage } from '@/contexts/LanguageContext'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t, dir } = useLanguage()
  const resolvedConfirm = confirmLabel ?? t('confirm')
  const resolvedCancel  = cancelLabel  ?? t('cancel')
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousActive = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Tab') {
        const els = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[]
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

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previousActive?.focus?.()
    }
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(15,12,40,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel() }}
          dir={dir}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? 'confirm-dialog-desc' : undefined}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  variant === 'danger' ? 'bg-red-50' : 'bg-primary-50'
                }`}
                aria-hidden="true"
              >
                <AlertTriangle
                  className={`w-7 h-7 ${variant === 'danger' ? 'text-red-500' : 'text-primary'}`}
                />
              </div>
              <h2
                id="confirm-dialog-title"
                className="text-lg font-bold text-gray-900 mb-1.5 leading-snug"
              >
                {title}
              </h2>
              {description && (
                <p id="confirm-dialog-desc" className="text-sm text-gray-500 leading-relaxed mb-6">
                  {description}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                ref={confirmRef}
                variant={variant === 'danger' ? 'danger' : 'primary'}
                size="md"
                fullWidth
                loading={loading}
                onClick={onConfirm}
              >
                {resolvedConfirm}
              </Button>
              <Button
                ref={cancelRef}
                variant="ghost"
                size="md"
                fullWidth
                disabled={loading}
                onClick={onCancel}
              >
                {resolvedCancel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
