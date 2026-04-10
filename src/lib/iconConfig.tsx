import { Plane, Ship, Car, Building2, Zap, ShieldCheck, FileCheck, FileText, CreditCard, UtensilsCrossed, ShoppingBag, MoreHorizontal, Star, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DocType, Category } from '@/types'

interface IconConfig {
  Icon: LucideIcon
  gradient: string  // CSS gradient string for background
  textColor: string // color for the icon itself (always white)
}

export const DOC_TYPE_ICON: Record<DocType, IconConfig> = {
  passport:  { Icon: CreditCard,  gradient: 'linear-gradient(135deg, #7C3AED 0%, #9B7BFF 100%)', textColor: 'white' },
  flight:    { Icon: Plane,       gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', textColor: 'white' },
  hotel:     { Icon: Building2,   gradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)', textColor: 'white' },
  ferry:     { Icon: Ship,        gradient: 'linear-gradient(135deg, #0891B2 0%, #38BDF8 100%)', textColor: 'white' },
  activity:  { Icon: Zap,         gradient: 'linear-gradient(135deg, #D97706 0%, #FCD34D 100%)', textColor: 'white' },
  insurance: { Icon: ShieldCheck, gradient: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)', textColor: 'white' },
  visa:      { Icon: FileCheck,   gradient: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)', textColor: 'white' },
  other:     { Icon: FileText,    gradient: 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)', textColor: 'white' },
}

export const CATEGORY_ICON: Record<Category, IconConfig> = {
  flight:   { Icon: Plane,           gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', textColor: 'white' },
  ferry:    { Icon: Ship,            gradient: 'linear-gradient(135deg, #0891B2 0%, #38BDF8 100%)', textColor: 'white' },
  taxi:     { Icon: Car,             gradient: 'linear-gradient(135deg, #D97706 0%, #FCD34D 100%)', textColor: 'white' },
  hotel:    { Icon: Building2,       gradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)', textColor: 'white' },
  activity: { Icon: Zap,             gradient: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', textColor: 'white' },
  food:     { Icon: UtensilsCrossed, gradient: 'linear-gradient(135deg, #E11D48 0%, #FB7185 100%)', textColor: 'white' },
  shopping: { Icon: ShoppingBag,     gradient: 'linear-gradient(135deg, #EA580C 0%, #FB923C 100%)', textColor: 'white' },
  other:    { Icon: MoreHorizontal,  gradient: 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)', textColor: 'white' },
}

export const DOC_EVENT_ICON: Record<string, IconConfig> = {
  flight:          { Icon: Plane,    gradient: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)', textColor: 'white' },
  car_pickup:      { Icon: Car,      gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', textColor: 'white' },
  car_dropoff:     { Icon: Car,      gradient: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', textColor: 'white' },
  hotel_checkin:   { Icon: Building2,gradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)', textColor: 'white' },
  hotel_stay:      { Icon: Building2,gradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)', textColor: 'white' },
  hotel_checkout:  { Icon: LogOut,   gradient: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', textColor: 'white' },
}

/** Renders a styled icon badge for a DocType — use in document cards */
export function DocTypeIconBadge({ type, size = 'md' }: { type: DocType; size?: 'sm' | 'md' | 'lg' }) {
  const config = DOC_TYPE_ICON[type] || DOC_TYPE_ICON.other
  const { Icon, gradient } = config
  const sizeClass = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9'
  const iconSize  = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className={`${sizeClass} rounded-2xl flex items-center justify-center flex-shrink-0`}
      style={{ background: gradient }}>
      <Icon className={`${iconSize} text-white`} strokeWidth={2} />
    </div>
  )
}

/** Renders a styled icon badge for an expense category */
export function CategoryIconBadge({ category, size = 'md' }: { category: Category; size?: 'sm' | 'md' | 'lg' }) {
  const config = CATEGORY_ICON[category] || CATEGORY_ICON.other
  const { Icon, gradient } = config
  const sizeClass = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'
  const iconSize  = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className={`${sizeClass} rounded-xl flex items-center justify-center flex-shrink-0`}
      style={{ background: gradient }}>
      <Icon className={`${iconSize} text-white`} strokeWidth={2} />
    </div>
  )
}

/** Renders a styled icon for a timeline doc event type */
export function DocEventIconBadge({ type, size = 8 }: { type: string; size?: number }) {
  const config = DOC_EVENT_ICON[type]
  const sizeClass = `w-${size} h-${size}`
  const iconSizeClass = `w-${Math.floor(size * 0.5)} h-${Math.floor(size * 0.5)}`
  if (!config) {
    // Fallback: Star for service events
    return (
      <div className={`${sizeClass} rounded-xl flex items-center justify-center flex-shrink-0`}
        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
        <Star className={`${iconSizeClass} text-white`} strokeWidth={2} />
      </div>
    )
  }
  const { Icon, gradient } = config
  return (
    <div className={`${sizeClass} rounded-xl flex items-center justify-center flex-shrink-0`}
      style={{ background: gradient }}>
      <Icon className={`${iconSizeClass} text-white`} strokeWidth={2} />
    </div>
  )
}
