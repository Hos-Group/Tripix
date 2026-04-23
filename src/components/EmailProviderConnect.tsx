'use client'

/**
 * EmailProviderConnect
 * Unified email provider connection widget.
 * Supports: Gmail (OAuth), Microsoft/Outlook (OAuth), any provider (forwarding).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Copy, CheckCheck, Mail } from 'lucide-react'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface EmailConnection {
  id:              string
  email:           string
  needs_reauth?:   boolean
  provider:        'gmail' | 'microsoft'
  connection_type?: string  // 'oauth' | 'linked'
}

interface ScanResult {
  scanned:           number
  parsed:            number
  created:           number
  scannedWithPDF?:   number
  scannedEmailOnly?: number
  revokedAccounts?:  string[]
  scanError?:        string
}

interface EmailProviderConnectProps {
  userId:   string
  inboxKey?: string | null   // user's unique forward address prefix
}

// ── Provider tab options ──────────────────────────────────────────────────────

type Tab = 'gmail' | 'microsoft' | 'forward'

// ── Google logo ───────────────────────────────────────────────────────────────

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

// ── Microsoft logo ────────────────────────────────────────────────────────────

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-4 h-4'} viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  )
}

// ── Detect restricted context (iframe / localhost) ────────────────────────────

function isRestrictedContext(): boolean {
  if (typeof window === 'undefined') return false
  try { if (window.self !== window.top) return true } catch { return true }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true
  return false
}

const PROD_URL = 'https://tripix-ruby.vercel.app'

// ── Build OAuth URLs ──────────────────────────────────────────────────────────

async function getSessionToken(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  } catch { return '' }
}

async function buildGoogleOAuthUrl(hint?: string): Promise<string> {
  const base  = typeof window !== 'undefined' ? window.location.origin : ''
  const token = await getSessionToken()
  const params = new URLSearchParams()
  if (hint)  params.set('hint', hint)
  if (token) params.set('token', token)
  const qs = params.toString()
  return `${base}/api/auth/google${qs ? '?' + qs : ''}`
}

async function buildMicrosoftOAuthUrl(hint?: string): Promise<string> {
  const base  = typeof window !== 'undefined' ? window.location.origin : ''
  const token = await getSessionToken()
  const params = new URLSearchParams()
  if (hint)  params.set('hint', hint)
  if (token) params.set('token', token)
  const qs = params.toString()
  return `${base}/api/auth/microsoft${qs ? '?' + qs : ''}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailProviderConnect({ userId, inboxKey }: EmailProviderConnectProps) {
  const [tab,           setTab]           = useState<Tab>('gmail')
  const [connections,   setConnections]   = useState<EmailConnection[]>([])
  const [loading,       setLoading]       = useState(true)
  const [scanning,      setScanning]      = useState(false)
  const [lastScan,      setLastScan]      = useState<ScanResult | null>(null)
  const [lastScanTime,  setLastScanTime]  = useState<string | null>(null)
  const [scanError,     setScanError]     = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [copied,        setCopied]        = useState(false)

  // Add-account panel
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [hintEmail,    setHintEmail]    = useState('')
  const [hintError,    setHintError]    = useState('')
  const hintInputRef = useRef<HTMLInputElement>(null)

  const inboxEmail = inboxKey ? `${inboxKey}@in.tripix.app` : null
  const restricted = typeof window !== 'undefined' && isRestrictedContext()

  // ── Load all connections ──────────────────────────────────────────────────
  const loadConnections = useCallback(async () => {
    try {
      const [gmailRes, msRes] = await Promise.all([
        supabase.from('gmail_connections').select('id, gmail_address, needs_reauth, connection_type').eq('user_id', userId).order('gmail_address'),
        supabase.from('microsoft_connections').select('id, email, needs_reauth').eq('user_id', userId).order('email'),
      ])
      const gmail = ((gmailRes.data || []) as Array<{ id: string; gmail_address: string; needs_reauth?: boolean; connection_type?: string }>)
        .map(c => ({ id: c.id, email: c.gmail_address, needs_reauth: c.needs_reauth, connection_type: c.connection_type, provider: 'gmail' as const }))
      const microsoft = ((msRes.data || []) as Array<{ id: string; email: string; needs_reauth?: boolean }>)
        .map(c => ({ id: c.id, email: c.email, needs_reauth: c.needs_reauth, provider: 'microsoft' as const }))
      setConnections([...gmail, ...microsoft])
    } catch (err) {
      console.error('[EmailProviderConnect] loadConnections error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadConnections() }, [loadConnections])
  useEffect(() => { if (showAddPanel) setTimeout(() => hintInputRef.current?.focus(), 50) }, [showAddPanel])

  // ── URL-based feedback (e.g. ?gmail=connected or ?microsoft=connected) ────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected' || params.get('microsoft') === 'connected') {
      loadConnections()
      // Clean URL
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [loadConnections])

  // ── OAuth helpers ─────────────────────────────────────────────────────────
  const startGoogleOAuth = async (hint?: string) => {
    const url = await buildGoogleOAuthUrl(hint)
    if (restricted) window.open(url, '_blank', 'noopener')
    else window.location.href = url
  }

  const startMicrosoftOAuth = async (hint?: string) => {
    const url = await buildMicrosoftOAuthUrl(hint)
    if (restricted) window.open(url, '_blank', 'noopener')
    else window.location.href = url
  }

  const handlePanelConnect = () => {
    const email = hintEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setHintError('כתובת מייל לא תקינה')
      return
    }
    if (tab === 'gmail')     startGoogleOAuth(email || undefined)
    if (tab === 'microsoft') startMicrosoftOAuth(email || undefined)
  }

  // ── Scan all providers ────────────────────────────────────────────────────
  const handleScan = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setScanError('לא מחובר'); return }

      const gmailConns    = connections.filter(c => c.provider === 'gmail')
      const msConns       = connections.filter(c => c.provider === 'microsoft')

      // Run Gmail and Microsoft scans in parallel
      const scanPromises: Promise<ScanResult & { error?: string }>[] = []

      if (gmailConns.length > 0) {
        scanPromises.push(
          fetch('/api/gmail/scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
        )
      }
      if (msConns.length > 0) {
        scanPromises.push(
          fetch('/api/microsoft/scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
        )
      }

      const results = await Promise.all(scanPromises)

      // Aggregate stats
      const aggregated: ScanResult = {
        scanned: 0, parsed: 0, created: 0,
        scannedWithPDF: 0, scannedEmailOnly: 0,
        revokedAccounts: [], scanError: undefined,
      }

      for (const json of results) {
        if (json.error) { setScanError(json.error); continue }
        aggregated.scanned           += json.scanned          || 0
        aggregated.parsed            += json.parsed           || 0
        aggregated.created           += json.created          || 0
        aggregated.scannedWithPDF    = (aggregated.scannedWithPDF   ?? 0) + (json.scannedWithPDF   || 0)
        aggregated.scannedEmailOnly  = (aggregated.scannedEmailOnly ?? 0) + (json.scannedEmailOnly || 0)
        if (json.revokedAccounts?.length) {
          aggregated.revokedAccounts!.push(...json.revokedAccounts)
          aggregated.scanError = json.scanError
        } else if (json.scanError && !aggregated.scanError) {
          aggregated.scanError = json.scanError
        }
      }

      setLastScan(aggregated)
      setLastScanTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))

      if (aggregated.revokedAccounts!.length > 0) {
        setScanError(aggregated.scanError || 'חיבור מייל פג תוקף — יש להתחבר מחדש')
        setConnections(prev => prev.map(c =>
          aggregated.revokedAccounts!.includes(c.email) ? { ...c, needs_reauth: true } : c
        ))
      } else if (aggregated.scanError) {
        setScanError(aggregated.scanError)
      }
    } catch {
      setScanError('שגיאת רשת — נסה שוב')
    } finally {
      setScanning(false)
    }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = async (conn: EmailConnection) => {
    if (!confirm(`לנתק את ${conn.email} מ-Tripix?`)) return
    setDisconnecting(conn.id)
    try {
      const table = conn.provider === 'gmail' ? 'gmail_connections' : 'microsoft_connections'
      const { error } = await supabase.from(table).delete().eq('id', conn.id).eq('user_id', userId)
      if (error) throw error
      setConnections(prev => prev.filter(c => c.id !== conn.id))
    } catch (err) {
      console.error('[EmailProviderConnect] disconnect error:', err)
    } finally {
      setDisconnecting(null)
    }
  }

  const copyInbox = async () => {
    if (!inboxEmail) return
    await navigator.clipboard.writeText(inboxEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <div className="h-5 bg-gray-100 rounded-lg w-40 animate-pulse" />
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  const gmailConns    = connections.filter(c => c.provider === 'gmail')
  const msConns       = connections.filter(c => c.provider === 'microsoft')
  const totalConns    = connections.length
  // Only OAuth connections support direct scanning; linked connections use forwarding
  const scannableConns = connections.filter(c => c.provider !== 'gmail' || c.connection_type === 'oauth')
  const hasMsClientId  = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    // We show Microsoft tab always — if not configured it shows a setup notice

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── Restricted context banner ── */}
      {restricted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-bold text-amber-800">🔒 פתח באפליקציה האמיתית לחיבור מייל</p>
          <a href={`${PROD_URL}/settings`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-primary text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all">
            🌐 פתח Tripix וחבר מייל
          </a>
        </div>
      )}

      {/* ── Tab selector ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { id: 'gmail'     as Tab, label: 'Gmail',   icon: <GoogleLogo />,    count: gmailConns.length },
            { id: 'microsoft' as Tab, label: 'Outlook', icon: <MicrosoftLogo />, count: msConns.length   },
            { id: 'forward'   as Tab, label: 'כל מייל',  icon: <Mail className="w-4 h-4" />, count: 0   },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShowAddPanel(false); setHintEmail(''); setHintError('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all border-b-2 ${
                tab === t.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">

          {/* ── GMAIL TAB ── */}
          {tab === 'gmail' && (
            <GmailTabContent
              connections={gmailConns}
              scanning={scanning}
              disconnecting={disconnecting}
              showAddPanel={showAddPanel}
              hintEmail={hintEmail}
              hintError={hintError}
              hintInputRef={hintInputRef}
              inboxEmail={inboxEmail}
              onSetShowAddPanel={setShowAddPanel}
              onSetHintEmail={(v) => { setHintEmail(v); setHintError('') }}
              onConnect={handlePanelConnect}
              onDisconnect={handleDisconnect}
            />
          )}

          {/* ── MICROSOFT TAB ── */}
          {tab === 'microsoft' && (
            <MicrosoftTabContent
              connections={msConns}
              scanning={scanning}
              disconnecting={disconnecting}
              showAddPanel={showAddPanel}
              hintEmail={hintEmail}
              hintError={hintError}
              hintInputRef={hintInputRef}
              onSetShowAddPanel={setShowAddPanel}
              onSetHintEmail={(v) => { setHintEmail(v); setHintError('') }}
              onConnect={handlePanelConnect}
              onDisconnect={handleDisconnect}
            />
          )}

          {/* ── FORWARD TAB ── */}
          {tab === 'forward' && (
            <ForwardTabContent
              inboxEmail={inboxEmail}
              copied={copied}
              onCopy={copyInbox}
            />
          )}
        </div>
      </div>

      {/* ── Scan controls (shown when at least one OAuth account is connected) ── */}
      {scannableConns.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          {lastScan && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">
                תוצאות סריקה אחרונה
                {lastScanTime && <span className="font-normal text-blue-500"> · {lastScanTime}</span>}
              </p>
              <p>
                סרקנו {lastScan.scanned} מיילים
                {lastScan.scannedWithPDF !== undefined && (
                  <> · {lastScan.scannedWithPDF} עם PDF · {lastScan.scannedEmailOnly ?? 0} ללא PDF</>
                )}
                {' '}· יצרנו {lastScan.created} הוצאות
              </p>
              {scannableConns.length > 1 && (
                <p className="text-blue-500">סורקים {scannableConns.length} חשבונות מייל</p>
              )}
            </div>
          )}

          {scanError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">{scanError}</p>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || !!disconnecting}
            className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {scanning
              ? <><span className="animate-spin text-base">⏳</span>סורק {scannableConns.length > 1 ? 'כל החשבונות' : 'מיילים'}...</>
              : <><span>🔄</span>סרוק עכשיו{scannableConns.length > 1 ? ` (${scannableConns.length} חשבונות)` : ''}</>
            }
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            הסריקה בודקת מיילים מ-30 הימים האחרונים · עדכון יומי אוטומטי ב-9:00
          </p>
        </div>
      )}

      {/* ── Privacy notice ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs text-blue-800 font-medium">🔐 פרטיות ואבטחה</p>
        <p className="text-xs text-blue-700 mt-1">Tripix מבקש גישת קריאה בלבד. אנחנו לא שולחים, מוחקים או משנים מיילים.</p>
      </div>
    </div>
  )
}

// ── Gmail tab content ─────────────────────────────────────────────────────────

interface OAuthTabProps {
  connections:       EmailConnection[]
  scanning:          boolean
  disconnecting:     string | null
  showAddPanel:      boolean
  hintEmail:         string
  hintError:         string
  hintInputRef:      React.RefObject<HTMLInputElement>
  inboxEmail?:       string | null   // only needed for Gmail linked-connection guide
  onSetShowAddPanel: (v: boolean) => void
  onSetHintEmail:    (v: string) => void
  onConnect:         () => void
  onDisconnect:      (c: EmailConnection) => void
}

function GmailTabContent({
  connections, scanning, disconnecting, showAddPanel,
  hintEmail, hintError, hintInputRef, inboxEmail,
  onSetShowAddPanel, onSetHintEmail, onConnect, onDisconnect,
}: OAuthTabProps) {
  const [inboxCopied, setInboxCopied] = useState(false)

  const copyInbox = async () => {
    if (!inboxEmail) return
    await navigator.clipboard.writeText(inboxEmail)
    setInboxCopied(true)
    setTimeout(() => setInboxCopied(false), 2500)
  }

  // Linked connections — verified address, forwarding-based flow
  const linkedConns = connections.filter(c => c.connection_type !== 'oauth')
  const hasLinked    = linkedConns.length > 0

  if (connections.length === 0 && !showAddPanel) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          חבר Gmail כדי לקבל אישורי הזמנות אוטומטית.
          <br /><span className="text-gray-400">Tripix יאמת את הכתובת ויראה לך איך להעביר מיילים.</span>
        </p>
        <ConnectWithHint
          placeholder="your@gmail.com"
          hintEmail={hintEmail}
          hintError={hintError}
          hintInputRef={hintInputRef}
          onSetHintEmail={onSetHintEmail}
          onConnect={onConnect}
          logo={<GoogleLogo className="w-5 h-5 flex-shrink-0" />}
          label="חבר Gmail עם Tripix"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {connections.map(conn => (
        <ConnectionRow key={conn.id} conn={conn} disconnecting={disconnecting} scanning={scanning} onDisconnect={onDisconnect} />
      ))}

      {/* ── Forwarding guide for linked connections ── */}
      {hasLinked && inboxEmail && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-800">📨 כדי לקבל מיילים אוטומטית — הפנה ל-Tripix</p>
          <p className="text-[11px] text-blue-700 leading-relaxed">
            העתק את הכתובת ושים אותה ב-BCC בכל הזמנה, או הגדר העברת מיילים אוטומטית בגמייל.
          </p>
          <div className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-blue-200">
            <span className="text-[11px] font-mono text-blue-900 flex-1 truncate" dir="ltr">{inboxEmail}</span>
            <button
              onClick={copyInbox}
              className="text-blue-500 hover:text-blue-600 active:scale-95 transition-all flex-shrink-0"
              title="העתק כתובת"
            >
              {inboxCopied
                ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                : <Copy className="w-3.5 h-3.5" />
              }
            </button>
          </div>
          <a
            href="https://mail.google.com/mail/u/0/#settings/filters"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[11px] text-blue-600 underline"
          >
            פתח הגדרות סינון בגמייל →
          </a>
        </div>
      )}

      {showAddPanel ? (
        <AddAccountPanel
          hintEmail={hintEmail}
          hintError={hintError}
          hintInputRef={hintInputRef}
          placeholder="personal@gmail.com"
          label="אשר וחבר חשבון Gmail זה"
          logo={<GoogleLogo className="w-4 h-4 flex-shrink-0" />}
          onSetHintEmail={onSetHintEmail}
          onConnect={onConnect}
          onCancel={() => { onSetShowAddPanel(false); onSetHintEmail('') }}
        />
      ) : (
        <button
          onClick={() => onSetShowAddPanel(true)}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-gray-300 rounded-xl py-2.5 px-4 text-sm text-gray-500 font-medium active:scale-95 transition-all hover:bg-gray-50 disabled:opacity-50"
        >
          <GoogleLogo className="w-4 h-4 flex-shrink-0" />
          + הוסף חשבון Gmail נוסף
        </button>
      )}
    </div>
  )
}

