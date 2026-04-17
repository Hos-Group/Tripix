export type Category =
  | 'flight' | 'ferry' | 'taxi' | 'hotel' | 'activity' | 'food' | 'shopping' | 'other'
  | 'car_rental' | 'insurance' | 'visa' | 'sim' | 'pharmacy' | 'spa'
  | 'nightlife' | 'museum' | 'sport' | 'parking' | 'train' | 'tips' | 'travel_gear' | 'laundry'

export type Currency = 'ILS' | 'USD' | 'THB' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'SGD' | 'TRY' | 'CHF' | 'AUD' | 'CAD'
export type DocType = 'passport' | 'flight' | 'hotel' | 'ferry' | 'activity' | 'insurance' | 'visa' | 'other'
export type TravelerId = 'omer' | 'wife' | 'baby' | 'all'
export type ExpenseSource = 'manual' | 'scan' | 'document' | 'voice'

export interface Trip {
  id: string
  name: string
  destination: string
  start_date: string
  end_date: string
  budget_ils: number | null
  travelers: { id: string; name: string }[]
  notes: string | null
  created_at: string
}

export interface Expense {
  id: string
  trip_id: string
  title: string
  category: Category
  amount: number
  currency: Currency
  amount_ils: number
  expense_date: string
  notes: string | null
  receipt_url: string | null
  source: ExpenseSource
  travelers: string[]
  is_paid: boolean
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  trip_id: string
  name: string
  doc_type: DocType
  traveler_id: TravelerId
  file_url: string | null
  file_type: string | null
  extracted_data: Record<string, unknown>
  booking_ref: string | null
  valid_from: string | null
  valid_until: string | null
  flight_number: string | null
  notes: string | null
  created_at: string
}

export interface CurrencyRate {
  currency: Currency
  rate_to_ils: number
  updated_at: string
}

export interface CategoryMeta {
  label: string
  icon: string
  color: string
}

export interface DocTypeMeta {
  label: string
  icon: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  // Transport
  flight:       { label: 'טיסה',           icon: '✈️',  color: '#2563EB' },
  train:        { label: 'רכבת',           icon: '🚂',  color: '#7C3AED' },
  ferry:        { label: 'מעבורת',         icon: '⛴️',  color: '#0891B2' },
  taxi:         { label: 'מונית / Uber',   icon: '🚕',  color: '#D97706' },
  car_rental:   { label: 'השכרת רכב',      icon: '🚗',  color: '#EA580C' },
  parking:      { label: 'חניה',           icon: '🅿️',  color: '#64748B' },
  // Accommodation
  hotel:        { label: 'לינה',           icon: '🏨',  color: '#059669' },
  // Activities & Entertainment
  activity:     { label: 'פעילות / סיור', icon: '🎯',  color: '#7F77DD' },
  museum:       { label: 'מוזיאון / תרבות',icon: '🏛️', color: '#4F46E5' },
  sport:        { label: 'ספורט',          icon: '🏄',  color: '#16A34A' },
  nightlife:    { label: 'בילוי לילי',     icon: '🎭',  color: '#9333EA' },
  spa:          { label: 'ספא / בריאות',  icon: '💆',  color: '#EC4899' },
  // Food & Drink
  food:         { label: 'אוכל ושתייה',   icon: '🍜',  color: '#D4537E' },
  // Shopping & Essentials
  shopping:     { label: 'קניות',          icon: '🛍️', color: '#D85A30' },
  travel_gear:  { label: 'ציוד נסיעה',    icon: '🎒',  color: '#92400E' },
  pharmacy:     { label: 'בית מרקחת',      icon: '💊',  color: '#DC2626' },
  sim:          { label: 'כרטיס SIM',      icon: '📱',  color: '#0EA5E9' },
  laundry:      { label: 'כביסה',          icon: '👕',  color: '#78716C' },
  // Financial
  insurance:    { label: 'ביטוח',          icon: '🛡️', color: '#1D9E75' },
  visa:         { label: 'ויזה / אשרה',   icon: '📋',  color: '#6366F1' },
  tips:         { label: 'טיפים',          icon: '💵',  color: '#B45309' },
  // Other
  other:        { label: 'אחר',            icon: '📌',  color: '#888780' },
}

