'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('נא למלא את כל השדות'); return }

    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('התחברת בהצלחה!')
      router.push('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהתחברות')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">Tripix</h1>
          <p className="text-gray-500 text-sm">מנהל טיול חכם</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-center">התחברות</h2>

          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="אימייל" dir="ltr"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left" />

          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמא" dir="ltr"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left" />

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white rounded-xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          אין לך חשבון?{' '}
          <Link href="/auth/signup" className="text-primary font-medium">הרשם עכשיו</Link>
        </p>
      </div>
    </div>
  )
}
