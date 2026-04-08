'use client'

/**
 * GmailScanButton
 *
 * A compact but prominent "Scan Gmail" button for the dashboard.
 * Renders only when the user has at least one Gmail account connected.
 *
 * During the scan it shows animated live steps:
 *   1. מחפש מיילים...
 *   2. קורא תוכן ומסמכים...
 *   3. מנתח עם Claude...
 *   4. יוצר הוצאות...
 *
 * After the scan finishes it shows a result card and calls onScanComplete()
 * so the parent (dashboard) can refresh its expense list.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Throttle auto-scan: run at most once every 4 hours per browser session
const AUTO_SCAN_KEY = 'tripix_gmail_last_auto_scan'
const AUTO_SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000

interface ScanResult {
  scanned:          number
  parsed:           number
  created:          number
  scannedWithPDF?:  number
}

interface GmailScanButtonProps {
  /** Called after a successful scan so the parent can refresh expenses */
  onScanComplete?: (created: number) => void
}

const STEPS = [
  { id: 0, icon: '🔍', label: 'מחפש מיילים...' },
  { id: 1, icon: '📄', label: 'קורא תוכן ומסמכים PDF...' },
  { id: 2, icon: '🤖', label: 'Claude מנתח הזמנות...' },
  { id: 3, icon: '💾', label: 'יוצר הוצאות...' },
]

export default function GmailScanButton({ onScanComplete }: GmailScanButtonProps) {
  const [hasGmail,   setHasGmail]   = useState<boolean | null>(null)
  const [scanning,   setScanning]   = useState(false)
  const [stepIdx,    setStepIdx]    = useState(0)
  const [result,     setResult]     = useState<ScanResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const stepTimer  = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoFired  = useRef(false)

  // Check Gmail connection, then auto-scan if enough time has passed
  const checkGmail = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHasGmail(false); return }
    const { data } = await supabase
      .from('gmail_connections')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    setHasGmail(!!data)
  }, [])

  useEffect(() => { checkGmail() }, [checkGmail])

  // Animate through steps while scanning
  const startStepAnimation = () => {
    setStepIdx(0)
    let idx = 0
    stepTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, STEPS.length - 1)
      setStepIdx(idx)
      if (idx >= STEPS.length - 1 && stepTimer.current) {
        clearInterval(stepTimer.current)
      }
    }, 4000) // advance step every 4s
  }

  const stopStepAnimation = () => {
    if (stepTimer.current) {
      clearInterval(stepTimer.current)
      stepTimer.current = null
    }
  }

  useEffect(() => () => stopStepAnimation(), [])

  // ── Silent background auto-scan ────────────────────────────────────────────
  // Fires once per render when Gmail is connected and at least 4 h have passed
  // since the last auto-scan (stored in localStorage). No UI loading state.
  useEffect(() => {
    if (!hasGmail || autoFired.current) return
    autoFired.current = true

    const last = Number(localStorage.getItem(AUTO_SCAN_KEY) || 0)
    if (Date.now() - last < AUTO_SCAN_INTERVAL_MS) return // too soon

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return
        localStorage.setItem(AUTO_SCAN_KEY, String(Date.now()))
        const res = await fetch('/api/gmail/scan', {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const json = await res.json() as ScanResult
        if (json.created > 0) {
          setResult(json)
          onScanComplete?.(json.created)
        }
      } catch {
        // silent — don't surface auto-scan errors to the user
      }
    })()
  }, [hasGmail, onScanComplete])

  const handleScan = async () => {
    if (scanning) return
    setScanning(true)
    setResult(null)
    setError(null)
    startStepAnimation()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('לא מחובר'); setScanning(false); stopStepAnimation(); return }

      const res = await fetch('/api/gmail/scan', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as ScanResult & { error?: string }

      stopStepAnimation()

      if (!res.ok) {
        setError(json.error || 'שגיאה בסריקה')
      } else {
        setResult(json)
        onScanComplete?.(json.created)
      }
    } catch {
      stopStepAnimation()
      setError('שגיאת רשת — נסה שוב')
    } finally {
      setScanning(false)
    }
  }

  // Don't render until we know
  if (hasGmail === null) return null
  if (!hasGmail) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" dir="rtl">
      {/* Scan button row */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-all disabled:cursor-not-allowed"
      >
        {/* Icon area */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
          scanning ? 'bg-blue-100' : 'bg-blue-50'
        }`}>
          {scanning ? (
            <span className="text-xl animate-spin inline-block">⏳</span>
          ) : (
            <span className="text-xl">📧</span>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 text-right min-w-0">
          {scanning ? (
            <>
              <p className="text-sm font-semibold text-blue-700">
                {STEPS[stepIdx].icon} {STEPS[stepIdx].label}
              </p>
              <p className="text-[11px] text-blue-400 mt-0.5">סורק את כל חשבונות Gmail המחוברים</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-800">סרוק מיילים עכשיו</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {result
                  ? `נסרקו ${result.scanned} מיילים · ${result.created} הוצאות חדשות`
                  : 'משוך אישורי הזמנה מ-Gmail לדשבורד'}
              </p>
            </>
          )}
        </div>

        {/* Arrow / status */}
        {!scanning && (
          <span className="text-blue-400 text-lg flex-shrink-0">
            {result?.created ? '✅' : '›'}
          </span>
        )}
      </button>

      {/* Progress bar during scan */}
      {scanning && (
        <div className="h-1 bg-blue-50 w-full">
          <div
            className="h-1 bg-blue-400 transition-all duration-[3800ms] ease-linear rounded-full"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        </div>
      )}

      {/* Result detail (only when something was created) */}
      {result && result.created > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-emerald-50 rounded-xl px-3 py-2 text-xs text-emerald-700">
            ✅ נוצרו <strong>{result.created}</strong> הוצאות חדשות מתוך {result.scanned} מיילים
            {result.scannedWithPDF ? ` (כולל ${result.scannedWithPDF} עם PDF)` : ''}
          </div>
        </div>
      )}
      {result && result.created === 0 && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-gray-400 text-center">
            לא נמצאו הזמנות חדשות — כל מה שהיה כבר יובא
          </p>
        </div>
      )}
    </div>
  )
}
