'use client'

import { useState, useEffect } from 'react'
import { User, Lock, Bell, Shield, Info, LogOut, ChevronLeft, Save, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { invalidateTravelersCache } from '@/lib/travelers'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type SettingsPage = 'main' | 'account' | 'password' | 'notifications' | 'security' | 'about'

const MENU_ITEMS = [
  { id: 'account' as const, label: 'פרטי חשבון', icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'password' as const, label: 'שינוי סיסמא', icon: Lock, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'notifications' as const, label: 'התראות', icon: Bell, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'security' as const, label: 'אבטחה ופרטיות', icon: Shield, color: 'text-green-500', bg: 'bg-green-50' },
  { id: 'about' as const, label: 'אודות', icon: Info, color: 'text-gray-500', bg: 'bg-gray-50' },
]

interface Traveler {
  id: string
  name: string
}

export default function SettingsPage() {
  const [page, setPage] = useState<SettingsPage>('main')
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const [savingTravelers, setSavingTravelers] = useState(false)

  useEffect(() => {
    const fetchTravelers = async () => {
      try {
        const { data } = await supabase.from('trips').select('travelers').limit(1).single()
        if (data?.travelers) {
          setTravelers(data.travelers as Traveler[])
        }
      } catch {
        console.error('Failed to load travelers')
      }
    }
    fetchTravelers()
  }, [])

  const handleSaveTravelers = async () => {
    setSavingTravelers(true)
    try {
      const { error } = await supabase
        .from('trips')
        .update({ travelers })
        .not('id', 'is', null)
      if (error) throw error
      invalidateTravelersCache()
      toast.success('שמות הנוסעים עודכנו')
    } catch {
      toast.error('שגיאה בשמירה')
    }
    setSavingTravelers(false)
  }

  if (page !== 'main') {
    return (
      <div className="space-y-4">
        <button onClick={() => setPage('main')}
          className="flex items-center gap-2 text-primary text-sm font-medium active:scale-95 transition-transform">
          <ChevronLeft className="w-4 h-4" />
          חזרה להגדרות
        </button>

        {page === 'account' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">פרטי חשבון</h1>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold">נוסעים</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-3">שמות באנגלית בלבד — כפי שמופיע בדרכון</p>

              {travelers.map((t, i) => (
                <div key={t.id} className="flex gap-2 items-center">
                  <span className="text-xs text-primary font-medium w-16 flex-shrink-0">
                    {i === 0 ? 'נוסע ראשי' : `נוסע ${i + 1}`}
                  </span>
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) => {
                      const updated = [...travelers]
                      updated[i] = { ...updated[i], name: e.target.value }
                      setTravelers(updated)
                    }}
                    placeholder="Full name in English"
                    dir="ltr"
                    className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left"
                  />
                  {travelers.length > 1 && i > 0 && (
                    <button onClick={() => setTravelers(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 active:scale-95 px-1">✕</button>
                  )}
                </div>
              ))}

              <button onClick={() => setTravelers(prev => [...prev, { id: `traveler_${prev.length + 1}`, name: '' }])}
                className="w-full bg-gray-50 text-gray-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 transition-transform border border-dashed border-gray-300">
                + הוספת נוסע
              </button>

              <button onClick={handleSaveTravelers} disabled={savingTravelers}
                className="w-full bg-primary text-white rounded-xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {savingTravelers ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </motion.div>
        )}

        {page === 'password' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">שינוי סיסמא</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Lock className="w-10 h-10 text-orange-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {page === 'notifications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">התראות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Bell className="w-10 h-10 text-purple-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {page === 'security' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">אבטחה ופרטיות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <Shield className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">יהיה זמין בקרוב</p>
            </div>
          </motion.div>
        )}

        {page === 'about' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h1 className="text-xl font-bold">אודות</h1>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-2">
              <p className="text-2xl font-bold text-primary">Tripix</p>
              <p className="text-sm text-gray-500">מערכת ניהול טיול חכמה</p>
              <p className="text-xs text-gray-400">גרסה 1.0.0</p>
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הגדרות</h1>

      <div className="space-y-2">
        {MENU_ITEMS.map((item) => (
          <button key={item.id} onClick={() => setPage(item.id)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform">
            <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <span className="flex-1 text-sm font-medium text-right">{item.label}</span>
            <ChevronLeft className="w-4 h-4 text-gray-300" />
          </button>
        ))}

        <button
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform mt-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <span className="flex-1 text-sm font-medium text-right text-red-500">התנתקות</span>
        </button>
      </div>
    </div>
  )
}
