'use client'

import type { ElementType } from 'react'
import { Phone, MapPin, Shield, Heart, AlertTriangle, ChevronLeft, Globe, Building2, Clock, Flame, Info, Anchor } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useTrip } from '@/contexts/TripContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmergencyNumber {
  label: string
  number: string
  icon: string
  color: string
}

interface EmbassyInfo {
  type: 'שגרירות' | 'קונסוליה' | 'מחלקת אינטרסים' | 'אחראית'
  name: string
  city: string
  address: string
  phone: string
  emergency: string
  hours?: string
  note?: string
}

interface HospitalInfo {
  label: string
  value: string
  phone: string
}

interface CountryData {
  nameHe: string
  flag: string
  primaryNumber: string
  primaryLabel: string
  numbers: EmergencyNumber[]
  embassy: EmbassyInfo
  hospitals?: HospitalInfo[]
}

// ── Emergency Data ─────────────────────────────────────────────────────────────

const EMERGENCY_DATA: Record<string, CountryData> = {
  thailand: {
    nameHe: 'תאילנד', flag: '🇹🇭',
    primaryNumber: '191', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '191', icon: '🚔', color: 'bg-blue-500' },
      { label: 'משטרת תיירות', number: '1155', icon: 'ℹ️', color: 'bg-green-500' },
      { label: 'אמבולנס', number: '1669', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '199', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בבנגקוק', city: 'בנגקוק',
      address: '25 Ocean Tower 2, Soi Sukhumvit 19, Bangkok 10110',
      phone: '+66-2-204-9200', emergency: '+66-81-919-5951',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'בנגקוק', value: 'Bumrungrad International Hospital', phone: '+66-2-066-8888' },
      { label: 'פוקט', value: 'Vachira Phuket Hospital', phone: '+66-76-361-234' },
      { label: 'קוסמוי', value: 'Koh Samui Hospital', phone: '+66-77-421-230' },
      { label: 'קראבי', value: 'Krabi Hospital', phone: '+66-75-611-210' },
    ],
  },

  japan: {
    nameHe: 'יפן', flag: '🇯🇵',
    primaryNumber: '110', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '110', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס / כיבוי אש', number: '119', icon: '🚑', color: 'bg-red-500' },
      { label: 'מוקד תיירות', number: '050-3816-2787', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בטוקיו', city: 'טוקיו',
      address: '3 Nibancho, Chiyoda-ku, Tokyo 102-0084',
      phone: '+81-3-3264-0911', emergency: '+81-80-3417-2500',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'טוקיו', value: 'St. Luke\'s International Hospital', phone: '+81-3-5550-7166' },
      { label: 'אוסקה', value: 'Osaka University Hospital', phone: '+81-6-6879-5111' },
    ],
  },

  south_korea: {
    nameHe: 'קוריאה', flag: '🇰🇷',
    primaryNumber: '112', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '112', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '119', icon: '🚑', color: 'bg-red-500' },
      { label: 'מוקד תיירים', number: '1330', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בסיאול', city: 'סיאול',
      address: '46F, Lotte World Tower, 300 Olympic-ro, Songpa-gu, Seoul',
      phone: '+82-2-3210-8500', emergency: '+82-10-8993-8500',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'סיאול', value: 'Asan Medical Center', phone: '+82-2-3010-3114' },
    ],
  },

  uae: {
    nameHe: 'איחוד האמירויות', flag: '🇦🇪',
    primaryNumber: '999', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'משטרה', number: '999', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '998', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '997', icon: '🔥', color: 'bg-orange-500' },
      { label: 'מוקד תיירות', number: '800-2-DUBAI', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל באבו דאבי', city: 'אבו דאבי',
      address: 'Al Maqam Tower, Abu Dhabi Global Market Square, Abu Dhabi',
      phone: '+971-2-234-4000', emergency: '+971-50-565-1020',
      hours: 'א–ה 09:00–13:00',
      note: 'קונסוליה בדובאי: +971-4-276-0000',
    },
    hospitals: [
      { label: 'דובאי', value: 'Rashid Hospital', phone: '+971-4-219-2000' },
      { label: 'אבו דאבי', value: 'Cleveland Clinic Abu Dhabi', phone: '+971-2-501-9000' },
    ],
  },

  turkey: {
    nameHe: 'טורקיה', flag: '🇹🇷',
    primaryNumber: '155', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '155', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '112', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '110', icon: '🔥', color: 'bg-orange-500' },
      { label: 'ז\'נדרמרי', number: '156', icon: '🪖', color: 'bg-gray-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל באנקרה', city: 'אנקרה',
      address: 'Mahatma Gandhi Cad. No. 85, 06700 Gaziosmanpasa, Ankara',
      phone: '+90-312-446-3605', emergency: '+90-530-856-6666',
      hours: 'א–ה 09:00–12:30',
      note: 'קונסוליה באיסטנבול: +90-212-317-6500',
    },
    hospitals: [
      { label: 'איסטנבול', value: 'American Hospital Istanbul', phone: '+90-212-444-3777' },
      { label: 'אנטליה', value: 'Antalya Memorial Hospital', phone: '+90-242-314-6000' },
    ],
  },

  greece: {
    nameHe: 'יוון', flag: '🇬🇷',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '100', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '166', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '199', icon: '🔥', color: 'bg-orange-500' },
      { label: 'משטרת תיירות', number: '171', icon: 'ℹ️', color: 'bg-green-500' },
      { label: 'משמר חוף', number: '108', icon: '⛵', color: 'bg-cyan-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל באתונה', city: 'אתונה',
      address: 'Marathonodromon 1, 154 52 Psychico, Athens',
      phone: '+30-210-670-0500', emergency: '+30-694-659-0000',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'אתונה', value: 'Evangelismos Hospital', phone: '+30-213-204-1000' },
      { label: 'קרפת', value: 'Heraklion University Hospital', phone: '+30-2810-392-111' },
    ],
  },

  cyprus: {
    nameHe: 'קפריסין', flag: '🇨🇾',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '199', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '112', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בניקוסיה', city: 'ניקוסיה',
      address: '4 Gryparis Street, 1087 Nicosia',
      phone: '+357-22-445-195', emergency: '+357-99-654-321',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'ניקוסיה', value: 'Nicosia General Hospital', phone: '+357-22-603-000' },
      { label: 'לימסול', value: 'Limassol General Hospital', phone: '+357-25-801-100' },
    ],
  },

  italy: {
    nameHe: 'איטליה', flag: '🇮🇹',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '113', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '118', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '115', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל ברומא', city: 'רומא',
      address: 'Via Michele Mercati 12, 00197 Roma',
      phone: '+39-06-361-5500', emergency: '+39-335-810-0000',
      hours: 'א–ה 09:00–12:30',
      note: 'קונסוליה במילאנו: +39-02-4801-5500',
    },
    hospitals: [
      { label: 'רומא', value: 'Policlinico Gemelli', phone: '+39-06-30151' },
      { label: 'מילאנו', value: 'Ospedale Niguarda', phone: '+39-02-6444-1' },
    ],
  },

  france: {
    nameHe: 'צרפת', flag: '🇫🇷',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '17', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס (SAMU)', number: '15', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '18', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בפריז', city: 'פריז',
      address: '3 Rue Rabelais, 75008 Paris',
      phone: '+33-1-4076-5500', emergency: '+33-6-0833-3333',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'פריז', value: 'Hôpital Lariboisière', phone: '+33-1-4995-6000' },
    ],
  },

  spain: {
    nameHe: 'ספרד', flag: '🇪🇸',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה לאומית', number: '091', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '061', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '080', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל במדריד', city: 'מדריד',
      address: 'Calle Velázquez 150, 28002 Madrid',
      phone: '+34-91-782-9500', emergency: '+34-607-133-333',
      hours: 'א–ה 09:00–13:00',
      note: 'קונסוליה בברצלונה: +34-93-367-0040',
    },
    hospitals: [
      { label: 'מדריד', value: 'Hospital Universitario La Paz', phone: '+34-91-727-7000' },
      { label: 'ברצלונה', value: 'Hospital Clínic Barcelona', phone: '+34-93-227-5400' },
    ],
  },

  portugal: {
    nameHe: 'פורטוגל', flag: '🇵🇹',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'PSP (משטרה)', number: '112', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס (INEM)', number: '112', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בליסבון', city: 'ליסבון',
      address: 'Rua António Enes 16, 1050-024 Lisbon',
      phone: '+351-21-354-0200', emergency: '+351-96-354-0200',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'ליסבון', value: 'Hospital de Santa Maria', phone: '+351-21-780-5000' },
    ],
  },

  uk: {
    nameHe: 'בריטניה', flag: '🇬🇧',
    primaryNumber: '999', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '999', icon: '🆘', color: 'bg-blue-500' },
      { label: 'חירום אירופי', number: '112', icon: '🚑', color: 'bg-red-500' },
      { label: 'מידע לא-דחוף', number: '101', icon: 'ℹ️', color: 'bg-green-500' },
      { label: 'NHS מידע רפואי', number: '111', icon: '💊', color: 'bg-cyan-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בלונדון', city: 'לונדון',
      address: '2 Palace Green, London W8 4QB',
      phone: '+44-20-7957-9500', emergency: '+44-7944-123-456',
      hours: 'א–ה 09:00–13:00',
    },
    hospitals: [
      { label: 'לונדון', value: "St Thomas' Hospital", phone: '+44-20-7188-7188' },
    ],
  },

  germany: {
    nameHe: 'גרמניה', flag: '🇩🇪',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום / אמבולנס', number: '112', icon: '🚑', color: 'bg-red-500' },
      { label: 'משטרה', number: '110', icon: '🚔', color: 'bg-blue-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בברלין', city: 'ברלין',
      address: 'Auguste-Viktoria-Str. 74-76, 14193 Berlin',
      phone: '+49-30-8904-5500', emergency: '+49-152-2142-0000',
      hours: 'א–ה 09:00–12:30',
      note: 'קונסוליה במינכן: +49-89-9813-9970 | פרנקפורט: +49-69-6786-0430',
    },
    hospitals: [
      { label: 'ברלין', value: 'Charité – Universitätsmedizin', phone: '+49-30-450-50' },
    ],
  },

  netherlands: {
    nameHe: 'הולנד', flag: '🇳🇱',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה (לא-דחוף)', number: '0900-8844', icon: '🚔', color: 'bg-blue-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בהאג', city: 'האג',
      address: 'Buitenhof 47, 2513 AH The Hague',
      phone: '+31-70-376-0500', emergency: '+31-70-376-0592',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'אמסטרדם', value: 'Amsterdam UMC', phone: '+31-20-566-9111' },
    ],
  },

  switzerland: {
    nameHe: 'שווייץ', flag: '🇨🇭',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '117', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '144', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '118', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בברן', city: 'ברן',
      address: 'Alpenstrasse 32, 3006 Bern',
      phone: '+41-31-356-3500', emergency: '+41-79-356-3500',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'ג\'נבה', value: 'Hôpitaux Universitaires de Genève', phone: '+41-22-372-3311' },
    ],
  },

  austria: {
    nameHe: 'אוסטריה', flag: '🇦🇹',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '133', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '144', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '122', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בווינה', city: 'וינה',
      address: 'Anton-Frank-Gasse 20, 1180 Vienna',
      phone: '+43-1-476-4653', emergency: '+43-699-1969-3131',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'וינה', value: 'Allgemeines Krankenhaus Wien', phone: '+43-1-40400-0' },
    ],
  },

  czech: {
    nameHe: 'צ\'כיה', flag: '🇨🇿',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '158', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '155', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '150', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בפראג', city: 'פראג',
      address: 'Badeniho 2, 170 00 Prague 7',
      phone: '+420-233-097-500', emergency: '+420-603-161-500',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'פראג', value: 'Motol University Hospital', phone: '+420-224-431-111' },
    ],
  },

  hungary: {
    nameHe: 'הונגריה', flag: '🇭🇺',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '107', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '104', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '105', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בבודפשט', city: 'בודפשט',
      address: 'Fullánk u. 8, 1026 Budapest',
      phone: '+36-1-392-6200', emergency: '+36-30-944-9100',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'בודפשט', value: 'Semmelweis University Hospital', phone: '+36-1-459-1500' },
    ],
  },

  poland: {
    nameHe: 'פולין', flag: '🇵🇱',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '997', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '999', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '998', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בוורשה', city: 'וורשה',
      address: 'ul. Krzywickiego 24, 02-078 Warsaw',
      phone: '+48-22-520-0500', emergency: '+48-500-197-000',
      hours: 'א–ה 09:00–13:00',
    },
    hospitals: [
      { label: 'וורשה', value: 'Central Clinical Hospital (WUM)', phone: '+48-22-599-1000' },
      { label: 'קרקוב', value: 'University Hospital Krakow', phone: '+48-12-424-7000' },
    ],
  },

  croatia: {
    nameHe: 'קרואטיה', flag: '🇭🇷',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-purple-500' },
      { label: 'משטרה', number: '192', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '194', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '193', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בזאגרב', city: 'זאגרב',
      address: 'Pantovčak 101, 10000 Zagreb',
      phone: '+385-1-489-1500', emergency: '+385-91-489-1501',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'זאגרב', value: 'KBC Zagreb Hospital', phone: '+385-1-238-8888' },
      { label: 'ספליט', value: 'KBC Split', phone: '+385-21-556-111' },
    ],
  },

  usa: {
    nameHe: 'ארצות הברית', flag: '🇺🇸',
    primaryNumber: '911', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '911', icon: '🆘', color: 'bg-blue-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בוושינגטון', city: 'וושינגטון DC',
      address: '3514 International Dr NW, Washington, DC 20008',
      phone: '+1-202-364-5500', emergency: '+1-202-364-5590',
      hours: 'א–ה 09:00–13:00',
      note: 'קונסוליה בניו יורק: +1-212-499-5000 | LA: +1-323-852-5500 | מיאמי: +1-305-925-9400',
    },
    hospitals: [
      { label: 'ניו יורק', value: 'NewYork-Presbyterian Hospital', phone: '+1-212-746-5454' },
      { label: 'לוס אנג\'לס', value: 'Cedars-Sinai Medical Center', phone: '+1-310-423-3277' },
    ],
  },

  canada: {
    nameHe: 'קנדה', flag: '🇨🇦',
    primaryNumber: '911', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '911', icon: '🆘', color: 'bg-blue-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל באוטווה', city: 'אוטווה',
      address: '50 O\'Connor St, Suite 1005, Ottawa, ON K1P 6L2',
      phone: '+1-613-567-6450', emergency: '+1-613-567-6450',
      hours: 'א–ה 09:00–13:00',
      note: 'קונסוליה בטורונטו: +1-416-640-8500 | מונטריאול: +1-514-940-8500',
    },
    hospitals: [
      { label: 'טורונטו', value: 'Toronto General Hospital', phone: '+1-416-340-4800' },
    ],
  },

  australia: {
    nameHe: 'אוסטרליה', flag: '🇦🇺',
    primaryNumber: '000', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '000', icon: '🆘', color: 'bg-blue-500' },
      { label: 'SES (אסון)', number: '132-500', icon: '🌊', color: 'bg-cyan-500' },
      { label: 'ייעוץ בריאות', number: '1800-022-222', icon: '💊', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בקנברה', city: 'קנברה',
      address: '6 Turrana St, Yarralumla ACT 2600, Canberra',
      phone: '+61-2-6215-4500', emergency: '+61-4-1214-4500',
      hours: 'א–ה 09:00–12:30',
      note: 'קונסוליה בסידני: +61-2-9264-7933 | מלבורן: +61-3-9510-0022',
    },
    hospitals: [
      { label: 'סידני', value: 'Royal Prince Alfred Hospital', phone: '+61-2-9515-6111' },
    ],
  },

  india: {
    nameHe: 'הודו', flag: '🇮🇳',
    primaryNumber: '112', primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🆘', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '108', icon: '🚑', color: 'bg-red-500' },
      { label: 'מוקד תיירות', number: '1363', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בניו דלהי', city: 'ניו דלהי',
      address: '3 Aurangzeb Road, New Delhi 110011',
      phone: '+91-11-3041-3500', emergency: '+91-98-1818-3333',
      hours: 'א–ה 09:00–13:00',
      note: 'קונסוליה במומבאי: +91-22-2283-3140',
    },
    hospitals: [
      { label: 'ניו דלהי', value: 'Indraprastha Apollo Hospital', phone: '+91-11-2692-5858' },
      { label: 'גואה', value: 'Goa Medical College Hospital', phone: '+91-832-245-8700' },
    ],
  },

  singapore: {
    nameHe: 'סינגפור', flag: '🇸🇬',
    primaryNumber: '999', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '999', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס / כיבוי אש', number: '995', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בסינגפור', city: 'סינגפור',
      address: '58 Dalvey Road, Singapore 259479',
      phone: '+65-6834-9400', emergency: '+65-9833-4400',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'סינגפור', value: 'Singapore General Hospital', phone: '+65-6222-3322' },
    ],
  },

  indonesia: {
    nameHe: 'אינדונזיה / באלי', flag: '🇮🇩',
    primaryNumber: '110', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '110', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '118', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '113', icon: '🔥', color: 'bg-orange-500' },
      { label: 'מוקד תיירות', number: '021-500-212', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בג\'קרטה', city: "ג'קרטה",
      address: 'Jl. Denpasar Raya Kav. 10, Jakarta 12950',
      phone: '+62-21-520-3931', emergency: '+62-812-1000-4455',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'באלי', value: 'BIMC Hospital Kuta', phone: '+62-361-761-263' },
      { label: "ג'קרטה", value: 'RS Siloam Hospitals', phone: '+62-21-2996-9999' },
    ],
  },

  vietnam: {
    nameHe: 'וייטנאם', flag: '🇻🇳',
    primaryNumber: '113', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '113', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '115', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '114', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בהאנוי', city: 'האנוי',
      address: '68 Nguyen Thai Hoc Street, Ba Dinh District, Hanoi',
      phone: '+84-24-3843-6615', emergency: '+84-90-340-0000',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'הו צ\'י מין', value: 'FV Hospital Ho Chi Minh City', phone: '+84-28-5411-3333' },
      { label: 'האנוי', value: 'Hanoi French Hospital', phone: '+84-24-3577-1100' },
    ],
  },

  jordan: {
    nameHe: 'ירדן', flag: '🇯🇴',
    primaryNumber: '911', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '911', icon: '🆘', color: 'bg-blue-500' },
      { label: 'משטרת תיירות', number: '196', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בעמאן', city: 'עמאן',
      address: '47 Mithqal Al-Fayez Street, Rabieh, Amman',
      phone: '+962-6-550-0500', emergency: '+962-79-555-0500',
      hours: 'א–ה 09:00–12:30',
    },
    hospitals: [
      { label: 'עמאן', value: 'Jordan Hospital', phone: '+962-6-560-8080' },
    ],
  },

  egypt: {
    nameHe: 'מצרים', flag: '🇪🇬',
    primaryNumber: '122', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '122', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '123', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '180', icon: '🔥', color: 'bg-orange-500' },
      { label: 'משטרת תיירות', number: '126', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל בקהיר', city: 'קהיר',
      address: '6 Ibn Malek Street, Giza, Cairo',
      phone: '+20-2-3332-1500', emergency: '+20-100-123-4567',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'קהיר', value: 'Cairo University Hospital (Kasr Al-Ainy)', phone: '+20-2-2368-0003' },
      { label: 'שארם א-שייח', value: 'Sharm El Sheikh International Hospital', phone: '+20-69-366-0893' },
    ],
  },

  morocco: {
    nameHe: 'מרוקו', flag: '🇲🇦',
    primaryNumber: '19', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '19', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '150', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '15', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל ברבאט', city: 'רבאט',
      address: 'Rue El Farabi, Rabat',
      phone: '+212-537-668-726', emergency: '+212-661-234-567',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'מרקש', value: 'Clinique Internationale de Marrakech', phone: '+212-524-336-700' },
    ],
  },

  maldives: {
    nameHe: 'מלדיביים', flag: '🇲🇻',
    primaryNumber: '118', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '118', icon: '🚑', color: 'bg-red-500' },
      { label: 'משמר חוף', number: '191', icon: '⛵', color: 'bg-blue-500' },
      { label: 'משטרה', number: '119', icon: '🚔', color: 'bg-indigo-500' },
    ],
    embassy: {
      type: 'אחראית', name: 'שגרירות ישראל בניו דלהי (אחראית על מלדיביים)', city: 'ניו דלהי',
      address: '3 Aurangzeb Road, New Delhi 110011, India',
      phone: '+91-11-3041-3500', emergency: '+91-98-1818-3333',
      hours: 'א–ה 09:00–13:00',
    },
    hospitals: [
      { label: 'מאלה', value: 'ADK Hospital', phone: '+960-313-3535' },
      { label: 'רנאלד', value: 'IGMH Hospital', phone: '+960-332-2335' },
    ],
  },

  cambodia: {
    nameHe: 'קמבודיה', flag: '🇰🇭',
    primaryNumber: '117', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '117', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '119', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      type: 'אחראית', name: 'שגרירות ישראל בבנגקוק (אחראית על קמבודיה)', city: 'בנגקוק',
      address: '25 Ocean Tower 2, Soi Sukhumvit 19, Bangkok 10110',
      phone: '+66-2-204-9200', emergency: '+66-81-919-5951',
      hours: 'א–ה 09:00–12:00',
    },
    hospitals: [
      { label: 'פנום פן', value: 'Royal Phnom Penh Hospital', phone: '+855-23-991-000' },
      { label: 'סיאם ריפ', value: 'Royal Angkor International Hospital', phone: '+855-63-761-888' },
    ],
  },

  mexico: {
    nameHe: 'מקסיקו', flag: '🇲🇽',
    primaryNumber: '911', primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '911', icon: '🆘', color: 'bg-blue-500' },
      { label: 'מוקד תיירות', number: '078', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      type: 'שגרירות', name: 'שגרירות ישראל במקסיקו סיטי', city: 'מקסיקו סיטי',
      address: 'Sierra Madre 215, Lomas de Chapultepec, 11000 Mexico City',
      phone: '+52-55-5201-1500', emergency: '+52-55-5201-1554',
      hours: 'א–ה 09:00–13:00',
    },
    hospitals: [
      { label: 'מקסיקו סיטי', value: 'Hospital ABC (American British Cowdray)', phone: '+52-55-5230-8000' },
      { label: 'קנקון', value: 'Hospiten Cancun', phone: '+52-998-881-3700' },
    ],
  },

  israel: {
    nameHe: 'ישראל', flag: '🇮🇱',
    primaryNumber: '100', primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '100', icon: '🚔', color: 'bg-blue-500' },
      { label: 'מד"א (אמבולנס)', number: '101', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '102', icon: '🔥', color: 'bg-orange-500' },
      { label: 'חרום ביטחוני', number: '1202', icon: '🛡️', color: 'bg-gray-600' },
    ],
    embassy: {
      type: 'שגרירות', name: 'משרד החוץ הישראלי', city: 'ירושלים',
      address: 'רחוב יצחק רבין 9, ירושלים',
      phone: '+972-2-530-3111', emergency: '+972-2-530-3111',
      hours: 'א–ה 08:00–16:00',
    },
  },
}

