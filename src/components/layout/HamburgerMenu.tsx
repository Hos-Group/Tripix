'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Menu, X, AlertTriangle, Wallet, Luggage, ArrowLeftRight,
  Settings, LogOut, Cloud, Plane, Users, Sparkles, Map,
  Globe, PlusCircle, FolderOpen,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const { currentTrip } = useTrip()
  const { displayName, signOut } = useAuth()

  const primaryItems = [
    { href: '/trips/new', label: 'צור טיול חדש', icon: PlusCircle, isPrimary: true },
    { href: '/trips',     label: 'הטיולים שלי',   icon: FolderOpen, isPrimary: false },
  ]

  const tripTools = [
    { href: '/assistant', label: 'עוזר AI חכם',      icon: Sparkles,       color: 'text-violet-500',  bg: 'bg-violet-50' },
    { href: '/itinerary', label: 'לוח מסע',           icon: Map,            color: 'text-teal-600',    bg: 'bg-teal-50' },
    { href: '/budget',    label: 'מעקב תקציב',       icon: Wallet,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { href: '/packing',   label: 'רשימת אריזה',      icon: Luggage,        color: 'text-amber-600',   bg: 'bg-amber-50' },
    { href: '/weather',   label: 'מזג אוויר',        icon: Cloud,          color: 'text-sky-500',     bg: 'bg-sky-50' },
    { href: '/tools',     label: 'כלים (המרה / טיפ)', icon: ArrowLeftRight, color: 'text-blue-500',    bg: 'bg-blue-50' },
    { href: '/emergency', label: 'מצב חירום',        icon: AlertTriangle,  color: 'text-red-500',     bg: 'bg-red-50' },
  ]

  const generalItems = [
    { href: '/shared',    label: 'טיולים משותפים',  icon: Users,  color: 'text-orange-500', bg: 'bg-orange-50' },
    { href: '/community', label: 'קהילת Tripix',    icon: Globe,  color: 'text-green-500',  bg: 'bg-green-50' },
  ]

  return (
    <>
      {/* Trigger button — glass pill */}
      <button
        onClick={() => setOpen(true)}
        data-tour="hamburger-btn"
        className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 transition-all duration-150"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        <Menu className="w-5 h-5 text-gray-700" />
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
            />

            {/* Slide panel */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] z-[70] overflow-y-auto"
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
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition-all"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-lg font-bold text-white tracking-tight">Tripix</span>
                </div>

                {/* User info */}
                {displayName && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{displayName}</p>
                      <p className="text-white/70 text-[11px]">חשבון פעיל</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3">
                {/* Current trip card */}
                {currentTrip && (
                  <Link href="/dashboard" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-card active:scale-[0.98] transition-all">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}
                    >
                      <Plane className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{currentTrip.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{currentTrip.destination}</p>
                    </div>
                    <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">פעיל</span>
                  </Link>
                )}

                {/* Primary actions */}
                <div className="space-y-2">
                  <Link href="/trips/new" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-2xl active:scale-[0.98] transition-all text-white"
                    style={{ background: 'linear-gradient(135deg, #6C47FF, #9B7BFF)' }}>
                    <PlusCircle className="w-5 h-5 text-white" />
                    <span className="text-sm font-bold">צור טיול חדש</span>
                  </Link>
                  <Link href="/trips" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-primary/8 active:scale-[0.98] transition-all"
                    style={{ backgroundColor: 'rgba(108,71,255,0.08)' }}>
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <span className="text-sm font-bold text-primary">הטיולים שלי</span>
                  </Link>
                </div>

                {/* Trip tools */}
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 px-1">כלי טיול</p>
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {tripTools.map((item, i) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 active:bg-gray-50 active:scale-[0.98] transition-all ${i < tripTools.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <div className={`w-7 h-7 rounded-xl ${item.bg} flex items-center justify-center`}>
                          <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* General */}
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 px-1">כללי</p>
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {generalItems.map((item, i) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 active:bg-gray-50 active:scale-[0.98] transition-all ${i < generalItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <div className={`w-7 h-7 rounded-xl ${item.bg} flex items-center justify-center`}>
                          <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-1">
                  <Link href="/settings" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 active:bg-gray-50 transition-all">
                    <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Settings className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">הגדרות</span>
                  </Link>
                  <button
                    onClick={() => { setOpen(false); signOut() }}
                    className="flex items-center gap-3 px-3 py-2.5 w-full active:bg-red-50 transition-all"
                  >
                    <div className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center">
                      <LogOut className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="text-sm font-medium text-red-500">התנתקות</span>
                  </button>
                </div>

                <p className="text-[10px] text-gray-300 text-center pb-2">Tripix v1.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
