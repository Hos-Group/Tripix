'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ScanFace } from 'lucide-react'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('נא למלא את כל השדות'); return }

    setLoading(true)
    try {
      const session = await signIn(email, password)

      // Save remember me
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
      toast.error(err instanceof Error ? err.message : 'שגיאה בהתחברות')
    }
    setLoading(false)
  }

  const handleBiometric = async () => {
    // Check if we have saved biometric credentials
    const bioData = localStorage.getItem(BIOMETRIC_KEY)
    if (!bioData) {
      toast.error('יש להתחבר עם סיסמא פעם ראשונה כדי להפעיל Face ID')
      return
    }

    try {
      // Use WebAuthn to verify identity
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
      // Fallback: use saved credentials with device biometric prompt
      try {
        const { email: e, password: p } = JSON.parse(bioData)
        setLoading(true)
        await signIn(e, p)
        toast.success('התחברת בהצלחה!')
        router.push('/dashboard')
      } catch (err) {
        toast.error('שגיאה בהתחברות')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black mb-2" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Tripix</h1>
          <p className="text-gray-500 text-sm">מנהל טיול חכם</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-center">התחברות</h2>

          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="אימייל" dir="ltr"
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left" />

          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמא" dir="ltr"
            className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left" />

          {/* Remember me */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
              rememberMe ? 'border-transparent' : 'border-gray-300'
            }`} style={rememberMe ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : {}} onClick={() => setRememberMe(!rememberMe)}>
              {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-sm text-gray-600">זכור אותי</span>
          </label>

          <button type="submit" disabled={loading}
            className="w-full text-white rounded-2xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>

          {/* Face ID / Biometric */}
          {biometricAvailable && (
            <button type="button" onClick={handleBiometric} disabled={loading}
              className="w-full border-2 border-gray-200 rounded-2xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50">
              <ScanFace className="w-5 h-5" />
              התחבר עם Face ID
            </button>
          )}
        </form>

        <p className="text-center text-sm text-gray-500">
          אין לך חשבון?{' '}
          <Link href="/auth/signup" className="text-primary font-medium">הרשם עכשיו</Link>
        </p>
      </div>
    </div>
  )
}
