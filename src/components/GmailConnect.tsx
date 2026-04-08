'use client'

/**
 * GmailConnect
 * Settings widget for connecting / managing Gmail OAuth integration.
 *
 * States:
 *   - loading   — fetching connection status from server
 *   - connected — shows Gmail address, last scan stats, scan + disconnect buttons
 *   - not connected — shows "Connect with Gmail" button
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface GmailConnection {
  gmail_address: string
}

interface ScanResult {
  scanned:          number
  parsed:           number
  created:          number
  scannedWithPDF?:  number
  scannedEmailOnly?: number
}

interface GmailConnectProps {
  userId: string
}

export default function GmailConnect({ userId }: GmailConnectProps) {
  const [loading,      setLoading]      = useState(true)
  const [connection,   setConnection]   = useState<GmailConnection | null>(null)
  const [scanning,     setScanning]     = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [lastScan,     setLastScan]     = useState<ScanResult | null>(null)
  const [lastScanTime, setLastScanTime] = useState<string | null>(null)
  const [scanError,    setScanError]    = useState<string | null>(null)

  // ── Load connection status ─────────────────────────────────────────────────
  const loadConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('gmail_address')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      setConnection(data as GmailConnection | null)
    } catch (err) {
      console.error('[GmailConnect] loadConnection error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadConnection()
  }, [loadConnection])

  // ── Connect — redirect to OAuth flow ──────────────────────────────────────
  const handleConnect = () => {
    window.location.href = '/api/auth/google'
  }

  // ── Scan Gmail now ────────────────────────────────────────────────────────
  const handleScan = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setScanError('לא מחובר'); return }

      const res = await fetch('/api/gmail/scan', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as ScanResult & { error?: string }

      if (!res.ok) {
        setScanError(json.error || 'שגיאה בסריקה')
        return
      }

      setLastScan(json)
      setLastScanTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      console.error('[GmailConnect] scan error:', err)
      setScanError('שגיאת רשת — נסה שוב')
    } finally {
      setScanning(false)
    }
  }

  // ── Disconnect — delete row from gmail_connections ────────────────────────
  const handleDisconnect = async () => {
    if (!confirm('לנתק את Gmail? לא תוכל לסרוק מיילים חדשים עד שתתחבר שוב.')) return
    setDisconnecting(true)
    try {
      await supabase
        .from('gmail_connections')
        .delete()
        .eq('user_id', userId)
      setConnection(null)
      setLastScan(null)
    } catch (err) {
      console.error('[GmailConnect] disconnect error:', err)
    } finally {
      setDisconnecting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="h-6 bg-gray-100 rounded-lg w-40 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded-lg w-64 animate-pulse mt-3" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">📧</span>
        <h3 className="font-bold text-sm text-gray-900">סנכרון מייל אוטומטי</h3>
      </div>

      {connection ? (
        /* ── Connected state ── */
        <>
          {/* Status badge */}
          <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-3">
            <span className="text-emerald-500 text-lg">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800">מחובר</p>
              <p className="text-xs text-emerald-600 truncate" dir="ltr">
                {connection.gmail_address}
              </p>
            </div>
          </div>

          {/* Last scan stats */}
          {lastScan && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">
                תוצאות הסריקה האחרונה
                {lastScanTime && <span className="font-normal text-blue-500"> · {lastScanTime}</span>}
              </p>
              <p>
                סרקנו {lastScan.scanned} מיילים
                {lastScan.scannedWithPDF !== undefined && (
                  <> · {lastScan.scannedWithPDF} עם PDF · {lastScan.scannedEmailOnly ?? 0} ללא PDF</>
                )}
                {' '}· יצרנו {lastScan.created} הוצאות
              </p>
            </div>
          )}

          {/* Scan error */}
          {scanError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">
              {scanError}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleScan}
              disabled={scanning || disconnecting}
              className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {scanning ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  סורק...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  סרוק עכשיו
                </>
              )}
            </button>

            <button
              onClick={handleDisconnect}
              disabled={scanning || disconnecting}
              className="bg-red-50 text-red-500 rounded-xl py-2.5 px-4 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {disconnecting ? '...' : (
                <>
                  <span>❌</span>
                  נתק
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            הסריקה בודקת מיילים מ-30 הימים האחרונים
          </p>
        </>
      ) : (
        /* ── Not connected state ── */
        <>
          <p className="text-xs text-gray-500 leading-relaxed">
            חבר את Gmail ואנחנו נסרוק אוטומטית אישורי הזמנות ונוסיף אותם לטיול הנכון.
          </p>

          <button
            onClick={handleConnect}
            className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all hover:bg-gray-50"
          >
            {/* Google G logo */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-semibold text-gray-700">התחבר עם Gmail</span>
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            Tripix מבקש גישת קריאה בלבד לתיבת הדואר שלך
          </p>
        </>
      )}
    </div>
  )
}
