'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ExternalLink, Smartphone, ShieldCheck, Car, Star, Zap, Gift, TrendingUp, Check } from 'lucide-react'
import Link from 'next/link'

interface Partner {
  id: string
  name: string
  logo: string
  category: 'esim' | 'insurance' | 'car_rental'
  description: string
  discount: string
  rating: number
  features: string[]
  affiliateUrl: string
  promoCode?: string
  isRecommended?: boolean
}

const PARTNERS: Partner[] = [
  // eSIM Partners
  {
    id: 'airalo',
    name: 'Airalo',
    logo: '📱',
    category: 'esim',
    description: 'eSIM עם כיסוי ב-200+ מדינות. ActivatIon מיידי, ללא כרטיס פיזי.',
    discount: '10% הנחה עם קוד TRIPIX',
    rating: 4.8,
    features: ['200+ מדינות', 'הפעלה מיידית', 'תוכניות גמישות', 'אפליקציה נוחה'],
    affiliateUrl: 'https://www.airalo.com/?aff=tripix',
    promoCode: 'TRIPIX',
    isRecommended: true,
  },
  {
    id: 'holafly',
    name: 'Holafly',
    logo: '🌐',
    category: 'esim',
    description: 'eSIM עם גלישה ללא הגבלה. אידיאלי לנוסעים תכופים.',
    discount: '5% הנחה עם קוד TRIPIX5',
    rating: 4.6,
    features: ['גלישה ללא הגבלה', '170+ מדינות', 'שירות 24/7', 'תוקף עד 90 יום'],
    affiliateUrl: 'https://esim.holafly.com/?aff=tripix',
    promoCode: 'TRIPIX5',
  },
  {
    id: 'nomad',
    name: 'Nomad eSIM',
    logo: '🗺️',
    category: 'esim',
    description: 'eSIM חסכוני לנסיעות קצרות. מחירים תחרותיים לאסיה.',
    discount: 'עד 15% חיסכון לעומת רואומינג',
    rating: 4.5,
    features: ['מחירים נמוכים', 'אסיה ואירופה', 'ללא הסכם', 'שכבות מהירות'],
    affiliateUrl: 'https://www.getnomad.app/?ref=tripix',
  },
  // Insurance Partners
  {
    id: 'worldnomads',
    name: 'World Nomads',
    logo: '🛡️',
    category: 'insurance',
    description: 'ביטוח נסיעות המובחר לנוסעים פעילים. כיסוי רחב ושירות מצוין.',
    discount: 'מחיר תחרותי, כיסוי מקיף',
    rating: 4.7,
    features: ['פעילויות אקסטרים', 'כיסוי רפואי', 'ביטול נסיעה', 'חבצלת חירום 24/7'],
    affiliateUrl: 'https://www.worldnomads.com/?affiliate=tripix',
    isRecommended: true,
  },
  {
    id: 'safetywing',
    name: 'SafetyWing',
    logo: '⚕️',
    category: 'insurance',
    description: 'ביטוח בריאות ונסיעות לנוסעים ארוכי טווח. מנוי חודשי גמיש.',
    discount: 'מ-$42 לחודש',
    rating: 4.5,
    features: ['מנוי חודשי', 'כיסוי רפואי', '180 מדינות', 'אפשרות ביטול בכל עת'],
    affiliateUrl: 'https://safetywing.com/?referral=tripix',
  },
  {
    id: 'battleface',
    name: 'Battleface',
    logo: '🔰',
    category: 'insurance',
    description: 'ביטוח מותאם אישית לכל סוג נסיעה. כיסוי ממוקד ומחירים הוגנים.',
    discount: 'ביטוח מותאם לצרכים שלך',
    rating: 4.3,
    features: ['ביטוח מותאם', 'ביטול גמיש', 'כיסוי COVID', 'אונליין 100%'],
    affiliateUrl: 'https://battleface.com/?ref=tripix',
  },
  // Car Rental Partners
  {
    id: 'rentalcars',
    name: 'Rentalcars.com',
    logo: '🚗',
    category: 'car_rental',
    description: 'השוואת מחירים מ-900+ חברות השכרה ברחבי העולם. הטוב ביותר.',
    discount: 'מציאת המחיר הנמוך ביותר',
    rating: 4.6,
    features: ['900+ ספקים', 'ביטול חינם', 'ללא תשלום מקדמה', '60,000+ נקודות איסוף'],
    affiliateUrl: 'https://www.rentalcars.com/?affiliateCode=tripix',
    isRecommended: true,
  },
  {
    id: 'discovercars',
    name: 'Discover Cars',
    logo: '🏎️',
    category: 'car_rental',
    description: 'השכרת רכב עם ביטוח מלא כלול. ללא הפתעות מחיר.',
    discount: 'ביטוח מלא כלול במחיר',
    rating: 4.5,
    features: ['ביטוח מלא', 'ביטול חינם', 'תמיכה 24/7', 'ערבות מחיר'],
    affiliateUrl: 'https://www.discovercars.com/?a_aid=tripix',
  },
]

