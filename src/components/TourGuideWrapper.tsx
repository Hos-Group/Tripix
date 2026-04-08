'use client'
import { useAuth } from '@/contexts/AuthContext'
import TourGuide from './TourGuide'

export default function TourGuideWrapper() {
  const { user } = useAuth()
  if (!user) return null
  return <TourGuide userId={user.id} />
}
