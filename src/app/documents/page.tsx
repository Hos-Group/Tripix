'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, ExternalLink, Filter, List, LayoutGrid, CreditCard, RefreshCw, Mail, Settings, ChevronRight, CheckSquare, Square, Download, X } from 'lucide-react'
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

  const [documents,         setDocuments]        = useState<Document[]>([])
  const [loading,           setLoading]          = useState(true)
  const [reprocessingAll,   setReprocessingAll]  = useState(false)
  const [reprocessProgress, setReprocessProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Multi-select state ──────────────────────────────────────────────────
  const [selectMode,   setSelectMode]   = useState(false)
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── Gmail sync state ────────────────────────────────────────────────────
  const [gmailConnections, setGmailConnections] = useState<{ id: string; gmail_address: string }[] | null>(null)
  const [gmailScanning,    setGmailScanning]    = useState(false)
  const [gmailResult,      setGmailResult]      = useState<{
    scanned:            number
    created:            number
    createdDocs?:       Array<{ id: string; name: string; doc_type: string }>
    filteredLowConf?:   number
    filteredWrongDest?: number
    filteredWrongDate?: number
    filteredDuplicate?: number
    failedDB?:          number
    lastDbError?:       string
  } | null>(null)
  const [gmailError,  setGmailError]  = useState<string | null>(null)
  const [newDocIds,   setNewDocIds]   = useState<Set<string>>(new Set())
  const newDocsRef = useRef<HTMLDivElement>(null)
  const [filterType,     setFilterType]     = useState<DocType | null>(null)
  const [filterTraveler, setFilterTraveler] = useState<TravelerId | null>(null)
  const [viewMode,       setViewMode]       = useState<'list' | 'cards' | 'grid'>('list')
  const [viewerUrl,      setViewerUrl]      = useState<string | null>(null)

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
      if (error) console.error(error)
      else setDocuments(data || [])
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])

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

      let json: Record<string, unknown> = {}
      try { json = await res.json() } catch {
        if (res.status === 504 || res.status === 524) {
          setGmailError('הסריקה ארכה יותר מדי — נסה שוב')
        } else {
          setGmailError(`שגיאת שרת (${res.status}) — נסה שוב`)
        }
        return
      }

      if (!res.ok) { setGmailError((json.error as string) || 'שגיאה בסריקה'); return }

      const createdDocs = (json.createdDocs as Array<{ id: string; name: string; doc_type: string }>) || []
      setGmailResult({
        scanned:           json.scanned           as number,
        created:           json.created           as number,
        createdDocs,
        filteredLowConf:   json.filteredLowConf   as number | undefined,
        filteredWrongDest: json.filteredWrongDest as number | undefined,
        filteredWrongDate: json.filteredWrongDate as number | undefined,
        filteredDuplicate: json.filteredDuplicate as number | undefined,
        failedDB:          json.failedDB          as number | undefined,
        lastDbError:       json.lastDbError       as string | undefined,
      })

      if (createdDocs.length > 0) {
        setFilterType(null)
        setFilterTraveler(null)
        const { data: newDocs, error: newDocsErr } = await supabase
          .from('documents')
          .select('*')
          .in('id', createdDocs.map(d => d.id))
        if (newDocsErr) console.error('[documents] Failed to fetch new docs by ID:', newDocsErr)
        if (newDocs && newDocs.length > 0) {
          setDocuments(prev => [
            ...newDocs,
            ...prev.filter(d => !newDocs.some((n: Document) => n.id === d.id)),
          ])
          setNewDocIds(new Set(newDocs.map((d: Document) => d.id)))
          setTimeout(() => setNewDocIds(new Set()), 10000)
          newDocs.forEach((doc: Document) => {
            toast.success(`נוסף: ${doc.name}`, { icon: '📄', duration: 5000 })
          })
          setTimeout(() => {
            newDocsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 200)
        } else {
          await fetchDocuments()
        }
      } else {
        await fetchDocuments()
      }
    } catch (err) {
      console.error('[gmail scan] network error:', err)
      setGmailError('שגיאת רשת — בדוק חיבור לאינטרנט ונסה שוב')
    } finally {
      setGmailScanning(false)
    }
  }, [currentTrip, fetchDocuments])

  // ── Delete via server API (bypasses RLS) ─────────────────────────────────
  const deleteDocumentsByIds = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { toast.error('לא מחובר'); return false }
      const res = await fetch('/api/documents/delete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ids }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'שגיאה במחיקה'); return false }
      return true
    } catch {
      toast.error('שגיאת רשת'); return false
    }
  }, [])

  // ── Single delete ────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('למחוק את המסמך לצמיתות?')
    if (!confirmed) return
    const ok = await deleteDocumentsByIds([id])
    if (ok) {
      toast.success('המסמך נמחק')
      setDocuments(prev => prev.filter(d => d.id !== id))
    }
  }

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
    const confirmed = window.confirm(`למחוק ${selectedIds.size} מסמכים לצמיתות?`)
    if (!confirmed) return
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const ok = await deleteDocumentsByIds(ids)
    if (ok) {
      toast.success(`נמחקו ${ids.length} מסמכים`)
      setDocuments(prev => prev.filter(d => !ids.includes(d.id)))
      setSelectedIds(new Set())
      setSelectMode(false)
    }
    setBulkDeleting(false)
  }

  // ── Export selected (open file_url in new tab) ───────────────────────────
  const handleExport = () => {
    const selected = documents.filter(d => selectedIds.has(d.id) && d.file_url)
    if (!selected.length) { toast('אין קבצים לייצוא בבחירה זו'); return }
    selected.forEach(d => window.open(d.file_url!, '_blank'))
    toast.success(`נפתחו ${selected.length} קבצים`)
  }

  // ── Toggle select ────────────────────────────────────────────────────────
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)))
    }
  }

  // ── Delete duplicates ────────────────────────────────────────────────────
  const handleDeleteDuplicates = async () => {
    const sorted = [...documents].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
    )
    const seen     = new Set<string>()
    const toDelete: string[] = []
    for (const doc of sorted) {
      const key = `${(doc.name || '').toLowerCase().trim()}|${doc.valid_from || ''}`
      if (key === '|') continue
      if (seen.has(key)) toDelete.push(doc.id)
      else seen.add(key)
    }
    if (toDelete.length === 0) { toast('אין כפילויות'); return }
    const confirmed = window.confirm(`נמצאו ${toDelete.length} כפילויות. למחוק?`)
    if (!confirmed) return
    const ok = await deleteDocumentsByIds(toDelete)
    if (ok) {
      toast.success(`נמחקו ${toDelete.length} כפילויות ✓`)
      setDocuments(prev => prev.filter(d => !toDelete.includes(d.id)))
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
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ documentId: doc.id }),
        })
      } catch {/* ignore */}
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

  // Duplicate count
  const dupCount = (() => {
    const seen = new Set<string>()
    let count = 0
    for (const doc of [...documents].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
    )) {
      const key = `${(doc.name || '').toLowerCase().trim()}|${doc.valid_from || ''}`
      if (key === '|') continue
      if (seen.has(key)) count++
      else seen.add(key)
    }
    return count
  })()

  // ── Gmail card ────────────────────────────────────────────────────────────
  const gmailCard = (
    <AnimatePresence mode="wait">
      {gmailConnections === null ? (
        <motion.div key="gmail-loading"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
      ) : gmailConnections.length === 0 ? (
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
            <div className="bg-white/70 rounded-xl px-3 py-2.5 text-xs space-y-2">
              {gmailResult.created > 0 ? (
                <>
                  <p className="text-emerald-700 font-semibold">
                    ✅ נוצרו {gmailResult.created} מסמכים מתוך {gmailResult.scanned} מיילים
                  </p>
                  {gmailResult.createdDocs && gmailResult.createdDocs.length > 0 && (
                    <ul className="space-y-1">
                      {gmailResult.createdDocs.map(doc => (
                        <li key={doc.id} className="flex items-center gap-1.5 text-gray-700">
                          <span className="text-base leading-none">
                            {DOC_TYPE_META[doc.doc_type as DocType]?.icon ?? '📄'}
                          </span>
                          <span className="truncate">{doc.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : gmailResult.scanned === 0 ? (
                <p className="text-amber-600 font-medium">
                  ⚠️ לא נמצאו מיילים תואמים — נסה שוב מאוחר יותר
                </p>
              ) : (
                <p className="text-gray-600 font-medium">
                  סרקנו {gmailResult.scanned} מיילים — לא נמצאו מסמכים חדשים לטיול זה
                </p>
              )}
              {gmailResult.scanned > 0 && (
                <div className="border-t border-gray-100 pt-1.5 space-y-0.5">
                  {(gmailResult.filteredLowConf ?? 0) > 0 && (
                    <p className="text-gray-400">🤖 {gmailResult.filteredLowConf} מיילים שיווקיים / לא ברורים (AI)</p>
                  )}
                  {(gmailResult.filteredWrongDest ?? 0) > 0 && (
                    <p className="text-gray-400">🗺️ {gmailResult.filteredWrongDest} הזמנות ליעד אחר</p>
                  )}
                  {(gmailResult.filteredWrongDate ?? 0) > 0 && (
                    <p className="text-gray-400">📅 {gmailResult.filteredWrongDate} הזמנות מחוץ לתאריכי הטיול</p>
                  )}
                  {(gmailResult.filteredDuplicate ?? 0) > 0 && (
                    <p className="text-gray-400">🔄 {gmailResult.filteredDuplicate} כבר קיימים במערכת</p>
                  )}
                  {(gmailResult.failedDB ?? 0) > 0 && (
                    <div>
                      <p className="text-red-400">⚠️ {gmailResult.failedDB} שגיאות שמירה</p>
                      {gmailResult.lastDbError && (
                        <p className="text-red-300 text-[10px] mt-0.5 font-mono break-all">
                          {gmailResult.lastDbError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
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
    <div className="space-y-4 pb-32">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">כספת מסמכים</h1>
        <div className="flex items-center gap-2">
          {/* View mode */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([
              { mode: 'list'  as const, icon: List,       label: 'רשימה'  },
              { mode: 'cards' as const, icon: CreditCard, label: 'כרטיסים' },
              { mode: 'grid'  as const, icon: LayoutGrid,  label: 'רשת'    },
            ]).map(({ mode, icon: Icon }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Multi-select toggle */}
          <button
            onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()) }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium active:scale-95 transition-all ${
              selectMode ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
            }`}
            title="בחירה מרובה">
            <CheckSquare className="w-4 h-4" />
            {selectMode ? 'בטל' : 'בחר'}
          </button>

          {/* Duplicate cleaner */}
          {dupCount > 0 && (
            <button
              onClick={handleDeleteDuplicates}
              className="flex items-center gap-1.5 bg-red-50 text-red-500 rounded-xl px-3 py-2 text-sm font-medium active:scale-95 transition-transform"
              title={`נמצאו ${dupCount} כפילויות`}>
              <Trash2 className="w-4 h-4" />
              {dupCount} כפולים
            </button>
          )}

          {/* Reprocess all */}
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

      {/* ── Gmail Sync Card ───────────────────────────────────────────────── */}
      {gmailCard}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
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

        {/* Select all row — shown only in select mode */}
        {selectMode && filtered.length > 0 && (
          <div className="flex items-center gap-3 bg-primary/5 rounded-xl px-3 py-2">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-primary font-medium">
              {selectedIds.size === filtered.length
                ? <CheckSquare className="w-4 h-4" />
                : <Square className="w-4 h-4" />}
              {selectedIds.size === filtered.length ? 'בטל הכל' : 'בחר הכל'}
            </button>
            <span className="text-xs text-gray-500">{selectedIds.size} נבחרו מתוך {filtered.length}</span>
          </div>
        )}
      </div>

      {/* ── Documents grouped by type ─────────────────────────────────────── */}
      <div ref={newDocsRef} />
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
                      onClick={(e) => selectMode ? toggleSelect(doc.id, e) : (doc.file_url && setViewerUrl(doc.file_url))}
                      className={`bg-white rounded-2xl p-3 shadow-sm active:scale-[0.97] transition-transform relative ${
                        doc.file_url || selectMode ? 'cursor-pointer' : ''
                      } ${selectedIds.has(doc.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                      {selectMode && (
                        <div className="absolute top-2 right-2">
                          {selectedIds.has(doc.id)
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-gray-300" />}
                        </div>
                      )}
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
                        {!selectMode && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                            className="text-gray-300 hover:text-red-400 active:scale-95">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Cards view */}
              {viewMode === 'cards' && docs.map(doc => (
                <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={(e) => selectMode ? toggleSelect(doc.id, e) : (doc.file_url && setViewerUrl(doc.file_url))}
                  className={`bg-gradient-to-bl from-white to-gray-50 rounded-2xl p-5 shadow-sm border active:scale-[0.98] transition-transform relative ${
                    doc.file_url || selectMode ? 'cursor-pointer' : ''
                  } ${selectedIds.has(doc.id) ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-gray-100'}`}>
                  {selectMode && (
                    <div className="absolute top-3 left-3">
                      {selectedIds.has(doc.id)
                        ? <CheckSquare className="w-5 h-5 text-primary" />
                        : <Square className="w-5 h-5 text-gray-300" />}
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <p className="text-sm font-bold">{doc.name}</p>
                        <p className="text-xs text-gray-400">{getTravelerName(travelers, doc.traveler_id)}</p>
                      </div>
                    </div>
                    {!selectMode && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                        className="p-2 text-gray-300 hover:text-red-400 active:scale-95">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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

              {/* List view */}
              {viewMode === 'list' && docs.map(doc => (
                <motion.div key={doc.id}
                  initial={{ opacity: 0, y: newDocIds.has(doc.id) ? -8 : 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={(e) => selectMode ? toggleSelect(doc.id, e) : (doc.file_url && setViewerUrl(doc.file_url))}
                  className={`rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all relative ${
                    doc.file_url || selectMode ? 'cursor-pointer' : ''
                  } ${
                    selectedIds.has(doc.id)
                      ? 'bg-primary/5 border-2 border-primary ring-2 ring-primary/10'
                      : newDocIds.has(doc.id)
                        ? 'bg-emerald-50 border-2 border-emerald-300 ring-2 ring-emerald-100'
                        : 'bg-white'
                  }`}>
                  <div className="flex items-start gap-3">
                    {/* Checkbox / icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                      selectedIds.has(doc.id) ? 'bg-primary/10' : newDocIds.has(doc.id) ? 'bg-emerald-100' : 'bg-gray-50'
                    }`}>
                      {selectMode
                        ? (selectedIds.has(doc.id)
                            ? <CheckSquare className="w-5 h-5 text-primary" />
                            : <Square className="w-5 h-5 text-gray-300" />)
                        : meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate">{doc.name}</p>
                        {newDocIds.has(doc.id) && (
                          <span className="flex-shrink-0 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">חדש</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{getTravelerName(travelers, doc.traveler_id)}</p>
                      {doc.booking_ref && (
                        <p className="text-xs text-primary mt-1">
                          {doc.doc_type === 'passport' ? 'מספר דרכון' : 'הזמנה'}: {doc.booking_ref}
                        </p>
                      )}
                      {doc.flight_number && (
                        <p className="text-xs text-blue-500 mt-0.5">טיסה: {doc.flight_number}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                        {doc.valid_from && <span>מ-{formatDateShort(doc.valid_from)}</span>}
                        {doc.valid_until && <span>עד {formatDateShort(doc.valid_until)}</span>}
                      </div>
                      {doc.file_type === 'gmail' && (
                        <p className="text-[10px] text-orange-500 mt-1.5 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {doc.file_url ? 'Gmail — לחץ לצפייה במייל' : 'ייובא מ-Gmail'}
                        </p>
                      )}
                      {doc.file_url && doc.file_type !== 'gmail' && (
                        <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> לחץ לצפייה במסמך
                        </p>
                      )}
                    </div>
                    {!selectMode && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                        className="p-2 text-gray-300 hover:text-red-400 active:scale-95 transition-all flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        })
      )}

      {/* ── Bulk action bar (floating, shown when docs are selected) ───────── */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: 100, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 z-50 bg-gray-900 text-white rounded-2xl p-3 flex items-center gap-2 shadow-2xl">
            <span className="flex-1 text-sm font-semibold">{selectedIds.size} נבחרו</span>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2 text-sm font-medium active:scale-95 transition-all">
              <Download className="w-4 h-4" /> ייצוא
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 rounded-xl px-3 py-2 text-sm font-medium active:scale-95 transition-all disabled:opacity-50">
              {bulkDeleting
                ? <span className="animate-spin">⏳</span>
                : <Trash2 className="w-4 h-4" />}
              מחק
            </button>
            <button
              onClick={() => { setSelectedIds(new Set()); setSelectMode(false) }}
              className="p-2 text-white/60 hover:text-white active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <DocumentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  )
}
