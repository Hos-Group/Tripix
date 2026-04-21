'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, X, Crown, Edit3, Eye, Clock, CheckCircle, Trash2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { TripMember, MemberRole } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface MembersPanelProps {
  tripId: string
}

const ROLE_META: Record<MemberRole, { label: string; icon: React.ReactNode; color: string }> = {
  owner:  { label: 'בעלים',  icon: <Crown className="w-3 h-3" />,  color: '#F59E0B' },
  editor: { label: 'עורך',   icon: <Edit3 className="w-3 h-3" />,  color: '#6C47FF' },
  viewer: { label: 'צופה',   icon: <Eye className="w-3 h-3" />,    color: '#6B7280' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(p => p[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ['#6C47FF', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: colors[idx], fontSize: size * 0.35 }}
    >
      {getInitials(name)}
    </div>
  )
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function MembersPanel({ tripId }: MembersPanelProps) {
  const [members, setMembers] = useState<TripMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer')
  const [inviting, setInviting] = useState(false)
  const [removingMember, setRemovingMember] = useState<TripMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setMembers(json.members || [])
      }
    } catch (err) {
      console.error('[MembersPanel] fetch error:', err)
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('נדרש אימייל')
      return
    }
    setInviting(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'שגיאה בהזמנה')
      } else {
        toast.success('הזמנה נשלחה בהצלחה!')
        setInviteEmail('')
        setInviteName('')
        setInviteRole('viewer')
        setShowInvite(false)
        fetchMembers()
      }
    } catch {
      toast.error('שגיאה בחיבור לשרת')
    }
    setInviting(false)
  }

  const requestRemove = (member: TripMember) => setRemovingMember(member)

  const handleConfirmRemove = async () => {
    if (!removingMember) return
    const member = removingMember
    setRemoving(true)
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/members/${member.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('החבר הוסר')
        setMembers(prev => prev.filter(m => m.id !== member.id))
        setRemovingMember(null)
      } else {
        const json = await res.json()
        toast.error(json.error || 'שגיאה בהסרה')
      }
    } catch {
      toast.error('שגיאה בחיבור לשרת')
    }
    setRemoving(false)
  }

  const handleChangeRole = async (member: TripMember, newRole: 'editor' | 'viewer') => {
    try {
      const token = await getAuthToken()
      const res = await fetch(`/api/trips/${tripId}/members/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        toast.success('התפקיד עודכן')
        setMembers(prev =>
          prev.map(m => (m.id === member.id ? { ...m, role: newRole } : m))
        )
      } else {
        const json = await res.json()
        toast.error(json.error || 'שגיאה בעדכון')
      }
    } catch {
      toast.error('שגיאה בחיבור לשרת')
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-gray-800">חברים בטיול</h3>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl active:scale-95 transition-all"
          style={{ background: showInvite ? '#EF4444' : 'linear-gradient(135deg,#6C47FF,#9B7BFF)' }}
        >
          {showInvite ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {showInvite ? 'ביטול' : 'הזמן חבר'}
        </button>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-br from-primary/5 to-purple-50 rounded-2xl p-4 space-y-3 border border-primary/10"
          >
            <p className="text-sm font-bold text-gray-700">הזמנת חבר/ה לטיול</p>

            <input
              type="email"
              placeholder="כתובת אימייל *"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              dir="ltr"
              className="w-full bg-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 border border-gray-100 text-left placeholder:text-right"
            />

            <input
              type="text"
              placeholder="שם (אופציונלי)"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              className="w-full bg-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/20 border border-gray-100"
            />

            {/* Role selector */}
            <div className="relative">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
                className="w-full bg-white rounded-xl px-4 py-2.5 text-sm outline-none appearance-none border border-gray-100"
              >
                <option value="viewer">צופה — יכול לראות בלבד</option>
                <option value="editor">עורך — יכול לערוך ולהוסיף</option>
              </select>
              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={handleInvite}
              disabled={inviting}
              className="w-full text-white rounded-xl py-3 font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)' }}
            >
              {inviting ? 'שולח הזמנה...' : 'שלח הזמנה'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="w-7 h-7 rounded-full animate-spin"
            style={{ border: '2px solid rgba(108,71,255,0.15)', borderTopColor: '#6C47FF' }}
          />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">אין חברים עדיין</div>
      ) : (
        <div className="space-y-2">
          {members.map((member, i) => {
            const roleMeta = ROLE_META[member.role]
            const displayName = member.display_name || member.invited_name || member.invited_email || 'משתמש'
            const isPending = member.status === 'pending'

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border ${
                  isPending ? 'border-amber-100 opacity-75' : 'border-gray-50'
                }`}
              >
                {/* Avatar */}
                <div className="relative">
                  <Avatar name={displayName} size={38} />
                  {member.status === 'active' && (
                    <CheckCircle
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-emerald-500"
                      style={{ filter: 'drop-shadow(0 0 0 white)' }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    {isPending && (
                      <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">
                    {isPending ? 'ממתין לאישור' : member.invited_email || ''}
                  </p>
                </div>

                {/* Role badge */}
                {member.role !== 'owner' ? (
                  <select
                    value={member.role}
                    onChange={e => handleChangeRole(member, e.target.value as 'editor' | 'viewer')}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border outline-none appearance-none cursor-pointer"
                    style={{ color: roleMeta.color, borderColor: roleMeta.color + '40', background: roleMeta.color + '10' }}
                  >
                    <option value="viewer">👁 צופה</option>
                    <option value="editor">✏️ עורך</option>
                  </select>
                ) : (
                  <span
                    className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
                    style={{ color: roleMeta.color, background: roleMeta.color + '15' }}
                  >
                    {roleMeta.icon}
                    {roleMeta.label}
                  </span>
                )}

                {/* Remove (not for owner) */}
                {member.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => requestRemove(member)}
                    aria-label={`הסר את ${member.display_name} מהטיול`}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 active:text-red-500 active:bg-red-50 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-400 text-center">
        {members.length} חבר/ים בטיול
      </p>

      <ConfirmDialog
        open={!!removingMember}
        title="להסיר את החבר מהטיול?"
        description={
          removingMember
            ? `${removingMember.display_name} לא יוכל/ה לראות או לערוך את הטיול יותר. ניתן להזמין מחדש.`
            : undefined
        }
        confirmLabel="הסר מהטיול"
        cancelLabel="ביטול"
        variant="danger"
        loading={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => !removing && setRemovingMember(null)}
      />
    </div>
  )
}
