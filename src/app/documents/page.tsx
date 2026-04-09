'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, ExternalLink, Filter, List, LayoutGrid, CreditCard, RefreshCw, Mail, Settings, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDateShort } from '@/lib/utils'
import { Document, DocType, DOC_TYPE_META, TravelerId } from '@/types'
import DocumentViewer from '@/components/DocumentViewer'
import { loadTravelers, getTravelerName, type Traveler } from '@/lib/travelers'
import { useTrip } from '@/contexts/TripContext'

const DOC_TYPES: DocType[] = ['passport', 'flight', 'hotel', 'ferry', 'activity', 'insurance', 'visa', 'other']

export default function DocumentsPage() {
  const { currentTrip } = useTrip()
  const [travelers, setTravelers] = useState<Traveler[]>([])

  useEffect(() => {
    loadTravelers().then(setTravelers)
  }, [])
  const [documents,        setDocuments]        = useState<Document[]>([])
  const [loading,          setLoading]          = useState(true)
  const [reprocessing,     setReprocessing]     = useState<string | null>(null)
  const [reprocessingAll,  setReprocessingAll]  = useState(false)
  const [reprocessProgress, setReprocessProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Gmail sync state ────────────────────────────────────────────────────
  const [gmailConnections, setGmailConnections] = useState<{ id: string; gmail_address: string }[] | null>(null)
  const [gmailScanning,    setGmailScanning]    = useState(false)
  const [gmailResult,      setGmailResult]      = useState<{ scanned: number; created: number } | null>(null)
  const [gmailError,       setGmailError]       = useState<string | null>(null)
  const [filterType, setFilterType] = useState<DocType | null>(null)
  const [filterTraveler, setFilterTraveler] = useState<TravelerId | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'cards' | 'grid'>('list')
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  // ── Load Gmail connections ──────────────────────────────────────────────
  const loadGmailConnections = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setGmailConnections([]); return }
      const { data } = await supabase
        .from('gmail_connections')
        .select('id, gmail_address')
        .eq('user_id', user.id)
        .order('gmail_address')
      setGmailConnections(data || [])
    } catch {
      setGmailConnections([])
    }
  }, [])

  useEffect(() => { loadGmailConnections() }, [loadGmailConnections])

  const fetchDocuments = useCallback(async () => {
    if (!currentTrip) { setDocuments([]); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        setDocuments(data || [])
      }
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // ── Scan Gmail for this trip ─────────────────────────────────────────────
  const handleGmailScan = useCallback(async () => {
    if (!currentTrip) return
    setGmailScanning(true)
    setGmailResult(null)
    setGmailError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setGmailError('לא מחובר'); return }
      const res = await fetch('/api/gmail/scan-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trip_id: currentTrip.id }),
      })

      // Safely parse JSON — a 504 timeout returns HTML, not JSON
      let json: Record<string, unknown> = {}
      try {
        json = await res.json()
      } catch {
        if (res.status === 504 || res.status === 524) {
          setGmailError('הסריקה ארכה יותר מדי — נסה שוב (המיילים שנמצאו ייבאו בפעם הבאה)')
        } else {
          setGmailError(`שגיאת שרת (${res.status}) — נסה שוב`)
        }
        return
      }

      if (!res.ok) { setGmailError((json.error as string) || 'שגיאה בסריקה'); return }
      setGmailResult({ scanned: json.scanned as number, created: json.created as number })
      fetchDocuments() // always refresh — new documents may have been added
    } catch (err) {
      console.error('[gmail scan] network error:', err)
      setGmailError('שגיאת רשת — בדוק חיבור לאינטרנט ונסה שוב')
    } finally {
      setGmailScanning(false)
    }
  }, [currentTrip, fetchDocuments])

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('אתה בטוח שאתה רוצה למחוק? המסמך וההוצאות שנוצרו ממנו יימחקו לצמיתות.')
    if (!confirmed) return

    const doc = documents.find(d => d.id === id)

    // Step 1: Delete the document record FIRST (most important)
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) {
      console.error('Document delete failed:', error)
      toast.error('שגיאה במחיקת המסמך')
      return
    }

    // Step 2: Clean up related expenses (best effort — don't block)
    try {
      await supabase.from('expenses').delete().eq('source', 'document').eq('notes', `doc:${id}`)
      if (doc?.name) {
        await supabase.from('expenses').delete().eq('source', 'document').eq('title', doc.name)
      }
    } catch (e) {
      console.error('Expense cleanup error:', e)
    }

    // Step 3: Clean up storage file (best effort)
    if (doc?.file_url) {
      try {
        const path = doc.file_url.split('/documents/')[1] || doc.file_url.split('/receipts/')[1]
        if (path) {
          const bucket = doc.file_url.includes('/documents/') ? 'documents' : 'receipts'
          await supabase.storage.from(bucket).remove([decodeURIComponent(path)])
        }
      } catch (e) {
        console.error('Storage delete error:', e)
      }
    }

    toast.success('המסמך נמחק לצמיתות')
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const handleReprocess = async (id: string) => {
    setReprocessing(id)
    try {
      const res = await fetch('/api/documents/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error('שגיאה בעיבוד מחדש: ' + (json.error || ''))
      } else {
        toast.success('המסמך עובד מחדש!')
        fetchDocuments()
      }
    } catch {
      toast.error('שגיאת רשת')
    } finally {
      setReprocessing(null)
    }
  }

  const handleReprocessAll = async () => {
    const docsWithFile = documents.filter(d => d.file_url)
    if (docsWithFile.length === 0) { toast.error('אין מסמכים לעיבוד'); return }

    setReprocessingAll(true)
    setReprocessProgress({ done: 0, total: docsWithFile.length })

    let done = 0
    for (const doc of docsWithFile) {
      try {
        await fetch('/api/documents/reprocess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: doc.id }),
        })
      } catch {/* ignore individual errors */}
      done++
      setReprocessProgress({ done, total: docsWithFile.length })
    }

    setReprocessingAll(false)
    setReprocessProgress(null)
    toast.success(`${docsWithFile.length} מסמכים עובדו בהצלחה!`)
    fetchDocuments()
  }

  const filtered = documents.filter(d => {
    if (filterType && d.doc_type !== filterType) return false
    if (filterTraveler && d.traveler_id !== filterTraveler) return false
    return true
  })

  // Group by doc_type
  const grouped = filtered.reduce<Record<string, Document[]>>((acc, d) => {
    const key = d.doc_type
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  // ── Gmail card JSX (rendered regardless of loading state) ────────────────
  const gmailCard = (
    <AnimatePresence mode="wait">
      {gmailConnections === null ? (
        /* Still loading connections — show placeholder */
        <motion.div key="gmail-loading"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
      ) : gmailConnections.length === 0 ? (
        /* Not connected */
        <motion.div key="not-connected"
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-l from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Mail className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">משוך מסמכים מ-Gmail</p>
            <p className="text-xs text-gray-500 mt-0.5">חבר את המייל ונביא הזמנות אוטומטית</p>
          </div>
          <Link href="/settings"
            className="flex items-center gap-1 bg-primary text-white rounded-xl px-3 py-2 text-xs font-semibold active:scale-95 flex-shrink-0">
            <Settings className="w-3.5 h-3.5" /> חבר
          </Link>
        </motion.div>
      ) : (
        /* Connected */
        <motion.div key="connected"
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-l from-emerald-50 to-blue-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Mail className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Gmail מחובר ✅</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {gmailConnections.map(c => (
                  <span key={c.id} className="text-[10px] bg-white/80 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100 truncate max-w-[180px]" dir="ltr">
                    {c.gmail_address}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/settings" className="text-gray-300 hover:text-gray-500 active:scale-95 flex-shrink-0">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {gmailResult && (
            <div className="bg-white/70 rounded-xl px-3 py-2 text-xs text-emerald-700">
              {gmailResult.created > 0
                ? `✅ נוצרו ${gmailResult.created} מסמכים חדשים מתוך ${gmailResult.scanned} מיילים`
                : `סרקנו ${gmailResult.scanned} מיילים — לא נמצאו מסמכים חדשים`}
            </div>
          )}
          {gmailError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{gmailError}</p>
          )}
          <button
            onClick={handleGmailScan}
            disabled={gmailScanning || !currentTrip}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-all disabled:opacity-50">
            {gmailScanning
              ? <><span className="animate-spin">⏳</span> סורק מיילים...</>
              : <><Mail className="w-4 h-4" /> משוך מסמכים מ-Gmail לטיול זה</>}
          </button>
          {!gmailScanning && (
            <p className="text-[10px] text-gray-400 text-center">
              מחפש אישורי הזמנה · {gmailConnections.length} חשבון{gmailConnections.length > 1 ? 'ות' : ''} מחובר{gmailConnections.length > 1 ? 'ים' : ''}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">כספת מסמכים</h1>
          <Link href="/scan"
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium active:scale-95 transition-transform flex items-center gap-1">
            <Plus className="w-4 h-4" /> העלאה
          </Link>
        </div>
        {gmailCard}
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">כספת מסמכים</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([
              { mode: 'list' as const, icon: List, label: 'רשימה' },
              { mode: 'cards' as const, icon: CreditCard, label: 'כרטיסים' },
              { mode: 'grid' as const, icon: LayoutGrid, label: 'רשת' },
            ]).map(({ mode, icon: Icon }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Reprocess all button */}
          <button
            onClick={handleReprocessAll}
            disabled={reprocessingAll || documents.filter(d => d.file_url).length === 0}
            className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 rounded-xl px-3 py-2 text-sm font-medium active:scale-95 transition-transform disabled:opacity-40"
            title="עיבוד מחדש של כל המסמכים">
            <RefreshCw className={`w-4 h-4 ${reprocessingAll ? 'animate-spin' : ''}`} />
            {reprocessingAll && reprocessProgress
              ? `${reprocessProgress.done}/${reprocessProgress.total}`
              : 'רענן'}
          </button>

          <Link href="/scan"
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium active:scale-95 transition-transform flex items-center gap-1">
            <Plus className="w-4 h-4" /> העלאה
          </Link>
        </div>
      </div>

      {/* ── Gmail Sync Card ──────────────────────────────────────────────── */}
      {gmailCard}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">סוג מסמך:</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterType(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 ${!filterType ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>
            הכל
          </button>
          {DOC_TYPES.map(dt => (
            <button key={dt} onClick={() => setFilterType(filterType === dt ? null : dt)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 ${filterType === dt ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>
              {DOC_TYPE_META[dt].icon} {DOC_TYPE_META[dt].label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <span className="flex-shrink-0 text-xs text-gray-500 self-center">נוסע:</span>
          {[{ id: 'all', name: 'כולם' }, ...travelers].map(t => (
            <button key={t.id} onClick={() => setFilterTraveler(filterTraveler === t.id ? null : t.id as TravelerId)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 ${filterTraveler === t.id ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Documents grouped by type */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-3xl mb-2">📁</div>
          <p className="font-bold mb-1">אין מסמכים</p>
          <p className="text-sm text-gray-500 mb-3">העלו מסמכי הזמנה, דרכונים וכרטיסי טיסה</p>
          <Link href="/scan"
            className="inline-block bg-primary text-white rounded-xl px-6 py-2 text-sm font-medium active:scale-95 transition-transform">
            העלה מסמך
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([type, docs]) => {
          const meta = DOC_TYPE_META[type as DocType]
          return (
            <div key={type} className="space-y-2">
              <h3 className="text-sm font-bold text-gray-600 flex items-center gap-2">
                <span>{meta.icon}</span> {meta.label} ({docs.length})
              </h3>

              {/* Grid view */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-2 gap-2">
                  {docs.map(doc => (
                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      onClick={() => { if (doc.file_url) setViewerUrl(doc.file_url) }}
                      className={`bg-white rounded-2xl p-3 shadow-sm active:scale-[0.97] transition-transform ${doc.file_url ? 'cursor-pointer' : ''}`}>
                      <div className="text-2xl mb-2">{meta.icon}</div>
                      <p className="text-xs font-bold truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{getTravelerName(travelers, doc.traveler_id)}</p>
                      {doc.booking_ref && (
                        <p className="text-[10px] text-primary mt-1 truncate">
                          {doc.doc_type === 'passport' ? doc.booking_ref : `#${doc.booking_ref}`}
                        </p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        {doc.file_type === 'gmail' && <Mail className="w-3 h-3 text-orange-400" />}
                        {doc.file_url && <ExternalLink className="w-3 h-3 text-primary" />}
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                          className="text-gray-300 hover:text-red-400 active:scale-95">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Cards view */}
              {viewMode === 'cards' && docs.map(doc => (
                <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => { if (doc.file_url) setViewerUrl(doc.file_url) }}
                  className={`bg-gradient-to-bl from-white to-gray-50 rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform ${doc.file_url ? 'cursor-pointer' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <p className="text-sm font-bold">{doc.name}</p>
                        <p className="text-xs text-gray-400">{getTravelerName(travelers, doc.traveler_id)}</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                      className="p-2 text-gray-300 hover:text-red-400 active:scale-95">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {doc.booking_ref && (
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full">
                        {doc.doc_type === 'passport' ? `דרכון ${doc.booking_ref}` : `הזמנה ${doc.booking_ref}`}
                      </span>
                    )}
                    {doc.flight_number && (
                      <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-0.5 rounded-full">
                        {doc.flight_number}
                      </span>
                    )}
                    {doc.doc_type === 'passport' && (doc.extracted_data as Record<string, unknown>)?.issuing_country ? (
                      <span className="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded-full">
                        {String((doc.extracted_data as Record<string, unknown>).issuing_country)}
                      </span>
                    ) : null}
                    {doc.valid_from && (
                      <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">
                        {formatDateShort(doc.valid_from)}
                      </span>
                    )}
                    {doc.file_type === 'gmail' && (
                      <span className="bg-orange-50 text-orange-500 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5" /> Gmail
                      </span>
                    )}
                    {doc.file_url && (
                      <span className="bg-primary/5 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" /> צפייה
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* List view (default) */}
              {viewMode === 'list' && docs.map(doc => (
                <motion.div key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => { if (doc.file_url) setViewerUrl(doc.file_url) }}
                  className={`bg-white rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform ${doc.file_url ? 'cursor-pointer' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {getTravelerName(travelers, doc.traveler_id)}
                      </p>
                      {doc.booking_ref && (
                        <p className="text-xs text-primary mt-1">
                          {doc.doc_type === 'passport' ? 'מספר דרכון' : 'הזמנה'}: {doc.booking_ref}
                        </p>
                      )}
                      {doc.doc_type === 'passport' && (doc.extracted_data as Record<string, unknown>)?.issuing_country ? (
                        <p className="text-xs text-green-600 mt-0.5">
                          דרכון {String((doc.extracted_data as Record<string, unknown>).issuing_country)}
                        </p>
                      ) : null}
                      {doc.flight_number && (
                        <p className="text-xs text-blue-500 mt-0.5">טיסה: {doc.flight_number}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                        {doc.valid_from && <span>מ-{formatDateShort(doc.valid_from)}</span>}
                        {doc.valid_until && <span>עד {formatDateShort(doc.valid_until)}</span>}
                      </div>
                      {doc.file_type === 'gmail' && (
                        <p className="text-[10px] text-orange-500 mt-1.5 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> ייובא מ-Gmail
                        </p>
                      )}
                      {doc.file_url && (
                        <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> לחץ לצפייה במסמך
                        </p>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                      className="p-2 text-gray-300 hover:text-red-400 active:scale-95 transition-all flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        })
      )}
      <DocumentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  )
}
