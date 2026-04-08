'use client'

/**
 * TripGmailImport
 *
 * A button (+ inline result card) that lets the user retroactively import
 * booking confirmation emails from their Gmail into a specific trip.
 *
 * Shows only when:
 *   - The user has a connected Gmail account
 *   - The trip exists
 *
 * Silently hides when Gmail is not connected (no visual noise).
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface ImportResult {
  scanned:         number
  parsed:          number
  created:         number
  scannedWithPDF:  number
  scannedEmailOnly: number
  daysSearched:    number
  tripName:        string
}

interface TripGmailImportProps {
  tripId:      string
  tripName:    string
}

export default function TripGmailImport({ tripId, tripName }: TripGmailImportProps) {
  const [hasGmail,   setHasGmail]   = useState<boolean | null>(null) // null = loading
  const [importing,  setImporting]  = useState(false)
  const [result,     setResult]     = useState<ImportResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  // Check if Gmail is connected
  const checkGmail = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHasGmail(false); return }

    const { data } = await supabase
      .from('gmail_connections')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    setHasGmail(!!data)
  }, [])

  useEffect(() => { checkGmail() }, [checkGmail])

  // Don't render while loading or when Gmail is not connected
  if (hasGmail === null || hasGmail === false) return null

  const handleImport = async () => {
    if (importing) return
    setImporting(true)
    setResult(null)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('לא מחובר'); setImporting(false); return }

      const res = await fetch('/api/gmail/scan-trip', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ trip_id: tripId }),
      })

      const json = await res.json() as ImportResult & { error?: string }
      if (!res.ok) {
        setError(json.error || 'שגיאה בייבוא')
        return
      }
      setResult(json)
    } catch {
      setError('שגיאת רשת — נסה שוב')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-2" dir="rtl">
      {/* Import button */}
      {!result && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl py-2.5 px-4 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
        >
          {importing ? (
            <>
              <span className="animate-spin text-base">⏳</span>
              סורק Gmail... (עשוי לקחת כדקה)
            </>
          ) : (
            <>
              <span>📧</span>
              ייבוא הזמנות מ-Gmail
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-blue-800">
            ✅ הייבוא הושלם עבור {tripName}
          </p>
          <p className="text-xs text-blue-700">
            סרקנו {result.scanned} מיילים מ-{result.daysSearched} הימים האחרונים
            {result.scannedWithPDF > 0 && <> · {result.scannedWithPDF} עם PDF</>}
          </p>
          <p className="text-xs text-blue-700">
            ניתחנו {result.parsed} · נוצרו <strong>{result.created}</strong> הוצאות חדשות
          </p>
          {result.created === 0 && result.scanned > 0 && (
            <p className="text-[11px] text-blue-500 mt-0.5">
              לא נמצאו הזמנות חדשות (כנראה כבר יובאו בעבר)
            </p>
          )}
          {result.scanned === 0 && (
            <p className="text-[11px] text-blue-500 mt-0.5">
              לא נמצאו מיילים — נסה לוודא שהמייל שלך מחובר
            </p>
          )}
          <button
            onClick={() => { setResult(null); setError(null) }}
            className="text-[11px] text-blue-400 underline mt-1"
          >
            סרוק שוב
          </button>
        </div>
      )}
    </div>
  )
}
