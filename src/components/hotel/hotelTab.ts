/**
 * Hotel Tab — pure helpers for tracking incidentals charged to a
 * hotel room during a stay.  No React, no Supabase client — only
 * types and small pure functions so the logic is testable and
 * reusable from the Expenses page, the Quick Charge sheet, and
 * the end-of-stay Report.
 */
import { Hotel, Waves, Utensils, Wine, Sparkles, Dumbbell, ShoppingBag, BedDouble, MoreHorizontal } from 'lucide-react'
import type { Category, Currency } from '@/types'

// ─── Stay model ───────────────────────────────────────────────────

export type StayStatus = 'upcoming' | 'active' | 'ended'

export interface HotelStay {
  document_id: string         // FK into documents.id
  trip_id:     string
  name:        string         // e.g. "Anantara Layan Phuket"
  check_in:    string         // YYYY-MM-DD
  check_out:   string         // YYYY-MM-DD
  currency:    Currency       // default charging currency
  status:      StayStatus
  pre_paid_total_ils: number  // from the booking's own expense row
  incidentals_total_ils: number
  incidentals_count:  number
  nights:      number
}

export interface HotelDocumentRow {
  id:       string
  trip_id:  string
  name:     string
  doc_type: string
  extracted_data?: {
    check_in?:  string | null
    check_out?: string | null
    currency?:  string | null
  } | null
  valid_from?:  string | null
  valid_until?: string | null
}

export interface ExpenseRow {
  id:            string
  trip_id:       string
  document_id:   string | null
  amount:        number
  amount_ils:    number
  currency:      Currency
  category:      Category
  title:         string
  expense_date:  string
  location_tag?: LocationTag | null
  notes?:        string | null
}

// ─── Location vocabulary ──────────────────────────────────────────

export type LocationTag =
  | 'room' | 'pool' | 'lounge' | 'restaurant' | 'bar'
  | 'spa' | 'gym' | 'shop' | 'other'

export const LOCATION_TAGS: { id: LocationTag; label: string; icon: string }[] = [
  { id: 'room',       label: 'חדר',      icon: '🛏️' },
  { id: 'pool',       label: 'ברכה',     icon: '🏊' },
  { id: 'lounge',     label: 'לאונג׳',   icon: '🛋️' },
  { id: 'restaurant', label: 'מסעדה',    icon: '🍽️' },
  { id: 'bar',        label: 'בר',       icon: '🍹' },
  { id: 'spa',        label: 'ספא',      icon: '💆' },
  { id: 'gym',        label: 'כושר',     icon: '🏋️' },
  { id: 'shop',       label: 'חנות',     icon: '🛍️' },
  { id: 'other',      label: 'אחר',      icon: '➕' },
]

/** Map location → the Category the incidental is recorded under. */
export const LOCATION_DEFAULT_CATEGORY: Record<LocationTag, Category> = {
  room:       'food',
  pool:       'food',
  lounge:     'food',
  restaurant: 'food',
  bar:        'food',
  spa:        'spa',
  gym:        'activity',
  shop:       'shopping',
  other:      'other',
}

// ─── Quick-charge presets (shown as chips in the sheet) ──────────

export interface QuickPreset {
  id:       string
  label:    string
  icon:     string
  category: Category
  // Most-common spot for this kind of charge — pre-selects the location chip.
  location: LocationTag
}

export const QUICK_PRESETS: QuickPreset[] = [
  { id: 'drink',    label: 'שתייה',  icon: '🍹', category: 'food',     location: 'bar'        },
  { id: 'food',     label: 'אוכל',   icon: '🍽️', category: 'food',     location: 'restaurant' },
  { id: 'service',  label: 'שירות',  icon: '🛎️', category: 'food',     location: 'room'       },
  { id: 'spa',      label: 'ספא',    icon: '💆', category: 'spa',      location: 'spa'        },
  { id: 'shop',     label: 'חנות',   icon: '🛍️', category: 'shopping', location: 'shop'       },
  { id: 'other',    label: 'אחר',    icon: '➕', category: 'other',    location: 'other'      },
]

// ─── Stay status + derivation ─────────────────────────────────────

/** ISO date (YYYY-MM-DD) for "today" in the trip's timezone sense. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function deriveStayStatus(checkIn: string, checkOut: string, now = todayISO()): StayStatus {
  if (now < checkIn)  return 'upcoming'
  if (now >= checkOut) return 'ended'
  return 'active'
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 1
}

/**
 * Build a `HotelStay[]` from the raw hotel documents + all trip expenses.
 * The computation is O(docs + expenses) — good enough for Tripix scale.
 */
