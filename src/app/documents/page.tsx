'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, ExternalLink, Filter, List, LayoutGrid, CreditCard, RefreshCw, Mail, Settings, ChevronRight, CheckSquare, Square, Download, X, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDateShort } from '@/lib/utils'
import { Document, DocType, DOC_TYPE_META, TravelerId } from '@/types'
import { DocTypeIconBadge } from '@/lib/iconConfig'
import DocumentViewer from '@/components/DocumentViewer'
import { loadTravelers, getTravelerName, type Traveler } from '@/lib/travelers'
import { useTrip } from '@/contexts/TripContext'
import { useLanguage } from '@/contexts/LanguageContext'

const DOC_TYPES: DocType[] = ['passport', 'flight', 'hotel', 'ferry', 'activity', 'insurance', 'visa', 'other']

// ── Document grouping by booking_ref ───────────────────────────────────────
interface DocGroup {
  key: string       // unique key for the group (primary doc's id)
  docs: Document[]  // sorted: primary doc first, then related docs
}

const TYPE_PRIORITY: Partial<Record<DocType, number>> = {
  hotel: 0, flight: 1, ferry: 2, activity: 3, insurance: 4, visa: 5, passport: 6, other: 7,
}

function buildDocGroups(docs: Document[]): DocGroup[] {
  const byRef = new Map<string, Document[]>()
  const noRef: Document[] = []

  for (const doc of docs) {
    const ref = doc.booking_ref?.trim().toLowerCase()
    if (ref) {
      if (!byRef.has(ref)) byRef.set(ref, [])
      byRef.get(ref)!.push(doc)
    } else {
      noRef.push(doc)
    }
  }

  const result: DocGroup[] = []
  byRef.forEach((groupDocs) => {
    const sorted = [...groupDocs].sort(
      (a, b) => (TYPE_PRIORITY[a.doc_type] ?? 7) - (TYPE_PRIORITY[b.doc_type] ?? 7)
    )
    result.push({ key: sorted[0].id, docs: sorted })
  })
  for (const doc of noRef) {
    result.push({ key: doc.id, docs: [doc] })
  }
  // Sort groups by primary doc date (newest first)
  result.sort((a, b) =>
    new Date(b.docs[0].created_at).getTime() - new Date(a.docs[0].created_at).getTime()
  )
  return result
}

function getSubDocLabel(doc: Document): string {
  const ext = doc.extracted_data as Record<string, unknown> | null
  const subtype = (ext?.document_subtype as string | undefined)?.toLowerCase()
  if (subtype === 'invoice') return 'חשבונית'
  if (subtype === 'receipt') return 'קבלה'
  if (subtype === 'confirmation') return 'אישור הזמנה'
  if (doc.doc_type === 'hotel') return 'אישור הזמנה'
  if (doc.doc_type === 'flight') return 'כרטיס טיסה'
  return DOC_TYPE_META[doc.doc_type]?.label || 'מסמך'
}

// ── Type-level folder grouping ───────────────────────────────────────────────
// When too many docs of the same type accumulate, collapse them into a typed folder.
const TYPE_FOLDER_THRESHOLD: Partial<Record<DocType, number>> = {
  passport: 2,   // 2+ passports → Passports folder
  hotel:    3,   // 3+ hotel bookings → Hotels folder
  flight:   3,   // 3+ flights → Flights folder
}

const TYPE_FOLDER_STYLE: Partial<Record<DocType, {
  label: string; bg: string; border: string; strip: string; iconBg: string; text: string
}>> = {
  flight:   { label: 'טיסות',   bg: 'bg-sky-50',    border: 'border-sky-200',    strip: 'bg-sky-100/60',    iconBg: 'bg-sky-100',    text: 'text-sky-800'    },
  hotel:    { label: 'מלונות',  bg: 'bg-teal-50',   border: 'border-teal-200',   strip: 'bg-teal-100/60',   iconBg: 'bg-teal-100',   text: 'text-teal-800'   },
  passport: { label: 'דרכונים', bg: 'bg-violet-50', border: 'border-violet-200', strip: 'bg-violet-100/60', iconBg: 'bg-violet-100', text: 'text-violet-800' },
}

interface TypeFolderItem {
  kind:   'type_folder'
  type:   DocType
  groups: DocGroup[]
}
type DisplayItem = TypeFolderItem | { kind: 'doc_group'; group: DocGroup }

