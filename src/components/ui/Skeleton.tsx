'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  'aria-label'?: string
}

const roundedMap = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}

export default function Skeleton({ className, rounded = '2xl', ...rest }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={rest['aria-label'] ?? 'טוען תוכן'}
      className={cn('skeleton', roundedMap[rounded], className)}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="-mx-4">
      <div className="px-5 pt-6 pb-8 space-y-4"
        style={{ background: 'linear-gradient(160deg, #EEE9FF 0%, #DDD4FF 60%, #C5B3FF 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 bg-white/40" rounded="md" />
            <Skeleton className="h-4 w-32 bg-white/50" rounded="md" />
          </div>
          <Skeleton className="h-9 w-20 bg-white/50" rounded="xl" />
        </div>
        <div className="flex flex-col items-center gap-2 py-4">
          <Skeleton className="h-3 w-24 bg-white/40" rounded="md" />
          <Skeleton className="h-14 w-56 bg-white/60" rounded="xl" />
          <Skeleton className="h-3 w-40 bg-white/40" rounded="md" />
        </div>
      </div>

      <div className="bg-white px-5 py-5 border-b border-gray-50 flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-14 w-14" />
            <Skeleton className="h-2.5 w-10" rounded="md" />
          </div>
        ))}
      </div>

      <div className="bg-white px-5 py-4 border-b border-gray-50 flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-28" />
        ))}
      </div>

      <div className="bg-white px-5 py-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" rounded="md" />
              <Skeleton className="h-2.5 w-1/3" rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-3 space-y-3" aria-label="טוען רשימה">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" rounded="md" />
            <Skeleton className="h-2.5 w-1/3" rounded="md" />
          </div>
          <Skeleton className="h-4 w-16" rounded="md" />
        </div>
      ))}
    </div>
  )
}
