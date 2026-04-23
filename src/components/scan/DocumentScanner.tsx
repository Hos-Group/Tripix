'use client'

/**
 * DocumentScanner — live document scanner with auto-detection.
 *
 * UX flow:
 *   1. Camera opens full-screen with a visible document frame
 *   2. System automatically detects the document every 700ms
 *      → corners snap to the detected edges and show "מסמך זוהה ✓"
 *   3. User can manually drag corner handles to adjust
 *   4. Tap the shutter → scan line animation → perspective-corrected JPEG
 *   5. Preview: "השתמש בסריקה" / "סרוק שוב"
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { X, RefreshCw, Check, ScanLine as ScanIcon } from 'lucide-react'
import { perspectiveCorrect, enhanceScan, type Point } from '@/lib/perspectiveTransform'

// ─── Constants ────────────────────────────────────────────────────────────────

const DETECT_W   = 80    // detection canvas width (tiny = fast)
const DETECT_H   = 60    // detection canvas height
const HANDLE_HIT = 28   // touch target radius (px, display space)
const CORNER_ARM = 22   // length of each bracket arm

type DetectState = 'searching' | 'detected' | 'capturing'

// ─── Document edge detection ──────────────────────────────────────────────────

/**
 * Runs a fast document-boundary finder on the current video frame.
 * Returns normalised corners [tl,tr,br,bl] in [0..1] space, or null.
 *
 * Algorithm:
 *  1. Sample at 80×60 (micro canvas)
 *  2. Grayscale + Sobel edges
 *  3. Threshold to keep only the strongest edges
 *  4. Find the bounding box of those edges
 *  5. Reject if the box is too small, too full, or sparse
 */
function detectDocumentNorm(
  video: HTMLVideoElement,
): [number, number][] | null {
  const W = DETECT_W, H = DETECT_H

  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.drawImage(video, 0, 0, W, H)
  const px = ctx.getImageData(0, 0, W, H).data

  // Grayscale
  const g = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    g[i] = (px[i * 4] * 77 + px[i * 4 + 1] * 150 + px[i * 4 + 2] * 29) >> 8
  }

  // Sobel + find max
  const edge = new Float32Array(W * H)
  let maxE = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx =
        -g[(y - 1) * W + (x - 1)] + g[(y - 1) * W + (x + 1)]
        - 2 * g[y * W + (x - 1)] + 2 * g[y * W + (x + 1)]
        - g[(y + 1) * W + (x - 1)] + g[(y + 1) * W + (x + 1)]
      const gy =
        -g[(y - 1) * W + (x - 1)] - 2 * g[(y - 1) * W + x] - g[(y - 1) * W + (x + 1)]
        + g[(y + 1) * W + (x - 1)] + 2 * g[(y + 1) * W + x] + g[(y + 1) * W + (x + 1)]
      const e = Math.hypot(gx, gy)
      edge[y * W + x] = e
      if (e > maxE) maxE = e
    }
  }
  if (maxE < 20) return null

  const thresh = maxE * 0.28
  let minX = W, maxX = 0, minY = H, maxY = 0, count = 0
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (edge[y * W + x] >= thresh) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        count++
      }
    }
  }

  const dw = maxX - minX
  const dh = maxY - minY
  const fill = count / Math.max(1, dw * dh)

  // Reject: too small, fills entire frame, or too few edge pixels
  if (dw < W * 0.18 || dh < H * 0.18) return null
  if (dw > W * 0.90 && dh > H * 0.90) return null
  if (fill < 0.04 || fill > 0.7) return null

  const pad = 2
  const l = Math.max(0, minX - pad) / W
  const t = Math.max(0, minY - pad) / H
  const r = Math.min(W - 1, maxX + pad) / W
  const b = Math.min(H - 1, maxY + pad) / H

  return [[l, t], [r, t], [r, b], [l, b]]
}

/** Convert normalised [0..1] corners to display-pixel corners */
function normToDisplay(norm: [number, number][], W: number, H: number): Point[] {
  return norm.map(([nx, ny]) => [nx * W, ny * H] as Point)
}

