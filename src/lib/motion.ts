/**
 * Centralized motion design tokens.
 *
 * Use these everywhere instead of ad-hoc transitions to keep the app
 * feeling like one product. All values respect prefers-reduced-motion
 * via `useReducedMotion` from framer-motion.
 */

import type { Transition, Variants } from 'framer-motion'

// ─── Easing curves ────────────────────────────────────────────────────────
// "Out" curves feel snappy on entrance.
// "InOut" feel smooth during state changes.
export const ease = {
  /** Apple-like spring feel — fast start, soft landing */
  out:    [0.16, 1, 0.3, 1] as const,
  /** Symmetric — good for fade in/out, color changes */
  inOut:  [0.4, 0, 0.2, 1] as const,
  /** Snappy entry — for tap feedback */
  snap:   [0.2, 0.9, 0.2, 1] as const,
  /** Gentle, slow accelerate */
  in:     [0.4, 0, 1, 1] as const,
} as const

// ─── Duration scale ───────────────────────────────────────────────────────
export const dur = {
  instant: 0.08,
  fast:    0.18,
  base:    0.28,
  slow:    0.42,
  page:    0.32,
} as const

// ─── Spring presets ───────────────────────────────────────────────────────
export const spring = {
  /** Default UI spring — snappy, settled */
  ui:   { type: 'spring', damping: 28, stiffness: 320, mass: 0.8 } as Transition,
  /** Soft, bouncy — for sheet presentation */
  soft: { type: 'spring', damping: 30, stiffness: 260, mass: 0.9 } as Transition,
  /** Tight — for small affordances (buttons, badges) */
  tight: { type: 'spring', damping: 22, stiffness: 400, mass: 0.6 } as Transition,
  /** Bouncy emphasis — for "tada" / success */
  pop:  { type: 'spring', damping: 14, stiffness: 320, mass: 0.7 } as Transition,
} as const

// ─── Common variants ──────────────────────────────────────────────────────

/** Page enter/exit — slides up subtly + fades. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0,  transition: { duration: dur.page, ease: ease.out } },
  exit:    { opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.in } },
}

/** Slide-up sheet (e.g. from bottom of screen). */
export const sheetVariants: Variants = {
  initial: { y: '100%' },
  animate: { y: 0,      transition: spring.soft },
  exit:    { y: '100%', transition: { duration: dur.base, ease: ease.in } },
}

/** Modal/dialog — pop with scale. */
export const dialogVariants: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0,  scale: 1,    transition: spring.ui },
  exit:    { opacity: 0, y: 16, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } },
}

/** Backdrop / scrim. */
export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: dur.fast, ease: ease.out } },
  exit:    { opacity: 0, transition: { duration: dur.fast, ease: ease.in } },
}

/** Fade-only — for crossfade content swaps. */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: dur.base, ease: ease.out } },
  exit:    { opacity: 0, transition: { duration: dur.fast, ease: ease.in } },
}

/** Scale-pop entrance — for badges, success ticks, FABs. */
export const popVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1,    transition: spring.pop },
  exit:    { opacity: 0, scale: 0.85, transition: { duration: dur.fast, ease: ease.in } },
}

/** Item slide-in (used inside lists). */
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
  exit:    { opacity: 0, x: -16, transition: { duration: dur.fast, ease: ease.in } },
}

/** Stagger container — apply to parent of `itemVariants` children. */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren:   0.04,
    },
  },
}

/** Soft staggered entry for hero sections (slower, more dramatic). */
export const heroStagger: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren:   0.1,
    },
  },
}

/** Tap-press scale — apply via whileTap. */
export const tapScale = { scale: 0.96 }
export const tapScaleSmall = { scale: 0.9 }

/** Hover lift — apply via whileHover (desktop). */
export const hoverLift = { y: -2, transition: { duration: dur.fast, ease: ease.out } }