const CATEGORY_META = {
  esim:        { label: 'eSIM / כרטיס SIM', icon: Smartphone,  color: '#0EA5E9', bg: 'bg-sky-50',     border: 'border-sky-100' },
  insurance:   { label: 'ביטוח נסיעות',     icon: ShieldCheck, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  car_rental:  { label: 'השכרת רכב',        icon: Car,         color: '#D97706', bg: 'bg-amber-50',   border: 'border-amber-100' },
}

export default function PartnersPage() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'esim' | 'insurance' | 'car_rental'>('all')

  const filtered = PARTNERS.filter(p => activeCategory === 'all' || p.category === activeCategory)

  const handleClick = (partner: Partner) => {
    window.open(partner.affiliateUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/tools" className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-90 transition-all">
            <ChevronLeft className="w-4 h-4 text-gray-600 rotate-180" />
          </Link>
          <div className="flex-1">
            <h1 className="text-[17px] font-bold text-gray-900">שותפויות ויתרונות</h1>
            <p className="text-xs text-gray-400">eSIM • ביטוח • רכב</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50">
            <Gift className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-700">הנחות בלעדיות</span>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {(['all', 'esim', 'insurance', 'car_rental'] as const).map(cat => {
            const isAll = cat === 'all'
            const meta = isAll ? null : CATEGORY_META[cat]
            const CatIcon = meta?.icon
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
                style={activeCategory === cat ? { background: isAll ? '#6C47FF' : meta?.color } : {}}
              >
                {CatIcon && <CatIcon className="w-3.5 h-3.5" />}
                {isAll ? 'הכל' : meta?.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-28">
        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-3 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #6C47FF15 0%, #9B7BFF10 100%)', border: '1px solid #6C47FF20' }}
        >
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">הטבות בלעדיות לנוסעי Tripix</p>
            <p className="text-xs text-gray-500 mt-0.5">הזמנה דרך הקישורים תומכת ב-Tripix ועוזרת לנו להמשיך לפתח את האפליקציה</p>
          </div>
        </motion.div>

        {/* Partners Grid */}
        {filtered.map((partner, i) => {
          const meta = CATEGORY_META[partner.category]
          const CatIcon = meta.icon
          return (
            <motion.div
              key={partner.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
            >
              {/* Card Header */}
              <div className={`flex items-center gap-3 px-4 pt-4 pb-3`}>
                <div className="text-3xl leading-none">{partner.logo}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-gray-900">{partner.name}</span>
                    {partner.isRecommended && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
                        style={{ background: '#6C47FF' }}>מומלץ</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${meta.bg} border ${meta.border}`}
                      style={{ color: meta.color }}>
                      <CatIcon className="w-3 h-3" />
                      {meta.label}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-semibold text-gray-600">{partner.rating}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="px-4 pb-3">
                <p className="text-sm text-gray-600 leading-relaxed">{partner.description}</p>
              </div>

              {/* Features */}
              <div className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-1">
                  {partner.features.map(f => (
                    <div key={f} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount + CTA */}
              <div className="mx-4 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-gray-800">{partner.discount}</span>
                </div>
                {partner.promoCode && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500">קוד קופון:</span>
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{partner.promoCode}</span>
                  </div>
                )}
                <button
                  onClick={() => handleClick(partner)}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  style={{ background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}CC 100%)` }}
                >
                  <ExternalLink className="w-4 h-4" />
                  להזמנה באתר {partner.name}
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