const GENERIC_DATA: CountryData = {
  nameHe: 'בינלאומי', flag: '🌍',
  primaryNumber: '112', primaryLabel: 'חירום בינלאומי',
  numbers: [
    { label: 'חירום בינלאומי', number: '112', icon: '🆘', color: 'bg-blue-500' },
  ],
  embassy: {
    type: 'שגרירות', name: 'משרד החוץ — מוקד חירום', city: 'ירושלים',
    address: 'ירושלים, ישראל',
    phone: '+972-2-530-3111', emergency: '+972-2-530-3111',
    hours: '24/7',
  },
}

// ── Destination Mapping ───────────────────────────────────────────────────────

const DESTINATION_MAP: Record<string, string> = {
  // Thailand
  תאילנד: 'thailand', thailand: 'thailand', phuket: 'thailand', פוקט: 'thailand',
  bangkok: 'thailand', 'בנגקוק': 'thailand', 'ko samui': 'thailand', קוסמוי: 'thailand',
  'chiang mai': 'thailand', krabi: 'thailand', קראבי: 'thailand', פאי: 'thailand', pai: 'thailand',
  'ko pha ngan': 'thailand', 'koh phangan': 'thailand',
  // Japan
  יפן: 'japan', japan: 'japan', tokyo: 'japan', טוקיו: 'japan',
  osaka: 'japan', אוסקה: 'japan', kyoto: 'japan', קיוטו: 'japan',
  hiroshima: 'japan', נארה: 'japan', hokkaido: 'japan',
  // South Korea
  קוריאה: 'south_korea', korea: 'south_korea', 'south korea': 'south_korea',
  seoul: 'south_korea', סיאול: 'south_korea', busan: 'south_korea', פוסן: 'south_korea',
  // UAE / Dubai
  דובאי: 'uae', dubai: 'uae', 'אבו דאבי': 'uae', 'abu dhabi': 'uae',
  'איחוד האמירויות': 'uae', uae: 'uae', sharjah: 'uae', 'שארגה': 'uae',
  // Turkey
  טורקיה: 'turkey', turkey: 'turkey', istanbul: 'turkey', איסטנבול: 'turkey',
  antalya: 'turkey', אנטליה: 'turkey', bodrum: 'turkey', בודרום: 'turkey',
  cappadocia: 'turkey', קפדוקיה: 'turkey', izmir: 'turkey', איזמיר: 'turkey',
  // Greece
  יוון: 'greece', greece: 'greece', athens: 'greece', אתונה: 'greece',
  mykonos: 'greece', מיקונוס: 'greece', santorini: 'greece', סנטוריני: 'greece',
  crete: 'greece', כרתים: 'greece', rhodes: 'greece', רודוס: 'greece',
  corfu: 'greece', קורפו: 'greece', zakynthos: 'greece', זקינטוס: 'greece',
  // Cyprus
  קפריסין: 'cyprus', cyprus: 'cyprus', nicosia: 'cyprus', ניקוסיה: 'cyprus',
  limassol: 'cyprus', לימסול: 'cyprus', paphos: 'cyprus', פאפוס: 'cyprus',
  // Italy
  איטליה: 'italy', italy: 'italy', rome: 'italy', רומא: 'italy',
  milan: 'italy', מילאנו: 'italy', venice: 'italy', ונציה: 'italy',
  florence: 'italy', פירנצה: 'italy', naples: 'italy', נאפולי: 'italy',
  sicily: 'italy', סיציליה: 'italy', amalfi: 'italy',
  // France
  צרפת: 'france', france: 'france', paris: 'france', פריז: 'france',
  nice: 'france', ניס: 'france', lyon: 'france', bordeaux: 'france',
  // Spain
  ספרד: 'spain', spain: 'spain', madrid: 'spain', מדריד: 'spain',
  barcelona: 'spain', ברצלונה: 'spain', seville: 'spain', sevilla: 'spain',
  malaga: 'spain', מאלגה: 'spain', ibiza: 'spain', איביזה: 'spain',
  tenerife: 'spain', טנריף: 'spain', mallorca: 'spain', מיורקה: 'spain',
  // Portugal
  פורטוגל: 'portugal', portugal: 'portugal', lisbon: 'portugal', ליסבון: 'portugal',
  porto: 'portugal', פורטו: 'portugal', algarve: 'portugal', אלגרב: 'portugal',
  // UK
  בריטניה: 'uk', 'united kingdom': 'uk', london: 'uk', לונדון: 'uk', uk: 'uk', england: 'uk',
  scotland: 'uk', אנגליה: 'uk',
  // Germany
  גרמניה: 'germany', germany: 'germany', berlin: 'germany', ברלין: 'germany',
  munich: 'germany', מינכן: 'germany', frankfurt: 'germany', פרנקפורט: 'germany',
  // Netherlands
  הולנד: 'netherlands', netherlands: 'netherlands', amsterdam: 'netherlands', אמסטרדם: 'netherlands',
  holland: 'netherlands',
  // Switzerland
  שווייץ: 'switzerland', switzerland: 'switzerland', zurich: 'switzerland', זיריך: 'switzerland',
  geneva: 'switzerland', "ז'נבה": 'switzerland', bern: 'switzerland', ברן: 'switzerland',
  // Austria
  אוסטריה: 'austria', austria: 'austria', vienna: 'austria', וינה: 'austria',
  salzburg: 'austria', זלצבורג: 'austria',
  // Czech Republic
  "צ'כיה": 'czech', czech: 'czech', prague: 'czech', פראג: 'czech', 'czech republic': 'czech',
  // Hungary
  הונגריה: 'hungary', hungary: 'hungary', budapest: 'hungary', בודפשט: 'hungary',
  // Poland
  פולין: 'poland', poland: 'poland', warsaw: 'poland', וורשה: 'poland',
  krakow: 'poland', קרקוב: 'poland',
  // Croatia
  קרואטיה: 'croatia', croatia: 'croatia', dubrovnik: 'croatia', דוברובניק: 'croatia',
  split: 'croatia', ספליט: 'croatia', zagreb: 'croatia', זאגרב: 'croatia',
  // USA
  'ארצות הברית': 'usa', usa: 'usa', 'united states': 'usa', 'new york': 'usa',
  'ניו יורק': 'usa', 'לאס וגאס': 'usa', 'las vegas': 'usa', miami: 'usa', מיאמי: 'usa',
  'los angeles': 'usa', 'לוס אנג\'לס': 'usa', orlando: 'usa', אורלנדו: 'usa',
  'san francisco': 'usa',
  // Canada
  קנדה: 'canada', canada: 'canada', toronto: 'canada', טורונטו: 'canada',
  vancouver: 'canada', ונקובר: 'canada', montreal: 'canada', מונטריאול: 'canada',
  // Australia
  אוסטרליה: 'australia', australia: 'australia', sydney: 'australia', סידני: 'australia',
  melbourne: 'australia', מלבורן: 'australia',
  // India
  הודו: 'india', india: 'india', 'new delhi': 'india', 'ניו דלהי': 'india',
  goa: 'india', גואה: 'india', mumbai: 'india', מומבאי: 'india',
  // Singapore
  סינגפור: 'singapore', singapore: 'singapore',
  // Indonesia / Bali
  אינדונזיה: 'indonesia', indonesia: 'indonesia', bali: 'indonesia', באלי: 'indonesia',
  lombok: 'indonesia',
  // Vietnam
  וייטנאם: 'vietnam', vietnam: 'vietnam', 'ho chi minh': 'vietnam', 'הו צ\'י מין': 'vietnam',
  hanoi: 'vietnam', האנוי: 'vietnam', 'hoi an': 'vietnam', 'דה נאנג': 'vietnam',
  // Jordan
  ירדן: 'jordan', jordan: 'jordan', amman: 'jordan', עמאן: 'jordan', petra: 'jordan', פטרה: 'jordan',
  // Egypt
  מצרים: 'egypt', egypt: 'egypt', cairo: 'egypt', קהיר: 'egypt',
  hurghada: 'egypt', הורגדה: 'egypt', 'sharm el sheikh': 'egypt', שארם: 'egypt',
  // Morocco
  מרוקו: 'morocco', morocco: 'morocco', marrakech: 'morocco', מרקש: 'morocco',
  casablanca: 'morocco', 'fes': 'morocco', פז: 'morocco',
  // Maldives
  מלדיביים: 'maldives', maldives: 'maldives',
  // Cambodia
  קמבודיה: 'cambodia', cambodia: 'cambodia', 'פנום פן': 'cambodia', 'phnom penh': 'cambodia',
  'siem reap': 'cambodia', 'סיאם ריפ': 'cambodia',
  // Mexico
  מקסיקו: 'mexico', mexico: 'mexico', cancun: 'mexico', קנקון: 'mexico',
  'mexico city': 'mexico', tulum: 'mexico',
  // Israel
  ישראל: 'israel', israel: 'israel', 'תל אביב': 'israel', 'tel aviv': 'israel',
  ירושלים: 'israel', jerusalem: 'israel', eilat: 'israel', אילת: 'israel',
}

