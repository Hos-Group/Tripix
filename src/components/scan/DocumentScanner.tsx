'use client'

/**
 * DocumentScanner — live camera scanner with perspective correction.
 *
 * UX flow:
 *   1. Camera opens full-screen (rear-facing, high-res)
 *   2. Four green corner handles overlay the video feed
 *   3. User drags handles to the corners of the physical document
 *   4. Tap the capture button (big white circle)
 *   5. perspectiveCorrect() warps the frame to a rectangle
 *   6. enhanceScan() converts to high-contrast grayscale
 *   7. Preview is shown: "Use this scan" or "Retake"
 *   8. On confirm: onScan(File) is called with a JPEG file
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { X, RefreshCw, Check } from 'lucide-react'
import { perspectiveCorrect, enhanceScan, type Point } from '@/lib/perspectiveTransform'

const HANDLE_RADIUS = 22    // touch target radius px (display space)
const HANDLE_VISUAL = 14    // visual dot radius
const LINE_COLOR    = '#22c55e'
const LINE_WIDTH    = 2.5

interface Props {
  /** Called with the scanned JPEG file on confirmation */
  onScan:   (file: File) => void
  /** Called when user cancels before scanning */
  onCancel: () => void
}

// ─── Corner ordering helpers ──────────────────────────────────────────────────

/** Sort an arbitrary set of 4 points into [tl, tr, br, bl] order */
function orderCorners(pts: Point[]): Point[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4
  const cy = pts.reduce((s, p) => s + p[1], 0) / 4
  const byAngle = [...pts].sort((a, b) => {
    return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)
  })
  // After angle sort: right, bottom-right, bottom-left, left — shift to tl,tr,br,bl
  const [right, br, left, tl] = byAngle
  const tr = right
  const bl = left
  return [tl, tr, br, bl]
}

