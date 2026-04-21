'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  href?: string
  onClick?: () => void
  ariaLabel?: string
  className?: string
}

/**
 * Accessible back button with proper RTL chevron behavior.
 * In RTL, the chevron visually points right (rotated 180°).
 */
export default function BackButton({
  href,
  onClick,
  ariaLabel = 'חזרה',
  className,
}: BackButtonProps) {
  const router = useRouter()
  const handleClick = onClick ?? (() => router.back())

  const baseClasses =
    'w-11 h-11 inline-flex items-center justify-center rounded-2xl text-gray-600 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'

  const cls = className ? `${baseClasses} ${className}` : baseClasses

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cls}>
        <ChevronLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <button type="button" onClick={handleClick} aria-label={ariaLabel} className={cls}>
      <ChevronLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
    </button>
  )
}