function getContactStyle(color: string): { icon: ElementType; bg: string } {
  if (color === 'bg-blue-500' || color === 'bg-indigo-500') return { icon: Shield, bg: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }
  if (color === 'bg-red-500') return { icon: Heart, bg: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }
  if (color === 'bg-orange-500') return { icon: Flame, bg: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' }
  if (color === 'bg-green-500') return { icon: Info, bg: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }
  if (color === 'bg-purple-500') return { icon: AlertTriangle, bg: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)' }
  if (color === 'bg-cyan-500') return { icon: Anchor, bg: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }
  if (color === 'bg-gray-500' || color === 'bg-gray-600') return { icon: Shield, bg: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)' }
  return { icon: Phone, bg: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }
}

function detectCountry(destination: string): CountryData {
  if (!destination) return GENERIC_DATA
  const lower = destination.toLowerCase().trim()
  if (DESTINATION_MAP[lower]) return EMERGENCY_DATA[DESTINATION_MAP[lower]] ?? GENERIC_DATA
  for (const [key, code] of Object.entries(DESTINATION_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return EMERGENCY_DATA[code] ?? GENERIC_DATA
    }
  }
  return GENERIC_DATA
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmergencyPage() {
  const { currentTrip } = useTrip()
  const countryData = detectCountry(currentTrip?.destination ?? '')
  const isGeneric = countryData === GENERIC_DATA

  const handleCall = (number: string) => {
    window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>מצב חירום</h1>
          {currentTrip && (
            <p className="text-xs text-gray-400">{countryData.flag} {currentTrip.name} · {currentTrip.destination}</p>
          )}
        </div>
      </div>

      {/* SOS Button */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-3xl p-6 text-center text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' }}>
        <p className="text-5xl mb-2">{countryData.flag}</p>
        <p className="font-black text-xl mb-1">חירום ב{countryData.nameHe}?</p>
        <p className="text-sm opacity-80 mb-5">לחץ להתקשרות מיידית</p>
        <button onClick={() => handleCall(countryData.primaryNumber)}
          className="bg-white text-red-600 rounded-2xl px-8 py-4 font-black text-3xl active:scale-95 transition-transform shadow-lg tracking-widest flex items-center gap-3 mx-auto">
          <Phone className="w-7 h-7" />
          {countryData.primaryNumber}
        </button>
        <p className="text-xs opacity-70 mt-3 font-medium">{countryData.primaryLabel}</p>
      </motion.div>

      {/* Emergency Numbers Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">מספרי חירום ב{countryData.nameHe}</h3>
        <div className="grid grid-cols-2 gap-2">
          {countryData.numbers.map((contact) => {
            const { icon: ContactIcon, bg } = getContactStyle(contact.color)
            return (
              <button key={contact.number + contact.label} onClick={() => handleCall(contact.number)}
                className="bg-white rounded-2xl p-4 shadow-sm text-center active:scale-[0.97] transition-all border border-gray-100">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: bg }}>
                  <ContactIcon className="w-5 h-5 text-white" />
                </div>
                <p className="text-[11px] font-medium text-gray-500 mb-0.5">{contact.label}</p>
                <p className="text-2xl font-black text-gray-900 tracking-wide" dir="ltr">{contact.number}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Embassy / Consulate — prominent card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wide">{countryData.embassy.type} ישראל</p>
            <p className="text-sm font-bold text-gray-800 leading-tight">{countryData.embassy.name}</p>
          </div>
        </div>

        {/* Address */}
        <div className="flex gap-2 text-xs text-gray-500">
          <MapPin className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
          <span>{countryData.embassy.address}</span>
        </div>

        {/* Hours */}
        {countryData.embassy.hours && (
          <div className="flex gap-2 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span>שעות קבלה: {countryData.embassy.hours}</span>
          </div>
        )}

        {/* Note (additional consulates) */}
        {countryData.embassy.note && (
          <div className="rounded-xl px-3 py-2 text-[10px] leading-relaxed" style={{ background: 'rgba(108,71,255,0.08)', color: '#6C47FF' }}>
            {countryData.embassy.note}
          </div>
        )}

        {/* Call Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleCall(countryData.embassy.phone)}
            className="text-white rounded-2xl py-3 text-xs font-bold active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <Phone className="w-3.5 h-3.5" />
            <span>מרכזייה</span>
          </button>
          <button onClick={() => handleCall(countryData.embassy.emergency)}
            className="text-white rounded-2xl py-3 text-xs font-bold active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>חירום 24/7</span>
          </button>
        </div>

        {/* Phone numbers shown */}
        <div className="grid grid-cols-2 gap-1">
          <p className="text-[9px] text-center text-primary font-mono">{countryData.embassy.phone}</p>
          <p className="text-[9px] text-center text-red-500 font-mono">{countryData.embassy.emergency}</p>
        </div>
      </div>

      {/* Israeli Foreign Ministry — always shown */}
      <div className="rounded-2xl p-4 shadow-sm border border-violet-100 space-y-2" style={{ background: 'rgba(108,71,255,0.04)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
            <Globe className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-bold text-gray-800">מוקד חירום — משרד החוץ הישראלי</p>
        </div>
        <p className="text-[10px] text-gray-400">זמין 24/7 לכל אזרח ישראלי בחו&quot;ל</p>
        <button onClick={() => handleCall('+97225303111')}
          className="w-full text-white rounded-2xl py-3 text-sm font-bold active:scale-95 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
          <Phone className="w-4 h-4" />
          +972-2-530-3111
        </button>
        <p className="text-[9px] text-gray-400 text-center">
          ניתן גם לשלוח WhatsApp לאותו מספר
        </p>
      </div>

      {/* Hospitals */}
      {countryData.hospitals && countryData.hospitals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">בתי חולים</h3>
          {countryData.hospitals.map((hospital) => (
            <button key={hospital.phone} onClick={() => handleCall(hospital.phone)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-all border border-gray-100">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' }}>
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs font-bold text-gray-800">{hospital.label}</p>
                <p className="text-[10px] text-gray-500">{hospital.value}</p>
                <p className="text-[10px] text-primary font-mono mt-0.5">{hospital.phone}</p>
              </div>
              <Phone className="w-4 h-4 text-primary flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Unknown country notice */}
      {isGeneric && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold text-amber-700">לא זוהה יעד ספציפי</p>
          </div>
          <p className="text-[10px] text-amber-600">
            צור טיול עם יעד מוגדר כדי לראות את מספרי החירום המדויקים עבור אותה מדינה.
          </p>
        </div>
      )}

      {/* Insurance reminder */}
      <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
        <p className="text-xs font-bold text-yellow-700 mb-1.5">🛡️ מידע חשוב לשעת חירום</p>
        <ul className="text-[10px] text-yellow-600 space-y-0.5 list-disc list-inside">
          <li>שמור את פוליסת הביטוח בדפים המסמכים</li>
          <li>ספר מספר ביטוח רפואי זמין בכרטיס הביטוח שלך</li>
          <li>משרד החוץ מספק עזרה גם לאזרחים ללא ביטוח</li>
          <li>בכל מקרה של מעצר — דרוש לדבר עם הקונסוליה</li>
        </ul>
      </div>
    </div>
  )
}
