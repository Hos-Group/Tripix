'use client'

import { Phone, MapPin, Shield, Heart, AlertTriangle, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

const EMERGENCY_CONTACTS = [
  { name: 'משטרה תאילנד', number: '191', icon: Shield, color: 'bg-blue-500' },
  { name: 'אמבולנס', number: '1669', icon: Heart, color: 'bg-red-500' },
  { name: 'משטרת תיירות', number: '1155', icon: Shield, color: 'bg-green-500' },
  { name: 'כיבוי אש', number: '199', icon: AlertTriangle, color: 'bg-orange-500' },
]

const EMBASSY = {
  name: 'שגרירות ישראל בבנגקוק',
  address: '25 Ocean Tower 2, Soi Sukhumvit 19, Bangkok',
  phone: '+66-2-204-9200',
  emergency: '+66-81-919-5951',
  hours: 'א-ה 09:00-12:00',
}

const MEDICAL_INFO = [
  { label: 'בית חולים פוקט', value: 'Vachira Phuket Hospital', phone: '+66-76-361-234' },
  { label: 'בית חולים קוסמוי', value: 'Koh Samui Hospital', phone: '+66-77-421-230' },
  { label: 'בית חולים בנגקוק', value: 'Bumrungrad Hospital', phone: '+66-2-066-8888' },
]

export default function EmergencyPage() {
  const handleCall = (number: string) => {
    window.location.href = `tel:${number}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-red-500">מצב חירום</h1>
      </div>

      {/* SOS Button */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-br from-red-500 to-red-600 rounded-3xl p-6 text-center text-white shadow-lg">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
        <p className="font-bold text-lg">חירום בתאילנד?</p>
        <p className="text-sm opacity-80 mb-4">התקשר למספר החירום המתאים</p>
        <button onClick={() => handleCall('191')}
          className="bg-white text-red-500 rounded-2xl px-8 py-3 font-bold text-lg active:scale-95 transition-transform shadow-md">
          191 — משטרה
        </button>
      </motion.div>

      {/* Emergency Numbers */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-600">מספרי חירום</h3>
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_CONTACTS.map((contact) => (
            <button key={contact.number} onClick={() => handleCall(contact.number)}
              className="bg-white rounded-2xl p-4 shadow-sm text-center active:scale-95 transition-transform">
              <div className={`w-10 h-10 ${contact.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                <contact.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-medium">{contact.name}</p>
              <p className="text-lg font-bold text-primary">{contact.number}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Embassy */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold">{EMBASSY.name}</h3>
        </div>
        <p className="text-xs text-gray-500">{EMBASSY.address}</p>
        <div className="flex gap-2">
          <button onClick={() => handleCall(EMBASSY.phone)}
            className="flex-1 bg-blue-50 text-blue-600 rounded-xl py-2.5 text-xs font-medium active:scale-95 flex items-center justify-center gap-1">
            <Phone className="w-3 h-3" /> {EMBASSY.phone}
          </button>
          <button onClick={() => handleCall(EMBASSY.emergency)}
            className="flex-1 bg-red-50 text-red-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 flex items-center justify-center gap-1">
            <Phone className="w-3 h-3" /> חירום
          </button>
        </div>
        <p className="text-[10px] text-gray-400">שעות: {EMBASSY.hours}</p>
      </div>

      {/* Hospitals */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-600">בתי חולים</h3>
        {MEDICAL_INFO.map((hospital) => (
          <button key={hospital.phone} onClick={() => handleCall(hospital.phone)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs font-bold">{hospital.label}</p>
              <p className="text-[10px] text-gray-400">{hospital.value}</p>
            </div>
            <Phone className="w-4 h-4 text-primary" />
          </button>
        ))}
      </div>

      {/* Insurance & Medical */}
      <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
        <p className="text-xs font-bold text-yellow-700 mb-2">מידע רפואי וביטוח</p>
        <p className="text-[10px] text-yellow-600">
          העלה את פוליסת הביטוח לכספת המסמכים כדי שתהיה נגישה בכל רגע.
          הוסף מידע על אלרגיות ותרופות בהגדרות החשבון.
        </p>
      </div>
    </div>
  )
}
