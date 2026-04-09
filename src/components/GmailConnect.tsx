'use client'

/**
 * GmailConnect
 * Settings widget for connecting / managing Gmail OAuth integration.
 *
 * Supports multiple Gmail accounts per user:
 *   - Shows all connected accounts in a list
 *   - Each account has an individual disconnect button
 *   - "Add another Gmail account" panel with email hint input:
 *       user types their email → system pre-selects it in Google's account chooser
 *   - Single "Scan all accounts" button when at least one is connected
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface GmailConnection {
  id:            string
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

/** Inline Google G logo */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-4 h-4'} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/** Detect if running inside an iframe (Claude Preview, WebView, etc.) */
function isInIframe(): boolean {
  try { return window.self !== window.top } catch { return true }
}

/** Build the full absolute OAuth URL — includes the Supabase access token
 *  in the URL so the callback can identify the user on iOS / PWA / new-tab
 *  flows where session cookies are not forwarded. */
async function buildOAuthUrl(hint?: string): Promise<string> {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  // Attach the current session token so the server can carry it through OAuth state
  let token = ''
  try {
    const { supabase: sb } = await import('@/lib/supabase')
    const { data: { session } } = await sb.auth.getSession()
    token = session?.access_token || ''
  } catch { /* ignore */ }
  const params = new URLSearchParams()
  if (hint)  params.set('hint',  hint)
  if (token) params.set('token', token)
  const qs = params.toString()
  return `${base}/api/auth/google${qs ? '?' + qs : ''}`
}

