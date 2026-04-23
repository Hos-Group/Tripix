'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, ExternalLink, Filter, List, LayoutGrid, CreditCard, RefreshCw, Mail, Settings, ChevronRight, CheckSquare, Square, Download, X, FolderOpen, ChevronDown, ChevronUp, Search, ArrowUpDown, Check, Clock, AlertTriangle, Plane, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDateShort } from '@/lib/utils'
import { Document, DocType, DOC_TYPE_META, TravelerId } from '@/types'
import { DocTypeIconBadge, DOC_TYPE_ICON } from '@/lib/iconConfig'
import DocumentViewer from '@/components/DocumentViewer'
import { loadTravelers, getTravelerName, type Traveler } from '@/lib/travelers'
import { useTrip } from '@/contexts/TripContext'
import { useLanguage } from '@/contexts/LanguageContext'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { tFormat } from '@/lib/i18n'

const DOC_TYPES: DocType[] = ['passport', 'flight', 'hotel', 'ferry', 'activity', 'insurance', 'visa', 'other']

// ── Expiry status ───────────────────────────────────────────────────────────
// Used by the UI to surface passports / visas / insurances about to expire,
// and flights / hotels about to depart.
type DocStatus =
  | { kind: 'expired';     daysLeft: number; label: string; tone: 'red' }
  | { kind: 'expiring';    daysLeft: number; label: string; tone: 'amber' }
  | { kind: 'upcoming';    daysLeft: number; label: string; tone: 'blue' }
  | { kind: 'active';      daysLeft: number; label: string; tone: 'green' }
  | null

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function getDocStatus(doc: Document): DocStatus {
  const now = new Date()
  const until = doc.valid_until ? new Date(doc.valid_until) : null
  const from  = doc.valid_from  ? new Date(doc.valid_from)  : null

  // Long-term validity (passport / visa / insurance) — flag expiry.
  if (['passport', 'visa', 'insurance'].includes(doc.doc_type) && until) {
    const d = daysBetween(until, now)
    if (d < 0)   return { kind: 'expired',  daysLeft: d, label: `פג תוקף לפני ${Math.abs(d)} ימים`, tone: 'red' }
    if (d <= 90) return { kind: 'expiring', daysLeft: d, label: `פג תוקף בעוד ${d} ימים`,           tone: 'amber' }
    return null
  }

  // Bookings (flight / hotel / ferry / activity) — flag upcoming / active.
  if (['flight', 'hotel', 'ferry', 'activity'].includes(doc.doc_type) && from) {
    const d = daysBetween(from, now)
    if (d > 0 && d <= 30)   return { kind: 'upcoming', daysLeft: d, label: `בעוד ${d} ימים`,    tone: 'blue' }
    if (d >= -7 && d <= 0 && until && until.getTime() >= now.getTime())
      return { kind: 'active',   daysLeft: 0, label: 'מתקיים עכשיו',         tone: 'green' }
  }
  return null
}

