'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, User, AlertTriangle, Wallet, Luggage, ArrowLeftRight, Settings, LogOut, Cloud, Plane, Users, Sparkles, Map, Camera, Globe, PlusCircle, FolderOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTrip } from '@/contexts/TripContext'

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const { currentTrip } = useTrip()

  // Primary actions — always visible at top
  const primaryItems = [
    { href: '/trips/new', label: 'צור טיול חדש', icon: PlusCircle, color: 'text-white', bg: 'bg-primary' },
    { href: '/trips', label: 'הטיולים שלי', icon: FolderOpen, color: 'text-primary', bg: 'bg-primary/10' },
  ]

  // Trip-specific tools — only show when a trip is selected
  const tripTools = [
    { href: '/assistant', label: 'עוזר AI חכם', icon: Sparkles, color: 'text-indigo-500' },
    { href: '/itinerary', label: 'לוח מסע', icon: Map, color: 'text-teal-500' },
    { href: '/memories', label: 'זיכרונות טיול', icon: Camera, color: 'text-purple-500' },
    { href: '/budget', label: 'מעקב תקציב', icon: Wallet, color: 'text-green-600' },
    { href: '/packing', label: 'רשימת אריזה', icon: Luggage, color: 'text-amber-500' },
    { href: '/weather', label: 'מזג אוויר', icon: Cloud, color: 'text-sky-500' },
    { href: '/tools', label: 'כלים (המרה / טיפ)', icon: ArrowLeftRight, color: 'text-blue-500' },
    { href: '/emergency', label: 'מצב חירום', icon: AlertTriangle, color: 'text-red-500' },
  ]

  // General features
  const generalItems = [
    { href: '/shared', label: 'טיולים משותפים', icon: Users, color: 'text-orange-500' },
    { href: '/community', label: 'קהילת Tripix', icon: Globe, color: 'text-green-500' },
  ]

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center active:scale-95 transition-transform">
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)} className="fixed inset-0 bg-black/30 z-[60]" />

            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white z-[70] shadow-2xl overflow-y-auto"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
              <div className="p-5 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <button onClick={() => setOpen(false)} className="active:scale-95">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                  <span className="text-lg font-bold text-primary">Tripix</span>
                </div>

                {/* Current trip info */}
                {currentTrip && (
                  <Link href="/dashboard" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 mb-4 p-3 bg-primary/5 rounded-xl border border-primary/10 active:scale-[0.98]">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <Plane className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{currentTrip.name}</p>
                      <p className="text-[10px] text-gray-400">{currentTrip.destination}</p>
                    </div>
                    <span className="text-[10px] text-primary font-medium">פעיל</span>
                  </Link>
                )}

                {/* Primary actions */}
                <div className="space-y-2 mb-4">
                  {primaryItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-xl active:scale-[0.98] transition-all ${item.bg}`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                      <span className={`text-sm font-bold ${item.color}`}>{item.label}</span>
                    </Link>
                  ))}
                </div>

                {/* Trip tools */}
                <p className="text-[10px] text-gray-400 font-medium mb-1 px-1">כלי טיול</p>
                <div className="space-y-0.5 mb-3">
                  {tripTools.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all">
                      <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  ))}
                </div>

                {/* General */}
                <div className="border-t pt-3 mb-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-1 px-1">כללי</p>
                  <div className="space-y-0.5">
                    {generalItems.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all">
                        <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Settings */}
                <div className="border-t pt-3 mt-auto">
                  <Link href="/settings" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all">
                    <Settings className="w-4.5 h-4.5 text-gray-400" />
                    <span className="text-sm text-gray-500">הגדרות</span>
                  </Link>
                  <button className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all w-full">
                    <LogOut className="w-4.5 h-4.5 text-red-400" />
                    <span className="text-sm text-red-500">התנתקות</span>
                  </button>
                  <p className="text-[10px] text-gray-300 text-center mt-2">Tripix v1.0</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
