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
 */

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ExternalLink, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

interface DocumentViewerProps {
  url:       string | null
  onClose:   () => void
  title?:    string
  subtitle?: string
  docType?:  string   // e.g. 'flight', 'hotel', 'passport'
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
}: DocumentViewerProps) {
  const [contentLoaded, setContentLoaded] = useState(false)
  const [pdfError,      setPdfError]      = useState(false)
  const constraintsRef = useRef(null)

  if (!url) return null

  const ext = url.split('?')[0].toLowerCase()
  const isPdf   = ext.endsWith('.pdf') || url.includes('application/pdf') || url.includes('%2F') && url.includes('pdf')
  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(ext)
  const isHtml  = ext.endsWith('.html') || ext.endsWith('.htm')

  // PDF via Google Docs viewer if direct iframe fails
  const pdfSrc = pdfError
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : `${url}#toolbar=0&navpanes=0&scrollbar=0`

  const handleDownload = () => window.open(url, '_blank', 'noopener')

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
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
            {/* Doc-type badge */}
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">
              {docType ? (DOC_ICONS[docType] || '📄') : isPdf ? '📄' : isHtml ? '📧' : '🖼️'}
            </div>

            {/* Title / subtitle */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {title || (isPdf ? 'מסמך PDF' : isHtml ? 'אישור מ-Gmail' : isImage ? 'תמונה' : 'קובץ')}
              </p>
              {subtitle && (
                <p className="text-white/50 text-xs truncate">{subtitle}</p>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={handleDownload}
              className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
              title="פתח / הורד"
            >
              {isPdf
                ? <ExternalLink className="w-4 h-4 text-white/80" />
                : <Download className="w-4 h-4 text-white/80" />
              }
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>

          {/* ── Content ───────────────────────────────────────────────── */}
          <div className="flex-1 relative overflow-hidden bg-gray-900 mx-3 mb-3 rounded-2xl">
            {/* Loading overlay */}
            {!contentLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
                <p className="text-white/40 text-xs">טוען...</p>
              </div>
            )}

            {isHtml ? (
              /* Gmail email HTML snapshot */
              <>
                <iframe
                  src={url}
                  className="w-full h-full border-0 rounded-2xl bg-white"
                  title="תוכן המייל"
                  // allow-scripts   → email CSS animations / layout scripts work
                  // allow-popups    → links open in new tab (not inside iframe)
                  // allow-same-origin → allows the HTML file to be read normally
                  // allow-forms     → some email trackers / feedback buttons
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  onLoad={() => setContentLoaded(true)}
                  style={{ opacity: contentLoaded ? 1 : 0, transition: 'opacity 0.3s', background: '#fff' }}
                />
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
              <div className="w-full h-full flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={title || 'Document'}
                  className="max-w-full max-h-full object-contain rounded-xl"
                  style={{ opacity: contentLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
                  onLoad={() => setContentLoaded(true)}
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
