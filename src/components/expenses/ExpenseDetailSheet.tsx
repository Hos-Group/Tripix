'use client'

/**
 * ExpenseDetailSheet — unified "tap-to-view" sheet that opens on any
 * expense row click.
 *
 * Shows:
 *   - Summary header (title, amount in native currency + ILS, date,
 *     category, location tag if any, notes)
 *   - Linked document inline (PDF in iframe, image, or Gmail email
 *     fetched live via /api/gmail/fetch-message)
 *   - Action row at the bottom (edit / split / delete)
 *
 * Single source of truth for viewing + acting on an expense —
 * replaces the trailing-button cluster on the row itself.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Pencil, Split as SplitIcon, Trash2, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDateShort } from '@/lib/utils'
import type { Expense, Currency } from '@/types'
import { CATEGORY_META, CURRENCY_SYMBOL } from '@/types'

interface DocInfo {
  id:               string
  name:             string
  doc_type:         string | null
  file_url:         string | null
  file_type:        string | null
  gmail_message_id: string | null
}

type DocState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'receipt'; url: string }
  | { kind: 'file';    doc: DocInfo }
  | { kind: 'email';   doc: DocInfo; html: string; from: string }
  | { kind: 'meta_only'; doc: DocInfo }   // document exists but no file/email
  | { kind: 'error';   message: string }

interface Props {
  expense:    Expense | null
  onClose:    () => void
  onEdit:     (exp: Expense) => void
  onSplit:    (exp: Expense) => void
  onDelete:   (exp: Expense) => void
}

export default function ExpenseDetailSheet({ expense, onClose, onEdit, onSplit, onDelete }: Props) {
  const [doc, setDoc] = useState<DocState>({ kind: 'none' })

  // Whenever the selected expense changes, (re)load its attached document.
  useEffect(() => {
    if (!expense) { setDoc({ kind: 'none' }); return }

    const receiptUrl = (expense as unknown as { receipt_url?: string | null }).receipt_url || null
    const docId      = (expense as unknown as { document_id?: string | null }).document_id || null

    let cancelled = false

    ;(async () => {
      if (docId) {
        setDoc({ kind: 'loading' })
        const { data: info } = await supabase
          .from('documents')
          .select('id, name, doc_type, file_url, file_type, gmail_message_id')
          .eq('id', docId)
          .maybeSingle()
        if (cancelled) return
        const d = info as DocInfo | null
        if (!d) { setDoc({ kind: 'error', message: 'המסמך נמחק' }); return }
        if (d.file_url)   { setDoc({ kind: 'file', doc: d });  return }
        if (d.gmail_message_id) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) { setDoc({ kind: 'error', message: 'לא מחובר' }); return }
            const res = await fetch('/api/gmail/fetch-message', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body:    JSON.stringify({ gmail_message_id: d.gmail_message_id }),
            })
            const json = await res.json()
            if (cancelled) return
            if (!res.ok) {
              setDoc({ kind: 'error', message: json?.error || 'לא הצלחנו למשוך את המייל' })
              return
            }
            setDoc({ kind: 'email', doc: d, html: json.html || '', from: json.from || '' })
          } catch {
            if (!cancelled) setDoc({ kind: 'error', message: 'שגיאת רשת' })
          }
          return
        }
        setDoc({ kind: 'meta_only', doc: d })
        return
      }

      if (receiptUrl) { setDoc({ kind: 'receipt', url: receiptUrl }); return }

      setDoc({ kind: 'none' })
    })()

    return () => { cancelled = true }
  }, [expense?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!expense) return null

  const meta      = CATEGORY_META[expense.category]
  const locTag    = (expense as unknown as { location_tag?: string | null }).location_tag
  const notesTxt  = (expense.notes || '').trim()
  // Strip internal tags (GMID:, doc:) that shouldn't surface to the user
  const cleanNote = notesTxt
    .replace(/^GMID:[^\n]+\n?/m, '')
    .replace(/^doc:[0-9a-f-]+\n?/m, '')
    .trim()

  return (
    <AnimatePresence>
      {expense && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          role="dialog"
          aria-modal="true"
          aria-label={`פרטי הוצאה: ${expense.title}`}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-white w-full max-w-lg rounded-t-3xl flex flex-col"
            style={{ maxHeight: '92vh' }}
          >
            {/* Drag handle + close */}
            <div className="pt-2 pb-1 px-5 flex items-center justify-between">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
              <button
                type="button"
                onClick={onClose}
                aria-label="סגור"
                className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center active:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
              {/* Summary */}
              <header className="pt-2">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: (meta?.color || '#9CA3AF') + '1F' }}
                  >
                    {meta?.icon || '•'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black text-gray-900 leading-tight break-words">
                      {expense.title}
                    </h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {meta?.label || expense.category} · {formatDateShort(expense.expense_date)}
                    </p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="text-base font-black text-gray-900 leading-tight whitespace-nowrap">
                      {formatMoney(expense.amount_ils)}
                    </p>
                    {expense.currency !== 'ILS' && (
                      <p className="text-[11px] text-gray-400 whitespace-nowrap">
                        {CURRENCY_SYMBOL[expense.currency as Currency]}{expense.amount}
                      </p>
                    )}
                  </div>
                </div>

                {/* Meta chips */}
                {(locTag || expense.source) && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {locTag && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        📍 {locTag}
                      </span>
                    )}
                    {expense.source && expense.source !== 'manual' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {expense.source === 'scan' ? '📧 מייל' : expense.source === 'document' ? '📄 מסמך' : expense.source}
                      </span>
                    )}
                  </div>
                )}

                {cleanNote && (
                  <p className="text-xs text-gray-500 mt-3 whitespace-pre-wrap leading-relaxed">
                    {cleanNote}
                  </p>
                )}
              </header>

              {/* Document section */}
              <section className="border-t border-gray-100 pt-3">
                <h3 className="text-[11px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" aria-hidden="true" /> מסמך מקושר
                </h3>
                <DocViewport state={doc} />
              </section>
            </div>

            {/* Sticky action row */}
            <div className="border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { onEdit(expense); onClose() }}
                className="flex-1 py-2.5 min-h-[44px] rounded-2xl bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                aria-label={`ערוך את ${expense.title}`}
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                עריכה
              </button>
              <button
                type="button"
                onClick={() => { onSplit(expense); onClose() }}
                className="flex-1 py-2.5 min-h-[44px] rounded-2xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                aria-label={`פצל את ${expense.title}`}
              >
                <SplitIcon className="w-3.5 h-3.5" aria-hidden="true" />
                פיצול
              </button>
              <button
                type="button"
                onClick={() => { onDelete(expense); onClose() }}
                className="flex-1 py-2.5 min-h-[44px] rounded-2xl bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                aria-label={`מחק את ${expense.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                מחיקה
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ *
 * Document viewport — renders the linked document inline inside the  *
 * sheet. Handles PDF/image files, Gmail email HTML, metadata-only    *
 * documents, raw receipt uploads, errors, and the "nothing here" UI. *
 * ------------------------------------------------------------------ */
