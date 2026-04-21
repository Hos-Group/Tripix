'use client'

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary:
    'text-white shadow-[0_4px_14px_rgba(108,71,255,0.28)] active:shadow-[0_2px_8px_rgba(108,71,255,0.20)]',
  secondary:
    'bg-white text-gray-800 border border-gray-200 active:bg-gray-50',
  ghost:
    'bg-transparent text-gray-700 active:bg-gray-100',
  danger:
    'text-white shadow-[0_4px_14px_rgba(239,68,68,0.28)]',
  success:
    'text-white shadow-[0_4px_14px_rgba(16,185,129,0.28)]',
}

const sizeStyles: Record<Size, string> = {
  sm: 'min-h-[40px] px-4 text-sm rounded-xl gap-1.5',
  md: 'min-h-[48px] px-5 text-sm rounded-2xl gap-2',
  lg: 'min-h-[56px] px-6 text-base rounded-2xl gap-2',
}

const gradients: Partial<Record<Variant, string>> = {
  primary: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
  danger:  'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
  success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    style,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  const gradient = gradients[variant]
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-bold tracking-tight',
        'transition-all duration-150 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className,
      )}
      style={{ ...(gradient ? { background: gradient } : {}), ...style }}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : leftIcon ? (
        <span aria-hidden="true" className="inline-flex">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!loading && rightIcon ? (
        <span aria-hidden="true" className="inline-flex">{rightIcon}</span>
      ) : null}
    </button>
  )
})

export default Button
