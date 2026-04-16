'use client'
import { usePathname } from 'next/navigation'
import GlobalHeader from './GlobalHeader'
import BottomNav from './BottomNav'
import TourGuideWrapper from '@/components/TourGuideWrapper'

const MARKETING_ROUTES = ['/']

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMarketing = MARKETING_ROUTES.includes(pathname)

  if (isMarketing) {
    return <>{children}</>
  }

  return (
    <>
      <GlobalHeader />
      <main className="min-h-screen max-w-lg mx-auto px-4 pt-16 pb-24">
        {children}
      </main>
      <BottomNav />
      <TourGuideWrapper />
    </>
  )
}