/** Ease a value toward a target (for smooth corner animation) */
function ease(current: number, target: number, factor = 0.18): number {
  return current + (target - current) * factor
}

// ─── Corner ordering ──────────────────────────────────────────────────────────

function initialCorners(W: number, H: number): Point[] {
  const px = W * 0.11
  const py = H * 0.13
  return [[px, py], [W - px, py], [W - px, H - py], [px, H - py]]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onScan:   (file: File) => void
  onCancel: () => void
}

export default function DocumentScanner({ onScan, onCancel }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const overlayRef    = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number>(0)
  const detectRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const cornersRef    = useRef<Point[]>([])  // mutable copy for smooth animation
  const targetRef     = useRef<Point[] | null>(null)

  const [corners,     setCorners]     = useState<Point[]>([])
  const [dragIdx,     setDragIdx]     = useState<number | null>(null)
  const [detectState, setDetectState] = useState<DetectState>('searching')
  const [capturing,   setCapturing]   = useState(false)
  const [scanLine,    setScanLine]    = useState(0)  // 0..1 position during capture
  const [preview,     setPreview]     = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [camError,    setCamError]    = useState<string | null>(null)

  // ── Camera init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const vid = videoRef.current
        if (vid) { vid.srcObject = stream; vid.play() }
      })
      .catch(err => {
        if (alive) setCamError('לא ניתן לפתוח את המצלמה' + (err?.message ? ': ' + err.message : ''))
      })

    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
      if (detectRef.current) clearInterval(detectRef.current)
    }
  }, [])

  // ── Canvas resize sync ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const sync = () => {
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width  = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
      }
    }
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    sync()
    return () => ro.disconnect()
  }, [])

  // ── Set initial corners once video starts ─────────────────────────────────
  const handleVideoMeta = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const W = canvas.offsetWidth  || 400
    const H = canvas.offsetHeight || 600
    const init = initialCorners(W, H)
    cornersRef.current = init
    setCorners(init)
  }, [])

  // ── Auto-detection loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (corners.length !== 4) return

    detectRef.current = setInterval(() => {
      const video  = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas || dragIdx !== null || capturing) return
      if (video.readyState < 2) return

      const norm = detectDocumentNorm(video)
      const W    = canvas.offsetWidth  || canvas.width
      const H    = canvas.offsetHeight || canvas.height

      if (norm) {
        targetRef.current = normToDisplay(norm, W, H)
        setDetectState('detected')
      } else {
        targetRef.current = null
        setDetectState('searching')
      }
    }, 700)

    return () => { if (detectRef.current) clearInterval(detectRef.current) }
  }, [corners.length, dragIdx, capturing])

  // ── RAF: draw overlay + animate corners toward target ─────────────────────
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || corners.length !== 4) return

    let running = true

    const drawBracket = (ctx: CanvasRenderingContext2D, x: number, y: number, idx: number) => {
      const arm  = CORNER_ARM
      // Determine direction of bracket arms based on corner index
      const sx = idx === 0 || idx === 3 ? 1 : -1   // left corners → arm right; right → arm left
      const sy = idx === 0 || idx === 1 ? 1 : -1   // top corners → arm down; bottom → arm up

      ctx.beginPath()
      ctx.moveTo(x + sx * arm, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + sy * arm)
      ctx.stroke()

      // Centre dot for drag affordance
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = () => {
      if (!running) return

      // Smooth corners toward target
      if (targetRef.current && dragIdx === null) {
        cornersRef.current = cornersRef.current.map((c, i) => [
          ease(c[0], targetRef.current![i][0]),
          ease(c[1], targetRef.current![i][1]),
        ] as Point)
        setCorners([...cornersRef.current])
      }

      const ctx = canvas.getContext('2d')!
      const W = canvas.width, H = canvas.height
      const cs = cornersRef.current
      if (cs.length !== 4) { rafRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, W, H)

      // Dim outside quad
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.moveTo(cs[0][0], cs[0][1])
      for (let i = 1; i < 4; i++) ctx.lineTo(cs[i][0], cs[i][1])
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Quad edge (thin, semi-transparent)
      ctx.beginPath()
      ctx.moveTo(cs[0][0], cs[0][1])
      for (let i = 1; i < 4; i++) ctx.lineTo(cs[i][0], cs[i][1])
      ctx.closePath()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth   = 1
      ctx.stroke()

      // Corner brackets
      const detected = detectState === 'detected'
      ctx.strokeStyle = detected ? '#22c55e' : 'rgba(255,255,255,0.9)'
      ctx.fillStyle   = detected ? '#22c55e' : 'rgba(255,255,255,0.9)'
      ctx.lineWidth   = 3
      ctx.lineCap     = 'round'
      cs.forEach(([x, y], i) => drawBracket(ctx, x, y, i))

      // Scan line animation during capture
      if (capturing) {
        const scanY = cs[0][1] + (cs[3][1] - cs[0][1]) * scanLine
        ctx.beginPath()
        ctx.moveTo(cs[0][0], scanY)
        ctx.lineTo(cs[1][0], scanY)
        ctx.strokeStyle = 'rgba(34,197,94,0.7)'
        ctx.lineWidth   = 2
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [corners.length, detectState, dragIdx, capturing, scanLine])

  // ── Pointer handling ──────────────────────────────────────────────────────
  const getPoint = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement,
  ): Point => {
    const rect = canvas.getBoundingClientRect()
    const src  = 'touches' in e
      ? (e as React.TouchEvent).touches[0]
      : (e as React.MouseEvent)
    return [src.clientX - rect.left, src.clientY - rect.top]
  }

  const nearestCorner = (pt: Point): number | null => {
    let best: number | null = null, minD = HANDLE_HIT
    cornersRef.current.forEach(([cx, cy], i) => {
      const d = Math.hypot(pt[0] - cx, pt[1] - cy)
      if (d < minD) { minD = d; best = i }
    })
    return best
  }

  const onDown = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current!
    const pt = getPoint(e, canvas)
    const idx = nearestCorner(pt)
    if (idx !== null) {
      setDragIdx(idx)
      targetRef.current = null   // disable auto-target while dragging
      e.preventDefault()
    }
  }, [])

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (dragIdx === null) return
    const canvas = overlayRef.current!
    const pt = getPoint(e, canvas)
    cornersRef.current = cornersRef.current.map((c, i) =>
      i === dragIdx ? pt : c,
    ) as Point[]
    setCorners([...cornersRef.current])
    e.preventDefault()
  }, [dragIdx])

  const onUp = useCallback(() => setDragIdx(null), [])

  // ── Capture ───────────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    const video  = videoRef.current
    const canvas = overlayRef.current
    if (!video || !canvas || capturing) return

    setCapturing(true)
    setDetectState('capturing')

    // Animate scan line (top → bottom over 600ms)
    const start = Date.now()
    const animDur = 600
    const animFrame = () => {
      const t = Math.min(1, (Date.now() - start) / animDur)
      setScanLine(t)
      if (t < 1) requestAnimationFrame(animFrame)
    }
    animFrame()

    await new Promise<void>(r => setTimeout(r, animDur + 50))

    // Scale display corners to video resolution
    const scaleX = video.videoWidth  / (canvas.offsetWidth  || canvas.width)
    const scaleY = video.videoHeight / (canvas.offsetHeight || canvas.height)

    // Sort corners [tl, tr, br, bl]
    const cs   = cornersRef.current
    const cx   = cs.reduce((s, p) => s + p[0], 0) / 4
    const cy   = cs.reduce((s, p) => s + p[1], 0) / 4
    const sorted = [...cs].sort((a, b) => {
      const aA = Math.atan2(a[1] - cy, a[0] - cx)
      const bA = Math.atan2(b[1] - cy, b[0] - cx)
      return aA - bA
    })
    // atan2 gives: right=0, bottom=π/2, left=π/-π, top=-π/2
    // Rotate so tl is first: find the one closest to (-π/2 angle = top-left quadrant)
    const topLeft = sorted.reduce((best, p, i) => {
      const angle = Math.atan2(p[1] - cy, p[0] - cx)
      const score = Math.hypot(p[0], p[1])   // smallest distance from origin = top-left
      return score < best.score ? { idx: i, score } : best
    }, { idx: 0, score: Infinity })

    const reordered: Point[] = [0, 1, 2, 3].map(i =>
      sorted[(topLeft.idx + i) % 4],
    )
    const vidCorners: Point[] = reordered.map(([x, y]) => [x * scaleX, y * scaleY])

    // Grab video frame
    const cap   = document.createElement('canvas')
    cap.width   = video.videoWidth
    cap.height  = video.videoHeight
    cap.getContext('2d')!.drawImage(video, 0, 0)

    // Warp + enhance
    await new Promise<void>(r => setTimeout(r, 16))
    const corrected = perspectiveCorrect(cap, vidCorners, 1800)
    enhanceScan(corrected)

    corrected.toBlob(
      blob => {
        if (!blob) { setCapturing(false); setDetectState('searching'); return }
        setPreviewBlob(blob)
        setPreview(URL.createObjectURL(blob))
        setCapturing(false)
      },
      'image/jpeg',
      0.92,
    )
  }, [capturing])

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
    setDetectState('searching')
    setScanLine(0)
  }, [preview])

  // ── Render: error ─────────────────────────────────────────────────────────
  if (camError) return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <ScanIcon className="w-12 h-12 text-white/30" />
      <p className="text-white/70 text-sm leading-relaxed">{camError}</p>
      <button onClick={onCancel} className="mt-2 px-8 py-3 bg-white rounded-2xl text-gray-900 font-bold text-sm">
        חזרה
      </button>
    </div>
  )

  // ── Render: preview after scan ────────────────────────────────────────────
  if (preview) return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 bg-black">
        <button onClick={retake} className="flex items-center gap-2 text-white/70 text-sm active:opacity-60">
          <RefreshCw className="w-4 h-4" /> סרוק שוב
        </button>
        <span className="text-white font-semibold text-sm">תצוגה מקדימה</span>
        <button onClick={onCancel} className="text-white/50 active:opacity-60">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="סריקה" className="flex-1 object-contain bg-gray-950 w-full" />

      <div className="px-5 pb-8 pt-4 bg-black space-y-3">
        <button
          onClick={confirmScan}
          className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
        >
          <Check className="w-5 h-5" /> השתמש בסריקה
        </button>
        <button
          onClick={retake}
          className="w-full py-3 rounded-2xl font-medium text-white/60 bg-white/8 text-sm active:opacity-70"
        >
          צלם שוב
        </button>
      </div>
    </div>
  )

  // ── Render: live scanner ──────────────────────────────────────────────────
  const statusText =
    detectState === 'capturing' ? 'סורק...' :
    detectState === 'detected'  ? '✓  מסמך זוהה' :
    'כוון את המצלמה אל המסמך'

  const statusColor =
    detectState === 'detected'  ? 'bg-green-600/90' :
    detectState === 'capturing' ? 'bg-blue-600/90'  :
    'bg-black/60'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Camera viewport */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline muted autoPlay
          onLoadedMetadata={handleVideoMeta}
        />

        {/* Overlay — dimming + corner brackets + scan line */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none' }}
          onMouseDown={onDown}   onMouseMove={onMove}   onMouseUp={onUp}   onMouseLeave={onUp}
          onTouchStart={onDown}  onTouchMove={onMove}   onTouchEnd={onUp}
        />

        {/* Status badge */}
        <div className="absolute top-5 left-0 right-0 flex justify-center pointer-events-none">
          <span className={`${statusColor} backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full font-medium transition-colors duration-300`}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-8 pb-8 pt-5 bg-black">
        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center active:bg-white/25"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Shutter */}
        <button
          onClick={capture}
          disabled={capturing || corners.length !== 4}
          aria-label="סרוק"
          className="relative w-20 h-20 rounded-full border-[3px] flex items-center justify-center
                     active:scale-90 transition-transform disabled:opacity-40"
          style={{ borderColor: detectState === 'detected' ? '#22c55e' : 'white' }}
        >
          <div
            className="w-[60px] h-[60px] rounded-full transition-colors duration-300"
            style={{ background: detectState === 'detected' ? '#22c55e' : 'white' }}
          />
        </button>

        {/* Spacer */}
        <div className="w-11" />
      </div>
    </div>
  )
}
