'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function SkipLink() {
  const { t } = useLanguage()
  return (
    <a href="#main-content" className="skip-link">
      {t('nav_skip_to_main')}
    </a>
  )
}
