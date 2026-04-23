'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Globe, Users, TrendingUp, Star, MapPin, DollarSign, Calendar, Heart, MessageCircle, Share2 } from 'lucide-react'

// Mock community data (will be real when users start sharing)
const POPULAR_DESTINATIONS = [
  { name: 'תאילנד', nameEn: 'Thailand', flag: '🇹🇭', trips: 1243, avgBudget: 18500, avgDays: 14, rating: 4.7, topSeason: 'נובמבר-מרץ', image: '🏖️' },
  { name: 'יפן', nameEn: 'Japan', flag: '🇯🇵', trips: 892, avgBudget: 28000, avgDays: 12, rating: 4.9, topSeason: 'אפריל, אוקטובר', image: '🗾' },
  { name: 'יוון', nameEn: 'Greece', flag: '🇬🇷', trips: 1567, avgBudget: 12000, avgDays: 8, rating: 4.5, topSeason: 'יוני-ספטמבר', image: '🏛️' },
  { name: 'איטליה', nameEn: 'Italy', flag: '🇮🇹', trips: 1345, avgBudget: 15000, avgDays: 10, rating: 4.6, topSeason: 'אפריל-יוני, ספטמבר', image: '🍕' },
  { name: 'פורטוגל', nameEn: 'Portugal', flag: '🇵🇹', trips: 678, avgBudget: 10000, avgDays: 7, rating: 4.4, topSeason: 'מאי-אוקטובר', image: '🏄' },
  { name: 'ברצלונה', nameEn: 'Spain', flag: '🇪🇸', trips: 1100, avgBudget: 9500, avgDays: 5, rating: 4.5, topSeason: 'מאי-יוני, ספטמבר', image: '💃' },
]

const COMMUNITY_TIPS = [
  { destination: 'תאילנד', user: 'מיכל ר.', tip: 'הביאו תרופות לבטן מהארץ, פה יקר', likes: 34, daysAgo: 2 },
  { destination: 'תאילנד', user: 'דוד כ.', tip: 'Grab זול הרבה יותר מטוקטוק', likes: 67, daysAgo: 5 },
  { destination: 'יפן', user: 'נועה ל.', tip: 'IC Card חובה — חוסך המון זמן בתחבורה', likes: 45, daysAgo: 1 },
  { destination: 'יוון', user: 'עומר ב.', tip: 'סנטוריני שווה רק 2-3 לילות, לא יותר', likes: 89, daysAgo: 3 },
  { destination: 'איטליה', user: 'רוני ש.', tip: 'הזמינו טוסקנה מראש — נגמר מהר', likes: 23, daysAgo: 7 },
]

const SHARED_TRIPS = [
  { title: 'תאילנד 3 שבועות — זוג + תינוק', destination: 'תאילנד', days: 21, budget: 25000, travelers: 'זוג + תינוק', rating: 5, user: 'אומר ה.' },
  { title: 'סקי באוסטריה — 4 חברים', destination: 'אוסטריה', days: 7, budget: 8000, travelers: '4 חברים', rating: 4, user: 'יובל מ.' },
  { title: 'רווקים באמסטרדם', destination: 'הולנד', days: 4, budget: 6500, travelers: '6 חברים', rating: 5, user: 'איתי כ.' },
  { title: 'ירח דבש ביוון', destination: 'יוון', days: 10, budget: 18000, travelers: 'זוג', rating: 5, user: 'שירה ד.' },
]

type Tab = 'destinations' | 'tips' | 'trips'

export default function CommunityPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('destinations')
  const [selectedDest, setSelectedDest] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-bl from-[#1D9E75] to-[#146B50] text-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="חזרה"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <h1 className="text-lg font-bold">קהילת Tripix</h1>
          <div className="w-11" aria-hidden="true" />
        </div>
        <p className="text-sm opacity-80 text-center">למד מטיולים של אחרים. שתף את שלך.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b px-2 sticky top-0 z-10">
        {[
          { key: 'destinations' as Tab, label: 'יעדים פופולריים', icon: Globe },
          { key: 'tips' as Tab, label: 'טיפים', icon: MessageCircle },
          { key: 'trips' as Tab, label: 'טיולים משותפים', icon: Users },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              tab === t.key ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {/* Destinations Tab */}
        {tab === 'destinations' && (
          <div className="space-y-3">
            {POPULAR_DESTINATIONS.map((dest, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{dest.flag}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium">{dest.rating}</span>
                      </div>
                      <h3 className="font-bold text-sm">{dest.name}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <DollarSign className="w-3.5 h-3.5 mx-auto text-green-500 mb-0.5" />
                        <p className="text-xs font-bold">₪{dest.avgBudget.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">תקציב ממוצע</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <Calendar className="w-3.5 h-3.5 mx-auto text-blue-500 mb-0.5" />
                        <p className="text-xs font-bold">{dest.avgDays} ימים</p>
                        <p className="text-[10px] text-gray-400">ממוצע</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                      <span>{dest.trips} טיולים</span>
                      <span>עונה: {dest.topSeason}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tips Tab */}
        {tab === 'tips' && (
          <div className="space-y-3">
            {COMMUNITY_TIPS.map((tip, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400">לפני {tip.daysAgo} ימים</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{tip.user}</span>
                    <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{tip.destination}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-right">💡 {tip.tip}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button className="flex items-center gap-1 text-xs text-gray-400 active:scale-95">
                    <Share2 className="w-3.5 h-3.5" />
                    שתף
                  </button>
                  <button className="flex items-center gap-1 text-xs text-gray-400 active:scale-95">
                    <Heart className="w-3.5 h-3.5" />
                    {tip.likes}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Shared Trips Tab */}
        {tab === 'trips' && (
          <div className="space-y-3">
            {SHARED_TRIPS.map((trip, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-transform cursor-pointer"
              >
                <h3 className="font-bold text-sm mb-1 text-right">{trip.title}</h3>
                <div className="flex items-center gap-1 justify-end mb-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-3 h-3 ${s <= trip.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{trip.user}</span>
                  <div className="flex items-center gap-3">
                    <span>{trip.days} ימים</span>
                    <span>₪{trip.budget.toLocaleString()}</span>
                    <span>{trip.travelers}</span>
                  </div>
                </div>
              </motion.div>
            ))}

            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">רוצה לשתף את הטיול שלך?</p>
              <button className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium active:scale-95">
                שתף את הטיול שלי
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
