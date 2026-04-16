'use client'

/**
 * /admin — Tripix Owner Dashboard
 * Shows real-time user count, trip count, Gmail connections, documents, and activity.
 * Protected: only renders if user email matches OWNER_EMAIL.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Users, Plane, FileText, Mail, TrendingUp, RefreshCw, Activity } from 'lucide-react'

// ── Owner guard ────────────────────────────────────────────────────────────────
const OWNER_EMAIL = 'omerhalevy10@gmail.com' // שנה לכתובת המייל שלך

interface Stats {
  totalUsers:      number
  activeUsers7d:   number
  totalTrips:      number
  totalDocuments:  number
  gmailConnections:number
  totalExpenses:   number
  recentSignups:   { email: string; created_at: string }[]
  topDestinations: { destination: string; count: number }[]
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Guard — redirect if not owner
  useEffect(() => {
    if (!authLoading && (!user || user.email !== OWNER_EMAIL)) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const loadStats = async () => {
    setRefreshing(true)
    try {
      // Get session token for service-role calls
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // ── Parallel queries ──────────────────────────────────────────────────
      const [
        { count: totalUsers },
        { count: totalTrips },
        { count: totalDocuments },
        { count: gmailConnections },
        { count: totalExpenses },
        { data: recentUsers },
        { data: tripDests },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('trips').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase.from('gmail_connections').select('*', { count: 'exact', head: true }),
        supabase.from('expenses').select('*', { count: 'exact', head: true }),
        supabase.from('profiles')
          .select('email, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('trips')
          .select('destination')
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      // Active users in last 7 days (from trips created)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { count: activeUsers7d } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString())

      // Top destinations
      const destCounts: Record<string, number> = {}
      for (const t of (tripDests || [])) {
        const d = t.destination?.split(',')[0]?.trim() || 'לא ידוע'
        destCounts[d] = (destCounts[d] || 0) + 1
      }
      const topDestinations = Object.entries(destCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([destination, count]) => ({ destination, count }))

      setStats({
        totalUsers:       totalUsers || 0,
        activeUsers7d:    activeUsers7d || 0,
        totalTrips:       totalTrips || 0,
        totalDocuments:   totalDocuments || 0,
        gmailConnections: gmailConnections || 0,
        totalExpenses:    totalExpenses || 0,
        recentSignups:    (recentUsers || []) as { email: string; created_at: string }[],
        topDestinations,
      })
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Admin stats error:', err)
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    if (user?.email === OWNER_EMAIL) loadStats()
  }, [user])

  if (authLoading || !user) return null
  if (user.email !== OWNER_EMAIL) return null

  const StatCard = ({
    icon: Icon, label, value, sub, color
  }: { icon: React.ElementType, label: string, value: number | string, sub?: string, color: string }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-black text-gray-800">{value.toLocaleString()}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-32"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="px-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black" style={{
              background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
            }}>Tripix Admin</h1>
            {lastUpdated && (
              <p className="text-[10px] text-gray-400">
                עודכן: {lastUpdated.toLocaleTimeString('he-IL')}
              </p>
            )}
          </div>
          <button onClick={loadStats} disabled={refreshing}
            className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 text-xs text-gray-500 shadow-sm active:scale-95 transition-transform">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            רענן
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <>
            {/* Main stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users}    label="משתמשים רשומים"  value={stats.totalUsers}       color="bg-violet-50 text-violet-600" />
              <StatCard icon={Activity} label="פעילים (7 ימים)" value={stats.activeUsers7d}     color="bg-green-50 text-green-600" sub="טיולים שנוצרו" />
              <StatCard icon={Plane}    label="טיולים"           value={stats.totalTrips}        color="bg-blue-50 text-blue-600" />
              <StatCard icon={FileText} label="מסמכים"           value={stats.totalDocuments}    color="bg-orange-50 text-orange-600" />
              <StatCard icon={Mail}     label="Gmail מחוברים"    value={stats.gmailConnections}  color="bg-red-50 text-red-500" />
              <StatCard icon={TrendingUp} label="הוצאות"         value={stats.totalExpenses}     color="bg-amber-50 text-amber-600" />
            </div>

            {/* Conversion rate */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium mb-3">📊 המרות</p>
              <div className="space-y-2">
                {[
                  {
                    label: 'Gmail חיבור',
                    rate: stats.totalUsers > 0 ? Math.round(stats.gmailConnections / stats.totalUsers * 100) : 0,
                    color: 'bg-red-400'
                  },
                  {
                    label: 'משתמשים עם טיולים',
                    rate: stats.totalUsers > 0 ? Math.round(Math.min(stats.totalTrips, stats.totalUsers) / stats.totalUsers * 100) : 0,
                    color: 'bg-violet-500'
                  },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-bold text-gray-800">{item.rate}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${item.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top destinations */}
            {stats.topDestinations.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-3">✈️ יעדים פופולריים</p>
                <div className="space-y-2">
                  {stats.topDestinations.map((d, i) => (
                    <div key={d.destination} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <span className="text-sm text-gray-700 flex-1">{d.destination}</span>
                      <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">
                        {d.count} טיולים
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent signups */}
            {stats.recentSignups.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 font-medium mb-3">🆕 הרשמות אחרונות</p>
                <div className="space-y-2">
                  {stats.recentSignups.map((u, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate">{u.email}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mr-2">
                        {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goal tracker */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium mb-1">🎯 יעד: 100 משתמשים</p>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(stats.totalUsers / 100 * 100, 100)}%`,
                    background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)'
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {stats.totalUsers}/100 — {Math.round(stats.totalUsers / 100 * 100)}% לפתיחת עוסק מורשה
              </p>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-400 py-8">שגיאה בטעינת נתונים</p>
        )}
      </div>
    </div>
  )
}
