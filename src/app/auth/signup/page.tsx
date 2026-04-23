'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { signIn, signOut } from '@/lib/auth'
import { Analytics, identifyUser } from '@/lib/analytics'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { tFormat } from '@/lib/i18n'

export default function SignupPage() {
  const { t, dir, lang } = useLanguage()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({})
  const router = useRouter()

  const pwStrengthId = useId()

  // Password strength
  const pwStrength = (() => {
    if (password.length === 0) return 0
    let s = 0
    if (password.length >= 6)  s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s // 0-5
  })()

  const pwLabelKeys = ['', 'auth_pw_weak', 'auth_pw_medium', 'auth_pw_good', 'auth_pw_strong', 'auth_pw_excellent'] as const
  const pwLabel = pwStrength > 0 ? t(pwLabelKeys[pwStrength] as 'auth_pw_weak') : ''
  const pwColor  = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-emerald-500'][pwStrength]

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = t('auth_err_name_required')
    else if (name.trim().length < 2) next.name = t('auth_err_name_short')
    if (!email.trim()) next.email = t('auth_err_email_required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('auth_err_email_invalid')
    if (!password) next.password = t('auth_err_password_required')
    else if (password.length < 6) next.password = t('auth_err_password_short')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    email.toLowerCase().trim(),
          password,
          fullName: name.trim(),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        const message = json.error || t('auth_err_signup')
        setErrors({ form: message })
        toast.error(message)
        setLoading(false)
        return
      }

      await signOut().catch(() => {})

      const session = await signIn(email.toLowerCase().trim(), password)

      if (session?.user?.id) {
        identifyUser(session.user.id, { email: email.toLowerCase().trim(), name: name.trim() })
      }
      Analytics.signedUp('email')

      toast.success(t('auth_welcome_signup'))
      router.push('/onboarding')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth_err_signup')
      setErrors({ form: message })
      toast.error(message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50 py-8" dir={dir}>
      {/* Top-right: language switcher */}
      <div
        className="fixed top-0 right-0 z-50 p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingRight: '16px' }}
      >
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1
            className="text-4xl font-black mb-1"
            style={{
              background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Tripix
          </h1>
          <p className="text-gray-500 text-sm">{t('auth_signup_desc')}</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-describedby={errors.form ? 'signup-form-error' : undefined}
          className="bg-white rounded-3xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-bold text-center">{t('auth_signup_title')}</h2>

          {errors.form && (
            <div
              id="signup-form-error"
              role="alert"
              className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 font-medium"
            >
              {errors.form}
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-name" className="text-xs font-semibold text-gray-700">
              {t('auth_full_name')} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(s => ({ ...s, name: undefined })) }}
              placeholder={t('auth_full_name_ph')}
              autoComplete="name"
              required
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'signup-name-err' : undefined}
              className={`w-full bg-gray-50 rounded-2xl px-4 py-3 min-h-[48px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white transition-all ${
                errors.name ? 'ring-2 ring-red-300 bg-red-50/50' : ''
              }`}
            />
            {errors.name && (
              <p id="signup-name-err" role="alert" className="text-[11px] font-medium text-red-500 px-1">
                {errors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-email" className="text-xs font-semibold text-gray-700">
              {t('auth_email')} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="signup-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(s => ({ ...s, email: undefined })) }}
              placeholder={t('auth_email_ph')}
              dir="ltr"
              autoComplete="email"
              required
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'signup-email-err' : undefined}
              className={`w-full bg-gray-50 rounded-2xl px-4 py-3 min-h-[48px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white text-left transition-all ${
                errors.email ? 'ring-2 ring-red-300 bg-red-50/50' : ''
              }`}
            />
            {errors.email && (
              <p id="signup-email-err" role="alert" className="text-[11px] font-medium text-red-500 px-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-password" className="text-xs font-semibold text-gray-700">
              {t('auth_password')} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(s => ({ ...s, password: undefined })) }}
                placeholder={t('auth_password_hint_short')}
                dir="ltr"
                autoComplete="new-password"
                required
                minLength={6}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={`${pwStrengthId}${errors.password ? ' signup-password-err' : ''}`}
                className={`w-full bg-gray-50 rounded-2xl px-4 py-3 pl-12 min-h-[48px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white text-left transition-all ${
                  errors.password ? 'ring-2 ring-red-300 bg-red-50/50' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? t('auth_hide_password') : t('auth_show_password')}
                aria-pressed={showPw}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 active:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {showPw ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>

            {errors.password && (
              <p id="signup-password-err" role="alert" className="text-[11px] font-medium text-red-500 px-1">
                {errors.password}
              </p>
            )}

            {/* Password strength bar */}
            {password.length > 0 && (
              <div id={pwStrengthId} className="space-y-1 pt-1" aria-live="polite">
                <div className="flex gap-1" role="meter" aria-label={t('auth_pw_meter')} aria-valuenow={pwStrength} aria-valuemin={0} aria-valuemax={5}>
                  {[1,2,3,4,5].map(i => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= pwStrength ? pwColor : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[11px] font-medium text-left ${
                  pwStrength <= 1 ? 'text-red-500' : pwStrength <= 2 ? 'text-orange-500' : 'text-emerald-600'
                }`}>
                  {tFormat('auth_pw_label', lang, { strength: pwLabel })}
                </p>
              </div>
            )}
          </div>

          {/* Benefits list */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 space-y-1.5" aria-label={t('auth_benefits_title')}>
            {[t('auth_benefit_1'), t('auth_benefit_2'), t('auth_benefit_3')].map(item => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-gray-600">{item}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className="w-full text-white rounded-2xl py-3.5 min-h-[52px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? t('auth_creating') : t('auth_signup_btn')}
          </button>

          {/* Fine print */}
          <p className="text-center text-[11px] text-gray-400">
            {t('auth_no_email_confirm')}
          </p>
        </form>

        <p className="text-center text-sm text-gray-500">
          {t('auth_have_account')}{' '}
          <Link
            href="/auth/login"
            className="text-primary font-bold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {t('auth_login_link')}
          </Link>
        </p>
      </div>
    </div>
  )
}
