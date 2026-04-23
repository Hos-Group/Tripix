'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plane, Receipt, ScanLine, Package, FileText, Map } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { tFormat } from '@/lib/i18n'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function OnboardingPage() {
  const { user, displayName } = useAuth()
  const { t, dir, lang } = useLanguage()
  const router = useRouter()

  const FEATURES = [
    {
      icon: Receipt,
      color: 'bg-blue-50 text-blue-500',
      title: t('onb_feature_expenses'),
      desc:  t('onb_feature_expenses_desc'),
    },
    {
      icon: ScanLine,
      color: 'bg-green-50 text-green-500',
      title: t('onb_feature_scan'),
      desc:  t('onb_feature_scan_desc'),
    },
    {
      icon: Package,
      color: 'bg-orange-50 text-orange-500',
      title: t('onb_feature_packing'),
      desc:  t('onb_feature_packing_desc'),
    },
    {
      icon: FileText,
      color: 'bg-purple-50 text-purple-500',
      title: t('onb_feature_docs'),
      desc:  t('onb_feature_docs_desc'),
    },
    {
      icon: Map,
      color: 'bg-pink-50 text-pink-500',
      title: t('onb_feature_timeline'),
      desc:  t('onb_feature_timeline_desc'),
    },
  ]

  const handleStart = () => {
    if (user) {
      localStorage.setItem(`tripix_onboarded_${user.id}`, 'true')
    }
    router.push('/trips/new')
  }

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gray-50 pb-10"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
    >
      {/* Top-right: language switcher */}
      <div
        className="fixed top-0 right-0 z-50 p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingRight: '16px' }}
      >
        <LanguageSwitcher />
      </div>

      {/* Header gradient */}
      <div className="bg-gradient-to-br from-primary to-primary-dark px-6 pt-16 pb-12 text-white text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Plane className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold mb-1">{t('onb_welcome')}</h1>
          {displayName && (
            <p className="text-white/90 text-lg mt-1">
              {tFormat('onb_hello_user', lang, { name: displayName })} 👋
            </p>
          )}
          <p className="text-white/80 text-sm mt-2 leading-relaxed">
            {t('onb_subtitle')}
          </p>
        </motion.div>
      </div>

      {/* Features list */}
      <section aria-labelledby="features-heading" className="px-4 mt-6 space-y-3">
        <h2 id="features-heading" className="text-center text-sm text-gray-600 font-semibold mb-4">
          {t('onb_features_heading')}
        </h2>

        <ul className="space-y-3" role="list">
          {FEATURES.map((f, i) => (
            <motion.li
              key={f.title}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.09 }}
              className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`} aria-hidden="true">
                <f.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-800">{f.title}</h3>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <div className="px-4 mt-8">
        <motion.button
          type="button"
          onClick={handleStart}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="w-full bg-primary text-white rounded-2xl py-4 min-h-[56px] font-bold text-base active:scale-95 transition-transform shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          {t('onb_cta_first_trip')}
        </motion.button>
        <p className="text-center text-xs text-gray-500 mt-3">
          {t('onb_can_change')}
        </p>
      </div>
    </div>
  )
}
