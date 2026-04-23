'use client'

import { useEffect } from 'react'

/**
 * Prevents desktop browser zoom (Ctrl/Cmd + wheel, Ctrl/Cmd + plus/minus/0,
 * pinch-zoom on trackpads).
 *
 * On mobile, the viewport meta + body `touch-action: pan-x pan-y` already
 * blocks pinch / double-tap zoom. This component plugs the desktop hole
 * so the app feels like a native app on every form factor.
 *
 * The DocumentViewer is the one place zoom is allowed — it overrides the
 * viewport meta dynamically (see `src/lib/useViewerZoom.ts`), and this
 * guard explicitly skips events whose target is inside `[data-allow-zoom]`.
 */
export default function NoZoom() {
  useEffect(() => {
    function isInsideZoomable(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false
      return Boolean(target.closest('[data-allow-zoom]'))
    }

    // ── Block Ctrl/Cmd + wheel (mouse / trackpad zoom) ────────────────────
    function onWheel(e: WheelEvent) {
      if ((e.ctrlKey || e.metaKey) && !isInsideZoomable(e.target)) {
        e.preventDefault()
      }
    }

    // ── Block Ctrl/Cmd + (+ / - / 0) keyboard shortcuts ───────────────────
    function onKeydown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0' || e.key === '_') {
        if (!isInsideZoomable(e.target)) {
          e.preventDefault()
        }
      }
    }

    // ── Block legacy iOS gesture events (multi-touch pinch on macOS Safari) ─
    function onGesture(e: Event) {
      if (!isInsideZoomable(e.target)) {
        e.preventDefault()
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('gesturestart',  onGesture as EventListener, { passive: false } as AddEventListenerOptions)
    document.addEventListener('gesturechange', onGesture as EventListener, { passive: false } as AddEventListenerOptions)
    document.addEventListener('gestureend',    onGesture as EventListener, { passive: false } as AddEventListenerOptions)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeydown)
      document.removeEventListener('gesturestart',  onGesture as EventListener)
      document.removeEventListener('gesturechange', onGesture as EventListener)
      document.removeEventListener('gestureend',    onGesture as EventListener)
    }
  }, [])

  return null
}
