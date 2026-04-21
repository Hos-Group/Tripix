'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { signOut as authSignOut } from '@/lib/auth'
import type { User, Session } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  avatar_url: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  displayName: string
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  displayName: '',
  signOut: async () => {},
})

const PUBLIC_PATHS = ['/auth/login', '/auth/signup', '/']

/**
 * Check if Supabase has a non-expired session token in localStorage.
 * Avoids blocking the full page on reload for returning users.
 */
function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const ref = url.replace(/^https?:\/\//, '').split('.')[0]
    const raw = localStorage.getItem(`sb-${ref}-auth-token`)
    if (!raw) return false
    const data = JSON.parse(raw) as { expires_at?: number }
    // expires_at is in seconds — accept if not yet expired (or no expiry field)
    return !data.expires_at || data.expires_at > Date.now() / 1000
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Skip loading screen if a cached session exists — validate async in the background
  const [loading, setLoading] = useState(() => !hasStoredSession())
  const router = useRouter()
  const pathname = usePathname()

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data as Profile)
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) loadProfile(s.user.id)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('[AuthContext] getSession failed (network?):', err?.message)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) loadProfile(s.user.id)
      else setProfile(null)
      setLoading(false)
    })

    // Reduced safety timeout — 2s is enough; 5s was too long
    const timeout = setTimeout(() => setLoading(false), 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/auth/login')
    }
  }, [loading, user, pathname, router])

  const handleSignOut = async () => {
    await authSignOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    router.replace('/auth/login')
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const isAdmin = profile?.role === 'admin'

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="טוען את Tripix"
        className="min-h-screen flex items-center justify-center bg-gray-50"
      >
        <div className="text-center">
          <h1
            className="text-3xl font-black mb-3"
            style={{
              background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Tripix
          </h1>
          <div
            className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto"
            aria-hidden="true"
          />
          <span className="sr-only">טוען…</span>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isAdmin, displayName, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
