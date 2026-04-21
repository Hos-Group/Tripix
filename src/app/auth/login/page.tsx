'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ScanFace, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { signIn } from '@/lib/auth'
import { Analytics, identifyUser } from '@/lib/analytics'

const REMEMBER_KEY = 'tripix_remember'
const BIOMETRIC_KEY = 'tripix_biometric'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const router = useRouter()

  useEffect(() => {
    // Load saved credentials
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      try {
        const { email: e } = JSON.parse(saved)
        setEmail(e)
        setRememberMe(true)
      } catch { /* ignore */ }
    }

    // Check biometric availability (WebAuthn)
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().then(available => {
        setBiometricAvailable(available)
      })
    }
  }, [])

  const validate = () => {
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'נא להזין כתובת אימייל'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'כתובת אימייל אינה תקינה'
    if (!password) next.password = 'נא להזין סיסמא'
    else if (password.length < 6) next.password = 'סיסמא חייבת להכיל לפחות 6 תווים'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const session = await signIn(email, password)

      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }))
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      if (session?.user?.id) {
        identifyUser(session.user.id, { email: email.toLowerCase().trim() })
      }
      Analytics.signedIn('email')

      toast.success('התחברת בהצלחה!')
      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בהתחברות'
      setErrors({ form: message })
      toast.error(message)
    }
    setLoading(false)
  }

  const handleBiometric = async () => {
    const bioData = localStorage.getItem(BIOMETRIC_KEY)
    if (!bioData) {
      toast.error('יש להתחבר עם סיסמא פעם ראשונה כדי להפעיל Face ID')
      return
    }

    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname,
          allowCredentials: [],
        }
      })

      if (credential) {
        const { email: e, password: p } = JSON.parse(bioData)
        setLoading(true)
        await signIn(e, p)
        toast.success('התחברת עם Face ID!')
        router.push('/dashboard')
      }
    } catch {
      try {
        const { email: e, password: p } = JSON.parse(bioData)
        setLoading(true)
        await signIn(e, p)
        toast.success('התחברת בהצלחה!')
        router.push('/dashboard')
      } catch {
        toast.error('שגיאה בהתחברות')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1
            className="text-4xl font-black mb-2"
            style={{
              background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Tripix
          </h1>
          <p className="text-gray-500 text-sm">מנהל טיול חכם</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-describedby={errors.form ? 'login-form-error' : undefined}
          className="bg-white rounded-3xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-bold text-center">התחברות</h2>

          {errors.form && (
            <div
              id="login-form-error"
              role="alert"
              className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 font-medium"
            >
              {errors.form}
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-xs font-semibold text-gray-700">
              אימייל <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(s => ({ ...s, email: undefined })) }}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'login-email-err' : undefined}
              placeholder="name@example.com"
              className={`w-full bg-gray-50 rounded-2xl px-4 py-3 min-h-[48px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white text-left transition-all ${
                errors.email ? 'ring-2 ring-red-300 bg-red-50/50' : ''
              }`}
            />
            {errors.email && (
              <p id="login-email-err" role="alert" className="text-[11px] font-medium text-red-500 px-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-xs font-semibold text-gray-700">
              סיסמא <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(s => ({ ...s, password: undefined })) }}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'login-pass-err' : undefined}
                className={`w-full bg-gray-50 rounded-2xl px-4 py-3 pl-12 min-h-[48px] text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white text-left transition-all ${
                  errors.password ? 'ring-2 ring-red-300 bg-red-50/50' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'הסתר סיסמא' : 'הצג סיסמא'}
                aria-pressed={showPassword}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 active:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.password && (
              <p id="login-pass-err" role="alert" className="text-[11px] font-medium text-red-500 px-1">
                {errors.password}
              </p>
            )}
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="sr-only peer"
            />
            <span
              aria-hidden="true"
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                rememberMe ? 'border-transparent' : 'border-gray-300'
              }`}
              style={rememberMe ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : {}}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-sm text-gray-600">זכור אותי</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className="w-full text-white rounded-2xl py-3.5 min-h-[52px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? 'מתחבר…' : 'התחבר'}
          </button>

          {/* Face ID / Biometric */}
          {biometricAvailable && (
            <button
              type="button"
              onClick={handleBiometric}
              disabled={loading}
              aria-label="התחבר באמצעות Face ID או טביעת אצבע"
              className="w-full border-2 border-gray-200 rounded-2xl py-3 min-h-[52px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ScanFace className="w-5 h-5" aria-hidden="true" />
              התחבר עם Face ID
            </button>
          )}
        </form>

        <p className="text-center text-sm text-gray-500">
          אין לך חשבון?{' '}
          <Link
            href="/auth/signup"
            className="text-primary font-bold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            הרשם עכשיו
          </Link>
        </p>
      </div>
    </div>
  )
}
