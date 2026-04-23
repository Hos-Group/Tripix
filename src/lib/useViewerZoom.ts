'use client'

import { useEffect } from 'react'

const VIEWPORT_LOCKED =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
const VIEWPORT_ZOOMABLE =
  'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover'

/**
 * Temporarily allow pinch-to-zoom while the consumer is mounted/active.
 *
 * The whole app ships with `user-scalable=no, maximum-scale=1` so taps
 * inside scrollable lists never accidentally zoom the page. Document
 * viewing is the one place users genuinely need to zoom in (read fine
 * print on tickets, hotel confirmations, passport scans, etc.) — calling
 * this hook with `enabled=true` swaps the viewport meta to allow zoom up
 * to 5×, then restores the locked viewport on unmount / when disabled.
 *
 * Safe to call multiple times — the previous content is captured and
 * restored exactly.
 */
export function useViewerZoom(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'viewport'
      document.head.appendChild(meta)
    }

    const previous = meta.getAttribute('content') ?? VIEWPORT_LOCKED
    meta.setAttribute('content', VIEWPORT_ZOOMABLE)

    return () => {
      meta!.setAttribute('content', previous)
    }
  }, [enabled])
}
