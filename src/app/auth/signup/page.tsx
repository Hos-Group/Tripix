'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { signIn, signOut } from '@/lib/auth'
import { Analytics, identifyUser } from '@/lib/analytics'

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

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

  const pwLabel  = ['', 'חלשה', 'בינונית', 'טובה', 'חזקה', 'מצוינת'][pwStrength]
  const pwColor  = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-emerald-500'][pwStrength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) {
      toast.error('נא למלא את כל השדות')
      return
    }
    if (password.length < 6) {
      toast.error('הסיסמא חייבת להכיל לפחות 6 תווים')
      return
    }

    setLoading(true)
    try {
      // ── Step 1: Call the SERVER-SIDE API route ───────────────────────────────
      // This runs on Vercel — NOT in the browser.
      // The server creates the user with email already confirmed.
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
        toast.error(json.error || 'שגיאה בהרשמה')
        setLoading(false)
        return
      }

      // ── Step 2: Clear any existing session ────────────────────────────────────
      await signOut().catch(() => {})

      // ── Step 3: Sign in immediately (no email confirmation needed) ───────────
      const session = await signIn(email.toLowerCase().trim(), password)

      // Track signup
      if (session?.user?.id) {
        identifyUser(session.user.id, { email: email.toLowerCase().trim(), name: name.trim() })
      }
      Analytics.signedUp('email')

      toast.success('ברוך הבא לטריפיקס! 🎉')
      router.push('/onboarding')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהרשמה')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-black mb-1" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Tripix ✈️</h1>
          <p className="text-gray-500 text-sm">צור חשבון ותתחיל לתכנן את הטיול שלך</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-center">הרשמה</h2>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי"
              autoComplete="name"
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              dir="ltr"
              autoComplete="email"
              className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">סיסמא</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                dir="ltr"
                autoComplete="new-password"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 active:scale-90"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength bar */}
            {password.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= pwStrength ? pwColor : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[11px] font-medium text-left ${
                  pwStrength <= 1 ? 'text-red-400' : pwStrength <= 2 ? 'text-orange-400' : 'text-green-500'
                }`}>
                  סיסמא {pwLabel}
                </p>
              </div>
            )}
          </div>

          {/* Benefits list */}
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 space-y-1.5">
            {['ניהול הוצאות בכל מטבע', 'סריקת קבלות חכמה', 'שיתוף עם הנוסעים'].map(item => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-xs text-gray-600">{item}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white rounded-2xl py-3.5 font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'יוצר חשבון...' : '🚀 צור חשבון'}
          </button>

          {/* Fine print */}
          <p className="text-center text-[11px] text-gray-400">
            ללא צורך באישור אימייל — מתחילים מיד!
          </p>
        </form>

        <p className="text-center text-sm text-gray-500">
          כבר יש לך חשבון?{' '}
          <Link href="/auth/login" className="text-primary font-medium">התחבר</Link>
        </p>
      </div>
    </div>
  )
}
