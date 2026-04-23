'use client'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import GlobalHeader from './GlobalHeader'
import BottomNav from './BottomNav'
import TourGuideWrapper from '@/components/TourGuideWrapper'
import { pageVariants } from '@/lib/motion'

const MARKETING_ROUTES = ['/']

/**
 * Group pathnames into "transition cohorts" — navigating WITHIN a cohort
 * (e.g. /trips → /trips/123) gets a quick crossfade, while moving BETWEEN
 * cohorts (e.g. /dashboard → /expenses) gets the slide-up enter motion.
 *
 * This produces a calmer feel for in-section navigation.
 */
function cohortKey(path: string): string {
  const seg = path.split('/').filter(Boolean)[0] ?? 'root'
  return seg
}

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const isMarketing = MARKETING_ROUTES.includes(pathname)

  if (isMarketing) {
    return <>{children}</>
  }

  return (
    <>
      <GlobalHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-screen max-w-lg mx-auto px-4 pt-16 pb-24 focus:outline-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cohortKey(pathname) + pathname}
            initial={reduce ? false : 'initial'}
            animate="animate"
            exit="exit"
            variants={pageVariants}
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
      <TourGuideWrapper />
    </>
  )
}
