'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DocumentViewerProps {
  url: string | null
  onClose: () => void
}

export default function DocumentViewer({ url, onClose }: DocumentViewerProps) {
  if (!url) return null

  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('application/pdf')
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('image/')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-[80] flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50">
          <button onClick={onClose}
            className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-5 h-5 text-white" />
          </button>
          <span className="text-white text-sm font-medium">תצוגת מסמך</span>
          <div className="w-9" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isPdf ? (
            <iframe
              src={`${url}#toolbar=0`}
              className="w-full h-full border-0"
              title="Document viewer"
            />
          ) : isImage ? (
            <div className="flex items-center justify-center min-h-full p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Document"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          ) : (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title="Document viewer"
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