/** Initial corners: a padded rectangle centred in the canvas */
function initialCorners(w: number, h: number): Point[] {
  const px = w * 0.12
  const py = h * 0.14
  return [
    [px,     py],      // tl
    [w - px, py],      // tr
    [w - px, h - py],  // br
    [px,     h - py],  // bl
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentScanner({ onScan, onCancel }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number>(0)

  const [corners,   setCorners]   = useState<Point[]>([])
  const [dragIdx,   setDragIdx]   = useState<number | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [camError,  setCamError]  = useState<string | null>(null)

  // ── Camera init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const vid = videoRef.current
        if (vid) { vid.srcObject = stream; vid.play() }
      })
      .catch(err => {
        if (alive) setCamError('לא ניתן לגשת למצלמה' + (err?.message ? ': ' + err.message : ''))
      })

    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Overlay canvas — resize + RAF draw ────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return

    const sync = () => {
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width  = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
      }
    }

    const ro = new ResizeObserver(() => {
      sync()
      // Re-center handles when container resizes (e.g., device rotation)
      if (corners.length === 0) return
      // keep existing corners clamped inside the new canvas bounds
      setCorners(prev =>
        prev.map(([x, y]) => [
          Math.min(Math.max(x, 0), canvas.width),
          Math.min(Math.max(y, 0), canvas.height),
        ] as Point),
      )
    })
    ro.observe(canvas)
    sync()
    return () => ro.disconnect()
  }, [corners.length])

  // ── RAF: draw overlay (corners + quad) ────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || corners.length !== 4) return

    let running = true
    const draw = () => {
      if (!running) return
      const ctx = canvas.getContext('2d')!
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Dim outside the quad
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.moveTo(corners[0][0], corners[0][1])
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1])
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Quad border
      ctx.beginPath()
      ctx.moveTo(corners[0][0], corners[0][1])
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1])
      ctx.closePath()
      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth   = LINE_WIDTH
      ctx.stroke()

      // Corner handles
      corners.forEach(([x, y], i) => {
        // Outer ring
        ctx.beginPath()
        ctx.arc(x, y, HANDLE_VISUAL + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fill()
        // Green dot
        ctx.beginPath()
        ctx.arc(x, y, HANDLE_VISUAL, 0, Math.PI * 2)
        ctx.fillStyle = i === dragIdx ? '#4ade80' : LINE_COLOR
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()
      })

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [corners, dragIdx])

  // ── Set initial corners once video is ready ────────────────────────────────
  const handleVideoMeta = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const w = canvas.offsetWidth  || canvas.width
    const h = canvas.offsetHeight || canvas.height
    setCorners(initialCorners(w, h))
  }, [])

  // ── Pointer helpers ────────────────────────────────────────────────────────
  const canvasPoint = (
    e: React.Touch | MouseEvent | React.MouseEvent,
    canvas: HTMLCanvasElement,
  ): Point => {
    const rect = canvas.getBoundingClientRect()
    const cx = 'clientX' in e ? (e as MouseEvent).clientX : (e as React.Touch).clientX
    const cy = 'clientX' in e ? (e as MouseEvent).clientY : (e as React.Touch).clientY
    return [cx - rect.left, cy - rect.top]
  }

  const nearestCorner = (pt: Point): number | null => {
    let best: number | null = null, minD = HANDLE_RADIUS * 1.6
    corners.forEach(([cx, cy], i) => {
      const d = Math.hypot(pt[0] - cx, pt[1] - cy)
      if (d < minD) { minD = d; best = i }
    })
    return best
  }

  const onDown = useCallback((
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = overlayRef.current!
    const pt = canvasPoint(
      'touches' in e ? e.touches[0] : e as React.MouseEvent,
      canvas,
    )
    const idx = nearestCorner(pt)
    if (idx !== null) { setDragIdx(idx); e.preventDefault() }
  }, [corners])  // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = useCallback((
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (dragIdx === null) return
    const canvas = overlayRef.current!
    const [x, y] = canvasPoint(
      'touches' in e ? e.touches[0] : e as React.MouseEvent,
      canvas,
    )
    setCorners(prev => prev.map((c, i) => i === dragIdx ? [x, y] as Point : c))
    e.preventDefault()
  }, [dragIdx])

  const onUp = useCallback(() => setDragIdx(null), [])

  // ── Capture + warp ────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    const video  = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas || corners.length !== 4) return

    setCapturing(true)

    // Scale display-space corners to actual video resolution
    const scaleX = video.videoWidth  / (canvas.offsetWidth  || canvas.width)
    const scaleY = video.videoHeight / (canvas.offsetHeight || canvas.height)
    const vidCorners: Point[] = orderCorners(
      corners.map(([x, y]) => [x * scaleX, y * scaleY] as Point),
    )

    // Grab the video frame
    const cap = document.createElement('canvas')
    cap.width  = video.videoWidth
    cap.height = video.videoHeight
    cap.getContext('2d')!.drawImage(video, 0, 0)

    // Heavy work in a microtask so UI stays responsive
    await new Promise<void>(r => setTimeout(r, 16))
    const corrected = perspectiveCorrect(cap, vidCorners, 1800)
    enhanceScan(corrected)

    corrected.toBlob(
      blob => {
        if (!blob) { setCapturing(false); return }
        setPreviewBlob(blob)
        setPreview(URL.createObjectURL(blob))
        setCapturing(false)
      },
      'image/jpeg',
      0.92,
    )
  }, [corners])

  const confirmScan = useCallback(() => {
    if (!previewBlob) return
    const file = new File([previewBlob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
    streamRef.current?.getTracks().forEach(t => t.stop())
    onScan(file)
  }, [previewBlob, onScan])

  const retake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setPreviewBlob(null)
  }, [preview])

  // ── Render: error ─────────────────────────────────────────────────────────
  if (camError) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-5 p-8 text-center">
        <p className="text-white text-base">{camError}</p>
        <button
          onClick={onCancel}
          className="px-8 py-3 bg-white rounded-full text-gray-900 font-bold"
        >
          חזרה
        </button>
      </div>
    )
  }

  // ── Render: preview ───────────────────────────────────────────────────────
  if (preview) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-3 bg-black/80">
          <button onClick={retake} className="flex items-center gap-2 text-white/80 text-sm">
            <RefreshCw className="w-4 h-4" /> סרוק שוב
          </button>
          <span className="text-white font-semibold text-sm">תצוגה מקדימה</span>
          <button onClick={onCancel} className="text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="סריקה"
          className="flex-1 object-contain bg-gray-950 w-full"
        />

        {/* Confirm */}
        <div className="px-6 pb-safe pb-8 pt-5 bg-black flex flex-col gap-3">
          <button
            onClick={confirmScan}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
          >
            <Check className="w-5 h-5" /> השתמש בסריקה
          </button>
          <button
            onClick={retake}
            className="w-full py-3 rounded-2xl font-medium text-white/70 bg-white/10 text-sm"
          >
            צלם שוב
          </button>
        </div>
      </div>
    )
  }

  // ── Render: camera + overlay ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          onLoadedMetadata={handleVideoMeta}
        />

        {/* Overlay canvas — corners + dimming */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />

        {/* Instruction banner */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-safe pt-4">
          <span className="bg-black/60 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full">
            גרור את הנקודות הירוקות לפינות המסמך
          </span>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between px-8 pb-safe pb-8 pt-5 bg-black">
        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Shutter */}
        <button
          onClick={capture}
          disabled={capturing || corners.length !== 4}
          aria-label="סרוק"
          className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center
                     active:scale-90 transition-transform disabled:opacity-50"
        >
          {capturing ? (
            <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white" />
          )}
        </button>

        {/* Spacer (symmetry) */}
        <div className="w-12" />
      </div>
    </div>
  )
}
