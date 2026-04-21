'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Menu, X, AlertTriangle, Wallet, Luggage, ArrowLeftRight,
  Settings, LogOut, Cloud, Plane, Users, Sparkles, Map,
  Globe, PlusCircle, FolderOpen, Heart, Smartphone,
  ChevronDown, Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const { currentTrip, trips, setCurrentTripId } = useTrip()
  const { displayName, signOut } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const tripTools = [
    { href: '/assistant', label: t('menu_ai_assistant'), icon: Sparkles,       color: 'text-violet-500',  bg: 'bg-violet-50' },
    { href: '/itinerary', label: t('menu_itinerary'),    icon: Map,            color: 'text-teal-600',    bg: 'bg-teal-50' },
    { href: '/budget',    label: t('menu_budget'),       icon: Wallet,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { href: '/packing',   label: t('menu_packing'),      icon: Luggage,        color: 'text-amber-600',   bg: 'bg-amber-50' },
    { href: '/lifestyle', label: 'LifeStyle',            icon: Heart,          color: 'text-pink-500',    bg: 'bg-pink-50' },
    { href: '/weather',   label: t('menu_weather'),      icon: Cloud,          color: 'text-sky-500',     bg: 'bg-sky-50' },
    { href: '/tools',     label: t('menu_tools'),        icon: ArrowLeftRight, color: 'text-blue-500',    bg: 'bg-blue-50' },
    { href: '/emergency', label: t('menu_emergency'),    icon: AlertTriangle,  color: 'text-red-500',     bg: 'bg-red-50' },
    { href: '/partners',  label: t('menu_partners'),     icon: Smartphone,     color: 'text-sky-500',     bg: 'bg-sky-50' },
  ]

  const generalItems = [
    { href: '/shared',    label: t('menu_shared_trips'), icon: Users,  color: 'text-orange-500', bg: 'bg-orange-50' },
    { href: '/community', label: t('menu_community'),    icon: Globe,  color: 'text-green-500',  bg: 'bg-green-50' },
  ]

  const otherTrips = trips?.filter(tp => tp.id !== currentTrip?.id) ?? []

  function handleSwitchTrip(tripId: string) {
    setCurrentTripId(tripId)
    setShowSwitcher(false)
    setOpen(false)
  }

  // Focus management + ESC close + scroll lock
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus close button shortly after open for screen readers
    const t1 = setTimeout(() => closeRef.current?.focus(), 80)

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(t1)
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
      // Return focus to trigger
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <>
      {/* Trigger button — glass pill */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-tour="hamburger-btn"
        aria-label="פתח תפריט ניווט"
        aria-expanded={open}
        aria-controls="app-nav-menu"
        aria-haspopup="menu"
        className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        <Menu className="w-5 h-5 text-gray-700" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(15,12,40,0.35)', backdropFilter: 'blur(2px)' }}
              aria-hidden="true"
            />

            {/* Slide panel */}
            <motion.div
              ref={panelRef}
              id="app-nav-menu"
              role="dialog"
              aria-modal="true"
              aria-label="תפריט ניווט ראשי"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
              className="fixed top-0 right-0 bottom-0 w-[300px] z-[70] overflow-y-auto"
              style={{
                background: '#FAFAFA',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.15)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Panel gradient header */}
              <div
                className="px-5 pt-5 pb-4"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="סגור תפריט"
                    className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                  >
                    <X className="w-5 h-5 text-white" aria-hidden="true" />
                  </button>
                  <span className="text-lg font-bold text-white tracking-tight">Tripix</span>
                </div>

                {/* User info */}
                {displayName && (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm"
                      aria-hidden="true"
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{displayName}</p>
                      <p className="text-white/70 text-[11px]">חשבון פעיל</p>
                    </div>
                  </div>
                )}
              </div>

              <nav aria-label="פעולות וטיולים" className="p-4 flex flex-col gap-3">

                {/* ── Active trip card + inline switcher ─────────────────── */}
                {currentTrip && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => { setOpen(false); router.push('/dashboard') }}
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}
                        aria-label="עבור לדשבורד של הטיול הנוכחי"
                      >
                        <Plane className="w-5 h-5 text-white" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSwitcher(s => !s)}
                        aria-expanded={showSwitcher}
                        aria-controls="trip-switcher-list"
                        aria-label={`טיול פעיל: ${currentTrip.name}. החלף טיול`}
                        className="flex-1 min-w-0 text-right active:opacity-70 transition-opacity focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                      >
                        <p className="text-sm font-bold truncate">{currentTrip.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{currentTrip.destination}</p>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">פעיל</span>
                        {otherTrips.length > 0 && (
                          <span aria-hidden="true" className="inline-flex">
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showSwitcher ? 'rotate-180' : ''}`}
                            />
                          </span>
                        )}
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {showSwitcher && otherTrips.length > 0 && (
                        <motion.div
                          key="switcher"
                          id="trip-switcher-list"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-gray-100"
                        >
                          <div className="px-2 py-1.5 space-y-0.5" role="list">
                            <p className="text-[10px] text-gray-400 font-semibold px-1 py-0.5">החלפת טיול</p>
                            {otherTrips.map(trip => (
                              <button
                                key={trip.id}
                                type="button"
                                onClick={() => handleSwitchTrip(trip.id)}
                                role="listitem"
                                aria-label={`החלף לטיול ${trip.name} ב${trip.destination}`}
                                className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl active:bg-primary/5 transition-all text-right focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                                  <Plane className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-700 truncate">{trip.name}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{trip.destination}</p>
                                </div>
                                <Check className="w-3 h-3 text-gray-200 opacity-0" aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Primary actions */}
                <div className="space-y-2">
                  <Link href="/trips/new" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl active:scale-[0.98] transition-all text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[48px]"
                    style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                    <PlusCircle className="w-5 h-5 text-white" aria-hidden="true" />
                    <span className="text-sm font-bold">{t('menu_new_trip')}</span>
                  </Link>
                  <Link href="/trips" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/8 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[48px]"
                    style={{ backgroundColor: 'rgba(108,71,255,0.08)' }}>
                    <FolderOpen className="w-5 h-5 text-primary" aria-hidden="true" />
                    <span className="text-sm font-bold text-primary">{t('menu_my_trips')}</span>
                  </Link>
                </div>

                {/* Trip tools */}
                <div>
                  <h3 id="menu-tools-heading" className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 px-1">
                    {t('menu_trip_tools')}
                  </h3>
                  <ul className="bg-white rounded-2xl border border-gray-100 overflow-hidden" aria-labelledby="menu-tools-heading">
                    {tripTools.map((item, i) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-3 min-h-[48px] active:bg-gray-50 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary ${i < tripTools.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`} aria-hidden="true">
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* General */}
                <div>
                  <h3 id="menu-general-heading" className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 px-1">
                    {t('menu_general')}
                  </h3>
                  <ul className="bg-white rounded-2xl border border-gray-100 overflow-hidden" aria-labelledby="menu-general-heading">
                    {generalItems.map((item, i) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-3 min-h-[48px] active:bg-gray-50 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary ${i < generalItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`} aria-hidden="true">
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-1">
                  <Link href="/settings" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] border-b border-gray-50 active:bg-gray-50 transition-all focus-visible:ring-2 focus-visible:ring-primary">
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center" aria-hidden="true">
                      <Settings className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">הגדרות</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); signOut() }}
                    className="flex items-center gap-3 px-3 py-3 min-h-[48px] w-full active:bg-red-50 transition-all focus-visible:ring-2 focus-visible:ring-red-400"
                    aria-label="התנתק מהחשבון"
                  >
                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center" aria-hidden="true">
                      <LogOut className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-sm font-medium text-red-500">התנתקות</span>
                  </button>
                </div>

                <p className="text-[10px] text-gray-300 text-center pb-2">Tripix v1.0</p>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
