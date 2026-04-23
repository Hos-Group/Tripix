'use client'

/**
 * DocumentViewer — improved modal viewer for PDFs and images.
 *
 * Features:
 * - Slide-up animation (sheet-style on mobile)
 * - Loading spinner while content renders
 * - Download / open-in-browser button
 * - Swipe-down gesture to close (framer-motion drag)
 * - Optional title, subtitle and doc-type badge in header
 * - Google Docs fallback for PDFs that block iframe embedding
 * - HTML emails: fetched and rendered via srcdoc (bypasses Supabase Content-Disposition: attachment)
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ExternalLink, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useViewerZoom } from '@/lib/useViewerZoom'

interface DocumentViewerProps {
  url:         string | null
  onClose:     () => void
  title?:      string
  subtitle?:   string
  docType?:    string   // e.g. 'flight', 'hotel', 'passport'
  /**
   * Optional raw HTML to display (e.g. an email fetched live from Gmail/Graph).
   * Takes precedence over `url` when set — the viewer renders it via iframe
   * srcdoc so the user never leaves the app.
   */
  htmlContent?: string | null
  /** Loading state for when htmlContent is being fetched externally. */
  htmlLoading?: boolean
}

const DOC_ICONS: Record<string, string> = {
  flight:    '✈️',
  hotel:     '🏨',
  ferry:     '⛴️',
  activity:  '🎯',
  insurance: '🛡️',
  visa:      '📋',
  passport:  '🛂',
  other:     '📄',
  receipt:   '🧾',
}

