'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { signUp } from '@/lib/auth'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) { toast.error('נא למלא את כל השדות'); return }
    if (password.length < 6) { toast.error('סיסמא חייבת להכיל לפחות 6 תווים'); return }

    setLoading(true)
    try {
      await signUp(email, password, name)
      toast.success('נרשמת בהצלחה!')
      router.push('/trips/new')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהרשמה')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">Tripix</h1>
          <p className="text-gray-500 text-sm">צור חשבון חדש</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-center">הרשמה</h2>

          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="שם מלא" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />

          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="אימייל" dir="ltr"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left" />

          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמא (לפחות 6 תווים)" dir="ltr"
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-left" />

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white rounded-xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'נרשם...' : 'צור חשבון'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          כבר יש לך חשבון?{' '}
          <Link href="/auth/login" className="text-primary font-medium">התחבר</Link>
        </p>
      </div>
    </div>
  )
}
