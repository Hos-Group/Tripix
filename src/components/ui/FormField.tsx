'use client'

import {
  forwardRef,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  useId,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
  optional?: boolean
}

function FieldShell({ id, label, hint, error, required, optional, children, className }: FieldShellProps) {
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold text-gray-700 flex items-center gap-1">
        {label}
        {required && <span aria-hidden="true" className="text-red-500">*</span>}
        {optional && <span className="text-gray-400 font-normal">(אופציונלי)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-[11px] text-gray-400 leading-snug px-1">{hint}</p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[11px] font-medium text-red-500 leading-snug px-1">
          {error}
        </p>
      )}
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  optional?: boolean
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, required, id, className, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-err` : null]
    .filter(Boolean)
    .join(' ') || undefined
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <input
        ref={ref}
        id={fieldId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        className={cn(
          'w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none',
          'min-h-[48px]',
          'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white',
          'transition-all placeholder:text-gray-400',
          error && 'ring-2 ring-red-300 bg-red-50/40',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  )
})

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  error?: string
  optional?: boolean
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, optional, required, id, className, children, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-err` : null]
    .filter(Boolean)
    .join(' ') || undefined
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(
            'w-full bg-surface-secondary rounded-2xl px-4 py-3 pl-10 text-sm font-medium outline-none appearance-none',
            'min-h-[48px]',
            'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white',
            'transition-all',
            error && 'ring-2 ring-red-300 bg-red-50/40',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        />
      </div>
    </FieldShell>
  )
})

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
  error?: string
  optional?: boolean
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, hint, error, optional, required, id, className, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-err` : null]
    .filter(Boolean)
    .join(' ') || undefined
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} optional={optional}>
      <textarea
        ref={ref}
        id={fieldId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        required={required}
        className={cn(
          'w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white',
          'transition-all placeholder:text-gray-400 resize-none',
          error && 'ring-2 ring-red-300 bg-red-50/40',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  )
})