// ── Microsoft tab content ─────────────────────────────────────────────────────

function MicrosoftTabContent({
  connections, scanning, disconnecting, showAddPanel,
  hintEmail, hintError, hintInputRef,
  onSetShowAddPanel, onSetHintEmail, onConnect, onDisconnect,
}: OAuthTabProps) {
  if (connections.length === 0 && !showAddPanel) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          חבר Outlook, Hotmail, Live או Microsoft 365 לסריקה אוטומטית.
          <br /><span className="text-gray-400">אפשר לחבר מספר חשבונות.</span>
        </p>
        <ConnectWithHint
          placeholder="your@outlook.com"
          hintEmail={hintEmail}
          hintError={hintError}
          hintInputRef={hintInputRef}
          onSetHintEmail={onSetHintEmail}
          onConnect={onConnect}
          logo={<MicrosoftLogo className="w-5 h-5 flex-shrink-0" />}
          label="סנכרן Outlook עם Tripix"
        />
        <div className="bg-sky-50 rounded-xl p-3 text-[11px] text-sky-700 leading-relaxed">
          <strong>נתמך:</strong> Outlook.com · Hotmail · Live · Microsoft 365 / Exchange
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {connections.map(conn => (
        <ConnectionRow key={conn.id} conn={conn} disconnecting={disconnecting} scanning={scanning} onDisconnect={onDisconnect} />
      ))}
      {showAddPanel ? (
        <AddAccountPanel
          hintEmail={hintEmail}
          hintError={hintError}
          hintInputRef={hintInputRef}
          placeholder="your@outlook.com"
          label="אשר וחבר חשבון Outlook זה"
          logo={<MicrosoftLogo className="w-4 h-4 flex-shrink-0" />}
          onSetHintEmail={onSetHintEmail}
          onConnect={onConnect}
          onCancel={() => { onSetShowAddPanel(false); onSetHintEmail('') }}
        />
      ) : (
        <button
          onClick={() => onSetShowAddPanel(true)}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-gray-300 rounded-xl py-2.5 px-4 text-sm text-gray-500 font-medium active:scale-95 transition-all hover:bg-gray-50 disabled:opacity-50"
        >
          <MicrosoftLogo className="w-4 h-4 flex-shrink-0" />
          + הוסף חשבון Outlook נוסף
        </button>
      )}
    </div>
  )
}