const STATUS_CLASSES: Record<NonNullable<DocStatus>['tone'], { bg: string; text: string; Icon: typeof Clock }> = {
  red:   { bg: 'bg-red-50 border-red-200',       text: 'text-red-700',   Icon: AlertTriangle },
  amber: { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700', Icon: Clock },
  blue:  { bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',  Icon: Plane },
  green: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', Icon: ShieldCheck },
}

function StatusBadge({ status }: { status: NonNullable<DocStatus> }) {
  const cls = STATUS_CLASSES[status.tone]
  const Icon = cls.Icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls.bg} ${cls.text}`}>
      <Icon className="w-3 h-3" />
      {status.label}
    </span>
  )
}

// ── Document grouping by booking_ref ───────────────────────────────────────
interface DocGroup {
  key: string       // unique key for the group (primary doc's id)
  docs: Document[]  // sorted: primary doc first, then related docs
}

const TYPE_PRIORITY: Partial<Record<DocType, number>> = {
  hotel: 0, flight: 1, ferry: 2, activity: 3, insurance: 4, visa: 5, passport: 6, other: 7,
}

function buildDocGroups(docs: Document[], preserveOrder = false): DocGroup[] {
  // Use Map insertion order so caller-provided sort is retained when asked.
  const byRef = new Map<string, Document[]>()
  const noRef: Document[] = []
  const refOrder: string[] = []

  for (const doc of docs) {
    const ref = doc.booking_ref?.trim().toLowerCase()
    if (ref) {
      if (!byRef.has(ref)) { byRef.set(ref, []); refOrder.push(ref) }
      byRef.get(ref)!.push(doc)
    } else {
      noRef.push(doc)
    }
  }

  const result: DocGroup[] = []
  for (const ref of refOrder) {
    const groupDocs = byRef.get(ref)!
    const sorted = [...groupDocs].sort(
      (a, b) => (TYPE_PRIORITY[a.doc_type] ?? 7) - (TYPE_PRIORITY[b.doc_type] ?? 7)
    )
    result.push({ key: sorted[0].id, docs: sorted })
  }
  for (const doc of noRef) {
    result.push({ key: doc.id, docs: [doc] })
  }

  if (!preserveOrder) {
    // Default: newest primary doc first
    result.sort((a, b) =>
      new Date(b.docs[0].created_at).getTime() - new Date(a.docs[0].created_at).getTime()
    )
  }
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
// When multiple docs of the same type accumulate, collapse them into a typed
// folder. Inside the folder they're further grouped by entity (hotel name,
// flight route, passport owner…) — see buildEntityGroups below.
const TYPE_FOLDER_THRESHOLD: Partial<Record<DocType, number>> = {
  passport:  2,   // 2+ passports  → Passports folder
  hotel:     2,   // 2+ hotels     → Hotels folder
  flight:    2,   // 2+ flights    → Flights folder
  ferry:     2,
  activity:  3,
  insurance: 2,
  visa:      2,
}

// ── Entity (sub-category) extraction ─────────────────────────────────────────
// Returns the "natural" entity a document belongs to: the hotel name for a
// hotel booking, the flight route for a flight, etc. Used to group multiple
// bookings/documents of the same real-world thing into one sub-folder.
function getEntityLabel(doc: Document): string {
  const ext = doc.extracted_data as Record<string, unknown> | null

  if (doc.doc_type === 'hotel') {
    const hotelName = ext?.hotel_name as string | undefined
    if (hotelName && hotelName.trim()) return hotelName.trim()
    return (doc.name || '').trim() || 'מלון'
  }

  if (doc.doc_type === 'flight') {
    const legs = ext?.legs as Array<{ departureCity?: string; arrivalCity?: string }> | undefined
    if (legs?.length) {
      const first = legs[0]
      const last  = legs[legs.length - 1]
      if (first?.departureCity && last?.arrivalCity) {
        return `${first.departureCity} → ${last.arrivalCity}`
      }
    }
    // Fallback: parse the doc name (format "DEP → ARR – PassengerName")
    const m = (doc.name || '').match(/^([^–]+?)\s*(?:→|->)\s*([^–]+?)(?:\s*–|$)/)
    if (m) return `${m[1].trim()} → ${m[2].trim()}`
    return (doc.name || '').trim() || 'טיסה'
  }

  if (doc.doc_type === 'passport') {
    const first = (ext?.first_name as string | undefined) || ''
    const last  = (ext?.last_name  as string | undefined) || ''
    const full  = (ext?.full_name  as string | undefined) || `${first} ${last}`.trim()
    if (full && full.trim()) return full.trim()
    return (doc.name || '').replace(/^דרכון\s+/, '').trim() || 'דרכון'
  }

  if (doc.doc_type === 'ferry') {
    const vendor = (ext?.vendor as string | undefined) || (ext?.company as string | undefined)
    if (vendor && vendor.trim()) return vendor.trim()
    return (doc.name || '').trim() || 'מעבורת'
  }

  // Insurance / visa / activity / other — fall back to doc.name (trimmed).
  return (doc.name || '').trim() || DOC_TYPE_META[doc.doc_type]?.label || 'מסמך'
}

function getEntityKey(doc: Document): string {
  return getEntityLabel(doc).toLowerCase().replace(/\s+/g, ' ').trim()
}

interface EntityGroup {
  key:    string       // stable key (normalized)
  label:  string       // display label (e.g. "Ritz Carlton")
  groups: DocGroup[]   // one or more bookings for this entity
}

function buildEntityGroups(groups: DocGroup[]): EntityGroup[] {
  const byEntity = new Map<string, EntityGroup>()
  const order:    string[] = []
  for (const g of groups) {
    const primary = g.docs[0]
    const key     = getEntityKey(primary)
    if (!byEntity.has(key)) {
      byEntity.set(key, { key, label: getEntityLabel(primary), groups: [] })
      order.push(key)
    }
    byEntity.get(key)!.groups.push(g)
  }
  return order.map(k => byEntity.get(k)!)
}

const TYPE_FOLDER_STYLE: Partial<Record<DocType, {
  label: string; bg: string; border: string; strip: string; iconBg: string; text: string
}>> = {
  flight:   { label: 'טיסות',   bg: 'bg-sky-50',    border: 'border-sky-200',    strip: 'bg-sky-100/60',    iconBg: 'bg-sky-100',    text: 'text-sky-800'    },
  hotel:    { label: 'מלונות',  bg: 'bg-teal-50',   border: 'border-teal-200',   strip: 'bg-teal-100/60',   iconBg: 'bg-teal-100',   text: 'text-teal-800'   },
  passport: { label: 'דרכונים', bg: 'bg-violet-50', border: 'border-violet-200', strip: 'bg-violet-100/60', iconBg: 'bg-violet-100', text: 'text-violet-800' },
}

interface TypeFolderItem {
  kind:     'type_folder'
  type:     DocType
  entities: EntityGroup[]   // NEW — sub-category layer
}
type DisplayItem = TypeFolderItem | { kind: 'doc_group'; group: DocGroup }

function buildDisplayItems(docs: Document[], preserveOrder = false): DisplayItem[] {
  const allGroups = buildDocGroups(docs, preserveOrder)

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
      const entities = buildEntityGroups(groups)
      result.push({ kind: 'type_folder', type, entities })
    } else {
      for (const g of groups) otherGroups.push(g)
    }
  })

  for (const g of otherGroups) result.push({ kind: 'doc_group', group: g })

  if (!preserveOrder) {
    // Default: sort by most recent doc date
    result.sort((a, b) => {
      const aMs = a.kind === 'type_folder'
        ? Math.max(...a.entities.flatMap(en => en.groups.map(g => new Date(g.docs[0].created_at).getTime())))
        : new Date(a.group.docs[0].created_at).getTime()
      const bMs = b.kind === 'type_folder'
        ? Math.max(...b.entities.flatMap(en => en.groups.map(g => new Date(g.docs[0].created_at).getTime())))
        : new Date(b.group.docs[0].created_at).getTime()
      return bMs - aMs
    })
  }

  return result
}

export default function DocumentsPage() {
  const { currentTrip } = useTrip()
  const { t, dir, lang } = useLanguage()
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
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [deletingDoc,     setDeletingDoc]     = useState<Document | null>(null)
  const [deletingSingle,  setDeletingSingle]  = useState(false)

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

  // ── Entity sub-folder expand state (hotel name, flight route, etc.) ─────
  // Key format: `${type}|${entityKey}` so the same label across types doesn't collide.
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set())
  const toggleEntity = useCallback((type: DocType, entityKey: string) => {
    setExpandedEntities(prev => {
      const k = `${type}|${entityKey}`
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
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

  // ── Search + sort (international-polish additions) ────────────────────────
  type SortKey = 'recent' | 'name' | 'date' | 'type' | 'expiring'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey,     setSortKey]     = useState<SortKey>('recent')
  const [showSortMenu,setShowSortMenu]= useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── In-app email viewer ────────────────────────────────────────────────────
  // Live-fetches Gmail/Outlook messages via /api/gmail/fetch-message and
  // renders them inside DocumentViewer — users never leave the app.
  const [emailHtml,     setEmailHtml]     = useState<string | null>(null)
  const [emailMeta,     setEmailMeta]     = useState<{ subject?: string; from?: string } | null>(null)
  const [emailLoading,  setEmailLoading]  = useState(false)
  const openEmailInApp = useCallback(async (messageId: string | null | undefined) => {
    if (!messageId) return
    setEmailHtml('')         // opens viewer immediately with loading state
    setEmailMeta(null)
    setEmailLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { toast.error('לא מחובר'); setEmailLoading(false); setEmailHtml(null); return }
      const res = await fetch('/api/gmail/fetch-message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ gmail_message_id: messageId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'לא הצלחנו למשוך את המייל')
        setEmailHtml(null)
      } else {
        setEmailHtml(json.html || '<p style="padding:20px;color:#888">המייל ריק</p>')
        setEmailMeta({ subject: json.subject, from: json.from })
      }
    } catch {
      toast.error('שגיאת רשת')
      setEmailHtml(null)
    } finally {
      setEmailLoading(false)
    }
  }, [])
  const closeEmailViewer = useCallback(() => {
    setEmailHtml(null)
    setEmailMeta(null)
    setEmailLoading(false)
  }, [])

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  // Cmd/Ctrl+K or /  → focus search
  // Esc              → clear search / exit select mode / close sort menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const editable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute?.('contenteditable') === 'true'

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (e.key === '/' && !editable) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if (e.key === 'Escape') {
        if (showSortMenu) { setShowSortMenu(false); return }
        if (searchQuery)  { setSearchQuery('');    return }
        if (selectMode)   { setSelectMode(false); setSelectedIds(new Set()); return }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSortMenu, searchQuery, selectMode])

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

  // ── Single delete (now uses ConfirmDialog) ──────────────────────────────
  const handleDelete = (id: string) => {
    const doc = documents.find(d => d.id === id)
    if (!doc) return
    setDeletingDoc(doc)
  }

  const handleConfirmSingleDelete = async () => {
    if (!deletingDoc) return
    setDeletingSingle(true)
    const id = deletingDoc.id
    const ok = await deleteDocumentsByIds([id])
    setDeletingSingle(false)
    if (ok) {
      toast.success(t('doc_deleted'))
      setDocuments(prev => prev.filter(d => d.id !== id))
    }
    setDeletingDoc(null)
  }

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const requestBulkDelete = () => {
    if (!selectedIds.size) return
    setShowBulkConfirm(true)
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.size) { setShowBulkConfirm(false); return }
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const ok = await deleteDocumentsByIds(ids)
    if (ok) {
      toast.success(tFormat('doc_bulk_deleted', lang, { count: ids.length }))
      setDocuments(prev => prev.filter(d => !ids.includes(d.id)))
      setSelectedIds(new Set())
      setSelectMode(false)
    }
    setBulkDeleting(false)
    setShowBulkConfirm(false)
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

  // ── Filter + search + sort pipeline ────────────────────────────────────
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filtered = documents.filter(d => {
    if (filterType     && d.doc_type    !== filterType)     return false
    if (filterTraveler && d.traveler_id !== filterTraveler) return false
    if (normalizedQuery) {
      const hay = [
        d.name,
        d.booking_ref,
        d.flight_number,
        (d.extracted_data as Record<string, unknown> | null)?.passenger_name as string | undefined,
        (d.extracted_data as Record<string, unknown> | null)?.hotel_name     as string | undefined,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(normalizedQuery)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'name':     return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
      case 'type':     return (a.doc_type || '').localeCompare(b.doc_type || '')
      case 'date': {
        const aDate = a.valid_from || a.created_at
        const bDate = b.valid_from || b.created_at
        return new Date(aDate).getTime() - new Date(bDate).getTime()
      }
      case 'expiring': {
        // Docs with valid_until come first, soonest-expiring at top.
        // Docs without valid_until fall to the bottom.
        const aT = a.valid_until ? new Date(a.valid_until).getTime() : Infinity
        const bT = b.valid_until ? new Date(b.valid_until).getTime() : Infinity
        return aT - bT
      }
      case 'recent':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  // Preserve the user's chosen sort order only when they actually picked one.
  // Default ('recent') keeps the old group-by-primary-doc-date behavior.
  const displayItems = buildDisplayItems(sorted, sortKey !== 'recent')

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
            aria-label={t('doc_upload_new')}
            className="bg-primary text-white rounded-xl px-4 py-2.5 min-h-[44px] text-sm font-medium active:scale-95 transition-transform flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <Plus className="w-4 h-4" aria-hidden="true" /> {t('doc_upload_short')}
          </Link>
        </div>
        <span className="sr-only" role="status" aria-live="polite">{t('doc_loading')}</span>
        {gmailCard}
        <ListSkeleton rows={6} />
      </div>
    )
  }

  // ── Render a single document card (list / cards / grid) ───────────────────
  const renderSingleDoc = (doc: Document, mode: 'list' | 'cards' | 'grid') => {
    const meta = DOC_TYPE_META[doc.doc_type]
    const isNew = newDocIds.has(doc.id)
    const isSel = selectedIds.has(doc.id)

    if (mode === 'grid') {
      const clickable = selectMode || doc.file_url || doc.gmail_message_id
      return (
        <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={(e) => {
            if (selectMode) return toggleSelect(doc.id, e)
            if (doc.file_url) return setViewerUrl(doc.file_url)
            if (doc.gmail_message_id) return openEmailInApp(doc.gmail_message_id)
          }}
          className={`bg-white rounded-2xl p-3 shadow-sm active:scale-[0.97] transition-transform relative ${
            clickable ? 'cursor-pointer' : ''
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
          <div className="flex justify-between items-center mt-2 gap-1">
            <div className="flex items-center gap-1">
              {doc.file_url && <ExternalLink className="w-3 h-3 text-primary" />}
              {doc.gmail_message_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); openEmailInApp(doc.gmail_message_id) }}
                  title="פתח מייל מקורי"
                  className="p-0.5 rounded hover:bg-orange-50 active:scale-90 transition-all">
                  <Mail className="w-3 h-3 text-orange-400" />
                </button>
              )}
            </div>
            {!selectMode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                aria-label={`${t('doc_delete_action')} ${doc.name}`}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 active:text-red-500 active:bg-red-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-red-400">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      )
    }

    if (mode === 'cards') {
      const clickable = selectMode || doc.file_url || doc.gmail_message_id
      return (
        <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={(e) => {
            if (selectMode) return toggleSelect(doc.id, e)
            if (doc.file_url) return setViewerUrl(doc.file_url)
            if (doc.gmail_message_id) return openEmailInApp(doc.gmail_message_id)
          }}
          className={`bg-gradient-to-bl from-white to-gray-50 rounded-2xl p-5 shadow-sm border active:scale-[0.98] transition-transform relative ${
            clickable ? 'cursor-pointer' : ''
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
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                aria-label={`${t('doc_delete_action')} ${doc.name}`}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:text-red-500 active:bg-red-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-red-400">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
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
            {doc.file_url && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewerUrl(doc.file_url!) }}
                className="bg-primary/5 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 active:scale-95 transition-transform hover:bg-primary/10">
                <ExternalLink className="w-2.5 h-2.5" /> צפה במסמך
              </button>
            )}
            {doc.gmail_message_id && (
              <button
                onClick={(e) => { e.stopPropagation(); openEmailInApp(doc.gmail_message_id) }}
                className="bg-orange-50 text-orange-600 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 active:scale-95 transition-transform hover:bg-orange-100">
                <Mail className="w-2.5 h-2.5" /> פתח מייל
              </button>
            )}
          </div>
        </motion.div>
      )
    }

    // List view (default)
    const clickable = selectMode || doc.file_url || doc.gmail_message_id
    const typeGradient = DOC_TYPE_ICON[doc.doc_type]?.gradient || DOC_TYPE_ICON.other.gradient
    return (
      <motion.div key={doc.id}
        initial={{ opacity: 0, y: isNew ? -8 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        whileHover={clickable ? { y: -1 } : undefined}
        onClick={(e) => {
          if (selectMode) return toggleSelect(doc.id, e)
          if (doc.file_url) return setViewerUrl(doc.file_url)
          if (doc.gmail_message_id) return openEmailInApp(doc.gmail_message_id)
        }}
        className={`group rounded-2xl p-4 transition-all relative overflow-hidden border ${
          clickable ? 'cursor-pointer active:scale-[0.985]' : ''
        } ${
          isSel
            ? 'bg-primary/5 border-primary/50 shadow-[0_4px_16px_rgba(108,71,255,0.12)] ring-2 ring-primary/20'
            : isNew
              ? 'bg-emerald-50 border-emerald-200 shadow-[0_4px_16px_rgba(16,185,129,0.12)]'
              : 'bg-white border-gray-100/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-gray-200/80'
        }`}>
        {/* Accent strip on the leading edge — matches the doc-type gradient */}
        {!isSel && !isNew && (
          <div
            className={`absolute top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity ${
              dir === 'rtl' ? 'right-0' : 'left-0'
            }`}
            style={{ background: typeGradient }}
          />
        )}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center flex-shrink-0">
            {selectMode
              ? <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-secondary">{isSel ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-gray-300" />}</div>
              : <DocTypeIconBadge type={doc.doc_type} size="md" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold truncate">{doc.name}</p>
              {isNew && (
                <span className="flex-shrink-0 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">חדש</span>
              )}
              {(() => {
                const s = getDocStatus(doc)
                return s ? <StatusBadge status={s} /> : null
              })()}
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
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {doc.file_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); setViewerUrl(doc.file_url!) }}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-1 rounded-full active:scale-95 transition-transform hover:bg-primary/20">
                  <ExternalLink className="w-3 h-3" /> צפה במסמך
                </button>
              )}
              {doc.gmail_message_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); openEmailInApp(doc.gmail_message_id) }}
                  className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[10px] font-semibold px-2 py-1 rounded-full active:scale-95 transition-transform hover:bg-orange-100">
                  <Mail className="w-3 h-3" /> פתח מייל
                </button>
              )}
            </div>
          </div>
          {!selectMode && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
              aria-label={`${t('doc_delete_action')} ${doc.name}`}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:text-red-500 active:bg-red-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-red-400 flex-shrink-0">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
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
            if (selectMode) return toggleGroupSelect(group)
            if (primary.file_url) return setViewerUrl(primary.file_url)
            if (primary.gmail_message_id) return openEmailInApp(primary.gmail_message_id)
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
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {primary.file_url && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewerUrl(primary.file_url!) }}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-1 rounded-full active:scale-95 transition-transform hover:bg-primary/20">
                    <ExternalLink className="w-3 h-3" /> צפה במסמך
                  </button>
                )}
                {primary.gmail_message_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEmailInApp(primary.gmail_message_id) }}
                    className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[10px] font-semibold px-2 py-1 rounded-full active:scale-95 transition-transform hover:bg-orange-100">
                    <Mail className="w-3 h-3" /> פתח מייל
                  </button>
                )}
              </div>
            </div>

            {!selectMode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(primary.id) }}
                aria-label={`${t('doc_delete_action')} ${primary.name}`}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 active:text-red-500 active:bg-red-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-red-400 flex-shrink-0">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
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
                        {doc.file_url && (
                          <button
                            onClick={() => setViewerUrl(doc.file_url!)}
                            title="צפה במסמך"
                            className="text-primary active:scale-95 p-1 rounded hover:bg-primary/10">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {doc.gmail_message_id && (
                          <button
                            onClick={() => openEmailInApp(doc.gmail_message_id)}
                            title="פתח מייל מקורי"
                            className="text-orange-500 active:scale-95 p-1 rounded hover:bg-orange-50">
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!selectMode && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            aria-label={`${t('doc_delete_action')} ${doc.name}`}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 active:text-red-500 active:bg-red-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-red-400">
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
  // ── Entity sub-folder card ───────────────────────────────────────────
  // Renders a single "sub-category" (e.g. "Ritz Carlton" inside "Hotels").
  // Shows a compact header with a chevron; on expand, renders each booking
  // (DocGroup) underneath.
  const renderEntitySubfolder = (type: DocType, entity: EntityGroup) => {
    const entityKey = `${type}|${entity.key}`
    const isOpen    = expandedEntities.has(entityKey)
    const totalDocs = entity.groups.reduce((s, g) => s + g.docs.length, 0)
    const hasNew    = entity.groups.some(g => g.docs.some(d => newDocIds.has(d.id)))
    const allSel    = entity.groups.every(g => g.docs.every(d => selectedIds.has(d.id)))
    const anySel    = entity.groups.some(g => g.docs.some(d => selectedIds.has(d.id)))
    const typeGradient = DOC_TYPE_ICON[type]?.gradient || DOC_TYPE_ICON.other.gradient

    // Earliest relevant date for context under the label (check-in, flight date, passport expiry).
    const primary = entity.groups[0].docs[0]
    const contextDate = primary.valid_from || primary.valid_until

    return (
      <div
        key={`entity-${entityKey}`}
        className={`rounded-xl overflow-hidden border bg-white transition-all ${
          allSel ? 'border-primary/50 shadow-[0_2px_10px_rgba(108,71,255,0.08)]'
          : hasNew ? 'border-emerald-200'
          : 'border-gray-100'
        }`}
      >
        <button
          onClick={() => selectMode
            ? entity.groups.forEach(g => {
                setSelectedIds(prev => {
                  const next = new Set(prev)
                  const groupAllSel = g.docs.every(d => next.has(d.id))
                  if (groupAllSel) g.docs.forEach(d => next.delete(d.id))
                  else g.docs.forEach(d => next.add(d.id))
                  return next
                })
              })
            : toggleEntity(type, entity.key)}
          className="w-full flex items-center gap-3 px-3 py-3 text-right active:bg-gray-50 transition-colors"
        >
          {/* Thin vertical accent matching the type gradient */}
          <div className="w-1 h-9 rounded-full flex-shrink-0" style={{ background: typeGradient }} />

          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-800 truncate">{entity.label}</p>
              {entity.groups.length > 1 && (
                <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {entity.groups.length} הזמנות
                </span>
              )}
              {totalDocs > entity.groups.length && (
                <span className="text-[10px] text-gray-400">{totalDocs} מסמכים</span>
              )}
              {hasNew && (
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">חדש</span>
              )}
            </div>
            {contextDate && (
              <p className="text-[10px] text-gray-400 mt-0.5">{formatDateShort(contextDate)}</p>
            )}
          </div>

          {selectMode ? (
            <div className="flex-shrink-0">
              {allSel
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : anySel
                  ? <CheckSquare className="w-4 h-4 text-primary/40" />
                  : <Square className="w-4 h-4 text-gray-300" />}
            </div>
          ) : (
            isOpen
              ? <ChevronUp   className="w-4 h-4 text-gray-400 flex-shrink-0" />
              : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 p-2.5 space-y-2 bg-gray-50/50">
                {entity.groups.map(group =>
                  group.docs.length === 1
                    ? renderSingleDoc(group.docs[0], 'list')
                    : renderFolderCard(group)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const renderTypeFolder = (item: TypeFolderItem) => {
    const meta = DOC_TYPE_META[item.type]
    const isExpanded = expandedTypeFolders.has(item.type)
    const allGroups  = item.entities.flatMap(e => e.groups)
    const totalDocs  = allGroups.reduce((sum, g) => sum + g.docs.length, 0)
    const hasNew     = allGroups.some(g => g.docs.some(d => newDocIds.has(d.id)))
    const allSel     = allGroups.every(g => g.docs.every(d => selectedIds.has(d.id)))
    const anySel     = allGroups.some(g => g.docs.some(d => selectedIds.has(d.id)))
    const preview    = item.entities.slice(0, 3).map(en => en.label).join(' · ')

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
            ? allGroups.forEach(g => {
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
                {item.entities.length} {item.entities.length === 1 ? 'פריט' : 'פריטים'}
              </span>
              {totalDocs !== item.entities.length && (
                <span className="text-gray-400 text-[10px]">{totalDocs} מסמכים</span>
              )}
              {hasNew && (
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">חדש</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{preview}{item.entities.length > 3 ? ` ועוד ${item.entities.length - 3}…` : ''}</p>
          </div>
          {!selectMode && (
            isExpanded
              ? <ChevronUp   className="w-5 h-5 text-gray-400 flex-shrink-0" />
              : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* ── Expanded content: entity sub-folders ── */}
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
                {item.entities.map(entity =>
                  // If the entity has just one booking with one doc → render flat.
                  // Otherwise render as an expandable sub-folder.
                  entity.groups.length === 1 && entity.groups[0].docs.length === 1
                    ? renderSingleDoc(entity.groups[0].docs[0], 'list')
                    : renderEntitySubfolder(item.type, entity)
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // ── At-a-glance header stats ──────────────────────────────────────────
  const headerStats = (() => {
    let expiringSoon = 0
    let upcoming     = 0
    let passports    = 0
    for (const d of documents) {
      if (d.doc_type === 'passport') passports++
      const s = getDocStatus(d)
      if (!s) continue
      if (s.kind === 'expiring' || s.kind === 'expired') expiringSoon++
      else if (s.kind === 'upcoming')                    upcoming++
    }
    return { expiringSoon, upcoming, passports, total: documents.length }
  })()

  return (
    <div className="space-y-4 pb-32" dir={dir}>
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black gradient-text tracking-tight">{t('doc_title')}</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">ניהול חכם של כל מסמכי הנסיעה</p>
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

          <Link href="/scan" aria-label={t('doc_upload_new')}
            className="btn-cta px-4 py-2 text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" aria-hidden="true" /> {t('doc_upload_short')}
          </Link>
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      {documents.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="relative overflow-hidden bg-gradient-to-br from-white to-violet-50/60 border border-violet-100/80 rounded-2xl p-3 shadow-[0_2px_8px_rgba(124,58,237,0.06)]">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                <FolderOpen className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 font-medium">סך הכל</p>
                <p className="text-lg font-black text-gray-800 leading-tight">{headerStats.total}</p>
              </div>
            </div>
            <div className="absolute -left-3 -bottom-3 w-16 h-16 rounded-full bg-primary/5" />
          </div>

          <div className={`relative overflow-hidden border rounded-2xl p-3 ${
            headerStats.upcoming > 0
              ? 'bg-gradient-to-br from-white to-blue-50/60 border-blue-100/80 shadow-[0_2px_8px_rgba(37,99,235,0.06)]'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: headerStats.upcoming > 0
                  ? 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)'
                  : 'linear-gradient(135deg, #CBD5E1 0%, #E2E8F0 100%)' }}>
                <Plane className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 font-medium">קרובים</p>
                <p className={`text-lg font-black leading-tight ${headerStats.upcoming > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                  {headerStats.upcoming}
                </p>
              </div>
            </div>
            {headerStats.upcoming > 0 && <div className="absolute -left-3 -bottom-3 w-16 h-16 rounded-full bg-blue-500/5" />}
          </div>

          <div className={`relative overflow-hidden border rounded-2xl p-3 ${
            headerStats.expiringSoon > 0
              ? 'bg-gradient-to-br from-white to-amber-50/70 border-amber-100/80 shadow-[0_2px_8px_rgba(217,119,6,0.07)]'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: headerStats.expiringSoon > 0
                  ? 'linear-gradient(135deg, #D97706 0%, #FBBF24 100%)'
                  : 'linear-gradient(135deg, #CBD5E1 0%, #E2E8F0 100%)' }}>
                <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 font-medium">פגי תוקף</p>
                <p className={`text-lg font-black leading-tight ${headerStats.expiringSoon > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                  {headerStats.expiringSoon}
                </p>
              </div>
            </div>
            {headerStats.expiringSoon > 0 && <div className="absolute -left-3 -bottom-3 w-16 h-16 rounded-full bg-amber-500/5" />}
          </div>
        </div>
      )}

      {/* ── Gmail Sync Card ───────────────────────────────────────────────── */}
      {gmailCard}

      {/* ── Search + Sort bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            style={dir === 'rtl' ? { right: '0.75rem' } : { left: '0.75rem' }} />
          <input
            ref={searchInputRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery('') }}
            placeholder="חיפוש — שם, הזמנה, מספר טיסה, נוסע"
            aria-label="חיפוש מסמכים"
            className={`w-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-[0_2px_10px_rgba(15,23,42,0.04)] border border-gray-100/80 text-sm py-3 ${
              dir === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'
            } focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 focus:shadow-[0_4px_20px_rgba(108,71,255,0.10)] transition-all placeholder:text-gray-400`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}
              aria-label="נקה חיפוש"
              className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              style={dir === 'rtl' ? { left: '0.5rem' } : { right: '0.5rem' }}>
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
          <kbd className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-300 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 font-mono ${
            searchQuery ? 'opacity-0' : ''
          }`} style={dir === 'rtl' ? { left: '0.5rem' } : { right: '0.5rem' }}>
            ⌘K
          </kbd>
        </div>

        {/* Sort menu */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(v => !v)}
            aria-label="מיון"
            title={`מיון: ${sortKey}`}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${
              sortKey !== 'recent'
                ? 'text-white shadow-[0_4px_14px_rgba(108,71,255,0.35)]'
                : 'bg-white/90 backdrop-blur-sm shadow-[0_2px_10px_rgba(15,23,42,0.04)] border border-gray-100/80 text-gray-500 hover:text-primary hover:border-primary/30'
            }`}
            style={sortKey !== 'recent' ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}>
            <ArrowUpDown className="w-4 h-4" strokeWidth={2.2} />
          </button>
          <AnimatePresence>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-50 mt-2 min-w-[190px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                  style={dir === 'rtl' ? { left: 0 } : { right: 0 }}>
                  {([
                    { key: 'recent',   label: 'נוסף לאחרונה' },
                    { key: 'date',     label: 'לפי תאריך'      },
                    { key: 'expiring', label: 'בקרוב פג תוקף'  },
                    { key: 'name',     label: 'לפי שם'         },
                    { key: 'type',     label: 'לפי סוג'        },
                  ] as Array<{ key: SortKey; label: string }>).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setSortKey(key); setShowSortMenu(false) }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-right active:bg-gray-50 transition-colors ${
                        sortKey === key ? 'bg-primary/5 text-primary font-semibold' : 'text-gray-700'
                      }`}>
                      {label}
                      {sortKey === key && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

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
            <button key={t.id} onClick={() => setFilterTraveler(filterTraveler === t.id ? null : t.id)}
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
        (() => {
          const hasAnyDocs   = documents.length > 0
          const hasAnyFilter = !!filterType || !!filterTraveler || !!searchQuery.trim()
          // Case 1 — filters/search returned nothing
          if (hasAnyDocs && hasAnyFilter) {
            return (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-gray-100">
                  <Search className="w-7 h-7 text-gray-400" />
                </div>
                <p className="font-bold text-gray-800 mb-1">לא נמצאו מסמכים</p>
                <p className="text-sm text-gray-400 mb-4">
                  {searchQuery ? <>אין תוצאות ל-<span className="font-semibold text-gray-600">&quot;{searchQuery}&quot;</span></> : 'לא נמצאו מסמכים לפי הסינון שבחרת'}
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setFilterType(null); setFilterTraveler(null) }}
                  className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold rounded-xl px-4 py-2 text-sm active:scale-95 transition-transform">
                  <X className="w-4 h-4" /> נקה סינון
                </button>
              </div>
            )
          }
          // Case 2 — truly empty
          return (
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
          )
        })()
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
              <span className="text-sm font-bold text-gray-800 flex-1">{tFormat('doc_selected_count', lang, { count: selectedIds.size })}</span>
              <button onClick={handleExport} className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95">
                <Download className="w-4 h-4" aria-hidden="true" /> {t('doc_export_label')}
              </button>
              <button
                type="button"
                onClick={requestBulkDelete}
                disabled={bulkDeleting}
                aria-label={tFormat('doc_delete_bulk_btn', lang, { count: selectedIds.size })}
                className="flex items-center gap-1.5 bg-red-500 text-white rounded-xl px-4 py-3 min-h-[44px] text-sm font-semibold active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400">
                <Trash2 className="w-4 h-4" aria-hidden="true" /> {bulkDeleting ? t('doc_deleting') : t('delete')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DocumentViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />

      {/* In-app email viewer — fetches HTML from Gmail/Outlook server-side */}
      {(emailHtml !== null || emailLoading) && (
        <DocumentViewer
          url={null}
          htmlContent={emailHtml}
          htmlLoading={emailLoading}
          title={emailMeta?.subject || 'מייל'}
          subtitle={emailMeta?.from || ''}
          docType="other"
          onClose={closeEmailViewer}
        />
      )}

      <ConfirmDialog
        open={showBulkConfirm}
        title={tFormat('doc_delete_bulk_title', lang, { count: selectedIds.size })}
        description={t('doc_delete_bulk_desc')}
        confirmLabel={tFormat('doc_delete_bulk_btn', lang, { count: selectedIds.size })}
        cancelLabel={t('cancel')}
        variant="danger"
        loading={bulkDeleting}
        onConfirm={handleBulkDelete}
        onCancel={() => !bulkDeleting && setShowBulkConfirm(false)}
      />

      <ConfirmDialog
        open={!!deletingDoc}
        title={t('doc_delete_single_title')}
        description={
          deletingDoc
            ? `"${deletingDoc.name}" — ${t('doc_delete_single_desc')}`
            : undefined
        }
        confirmLabel={t('exp_delete_permanent')}
        cancelLabel={t('cancel')}
        variant="danger"
        loading={deletingSingle}
        onConfirm={handleConfirmSingleDelete}
        onCancel={() => !deletingSingle && setDeletingDoc(null)}
      />
    </div>
  )
}
