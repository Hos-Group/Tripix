export type Category = 'flight' | 'ferry' | 'taxi' | 'hotel' | 'activity' | 'food' | 'shopping' | 'other'
export type Currency = 'ILS' | 'USD' | 'THB' | 'EUR' | 'GBP'
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
  flight:   { label: 'טיסה',    icon: '✈️', color: '#378ADD' },
  ferry:    { label: 'מעבורת',  icon: '⛴️', color: '#1D9E75' },
  taxi:     { label: 'מונית',   icon: '🚕', color: '#EF9F27' },
  hotel:    { label: 'לינה',    icon: '🏨', color: '#639922' },
  activity: { label: 'פעילות',  icon: '🎯', color: '#7F77DD' },
  food:     { label: 'אוכל',    icon: '🍜', color: '#D4537E' },
  shopping: { label: 'קניות',   icon: '🛍️', color: '#D85A30' },
  other:    { label: 'אחר',     icon: '📌', color: '#888780' },
}

export const DOC_TYPE_META: Record<DocType, DocTypeMeta> = {
  passport:  { label: 'דרכון',       icon: '🛂' },
  flight:    { label: 'כרטיס טיסה',  icon: '✈️' },
  hotel:     { label: 'הזמנת מלון',  icon: '🏨' },
  ferry:     { label: 'מעבורת',      icon: '⛴️' },
  activity:  { label: 'פעילות',      icon: '🎯' },
  insurance: { label: 'ביטוח',       icon: '🛡️' },
  visa:      { label: 'ויזה',        icon: '📋' },
  other:     { label: 'אחר',         icon: '📄' },
}

export const TRAVELER_META: Record<TravelerId, string> = {
  omer: 'אומר',
  wife: 'אשתי',
  baby: 'תינוקת',
  all: 'כולם',
}

// Shared trips
export type TripType = 'personal' | 'bachelor' | 'bachelorette' | 'ski' | 'family' | 'friends' | 'couples' | 'work' | 'other'
export type MemberRole = 'owner' | 'admin' | 'member'
export type SplitType = 'equal' | 'custom' | 'full'

export interface TripMember {
  id: string
  trip_id: string
  user_id: string
  display_name: string
  email: string | null
  role: MemberRole
  joined_at: string
}

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
  balance: number // positive = others owe them, negative = they owe others
}

export interface DebtSummary {
  from: TripMember
  to: TripMember
  amount: number
}

export const TRIP_TYPE_META: Record<TripType, { label: string; icon: string; color: string }> = {
  personal:     { label: 'אישי',         icon: '🧳', color: '#185FA5' },
  bachelor:     { label: 'מסיבת רווקים',  icon: '🎉', color: '#D85A30' },
  bachelorette: { label: 'מסיבת רווקות', icon: '💃', color: '#D4537E' },
  ski:          { label: 'טיול סקי',      icon: '⛷️', color: '#579BFC' },
  family:       { label: 'טיול משפחות',   icon: '👨‍👩‍👧‍👦', color: '#639922' },
  friends:      { label: 'טיול חברים',    icon: '🤝', color: '#EF9F27' },
  couples:      { label: 'טיול זוגות',    icon: '💑', color: '#7F77DD' },
  work:         { label: 'טיול עבודה',    icon: '💼', color: '#888780' },
  other:        { label: 'אחר',          icon: '✨', color: '#1D9E75' },
}

export const CURRENCIES: Currency[] = ['ILS', 'USD', 'THB', 'EUR', 'GBP']

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  ILS: '₪',
  USD: '$',
  THB: '฿',
  EUR: '€',
  GBP: '£',
}