function buildDisplayItems(docs: Document[]): DisplayItem[] {
  const allGroups = buildDocGroups(docs)

  // Separate groups by whether their type has a threshold
  const typeGroupMap = new Map<DocType, DocGroup[]>()
  const otherGroups: DocGroup[] = []

  for (const group of allGroups) {
    const type = group.docs[0].doc_type
    if (TYPE_FOLDER_THRESHOLD[type] !== undefined) {
      if (!typeGroupMap.has(type)) typeGroupMap.set(type, [])
      typeGroupMap.get(type)!.push(group)
    } else {
      otherGroups.push(group)
    }
  }

  const result: DisplayItem[] = []

  // Create type folders for over-threshold types; spill rest to otherGroups
  typeGroupMap.forEach((groups, type) => {
    if (groups.length >= TYPE_FOLDER_THRESHOLD[type]!) {
      result.push({ kind: 'type_folder', type, groups })
    } else {
      for (const g of groups) otherGroups.push(g)
    }
  })

  for (const g of otherGroups) result.push({ kind: 'doc_group', group: g })

  // Sort by most recent doc date
  result.sort((a, b) => {
    const aMs = a.kind === 'type_folder'
      ? Math.max(...a.groups.map(g => new Date(g.docs[0].created_at).getTime()))
      : new Date(a.group.docs[0].created_at).getTime()
    const bMs = b.kind === 'type_folder'
      ? Math.max(...b.groups.map(g => new Date(g.docs[0].created_at).getTime()))
      : new Date(b.group.docs[0].created_at).getTime()
    return bMs - aMs
  })

  return result
}