export function buildHotelStays(
  hotelDocs: HotelDocumentRow[],
  expenses:  ExpenseRow[],
): HotelStay[] {
  // Bucket expenses by document_id for O(1) lookup
  const byDoc = new Map<string, ExpenseRow[]>()
  for (const e of expenses) {
    if (!e.document_id) continue
    if (!byDoc.has(e.document_id)) byDoc.set(e.document_id, [])
    byDoc.get(e.document_id)!.push(e)
  }

  const now = todayISO()
  return hotelDocs
    .filter(d => d.doc_type === 'hotel')
    .map<HotelStay | null>(d => {
      const checkIn  = d.extracted_data?.check_in  || d.valid_from
      const checkOut = d.extracted_data?.check_out || d.valid_until
      if (!checkIn || !checkOut) return null
      const rows     = byDoc.get(d.id) || []
      // First row linked to the doc is the booking itself (pre-paid).
      // Anything else is an incidental.  We distinguish by category:
      // bookings are category='hotel'; incidentals are any other category
      // the user/quick-charge picks.
      let prePaid = 0, incidentals = 0, incidentalsCount = 0
      for (const r of rows) {
        if (r.category === 'hotel') prePaid += r.amount_ils || 0
        else { incidentals += r.amount_ils || 0; incidentalsCount++ }
      }
      return {
        document_id:          d.id,
        trip_id:              d.trip_id,
        name:                 d.name,
        check_in:             checkIn,
        check_out:            checkOut,
        currency:             (d.extracted_data?.currency as Currency | undefined) || 'ILS',
        status:               deriveStayStatus(checkIn, checkOut, now),
        pre_paid_total_ils:   prePaid,
        incidentals_total_ils: incidentals,
        incidentals_count:    incidentalsCount,
        nights:               nightsBetween(checkIn, checkOut),
      }
    })
    .filter(Boolean) as HotelStay[]
}

// ─── Report aggregation ───────────────────────────────────────────

export interface ReportBucket {
  key:      string            // category or location
  label:    string
  icon:     string
  total:    number            // ILS
  count:    number
}

const CATEGORY_LABELS: Partial<Record<Category, { label: string; icon: string }>> = {
  food:      { label: 'אוכל ושתייה', icon: '🍽️' },
  spa:       { label: 'ספא',         icon: '💆' },
  activity:  { label: 'פעילות',      icon: '🏋️' },
  shopping:  { label: 'קניות',       icon: '🛍️' },
  hotel:     { label: 'חדר (pre-paid)', icon: '🏨' },
  other:     { label: 'אחר',         icon: '➕' },
}

/**
 * Summarise a stay's incidentals by category AND by location for the
 * end-of-stay report.  Returns two breakdowns; the UI renders whichever
 * the user wants to see (tabs).
 */
export function summariseStay(
  incidentals: ExpenseRow[],
): { byCategory: ReportBucket[]; byLocation: ReportBucket[]; total: number } {
  const cat = new Map<string, ReportBucket>()
  const loc = new Map<string, ReportBucket>()

  for (const e of incidentals) {
    const meta = CATEGORY_LABELS[e.category] || { label: e.category, icon: '•' }
    const ck   = e.category
    const cb   = cat.get(ck) || { key: ck, label: meta.label, icon: meta.icon, total: 0, count: 0 }
    cb.total += e.amount_ils || 0
    cb.count += 1
    cat.set(ck, cb)

    const lk    = e.location_tag || 'other'
    const lMeta = LOCATION_TAGS.find(t => t.id === lk) || LOCATION_TAGS[LOCATION_TAGS.length - 1]
    const lb    = loc.get(lk) || { key: lk, label: lMeta.label, icon: lMeta.icon, total: 0, count: 0 }
    lb.total += e.amount_ils || 0
    lb.count += 1
    loc.set(lk, lb)
  }

  const byCategory = Array.from(cat.values()).sort((a, b) => b.total - a.total)
  const byLocation = Array.from(loc.values()).sort((a, b) => b.total - a.total)
  const total      = incidentals.reduce((s, e) => s + (e.amount_ils || 0), 0)
  return { byCategory, byLocation, total }
}

// ─── Status labels + icons (consumed by UI) ──────────────────────

export const STATUS_LABELS: Record<StayStatus, { label: string; color: string }> = {
  upcoming: { label: 'עתידי',  color: '#9CA3AF' },
  active:   { label: 'בשהייה', color: '#10B981' },
  ended:    { label: 'הסתיים', color: '#6C47FF' },
}

export const StayIcons = { Hotel, Waves, Utensils, Wine, Sparkles, Dumbbell, ShoppingBag, BedDouble, MoreHorizontal }
