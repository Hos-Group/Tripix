'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Star, Camera, PenLine, Check, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'

interface Memory {
  id: string
  trip_id: string
  memory_date: string
  text: string | null
  rating: number
  photo_url: string | null
  created_at: string
}

export default function MemoriesPage() {
  const router = useRouter()
  const { currentTrip } = useTrip()
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [editDay, setEditDay] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editRating, setEditRating] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentTrip) loadMemories()
  }, [currentTrip])

  async function loadMemories() {
    if (!currentTrip) return
    const res = await fetch(`/api/memories?trip_id=${currentTrip.id}`)
    const data = await res.json()
    setMemories(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function getTripDays() {
    if (!currentTrip) return []
    const start = new Date(currentTrip.start_date)
    const end = new Date(currentTrip.end_date)
    const days: { date: string; dayNum: number; isToday: boolean; isPast: boolean }[] = []
    const today = new Date().toISOString().split('T')[0]

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        dayNum: Math.floor((d.getTime() - start.getTime()) / 86400000) + 1,
        isToday: dateStr === today,
        isPast: dateStr <= today,
      })
    }
    return days
  }

  function startEdit(date: string) {
    const existing = memories.find(m => m.memory_date === date)
    setEditDay(date)
    setEditText(existing?.text || '')
    setEditRating(existing?.rating || 0)
  }

  async function saveMemory() {
    if (!currentTrip || !editDay) return
    setSaving(true)
    try {
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: currentTrip.id,
          memory_date: editDay,
          text: editText.trim() || null,
          rating: editRating,
        }),
      })
      toast.success('הזיכרון נשמר!')
      setEditDay(null)
      loadMemories()
    } catch {
      toast.error('שגיאה')
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(date: string, file: File) {
    if (!currentTrip) return
    const ext = file.name.split('.').pop()
    const path = `memories/${currentTrip.id}/${date}.${ext}`

    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { toast.error('שגיאה בהעלאה'); return }

    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

    await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: currentTrip.id,
        memory_date: date,
        text: memories.find(m => m.memory_date === date)?.text || null,
        rating: memories.find(m => m.memory_date === date)?.rating || 0,
        photo_url: publicUrl,
      }),
    })

    toast.success('תמונה הועלתה!')
    loadMemories()
  }

  const days = getTripDays()
  const formatDate = (d: string) => new Date(d).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
  const memoriesWithData = days.filter(d => d.isPast)
  const completedDays = memories.filter(m => m.text || m.photo_url).length
  const progressPercent = memoriesWithData.length > 0 ? Math.round((completedDays / memoriesWithData.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-bl from-[#7F77DD] to-[#5B52B5] text-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/10 active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">זיכרונות טיול</h1>
          <div className="w-9" />
        </div>

        {/* Progress */}
        <div className="bg-white/15 rounded-xl p-3">
          <div className="flex justify-between text-sm mb-2">
            <span>{completedDays}/{memoriesWithData.length} ימים</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {days.map(day => {
            const memory = memories.find(m => m.memory_date === day.date)
            const hasContent = memory?.text || memory?.photo_url

            return (
              <div key={day.date} className={`bg-white rounded-2xl overflow-hidden shadow-sm ${
                day.isToday ? 'ring-2 ring-purple-300' : ''
              }`}>
                {/* Photo */}
                {memory?.photo_url && (
                  <div className="h-36 bg-gray-100 relative">
                    <img src={memory.photo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {day.isPast && !hasContent && (
                        <button onClick={() => startEdit(day.date)}
                          className="text-purple-500 text-xs active:scale-95 flex items-center gap-1">
                          <PenLine className="w-3.5 h-3.5" />
                          כתוב
                        </button>
                      )}
                      {hasContent && (
                        <button onClick={() => startEdit(day.date)}
                          className="text-gray-400 text-xs active:scale-95">
                          ערוך
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">יום {day.dayNum}</span>
                        {day.isToday && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">היום</span>}
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(day.date)}</span>
                    </div>
                  </div>

                  {/* Rating stars */}
                  {memory && memory.rating > 0 && (
                    <div className="flex gap-0.5 justify-end mb-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-4 h-4 ${s <= memory.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  )}

                  {/* Text */}
                  {memory?.text && (
                    <p className="text-sm text-gray-600 leading-relaxed text-right">{memory.text}</p>
                  )}

                  {/* Photo upload */}
                  {day.isPast && !memory?.photo_url && (
                    <label className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl py-2 cursor-pointer hover:bg-gray-50 active:scale-95">
                      <Camera className="w-3.5 h-3.5" />
                      הוסף תמונה
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && uploadPhoto(day.date, e.target.files[0])} />
                    </label>
                  )}

                  {!day.isPast && !day.isToday && (
                    <p className="text-xs text-gray-300 text-center py-2">עוד לא הגיע 🕐</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setEditDay(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-t-3xl w-full max-w-lg p-5">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <h3 className="font-bold text-center mb-4">
                איך היה יום {days.find(d => d.date === editDay)?.dayNum}?
              </h3>

              {/* Rating */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setEditRating(s)} className="active:scale-90 transition-transform">
                    <Star className={`w-8 h-8 ${s <= editRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                  </button>
                ))}
              </div>

              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                placeholder="ספר על היום... מה עשיתם? מה היה מיוחד?"
                rows={3}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none resize-none mb-4 focus:ring-2 focus:ring-purple-200"
              />

              <div className="flex gap-2">
                <button onClick={() => setEditDay(null)}
                  className="flex-1 bg-gray-100 rounded-xl py-3 text-sm font-medium active:scale-95">
                  ביטול
                </button>
                <button onClick={saveMemory} disabled={saving}
                  className="flex-1 bg-gradient-to-l from-[#7F77DD] to-[#5B52B5] text-white rounded-xl py-3 text-sm font-medium active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {saving ? '...' : <><Check className="w-4 h-4" />שמור</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