export default function GmailConnect({ userId }: GmailConnectProps) {
  const [loading,        setLoading]        = useState(true)
  const [connections,    setConnections]    = useState<GmailConnection[]>([])
  const [scanning,       setScanning]       = useState(false)
  const [disconnecting,  setDisconnecting]  = useState<string | null>(null)
  const [lastScan,       setLastScan]       = useState<ScanResult | null>(null)
  const [lastScanTime,   setLastScanTime]   = useState<string | null>(null)
  const [scanError,      setScanError]      = useState<string | null>(null)

  // ── "Add account" panel state ──────────────────────────────────────────────
  const [showAddPanel,   setShowAddPanel]   = useState(false)
  const [hintEmail,      setHintEmail]      = useState('')
  const [hintError,      setHintError]      = useState('')
  const hintInputRef = useRef<HTMLInputElement>(null)

  // ── Load all connections ───────────────────────────────────────────────────
  const loadConnections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('id, gmail_address')
        .eq('user_id', userId)
        .order('gmail_address')
      if (error) throw error
      setConnections((data as GmailConnection[]) || [])
    } catch (err) {
      console.error('[GmailConnect] loadConnections error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadConnections() }, [loadConnections])

  // Focus email input when panel opens
  useEffect(() => {
    if (showAddPanel) setTimeout(() => hintInputRef.current?.focus(), 50)
  }, [showAddPanel])

  // ── Redirect to Google OAuth (with optional email hint) ───────────────────
  const startOAuth = async (hint?: string) => {
    const url = await buildOAuthUrl(hint)
    if (isInIframe()) {
      // Cannot do OAuth inside an iframe — open in the real browser instead
      window.open(url, '_blank', 'noopener')
    } else {
      window.location.href = url
    }
  }

  // ── Handle "Connect" click in the add-account panel ──────────────────────
  const handlePanelConnect = () => {
    const email = hintEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setHintError('כתובת מייל לא תקינה')
      return
    }
    startOAuth(email || undefined)
  }

  // ── Scan all accounts ─────────────────────────────────────────────────────
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
      if (!res.ok) { setScanError(json.error || 'שגיאה בסריקה'); return }
      setLastScan(json)
      setLastScanTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      setScanError('שגיאת רשת — נסה שוב')
    } finally {
      setScanning(false)
    }
  }

  // ── Disconnect one account ────────────────────────────────────────────────
  const handleDisconnect = async (conn: GmailConnection) => {
    if (!confirm(`לנתק את ${conn.gmail_address} מ-Tripix?`)) return
    setDisconnecting(conn.id)
    try {
      const { error } = await supabase
        .from('gmail_connections')
        .delete()
        .eq('id', conn.id)
        .eq('user_id', userId)
      if (error) throw error
      setConnections(prev => prev.filter(c => c.id !== conn.id))
      if (connections.length <= 1) { setLastScan(null); setLastScanTime(null) }
    } catch (err) {
      console.error('[GmailConnect] disconnect error:', err)
    } finally {
      setDisconnecting(null)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <div className="h-5 bg-gray-100 rounded-lg w-40 animate-pulse" />
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  const hasConnections = connections.length > 0
  const inIframe = typeof window !== 'undefined' && isInIframe()

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4" dir="rtl">

      {/* ── Iframe/Preview warning ── */}
      {inIframe && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-800">🔒 חיבור Gmail דורש דפדפן אמיתי</p>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            OAuth של Google לא עובד בתוך iframe או תצוגת Preview.
            לחץ על הכפתור כדי לפתוח את האפליקציה בדפדפן ולחבר את המייל.
          </p>
          <a
            href={`${typeof window !== 'undefined' ? window.location.origin : ''}/settings`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-amber-600 text-white rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-all"
          >
            🌐 פתח בדפדפן וחבר Gmail
          </a>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">📧</span>
        <h3 className="font-bold text-sm text-gray-900">סנכרון מייל אוטומטי</h3>
      </div>

      {hasConnections ? (
        <>
          {/* Connected accounts list */}
          <div className="space-y-2">
            {connections.map(conn => (
              <div key={conn.id}
                className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2.5">
                <span className="text-emerald-500 text-base flex-shrink-0">✅</span>
                <p className="flex-1 text-xs text-emerald-700 font-medium truncate" dir="ltr">
                  {conn.gmail_address}
                </p>
                <button
                  onClick={() => handleDisconnect(conn)}
                  disabled={!!disconnecting || scanning}
                  className="text-red-400 hover:text-red-500 text-xs px-2 py-1 rounded-lg active:scale-95 transition-all disabled:opacity-40"
                  title="נתק חשבון זה"
                >
                  {disconnecting === conn.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>

          {/* Add another account — inline panel */}
          {showAddPanel ? (
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">
                הוסף מייל נוסף לסריקה
              </p>
              <p className="text-[11px] text-gray-500">
                הכנס את כתובת המייל שאחריו יש אישורי הזמנה (Gmail בלבד).
                המערכת תפתח את חלון ההרשאה של גוגל עם החשבון הזה.
              </p>
              <input
                ref={hintInputRef}
                type="email"
                dir="ltr"
                value={hintEmail}
                onChange={e => { setHintEmail(e.target.value); setHintError('') }}
                onKeyDown={e => e.key === 'Enter' && handlePanelConnect()}
                placeholder="personal@gmail.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left outline-none focus:ring-2 focus:ring-blue-300"
              />
              {hintError && (
                <p className="text-xs text-red-500">{hintError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handlePanelConnect}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 active:scale-95 transition-all hover:bg-gray-50 shadow-sm"
                >
                  <GoogleLogo className="w-4 h-4 flex-shrink-0" />
                  {hintEmail.trim() ? 'אשר וחבר חשבון זה' : 'בחר חשבון Google'}
                </button>
                <button
                  onClick={() => { setShowAddPanel(false); setHintEmail(''); setHintError('') }}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-400 active:scale-95"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPanel(true)}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-gray-300 rounded-xl py-2.5 px-4 text-sm text-gray-500 font-medium active:scale-95 transition-all hover:bg-gray-50 disabled:opacity-50"
            >
              <GoogleLogo className="w-4 h-4 flex-shrink-0" />
              + הוסף מייל נוסף לסריקה
            </button>
          )}

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
              {connections.length > 1 && (
                <p className="text-blue-500">סורקים {connections.length} חשבונות מייל</p>
              )}
            </div>
          )}

          {/* Scan error */}
          {scanError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">{scanError}</p>
          )}

          {/* Scan button */}
          <button
            onClick={handleScan}
            disabled={scanning || !!disconnecting}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {scanning ? (
              <><span className="animate-spin text-base">⏳</span>סורק {connections.length > 1 ? 'כל החשבונות' : 'מיילים'}...</>
            ) : (
              <><span>🔄</span>סרוק עכשיו{connections.length > 1 ? ` (${connections.length} חשבונות)` : ''}</>
            )}
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            הסריקה בודקת מיילים מ-30 הימים האחרונים · עדכון יומי אוטומטי ב-9:00
          </p>
        </>
      ) : (
        /* ── Not connected — show add-account panel immediately ── */
        <>
          <p className="text-xs text-gray-500 leading-relaxed">
            חבר את Gmail ואנחנו נסרוק אוטומטית אישורי הזמנות ונוסיף אותם לטיול הנכון.
            <br />
            <span className="text-gray-400">אפשר לחבר מספר חשבונות מייל.</span>
          </p>

          {/* Email hint input */}
          <div className="space-y-2">
            <label className="text-[11px] text-gray-500 block">
              כתובת Gmail לחיבור (אופציונלי — מאפשר לגוגל לבחור את החשבון הנכון)
            </label>
            <input
              type="email"
              dir="ltr"
              value={hintEmail}
              onChange={e => { setHintEmail(e.target.value); setHintError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePanelConnect()}
              placeholder="your@gmail.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left outline-none focus:ring-2 focus:ring-blue-300"
            />
            {hintError && <p className="text-xs text-red-500">{hintError}</p>}
          </div>

          <button
            onClick={handlePanelConnect}
            className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all hover:bg-gray-50"
          >
            <GoogleLogo className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">
              {hintEmail.trim() ? `סנכרן את ${hintEmail.trim()}` : 'סנכרן Gmail עם Tripix'}
            </span>
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            Tripix מבקש גישת קריאה בלבד לתיבת הדואר שלך
          </p>
        </>
      )}
    </div>
  )
}