// ── Forward tab content ───────────────────────────────────────────────────────

function ForwardTabContent({
  inboxEmail, copied, onCopy,
}: {
  inboxEmail: string | null
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 leading-relaxed">
        עובד עם <strong>כל ספקי המייל</strong> — Yahoo, iCloud, Walla, AOL, חברתי/עסקי, ועוד.
        פשוט העבר את אישורי ההזמנה לכתובת האישית שלך.
      </p>

      {/* Inbox address */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4" />
          <span className="font-bold text-sm">הכתובת האישית שלך</span>
        </div>
        {inboxEmail ? (
          <>
            <div className="bg-white/20 rounded-xl px-3 py-2.5 font-mono text-sm break-all mb-3" dir="ltr">
              {inboxEmail}
            </div>
            <button
              onClick={onCopy}
              className="flex items-center gap-2 bg-white/25 hover:bg-white/35 active:scale-95 transition-all rounded-xl px-4 py-2 text-sm font-medium w-full justify-center"
            >
              {copied
                ? <><CheckCheck className="w-4 h-4" /> הועתק!</>
                : <><Copy className="w-4 h-4" /> העתק כתובת</>
              }
            </button>
          </>
        ) : (
          <p className="text-white/70 text-sm">טוען...</p>
        )}
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="font-bold text-sm text-gray-800">איך זה עובד? 🤔</p>
        {[
          { icon: '📋', title: 'העתק את הכתובת', desc: 'העתק את כתובת המייל האישית שלמעלה' },
          { icon: '✉️', title: 'הוסף ל-BCC או הפנה', desc: 'כשמזמינים מלון/טיסה/שכירות — הוסף ל-BCC, או הפנה מיילים קיימים' },
          { icon: '🤖', title: 'Tripix יעשה את השאר', desc: 'המערכת תנתח את המייל ותוסיף את ההוצאה אוטומטית לנסיעה הנכונה' },
        ].map(item => (
          <div key={item.title} className="flex gap-3 items-start">
            <span className="text-xl flex-shrink-0">{item.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Supported providers */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="font-bold text-sm mb-2">פלטפורמות נתמכות 🌐</p>
        <div className="flex flex-wrap gap-2">
          {['Booking.com','Airbnb','Expedia','Hotels.com','אל-על','Ryanair','EasyJet','Wizzair','Rentalcars','Avis','Hertz','GetYourGuide','Viator','eDreams','Trip.com','Agoda'].map(p => (
            <span key={p} className="bg-gray-50 text-gray-600 text-xs px-3 py-1 rounded-full border border-gray-200">{p}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ConnectionRow({
  conn, disconnecting, scanning, onDisconnect,
}: {
  conn: EmailConnection
  disconnecting: string | null
  scanning: boolean
  onDisconnect: (c: EmailConnection) => void
}) {
  const providerIcon = conn.provider === 'gmail'
    ? <GoogleLogo className="w-3.5 h-3.5 flex-shrink-0" />
    : <MicrosoftLogo className="w-3.5 h-3.5 flex-shrink-0" />

  const isLinked = conn.provider === 'gmail' && conn.connection_type !== 'oauth'

  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${conn.needs_reauth ? 'bg-red-50' : isLinked ? 'bg-blue-50' : 'bg-emerald-50'}`}>
      <span className={`text-base flex-shrink-0 ${conn.needs_reauth ? 'text-red-400' : isLinked ? 'text-blue-400' : 'text-emerald-500'}`}>
        {conn.needs_reauth ? '⚠️' : isLinked ? '🔗' : '✅'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {providerIcon}
          <p className={`text-xs font-medium truncate ${conn.needs_reauth ? 'text-red-700' : isLinked ? 'text-blue-700' : 'text-emerald-700'}`} dir="ltr">
            {conn.email}
          </p>
        </div>
        {conn.needs_reauth && (
          <p className="text-[10px] text-red-500 mt-0.5">נדרש חיבור מחדש</p>
        )}
        {isLinked && !conn.needs_reauth && (
          <p className="text-[10px] text-blue-500 mt-0.5">מחובר — הפנה מיילים לסריקה אוטומטית</p>
        )}
      </div>
      <button
        onClick={() => onDisconnect(conn)}
        disabled={!!disconnecting || scanning}
        className="text-red-400 hover:text-red-500 text-xs px-2 py-1 rounded-lg active:scale-95 transition-all disabled:opacity-40"
        title="נתק חשבון זה"
      >
        {disconnecting === conn.id ? '...' : '✕'}
      </button>
    </div>
  )
}

function ConnectWithHint({
  placeholder, hintEmail, hintError, hintInputRef,
  onSetHintEmail, onConnect, logo, label,
}: {
  placeholder: string
  hintEmail: string
  hintError: string
  hintInputRef: React.RefObject<HTMLInputElement>
  onSetHintEmail: (v: string) => void
  onConnect: () => void
  logo: React.ReactNode
  label: string
}) {
  return (
    <div className="space-y-2">
      <input
        ref={hintInputRef}
        type="email"
        dir="ltr"
        value={hintEmail}
        onChange={e => onSetHintEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onConnect()}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left outline-none focus:ring-2 focus:ring-blue-300"
      />
      {hintError && <p className="text-xs text-red-500">{hintError}</p>}
      <button
        onClick={onConnect}
        className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all hover:bg-gray-50"
      >
        {logo}
        <span className="text-sm font-semibold text-gray-700">
          {hintEmail.trim() ? `סנכרן את ${hintEmail.trim()}` : label}
        </span>
      </button>
    </div>
  )
}

function AddAccountPanel({
  hintEmail, hintError, hintInputRef, placeholder, label, logo,
  onSetHintEmail, onConnect, onCancel,
}: {
  hintEmail:      string
  hintError:      string
  hintInputRef:   React.RefObject<HTMLInputElement>
  placeholder:    string
  label:          string
  logo:           React.ReactNode
  onSetHintEmail: (v: string) => void
  onConnect:      () => void
  onCancel:       () => void
}) {
  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">הוסף חשבון נוסף</p>
      <input
        ref={hintInputRef}
        type="email"
        dir="ltr"
        value={hintEmail}
        onChange={e => onSetHintEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onConnect()}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left outline-none focus:ring-2 focus:ring-blue-300"
      />
      {hintError && <p className="text-xs text-red-500">{hintError}</p>}
      <div className="flex gap-2">
        <button
          onClick={onConnect}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 active:scale-95 transition-all hover:bg-gray-50 shadow-sm"
        >
          {logo}
          {hintEmail.trim() ? label : 'בחר חשבון'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm text-gray-400 active:scale-95"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