export const DOC_TYPE_META: Record<DocType, DocTypeMeta> = {
  passport:  { label: 'דרכון',         icon: '🛂' },
  flight:    { label: 'כרטיס טיסה',   icon: '✈️' },
  hotel:     { label: 'הזמנת לינה',   icon: '🏨' },
  ferry:     { label: 'מעבורת',        icon: '⛴️' },
  activity:  { label: 'פעילות',        icon: '🎯' },
  insurance: { label: 'ביטוח',         icon: '🛡️' },
  visa:      { label: 'ויזה / אשרה',  icon: '📋' },
  other:     { label: 'אחר',           icon: '📄' },
}

export const TRAVELER_META: Record<TravelerId, string> = {
  omer: 'אומר',
  wife: 'אשתי',
  baby: 'תינוקת',
  all: 'כולם',
}

// ── Collaborative Trips ──────────────────────────────────────
export type TripType = 'personal' | 'bachelor' | 'bachelorette' | 'ski' | 'family' | 'friends' | 'couples' | 'work' | 'other'
export type MemberRole = 'owner' | 'editor' | 'viewer'
export type MemberStatus = 'active' | 'pending' | 'declined'
export type SplitType = 'equal' | 'custom'

/** A participant entry inside splits.participants JSONB */
export interface SplitParticipant {
  user_id?: string
  name: string
  email?: string
  amount: number
  paid: boolean
}

/** Row in trip_members table */
export interface TripMember {
  id: string
  trip_id: string
  user_id: string | null
  invited_email: string | null
  invited_name: string | null
  role: MemberRole
  status: MemberStatus
  joined_at: string | null
  created_at: string
  /** display helper — resolved at query time or UI level */
  display_name?: string
}

/** Row in splits table */
export interface Split {
  id: string
  trip_id: string
  expense_id: string | null
  paid_by_user_id: string | null
  paid_by_name: string
  total_amount: number
  currency: string
  description: string | null
  split_type: SplitType
  participants: SplitParticipant[]
  created_at: string
}

/** Computed debt: person A owes person B */
export interface DebtItem {
  fromName: string
  fromUserId?: string
  toName: string
  toUserId?: string
  amount: number
  currency: string
}

// Legacy aliases kept for backward compat
export interface ExpenseSplit {
  id: string
  expense_id: string
  member_id: string
  amount_ils: number
  is_paid: boolean
}

export interface Settlement {
  id: string
  trip_id: string
  from_member: string
  to_member: string
  amount_ils: number
  settled_at: string
  notes: string | null
}

export interface MemberBalance {
  member: TripMember
  totalPaid: number
  totalOwed: number
  balance: number
}

export interface DebtSummary {
  from: TripMember
  to: TripMember
  amount: number
}

export const TRIP_TYPE_META: Record<TripType, { label: string; icon: string; color: string }> = {
  personal:     { label: 'אישי',            icon: '🧳', color: '#185FA5' },
  bachelor:     { label: 'מסיבת רווקים',   icon: '🎉', color: '#D85A30' },
  bachelorette: { label: 'מסיבת רווקות',  icon: '💃', color: '#D4537E' },
  ski:          { label: 'נסיעת סקי',      icon: '⛷️', color: '#579BFC' },
  family:       { label: 'נסיעה משפחתית',  icon: '👨‍👩‍👧‍👦', color: '#639922' },
  friends:      { label: 'נסיעה עם חברים', icon: '🤝', color: '#EF9F27' },
  couples:      { label: 'נסיעה זוגית',    icon: '💑', color: '#7F77DD' },
  work:         { label: 'נסיעת עסקים',    icon: '💼', color: '#888780' },
  other:        { label: 'אחר',             icon: '✨', color: '#1D9E75' },
}

export const CURRENCIES: Currency[] = ['ILS', 'USD', 'THB', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'TRY', 'CHF', 'AUD', 'CAD']

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  ILS: '₪',
  USD: '$',
  THB: '฿',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AED: 'د.إ',
  SGD: 'S$',
  TRY: '₺',
  CHF: 'Fr',
  AUD: 'A$',
  CAD: 'C$',
}