function DocViewport({ state }: { state: DocState }) {
  if (state.kind === 'none') {
    return (
      <div className="bg-gray-50 rounded-2xl p-5 text-center">
        <FileText className="w-5 h-5 text-gray-300 mx-auto" aria-hidden="true" />
        <p className="text-xs text-gray-400 mt-2">אין מסמך מצורף להוצאה זו</p>
      </div>
    )
  }
  if (state.kind === 'loading') {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" aria-hidden="true" />
        <p className="text-xs text-gray-400">טוען מסמך…</p>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="bg-red-50 rounded-2xl p-4 text-center">
        <p className="text-xs text-red-600">{state.message}</p>
      </div>
    )
  }

  if (state.kind === 'file' || state.kind === 'receipt') {
    const url = state.kind === 'file' ? state.doc.file_url! : state.url
    const ext = url.split('?')[0].toLowerCase()
    const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(ext)
    const isPdf   = ext.endsWith('.pdf') || url.includes('application/pdf')
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={state.kind === 'file' ? state.doc.name : 'קבלה'} className="w-full h-auto" />
        ) : isPdf ? (
          <iframe
            src={url}
            className="w-full h-[60vh]"
            title={state.kind === 'file' ? state.doc.name : 'קבלה'}
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-6 text-sm font-bold text-primary"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            פתח את המסמך בחלון חיצוני
          </a>
        )}
      </div>
    )
  }

  if (state.kind === 'email') {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white">
        {state.from && (
          <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/60">
            <p className="text-[10px] text-gray-400 font-medium">מאת</p>
            <p className="text-xs text-gray-700 truncate">{state.from}</p>
          </div>
        )}
        <iframe
          srcDoc={state.html || '<p style="padding:16px;color:#999;font-family:sans-serif">המייל ריק</p>'}
          className="w-full h-[60vh] bg-white"
          sandbox="allow-same-origin"
          title={state.doc.name}
        />
      </div>
    )
  }

  // meta_only — document row exists but has no file/email to render
  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <p className="text-xs text-gray-500">
        למסמך <span className="font-semibold text-gray-700">{state.doc.name}</span> אין תצוגה זמינה (אין קובץ מצורף ואין מייל מקור).
      </p>
    </div>
  )
}