export default function DocumentsPage() {
  const { currentTrip } = useTrip()
  const { t, dir } = useLanguage()
  const [travelers, setTravelers] = useState<Traveler[]>([])

  useEffect(() => {
    loadTravelers().then(setTravelers)
  }, [])

  const [documents,         setDocuments]        = useState<Document[]>([])
  const [loading,           setLoading]          = useState(true)
  const [reprocessingAll,   setReprocessingAll]  = useState(false)
  const [reprocessProgress, setReprocessProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Multi-select state ──────────────────────────────────────────────────
  const [selectMode,      setSelectMode]      = useState(false)
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [bulkDeleting,    setBulkDeleting]    = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // ── Folder expand state (booking_ref groups) ─────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const toggleGroupExpand = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  // ── Type folder expand state (passports / hotels / flights) ──────────────
  const [expandedTypeFolders, setExpandedTypeFolders] = useState<Set<DocType>>(new Set())
  const toggleTypeFolder = useCallback((type: DocType) => {
    setExpandedTypeFolders(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }, [])

  // ── Gmail sync state ────────────────────────────────────────────────────
  const [gmailConnections, setGmailConnections] = useState<{ id: string; gmail_address: string; watch_active: boolean; watch_expiry: string | null }[] | null>(null)
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
    connectionError?:   string
  } | null>(null)
  const [gmailError,  setGmailError]  = useState<string | null>(null)
  const [newDocIds,   setNewDocIds]   = useState<Set<string>>(new Set())

  // ── Pending review (borderline emails waiting for user confirmation) ───
  interface PendingReviewItem {
    ingestId:       string
    gmailMessageId: string
    subject:        string
    from:           string
    date:           string
    summary:        string
    bookingType:    string
    vendor:         string
    confidence:     number
  }
  const [pendingReview,    setPendingReview]    = useState<PendingReviewItem[]>([])
  const [confirmingId,     setConfirmingId]     = useState<string | null>(null)
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
        .select('id, gmail_address, watch_active, watch_expiry')
        .eq('user_id', user.id)
        .order('gmail_address')
      setGmailConnections((data || []).map(r => ({
        id:           r.id,
        gmail_address: r.gmail_address,
        watch_active: r.watch_active ?? false,
        watch_expiry: r.watch_expiry ?? null,
      })))
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

      const createdDocs  = (json.createdDocs   as Array<{ id: string; name: string; doc_type: string }>) || []
      const pendingItems = (json.pendingReview as PendingReviewItem[]) || []
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
      if (pendingItems.length > 0) setPendingReview(pendingItems)

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

  // ── Confirm / dismiss a pending-review email ─────────────────────────────
  const handleConfirmEmail = useCallback(async (item: PendingReviewItem, action: 'add' | 'skip') => {
    setConfirmingId(item.ingestId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { toast.error('לא מחובר'); return }

      const res = await fetch('/api/gmail/confirm-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ingest_id: item.ingestId, action }),
      })
      const json = await res.json()

      if (!res.ok) { toast.error(json.error || 'שגיאה'); return }

      // Remove from pending list
      setPendingReview(prev => prev.filter(p => p.ingestId !== item.ingestId))

      if (action === 'add' && json.doc) {
        toast.success(`נוסף: ${json.doc.name}`, { icon: '📄', duration: 4000 })
        // Refresh documents list
        await fetchDocuments()
      } else if (action === 'skip') {
        toast('דולג', { icon: '⏭️', duration: 2000 })
      }
    } catch {
      toast.error('שגיאת רשת')
    } finally {
      setConfirmingId(null)
    }
  }, [fetchDocuments])

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
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id)
      setTimeout(() => setPendingDeleteId(prev => prev === id ? null : prev), 3000)
      return
    }
    setPendingDeleteId(null)
    const ok = await deleteDocumentsByIds([id])
    if (ok) {
      toast.success('המסמך נמחק')
      setDocuments(prev => prev.filter(d => d.id !== id))
    }
  }

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selectedIds.size) return
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

  // ── Export selected ───────────────────────────────────────────────────────
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
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleGroupSelect = (group: DocGroup) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSel = group.docs.every(d => next.has(d.id))
      if (allSel) group.docs.forEach(d => next.delete(d.id))
      else group.docs.forEach(d => next.add(d.id))
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

  const displayItems = buildDisplayItems(filtered)

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
          {/* ── Header row ──────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Mail className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">Gmail מחובר ✅</p>
                {/* Auto-sync status badge */}
                {gmailConnections.some(c => c.watch_active) ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    סנכרון אוטומטי פעיל
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
                    ⏱ סריקה יומית
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {gmailConnections.map(c => (
                  <span key={c.id} className="text-[10px] bg-white/80 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100 truncate max-w-[180px]" dir="ltr">
                    {c.gmail_address}
                    {c.watch_active && <span className="mr-1 text-emerald-400">●</span>}
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
              {/* ── Connection error — token expired / revoked ── */}
              {gmailResult.connectionError ? (
                <div className="space-y-2">
                  <p className="text-red-600 font-semibold">
                    🔌 {gmailResult.connectionError}
                  </p>
                  <Link
                    href="/settings"
                    className="flex items-center justify-center gap-1.5 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
                  >
                    <Mail className="w-3 h-3" />
                    חבר מחדש Gmail
                  </Link>
                </div>
              ) : gmailResult.created > 0 ? (
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
                <div className="space-y-1">
                  <p className="text-amber-600 font-medium">
                    ⚠️ לא נמצאו מיילים תואמים לנסיעה זו
                  </p>
                  <p className="text-gray-400">
                    אפשרות 1: עדיין לא קיבלת אישורי הזמנה
                  </p>
                  <p className="text-gray-400">
                    אפשרות 2: האישורים נמצאים בתיבת דואר נוספת — חבר חשבון Gmail נוסף בהגדרות
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 font-medium">
                  סרקנו {gmailResult.scanned} מיילים — לא נמצאו מסמכים חדשים לנסיעה זו
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
                    <p className="text-gray-400">📅 {gmailResult.filteredWrongDate} הזמנות מחוץ לתאריכי הנסיעה</p>
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
          {/* ── Pending review section ──────────────────────────────── */}
          {pendingReview.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <span>📬</span>
                מיילים שאולי קשורים לנסיעה — מה לעשות עם הם?
              </p>
              <div className="space-y-2">
                {pendingReview.map(item => (
                  <div key={item.ingestId} className="bg-white rounded-lg p-2.5 border border-amber-100">
                    <p className="text-xs font-medium text-gray-800 truncate leading-tight">{item.subject}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate" dir="ltr">{item.from}</p>
                    {item.summary && (
                      <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{item.summary}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => handleConfirmEmail(item, 'add')}
                        disabled={confirmingId === item.ingestId}
                        className="flex-1 bg-emerald-500 text-white rounded-lg py-1.5 text-[11px] font-semibold active:scale-95 disabled:opacity-50 transition-all">
                        {confirmingId === item.ingestId ? '...' : '✅ הוסף'}
                      </button>
                      <button
                        onClick={() => handleConfirmEmail(item, 'skip')}
                        disabled={confirmingId === item.ingestId}
                        className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-1.5 text-[11px] font-semibold active:scale-95 disabled:opacity-50 transition-all">
                        {confirmingId === item.ingestId ? '...' : '❌ דלג'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setPendingReview([])}
                className="w-full text-[10px] text-gray-400 hover:text-gray-600 py-1 transition-colors">
                סגור הכל
              </button>
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
              : <><Mail className="w-4 h-4" /> משוך מסמכים מ-Gmail לנסיעה זו</>}
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
      <div className="space-y-4" dir={dir}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('doc_title')}</h1>
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

  // ── Render a single document card (list / cards / grid) ───────────────────
  const renderSingleDoc = (doc: Document, mode: 'list' | 'cards' | 'grid') => {
    const meta = DOC_TYPE_META[doc.doc_type]
    const isNew = newDocIds.has(doc.id)
    const isSel = selectedIds.has(doc.id)

    if (mode === 'grid') {
      return (
        <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={(e) => selectMode ? toggleSelect(doc.id, e) : (doc.file_url && setViewerUrl(doc.file_url))}
          className={`bg-white rounded-2xl p-3 shadow-sm active:scale-[0.97] transition-transform relative ${
            doc.file_url || selectMode ? 'cursor-pointer' : ''
          } ${isSel ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
          {selectMode && (
            <div className="absolute top-2 right-2">
              {isSel ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-gray-300" />}
            </div>
          )}
          <div className="mb-3"><DocTypeIconBadge type={doc.doc_type} size="md" /></div>
          <p className="text-xs font-bold truncate">{doc.name}</p>
          <p className="text-[10px] text-gray-400 truncate">{getTravelerName(travelers, doc.traveler_id)}</p>
          {doc.booking_ref && (
            <p className="text-[10px] text-primary mt-1 truncate">#{doc.booking_ref}</p>
          )}
          <div className="flex justify-between items-center mt-2">
            {doc.file_type === 'gmail' && <Mail className="w-3 h-3 text-orange-400" />}
            {doc.file_url && <ExternalLink className="w-3 h-3 text-primary" />}
            {!selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-medium active:scale-95 transition-all ${
                  pendingDeleteId === doc.id ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-red-400'
                }`}>
                <Trash2 className="w-3 h-3" />
                {pendingDeleteId === doc.id && <span>מחק?</span>}
              </button>
            )}
          </div>
        </motion.div>
      )
    }

    if (mode === 'cards') {
      return (
        <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={(e) => selectMode ? toggleSelect(doc.id, e) : (doc.file_url && setViewerUrl(doc.file_url))}
          className={`bg-gradient-to-bl from-white to-gray-50 rounded-2xl p-5 shadow-sm border active:scale-[0.98] transition-transform relative ${
            doc.file_url || selectMode ? 'cursor-pointer' : ''
          } ${isSel ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-gray-100'}`}>
          {selectMode && (
            <div className="absolute top-3 left-3">
              {isSel ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-gray-300" />}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DocTypeIconBadge type={doc.doc_type} size="md" />
              <div>
                <p className="text-sm font-bold">{doc.name}</p>
                <p className="text-xs text-gray-400">{getTravelerName(travelers, doc.traveler_id)}</p>
              </div>
            </div>
            {!selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium active:scale-95 transition-all ${
                  pendingDeleteId === doc.id ? 'bg-red-500 text-white' : 'p-2 text-gray-300 hover:text-red-400'
                }`}>
                <Trash2 className="w-4 h-4" />
                {pendingDeleteId === doc.id && <span>מחק?</span>}
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
              <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-0.5 rounded-full">{doc.flight_number}</span>
            )}
            {doc.valid_from && (
              <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{formatDateShort(doc.valid_from)}</span>
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
      )
    }

    // List view (default)
    return (
      <motion.div key={doc.id}
        initial={{ opacity: 0, y: isNew ? -8 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => selectMode ? toggleSelect(doc.id, e) : (doc.file_url && setViewerUrl(doc.file_url))}
        className={`rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all relative ${
          doc.file_url || selectMode ? 'cursor-pointer' : ''
        } ${
          isSel
            ? 'bg-primary/5 border-2 border-primary ring-2 ring-primary/10'
            : isNew
              ? 'bg-emerald-50 border-2 border-emerald-300 ring-2 ring-emerald-100'
              : 'bg-white'
        }`}>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center flex-shrink-0">
            {selectMode
              ? <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-secondary">{isSel ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-gray-300" />}</div>
              : <DocTypeIconBadge type={doc.doc_type} size="md" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold truncate">{doc.name}</p>
              {isNew && (
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
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium active:scale-95 transition-all flex-shrink-0 ${
                pendingDeleteId === doc.id ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-red-400'
              }`}>
              <Trash2 className="w-4 h-4" />
              {pendingDeleteId === doc.id && <span>מחק?</span>}
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // ── Render a folder card (group with multiple docs) ────────────────────────
  const renderFolderCard = (group: DocGroup) => {
    const primary = group.docs[0]
    const isExpanded = expandedGroups.has(group.key)
    const allSel = group.docs.every(d => selectedIds.has(d.id))
    const anySel = group.docs.some(d => selectedIds.has(d.id))
    const isNew = group.docs.some(d => newDocIds.has(d.id))
    const extraLabels = group.docs.slice(1).map(d => getSubDocLabel(d)).join(' · ')

    return (
      <motion.div
        key={group.key}
        initial={{ opacity: 0, y: isNew ? -8 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl overflow-hidden shadow-sm border transition-all ${
          allSel
            ? 'border-primary bg-primary/5'
            : anySel
              ? 'border-primary/40 bg-primary/3'
              : isNew
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-gray-100 bg-white'
        }`}>

        {/* ── Primary doc section ── */}
        <div
          className="p-4 cursor-pointer active:bg-gray-50 transition-colors"
          onClick={() => {
            if (selectMode) toggleGroupSelect(group)
            else if (primary.file_url) setViewerUrl(primary.file_url)
          }}
        >
          <div className="flex items-start gap-3">
            {/* Icon / checkbox */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              allSel ? 'bg-primary/10' : isNew ? 'bg-emerald-100' : 'bg-surface-secondary'
            }`}>
              {selectMode
                ? (allSel
                    ? <CheckSquare className="w-5 h-5 text-primary" />
                    : anySel
                      ? <CheckSquare className="w-5 h-5 text-primary/40" />
                      : <Square className="w-5 h-5 text-gray-300" />)
                : <DocTypeIconBadge type={primary.doc_type} size="md" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate">{primary.name}</p>
                <span className="flex-shrink-0 bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <FolderOpen className="w-2.5 h-2.5" /> {group.docs.length}
                </span>
                {isNew && (
                  <span className="flex-shrink-0 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">חדש</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{getTravelerName(travelers, primary.traveler_id)}</p>
              {primary.booking_ref && (
                <p className="text-xs text-primary mt-1">הזמנה: {primary.booking_ref}</p>
              )}
              <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                {primary.valid_from && <span>מ-{formatDateShort(primary.valid_from)}</span>}
                {primary.valid_until && <span>עד {formatDateShort(primary.valid_until)}</span>}
              </div>
              {primary.file_type === 'gmail' && (
                <p className="text-[10px] text-orange-500 mt-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Gmail
                </p>
              )}
            </div>

            {!selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(primary.id) }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium active:scale-95 transition-all flex-shrink-0 ${
                  pendingDeleteId === primary.id ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-red-400'
                }`}>
                <Trash2 className="w-4 h-4" />
                {pendingDeleteId === primary.id && <span>מחק?</span>}
              </button>
            )}
          </div>
        </div>

        {/* ── Expand toggle strip ── */}
        <button
          onClick={() => toggleGroupExpand(group.key)}
          className="w-full flex items-center justify-between px-4 py-2 bg-surface-secondary border-t border-gray-100 text-xs text-gray-500 font-medium active:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            {isExpanded ? 'הסתר מסמכים' : `${group.docs.length} מסמכים`}
            {!isExpanded && extraLabels && (
              <span className="text-gray-400 font-normal">— {extraLabels}</span>
            )}
          </span>
          {isExpanded
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* ── Sub-documents (expanded) ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {group.docs.map((doc) => {
                  const isDocSel = selectedIds.has(doc.id)
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        isDocSel ? 'bg-primary/5' : 'bg-white/70 hover:bg-white/90'
                      }`}
                    >
                      {/* Sub-doc checkbox in select mode */}
                      {selectMode && (
                        <button
                          onClick={() => setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (next.has(doc.id)) next.delete(doc.id); else next.add(doc.id)
                            return next
                          })}
                          className="flex-shrink-0">
                          {isDocSel
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-gray-300" />}
                        </button>
                      )}

                      {/* Icon */}
                      <DocTypeIconBadge type={doc.doc_type} size="sm" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{getSubDocLabel(doc)}</p>
                        <p className="text-[10px] text-gray-400 truncate">{doc.name}</p>
                        {doc.valid_from && (
                          <p className="text-[10px] text-gray-400">{formatDateShort(doc.valid_from)}{doc.valid_until ? ` → ${formatDateShort(doc.valid_until)}` : ''}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {doc.file_type === 'gmail' && <Mail className="w-3 h-3 text-orange-400" />}
                        {doc.file_url && (
                          <button
                            onClick={() => setViewerUrl(doc.file_url!)}
                            className="text-primary active:scale-95 p-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!selectMode && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium active:scale-95 transition-all ${
                              pendingDeleteId === doc.id ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-red-400'
                            }`}>
                            <Trash2 className="w-3 h-3" />
                            {pendingDeleteId === doc.id && <span>מחק?</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // ── Render a type-level folder (Passports / Hotels / Flights) ─────────────
  const renderTypeFolder = (item: TypeFolderItem) => {
    const meta = DOC_TYPE_META[item.type]
    const isExpanded = expandedTypeFolders.has(item.type)
    const totalDocs  = item.groups.reduce((sum, g) => sum + g.docs.length, 0)
    const hasNew     = item.groups.some(g => g.docs.some(d => newDocIds.has(d.id)))
    const allSel     = item.groups.every(g => g.docs.every(d => selectedIds.has(d.id)))
    const anySel     = item.groups.some(g => g.docs.some(d => selectedIds.has(d.id)))
    const preview    = item.groups.slice(0, 3).map(g => g.docs[0].name).join(' · ')

    return (
      <motion.div
        key={`type-${item.type}`}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl overflow-hidden border shadow-sm bg-white border-gray-100 ${
          hasNew ? 'ring-2 ring-emerald-200' : ''
        } ${allSel ? 'ring-2 ring-primary' : anySel ? 'ring-1 ring-primary/40' : ''}`}
      >
        {/* ── Type folder header ── */}
        <button
          onClick={() => selectMode
            ? item.groups.forEach(g => {
                setSelectedIds(prev => {
                  const next = new Set(prev)
                  const allGroupSel = g.docs.every(d => next.has(d.id))
                  if (allGroupSel) g.docs.forEach(d => next.delete(d.id))
                  else g.docs.forEach(d => next.add(d.id))
                  return next
                })
              })
            : toggleTypeFolder(item.type)}
          className="w-full flex items-center gap-3 p-4 text-right active:bg-black/5 transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-surface-secondary">
            {selectMode
              ? (allSel
                  ? <CheckSquare className="w-6 h-6 text-primary" />
                  : anySel
                    ? <CheckSquare className="w-6 h-6 text-primary/40" />
                    : <Square className="w-6 h-6 text-gray-400" />)
              : <DocTypeIconBadge type={item.type} size="lg" />}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-gray-800">{meta.label}</p>
              <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                {item.groups.length} הזמנות
              </span>
              {totalDocs !== item.groups.length && (
                <span className="text-gray-400 text-[10px]">{totalDocs} מסמכים</span>
              )}
              {hasNew && (
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">חדש</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{preview}{item.groups.length > 3 ? ` ועוד ${item.groups.length - 3}…` : ''}</p>
          </div>
          {!selectMode && (
            isExpanded
              ? <ChevronUp   className="w-5 h-5 text-gray-400 flex-shrink-0" />
              : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* ── Expanded content ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 p-3 space-y-2">
                {item.groups.map(group =>
                  group.docs.length === 1
                    ? renderSingleDoc(group.docs[0], 'list')
                    : renderFolderCard(group)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4 pb-32" dir={dir} onClick={() => pendingDeleteId && setPendingDeleteId(null)}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black gradient-text">{t('doc_title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{documents.length} מסמכים שמורים</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode */}
          <div className="flex bg-surface-secondary rounded-xl p-0.5">
            {([
              { mode: 'list'  as const, icon: List,       label: 'רשימה'   },
              { mode: 'cards' as const, icon: CreditCard, label: 'כרטיסים' },
              { mode: 'grid'  as const, icon: LayoutGrid,  label: 'רשת'     },
            ]).map(({ mode, icon: Icon }) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-lg transition-all ${viewMode === mode ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Multi-select toggle */}
          <button
            onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()) }}
            className={`p-2 rounded-xl text-sm font-medium active:scale-95 transition-all ${
              selectMode ? 'bg-primary text-white' : 'bg-surface-secondary text-gray-500'
            }`}
            title="בחירה מרובה">
            <CheckSquare className="w-4 h-4" />
          </button>

          {/* Reprocess all */}
          <button
            onClick={handleReprocessAll}
            disabled={reprocessingAll || documents.filter(d => d.file_url).length === 0}
            className="p-2 bg-surface-secondary rounded-xl text-gray-400 active:scale-95 transition-all disabled:opacity-40"
            title={reprocessingAll && reprocessProgress ? `${reprocessProgress.done}/${reprocessProgress.total}` : 'עיבוד מחדש של כל המסמכים'}>
            <RefreshCw className={`w-4 h-4 ${reprocessingAll ? 'animate-spin' : ''}`} />
          </button>

          <Link href="/scan"
            className="btn-cta px-4 py-2 text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> העלאה
          </Link>
        </div>
      </div>

      {/* ── Gmail Sync Card ───────────────────────────────────────────────── */}
      {gmailCard}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterType(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs font-medium active:scale-95 transition-all ${!filterType ? 'text-white' : 'bg-white shadow-sm text-gray-500'}`}
            style={!filterType ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}>
            הכל
          </button>
          {DOC_TYPES.map(dt => (
            <button key={dt} onClick={() => setFilterType(filterType === dt ? null : dt)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs font-medium active:scale-95 transition-all ${filterType === dt ? 'text-white' : 'bg-white shadow-sm text-gray-500'}`}
              style={filterType === dt ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}>
              {DOC_TYPE_META[dt].icon} {DOC_TYPE_META[dt].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[{ id: 'all', name: 'כולם' }, ...travelers].map(t => (
            <button key={t.id} onClick={() => setFilterTraveler(filterTraveler === t.id ? null : t.id as TravelerId)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs font-medium active:scale-95 transition-all ${filterTraveler === t.id ? 'text-white' : 'bg-white shadow-sm text-gray-500'}`}
              style={filterTraveler === t.id ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Select all row */}
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

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <div ref={newDocsRef} />
      {displayItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <FolderOpen className="w-8 h-8 text-white" />
          </div>
          <p className="font-bold text-gray-800 mb-1">{t('doc_no_docs')}</p>
          <p className="text-sm text-gray-400 mb-4">הוסף מסמכי הזמנה, דרכונים וכרטיסי טיסה</p>
          <Link href="/scan" className="inline-flex items-center gap-2 btn-cta px-6 py-3 text-sm">
            <Plus className="w-4 h-4" /> הוסף מסמך ראשון
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-2">
          {displayItems.map(item =>
            item.kind === 'type_folder' ? (
              <div key={`type-${item.type}`} className="col-span-2">
                {renderTypeFolder(item)}
              </div>
            ) : item.group.docs.length === 1
              ? renderSingleDoc(item.group.docs[0], 'grid')
              : (
                <div key={item.group.key} className="col-span-2">
                  {renderFolderCard(item.group)}
                </div>
              )
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map(item =>
            item.kind === 'type_folder'
              ? renderTypeFolder(item)
              : item.group.docs.length === 1
                ? renderSingleDoc(item.group.docs[0], viewMode)
                : renderFolderCard(item.group)
          )}
        </div>
      )}

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto z-50">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-3">
              <span className="text-sm font-bold text-gray-800 flex-1">{selectedIds.size} נבחרו</span>
              <button onClick={handleExport} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95">
                <Download className="w-4 h-4" /> ייצוא
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex items-center gap-1.5 bg-red-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95 disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> {bulkDeleting ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DocumentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  )
}
