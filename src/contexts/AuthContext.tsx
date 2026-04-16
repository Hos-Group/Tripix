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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
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
        // Network failure — don't hang forever on the loading screen
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

    // Safety timeout: if auth hasn't resolved in 5s, unblock the UI
    const timeout = setTimeout(() => setLoading(false), 5000)

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-2">Tripix</h1>
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
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