export default function DocumentViewer({
  url,
  onClose,
  title,
  subtitle,
  docType,
  htmlContent,
  htmlLoading,
}: DocumentViewerProps) {
  const [contentLoaded, setContentLoaded] = useState(false)
  const [pdfError,      setPdfError]      = useState(false)
  // For HTML emails: fetch the raw HTML and inject via srcdoc so Supabase's
  // Content-Disposition: attachment header doesn't break rendering.
  const [htmlSrcdoc,   setHtmlSrcdoc]    = useState<string | null>(null)
  const [htmlFetching, setHtmlFetching]  = useState(false)
  const constraintsRef = useRef(null)

  // Viewer is open whenever we have content to show — allow pinch-zoom
  // while open, revert to locked viewport on close.
  const isOpen = Boolean(url || htmlContent || htmlLoading)
  useViewerZoom(isOpen)

  // Inline HTML (e.g. live-fetched Gmail email) takes precedence over url.
  const hasInlineHtml = typeof htmlContent === 'string' && htmlContent.length > 0
  const ext = url?.split('?')[0].toLowerCase() ?? ''
  const isPdf   = !hasInlineHtml && (ext.endsWith('.pdf') || (url?.includes('application/pdf') ?? false))
  const isImage = !hasInlineHtml && /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(ext)
  const isHtml  = hasInlineHtml || ext.endsWith('.html') || ext.endsWith('.htm')

  // Drive the srcdoc state: inline HTML wins; otherwise fetch from URL.
  useEffect(() => {
    if (hasInlineHtml) {
      setHtmlSrcdoc(htmlContent as string)
      setContentLoaded(false)
      setHtmlFetching(false)
      return
    }
    if (!url || !isHtml) return
    setHtmlSrcdoc(null)
    setContentLoaded(false)
    setHtmlFetching(true)
    fetch(url)
      .then(r => r.text())
      .then(html => { setHtmlSrcdoc(html); setHtmlFetching(false) })
      .catch(() => { setHtmlFetching(false) })
  }, [url, isHtml, hasInlineHtml, htmlContent])

  // Nothing to render — no url AND no inline HTML AND not loading one.
  if (!url && !hasInlineHtml && !htmlLoading) return null

  // PDF via Google Docs viewer if direct iframe fails
  const pdfSrc = url && pdfError
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : url ? `${url}#toolbar=0&navpanes=0&scrollbar=0` : ''

  const handleDownload = () => {
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <AnimatePresence>
      <motion.div
        key="viewer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-[80] flex flex-col items-stretch"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        onClick={onClose}
      >
        <motion.div
          key="viewer-sheet"
          ref={constraintsRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => { if (info.offset.y > 120) onClose() }}
          className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl overflow-hidden bg-gray-950"
          style={{ height: '93dvh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Drag handle ───────────────────────────────────────────── */}
          <div className="flex items-center justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="relative flex items-center gap-3 px-4 py-3 flex-shrink-0">
            {/* Ambient glow behind header — premium feel without heavy chrome */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(60% 120% at 20% 0%, rgba(108,71,255,0.18) 0%, transparent 65%)',
              }}
            />

            {/* Doc-type badge — gradient tile, matches documents list styling */}
            <div
              className="relative w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
              style={{
                background: docType === 'flight'    ? 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)'
                         : docType === 'hotel'     ? 'linear-gradient(135deg, #059669 0%, #34D399 100%)'
                         : docType === 'passport'  ? 'linear-gradient(135deg, #7C3AED 0%, #9B7BFF 100%)'
                         : docType === 'ferry'     ? 'linear-gradient(135deg, #0891B2 0%, #38BDF8 100%)'
                         : docType === 'activity'  ? 'linear-gradient(135deg, #D97706 0%, #FCD34D 100%)'
                         : docType === 'insurance' ? 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)'
                         : docType === 'visa'      ? 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)'
                         : isHtml                  ? 'linear-gradient(135deg, #EA580C 0%, #FB923C 100%)'
                         : isPdf                   ? 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)'
                         :                            'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
              }}
            >
              {docType ? (DOC_ICONS[docType] || '📄') : isPdf ? '📄' : isHtml ? '📧' : '🖼️'}
            </div>

            {/* Title / subtitle + format pill */}
            <div className="relative flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate tracking-tight">
                {title || (isPdf ? 'מסמך PDF' : isHtml ? 'אישור מ-Gmail' : isImage ? 'תמונה' : 'קובץ')}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                  {isPdf ? 'PDF' : isHtml ? 'EMAIL' : isImage ? 'IMAGE' : 'FILE'}
                </span>
                {subtitle && (
                  <p className="text-white/50 text-xs truncate">{subtitle}</p>
                )}
              </div>
            </div>

            {/* Actions — only show download when we have a real URL */}
            {url && (
              <button
                onClick={handleDownload}
                className="relative w-10 h-10 bg-white/10 hover:bg-white/15 rounded-2xl flex items-center justify-center active:scale-90 transition-all flex-shrink-0 border border-white/10"
                title="פתח / הורד"
              >
                {isPdf
                  ? <ExternalLink className="w-4 h-4 text-white/90" strokeWidth={2.2} />
                  : <Download     className="w-4 h-4 text-white/90" strokeWidth={2.2} />
                }
              </button>
            )}

            <button
              onClick={onClose}
              className="relative w-10 h-10 bg-white/10 hover:bg-white/15 rounded-2xl flex items-center justify-center active:scale-90 transition-all flex-shrink-0 border border-white/10"
              aria-label="סגור"
            >
              <X className="w-4 h-4 text-white/90" strokeWidth={2.2} />
            </button>
          </div>

          {/* ── Content ───────────────────────────────────────────────── */}
          <div
            className="flex-1 relative overflow-auto bg-gray-900 mx-3 mb-3 rounded-2xl"
            style={{ touchAction: 'pinch-zoom pan-x pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            {/* Loading overlay */}
            {!contentLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
                <p className="text-white/40 text-xs">טוען...</p>
              </div>
            )}

            {isHtml ? (
              /* HTML email — rendered via srcdoc. Supports:
                  - stored snapshots fetched from `url`
                  - live-fetched `htmlContent` (e.g. Gmail API)
                 Never navigates the user away from the app.              */
              <>
                {(htmlFetching || htmlLoading) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                    <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
                    <p className="text-white/40 text-xs">טוען מייל...</p>
                  </div>
                )}
                {htmlSrcdoc && (
                  <iframe
                    key={url || 'inline-email'}
                    srcDoc={htmlSrcdoc}
                    className="w-full h-full border-0 rounded-2xl"
                    title="תוכן המייל"
                    sandbox="allow-same-origin allow-popups allow-forms"
                    referrerPolicy="no-referrer"
                    onLoad={() => setContentLoaded(true)}
                    style={{ opacity: contentLoaded ? 1 : 0, transition: 'opacity 0.3s', background: '#ffffff' }}
                  />
                )}
                {contentLoaded && url && (
                  <button
                    onClick={handleDownload}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full border border-white/20 active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    פתח בדפדפן
                  </button>
                )}
              </>
            ) : isPdf ? (
              <>
                <iframe
                  src={pdfSrc}
                  className="w-full h-full border-0 rounded-2xl"
                  title="Document viewer"
                  onLoad={() => setContentLoaded(true)}
                  onError={() => { setPdfError(true); setContentLoaded(false) }}
                  style={{ opacity: contentLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
                />
                {/* PDF fallback CTA */}
                {contentLoaded && (
                  <button
                    onClick={handleDownload}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full border border-white/20 active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    פתח בדפדפן
                  </button>
                )}
              </>
            ) : isImage ? (
              <div
                className="w-full h-full flex items-center justify-center p-4"
                style={{ touchAction: 'pinch-zoom pan-x pan-y' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url ?? undefined}
                  alt={title || 'Document'}
                  className="max-w-full max-h-full object-contain rounded-xl"
                  style={{
                    opacity: contentLoaded ? 1 : 0,
                    transition: 'opacity 0.3s',
                    touchAction: 'pinch-zoom pan-x pan-y',
                  }}
                  onLoad={() => setContentLoaded(true)}
                  draggable={false}
                />
              </div>
            ) : (
              /* Generic fallback */
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <FileText className="w-16 h-16 text-white/20" />
                <p className="text-white/50 text-sm">לא ניתן להציג קובץ זה</p>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-primary text-white text-sm px-6 py-3 rounded-2xl active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  פתח בדפדפן
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
