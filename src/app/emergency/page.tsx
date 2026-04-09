'use client'

import { Phone, MapPin, Shield, Heart, AlertTriangle, ChevronLeft, Globe } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useTrip } from '@/contexts/TripContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmergencyNumber {
  label: string
  number: string
  icon: string
  color: string
}

interface EmbassyInfo {
  name: string
  address: string
  phone: string
  emergency: string
  hours?: string
}

interface HospitalInfo {
  label: string
  value: string
  phone: string
}

interface CountryData {
  nameHe: string
  primaryNumber: string
  primaryLabel: string
  numbers: EmergencyNumber[]
  embassy: EmbassyInfo
  hospitals?: HospitalInfo[]
}

// ── Emergency Data ────────────────────────────────────────────────────────────

const EMERGENCY_DATA: Record<string, CountryData> = {
  thailand: {
    nameHe: 'תאילנד',
    primaryNumber: '191',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '191', icon: '🚔', color: 'bg-blue-500' },
      { label: 'משטרת תיירות', number: '1155', icon: 'ℹ️', color: 'bg-green-500' },
      { label: 'אמבולנס', number: '1669', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '199', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בבנגקוק',
      address: '25 Ocean Tower 2, Soi Sukhumvit 19, Bangkok 10110',
      phone: '+66-2-204-9200',
      emergency: '+66-81-919-5951',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'בית חולים פוקט', value: 'Vachira Phuket Hospital', phone: '+66-76-361-234' },
      { label: 'בית חולים קוסמוי', value: 'Koh Samui Hospital', phone: '+66-77-421-230' },
      { label: 'בית חולים בנגקוק', value: 'Bumrungrad International Hospital', phone: '+66-2-066-8888' },
    ],
  },
  israel: {
    nameHe: 'ישראל',
    primaryNumber: '100',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '100', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס (מד"א)', number: '101', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '102', icon: '🔥', color: 'bg-orange-500' },
      { label: 'משטרת תיירות', number: '1599', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      name: 'משרד החוץ הישראלי',
      address: 'רחוב יצחק רבין 9, ירושלים',
      phone: '+972-2-530-3111',
      emergency: '+972-2-530-3111',
      hours: 'א-ה 08:00-16:00',
    },
  },
  uae: {
    nameHe: 'איחוד האמירויות',
    primaryNumber: '999',
    primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'משטרה', number: '999', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '998', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '997', icon: '🔥', color: 'bg-orange-500' },
      { label: 'מוקד תיירות', number: '800DUBAI', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל באבו דאבי',
      address: 'Tower 1, Al Maqam Tower, Abu Dhabi Global Market Square',
      phone: '+971-2-234-4000',
      emergency: '+971-50-565-1020',
      hours: 'א-ה 09:00-13:00',
    },
    hospitals: [
      { label: 'דובאי', value: 'Rashid Hospital', phone: '+971-4-219-2000' },
      { label: 'אבו דאבי', value: 'Cleveland Clinic Abu Dhabi', phone: '+971-2-501-9000' },
    ],
  },
  turkey: {
    nameHe: 'טורקיה',
    primaryNumber: '155',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '155', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '112', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '110', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל באנקרה',
      address: 'Mahatma Gandhi Cad. No. 85, 06700 Gaziosmanpasa, Ankara',
      phone: '+90-312-446-3605',
      emergency: '+90-530-856-6666',
      hours: 'א-ה 09:00-12:30',
    },
    hospitals: [
      { label: 'איסטנבול', value: 'American Hospital Istanbul', phone: '+90-212-444-3777' },
      { label: 'אנטליה', value: 'Antalya Memorial Hospital', phone: '+90-242-314-6000' },
    ],
  },
  greece: {
    nameHe: 'יוון',
    primaryNumber: '112',
    primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'משטרה', number: '100', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '166', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '199', icon: '🔥', color: 'bg-orange-500' },
      { label: 'משטרת תיירות', number: '171', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל באתונה',
      address: 'Marathonodromon 1 & Vas. Sofias Ave., 154 52 Psychico, Athens',
      phone: '+30-210-670-0500',
      emergency: '+30-694-659-0000',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'אתונה', value: 'Evangelismos Hospital', phone: '+30-213-204-1000' },
    ],
  },
  italy: {
    nameHe: 'איטליה',
    primaryNumber: '112',
    primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🚔', color: 'bg-blue-500' },
      { label: 'משטרה', number: '113', icon: '🚔', color: 'bg-indigo-500' },
      { label: 'אמבולנס', number: '118', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל ברומא',
      address: 'Via Michele Mercati 12, 00197 Roma',
      phone: '+39-06-361-5500',
      emergency: '+39-335-123-4567',
      hours: 'א-ה 09:00-12:30',
    },
    hospitals: [
      { label: 'רומא', value: 'Policlinico Gemelli', phone: '+39-06-30151' },
      { label: 'מילאנו', value: 'Ospedale Niguarda', phone: '+39-02-6444-1' },
    ],
  },
  france: {
    nameHe: 'צרפת',
    primaryNumber: '112',
    primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🚔', color: 'bg-blue-500' },
      { label: 'משטרה', number: '17', icon: '🚔', color: 'bg-indigo-500' },
      { label: 'אמבולנס (SAMU)', number: '15', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '18', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בפריז',
      address: '3 Rue Rabelais, 75008 Paris',
      phone: '+33-1-4076-5500',
      emergency: '+33-6-0833-3333',
      hours: 'א-ה 09:00-12:30',
    },
    hospitals: [
      { label: 'פריז', value: 'Hôpital Lariboisière', phone: '+33-1-4995-6000' },
    ],
  },
  spain: {
    nameHe: 'ספרד',
    primaryNumber: '112',
    primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🚔', color: 'bg-blue-500' },
      { label: 'משטרה לאומית', number: '091', icon: '🚔', color: 'bg-indigo-500' },
      { label: 'אמבולנס', number: '061', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      name: "שגרירות ישראל במדריד",
      address: 'Calle Velázquez 150, 28002 Madrid',
      phone: '+34-91-782-9500',
      emergency: '+34-607-133-333',
      hours: 'א-ה 09:00-13:00',
    },
    hospitals: [
      { label: 'מדריד', value: 'Hospital Universitario La Paz', phone: '+34-91-727-7000' },
    ],
  },
  uk: {
    nameHe: 'בריטניה',
    primaryNumber: '999',
    primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '999', icon: '🚔', color: 'bg-blue-500' },
      { label: 'חירום אירופי', number: '112', icon: '🚑', color: 'bg-red-500' },
      { label: 'מידע לא-דחוף', number: '101', icon: 'ℹ️', color: 'bg-green-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בלונדון',
      address: '2 Palace Green, London W8 4QB',
      phone: '+44-20-7957-9500',
      emergency: '+44-7944-123-456',
      hours: 'א-ה 09:00-13:00',
    },
    hospitals: [
      { label: 'לונדון', value: "St Thomas' Hospital", phone: '+44-20-7188-7188' },
    ],
  },
  germany: {
    nameHe: 'גרמניה',
    primaryNumber: '112',
    primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום / אמבולנס', number: '112', icon: '🚑', color: 'bg-red-500' },
      { label: 'משטרה', number: '110', icon: '🚔', color: 'bg-blue-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בברלין',
      address: 'Auguste-Viktoria-Str. 74-76, 14193 Berlin',
      phone: '+49-30-8904-5500',
      emergency: '+49-152-2142-0000',
      hours: 'א-ה 09:00-12:30',
    },
    hospitals: [
      { label: 'ברלין', value: 'Charité – Universitätsmedizin Berlin', phone: '+49-30-450-50' },
    ],
  },
  usa: {
    nameHe: 'ארצות הברית',
    primaryNumber: '911',
    primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '911', icon: '🚔', color: 'bg-blue-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בוושינגטון',
      address: '3514 International Dr NW, Washington, DC 20008',
      phone: '+1-202-364-5500',
      emergency: '+1-202-364-5590',
      hours: 'א-ה 09:00-13:00',
    },
    hospitals: [
      { label: 'ניו יורק', value: 'NewYork-Presbyterian Hospital', phone: '+1-212-746-5454' },
    ],
  },
  india: {
    nameHe: 'הודו',
    primaryNumber: '112',
    primaryLabel: 'חירום כללי',
    numbers: [
      { label: 'חירום כללי', number: '112', icon: '🚔', color: 'bg-blue-500' },
      { label: 'מוקד תיירות', number: '1363', icon: 'ℹ️', color: 'bg-green-500' },
      { label: 'אמבולנס', number: '108', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      name: "שגרירות ישראל בניו דלהי",
      address: '3 Aurangzeb Road, New Delhi 110011',
      phone: '+91-11-3041-3500',
      emergency: '+91-98-1818-3333',
      hours: 'א-ה 09:00-13:00',
    },
    hospitals: [
      { label: 'ניו דלהי', value: 'Indraprastha Apollo Hospital', phone: '+91-11-2692-5858' },
    ],
  },
  singapore: {
    nameHe: 'סינגפור',
    primaryNumber: '999',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '999', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס / כבאים', number: '995', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בסינגפור',
      address: '58 Dalvey Road, Singapore 259479',
      phone: '+65-6834-9400',
      emergency: '+65-9833-4400',
      hours: 'א-ה 09:00-12:30',
    },
    hospitals: [
      { label: 'סינגפור', value: 'Singapore General Hospital', phone: '+65-6222-3322' },
    ],
  },
  indonesia: {
    nameHe: 'אינדונזיה / באלי',
    primaryNumber: '110',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '110', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '118', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '113', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בג\'קרטה',
      address: 'Jl. Denpasar Raya Kav. 10, Jakarta 12950',
      phone: '+62-21-520-3931',
      emergency: '+62-812-1000-4455',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'באלי', value: 'BIMC Hospital Kuta', phone: '+62-361-761-263' },
      { label: "ג'קרטה", value: 'RS Siloam Hospitals', phone: '+62-21-2996-9999' },
    ],
  },
  vietnam: {
    nameHe: 'וייטנאם',
    primaryNumber: '113',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '113', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '115', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '114', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בהאנוי',
      address: '68 Nguyen Thai Hoc Street, Ba Dinh District, Hanoi',
      phone: '+84-24-3843-6615',
      emergency: '+84-90-340-0000',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'הו צ\'י מין', value: 'FV Hospital Ho Chi Minh City', phone: '+84-28-5411-3333' },
    ],
  },
  jordan: {
    nameHe: 'ירדן',
    primaryNumber: '911',
    primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '911', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '911', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בעמאן',
      address: '47 Mithqal Al-Fayez Street, Rabieh, Amman',
      phone: '+962-6-550-0500',
      emergency: '+962-79-555-0500',
      hours: 'א-ה 09:00-12:30',
    },
    hospitals: [
      { label: 'עמאן', value: 'Jordan Hospital', phone: '+962-6-560-8080' },
    ],
  },
  egypt: {
    nameHe: 'מצרים',
    primaryNumber: '126',
    primaryLabel: 'משטרת תיירות',
    numbers: [
      { label: 'משטרת תיירות', number: '126', icon: 'ℹ️', color: 'bg-green-500' },
      { label: 'אמבולנס', number: '123', icon: '🚑', color: 'bg-red-500' },
      { label: 'משטרה', number: '122', icon: '🚔', color: 'bg-blue-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בקהיר',
      address: '6 Ibn Malek Street, Giza, Cairo',
      phone: '+20-2-3332-1500',
      emergency: '+20-100-123-4567',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'קהיר', value: 'Cairo University Hospital (Kasr Al-Ainy)', phone: '+20-2-2368-0003' },
    ],
  },
  morocco: {
    nameHe: 'מרוקו',
    primaryNumber: '19',
    primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '19', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '150', icon: '🚑', color: 'bg-red-500' },
      { label: 'כיבוי אש', number: '15', icon: '🔥', color: 'bg-orange-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל ברבאט',
      address: 'Rue El Farabi, Rabat',
      phone: '+212-537-668-726',
      emergency: '+212-661-234-567',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'מרקש', value: 'Clinique Internationale de Marrakech', phone: '+212-524-336-700' },
    ],
  },
  maldives: {
    nameHe: 'מלדיביים',
    primaryNumber: '118',
    primaryLabel: 'שירותי חירום',
    numbers: [
      { label: 'שירותי חירום', number: '118', icon: '🚑', color: 'bg-red-500' },
      { label: 'משמר חוף', number: '191', icon: 'ℹ️', color: 'bg-blue-500' },
      { label: 'משטרה', number: '119', icon: '🚔', color: 'bg-indigo-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בניו דלהי (אחראית על מלדיביים)',
      address: '3 Aurangzeb Road, New Delhi 110011, India',
      phone: '+91-11-3041-3500',
      emergency: '+91-98-1818-3333',
      hours: 'א-ה 09:00-13:00',
    },
    hospitals: [
      { label: 'מאלה', value: 'ADK Hospital', phone: '+960-313-3535' },
    ],
  },
  cambodia: {
    nameHe: 'קמבודיה',
    primaryNumber: '117',
    primaryLabel: 'משטרה',
    numbers: [
      { label: 'משטרה', number: '117', icon: '🚔', color: 'bg-blue-500' },
      { label: 'אמבולנס', number: '119', icon: '🚑', color: 'bg-red-500' },
    ],
    embassy: {
      name: 'שגרירות ישראל בבנגקוק (אחראית על קמבודיה)',
      address: '25 Ocean Tower 2, Soi Sukhumvit 19, Bangkok 10110',
      phone: '+66-2-204-9200',
      emergency: '+66-81-919-5951',
      hours: 'א-ה 09:00-12:00',
    },
    hospitals: [
      { label: 'פנום פן', value: 'Royal Phnom Penh Hospital', phone: '+855-23-991-000' },
    ],
  },
}

const GENERIC_DATA: CountryData = {
  nameHe: 'בינלאומי',
  primaryNumber: '112',
  primaryLabel: 'חירום בינלאומי',
  numbers: [
    { label: 'חירום בינלאומי', number: '112', icon: '🚔', color: 'bg-blue-500' },
  ],
  embassy: {
    name: 'משרד החוץ — מוקד חירום',
    address: 'ירושלים, ישראל',
    phone: '+972-2-530-3111',
    emergency: '+972-2-530-3111',
    hours: '24/7',
  },
}

// ── Destination Mapping ───────────────────────────────────────────────────────

const DESTINATION_MAP: Record<string, string> = {
  // Thailand
  תאילנד: 'thailand', thailand: 'thailand', phuket: 'thailand', פוקט: 'thailand',
  bangkok: 'thailand', 'בנגקוק': 'thailand', 'קוסמוי': 'thailand', 'ko samui': 'thailand',
  'chiang mai': 'thailand', 'צ\'יאנג מאי': 'thailand', krabi: 'thailand', 'קראבי': 'thailand',
  // Israel
  ישראל: 'israel', israel: 'israel', 'תל אביב': 'israel', 'tel aviv': 'israel',
  ירושלים: 'israel', jerusalem: 'israel', eilat: 'israel', אילת: 'israel',
  // UAE / Dubai
  דובאי: 'uae', dubai: 'uae', 'אבו דאבי': 'uae', 'abu dhabi': 'uae',
  'איחוד האמירויות': 'uae', uae: 'uae',
  // Turkey
  טורקיה: 'turkey', turkey: 'turkey', istanbul: 'turkey', איסטנבול: 'turkey',
  antalya: 'turkey', אנטליה: 'turkey', bodrum: 'turkey', בודרום: 'turkey',
  // Greece
  יוון: 'greece', greece: 'greece', athens: 'greece', אתונה: 'greece',
  mykonos: 'greece', מיקונוס: 'greece', santorini: 'greece', סנטוריני: 'greece',
  // Italy
  איטליה: 'italy', italy: 'italy', rome: 'italy', רומא: 'italy',
  milan: 'italy', מילאנו: 'italy', venice: 'italy', ונציה: 'italy',
  // France
  צרפת: 'france', france: 'france', paris: 'france', פריז: 'france',
  // Spain
  ספרד: 'spain', spain: 'spain', madrid: 'spain', מדריד: 'spain',
  barcelona: 'spain', ברצלונה: 'spain',
  // UK
  בריטניה: 'uk', 'united kingdom': 'uk', london: 'uk', לונדון: 'uk', uk: 'uk', england: 'uk',
  // Germany
  גרמניה: 'germany', germany: 'germany', berlin: 'germany', ברלין: 'germany',
  // USA
  'ארצות הברית': 'usa', usa: 'usa', 'united states': 'usa', 'new york': 'usa',
  'ניו יורק': 'usa', 'לאס וגאס': 'usa', 'las vegas': 'usa',
  // India
  הודו: 'india', india: 'india', 'new delhi': 'india', 'ניו דלהי': 'india',
  goa: 'india', גואה: 'india',
  // Singapore
  סינגפור: 'singapore', singapore: 'singapore',
  // Indonesia / Bali
  אינדונזיה: 'indonesia', indonesia: 'indonesia', bali: 'indonesia', באלי: 'indonesia',
  // Vietnam
  וייטנאם: 'vietnam', vietnam: 'vietnam', 'ho chi minh': 'vietnam', 'הו צ\'י מין': 'vietnam',
  hanoi: 'vietnam', האנוי: 'vietnam',
  // Jordan
  ירדן: 'jordan', jordan: 'jordan', amman: 'jordan', עמאן: 'jordan', petra: 'jordan', פטרה: 'jordan',
  // Egypt
  מצרים: 'egypt', egypt: 'egypt', cairo: 'egypt', קהיר: 'egypt', hurghada: 'egypt', הורגדה: 'egypt',
  // Morocco
  מרוקו: 'morocco', morocco: 'morocco', marrakech: 'morocco', מרקש: 'morocco',
  // Maldives
  מלדיביים: 'maldives', maldives: 'maldives',
  // Cambodia
  קמבודיה: 'cambodia', cambodia: 'cambodia', 'פנום פן': 'cambodia', 'phnom penh': 'cambodia',
}

function detectCountry(destination: string): CountryData {
  if (!destination) return GENERIC_DATA
  const lower = destination.toLowerCase().trim()
  // Try exact match first
  if (DESTINATION_MAP[lower]) return EMERGENCY_DATA[DESTINATION_MAP[lower]] ?? GENERIC_DATA
  // Try partial match
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

  const handleCall = (number: string) => {
    window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-red-500">מצב חירום</h1>
          {currentTrip && (
            <p className="text-xs text-gray-400">{currentTrip.name}</p>
          )}
        </div>
      </div>

      {/* SOS Button */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-br from-red-500 to-red-600 rounded-3xl p-6 text-center text-white shadow-lg">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
        <p className="font-bold text-lg">חירום ב{countryData.nameHe}?</p>
        <p className="text-sm opacity-80 mb-4">התקשר למספר החירום המתאים</p>
        <button onClick={() => handleCall(countryData.primaryNumber)}
          className="bg-white text-red-500 rounded-2xl px-8 py-3 font-bold text-lg active:scale-95 transition-transform shadow-md">
          {countryData.primaryNumber} — {countryData.primaryLabel}
        </button>
      </motion.div>

      {/* Destination Emergency Numbers */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-600">מספרי חירום ב{countryData.nameHe}</h3>
        <div className="grid grid-cols-2 gap-2">
          {countryData.numbers.map((contact) => (
            <button key={contact.number + contact.label} onClick={() => handleCall(contact.number)}
              className="bg-white rounded-2xl p-4 shadow-sm text-center active:scale-95 transition-transform">
              <div className={`w-10 h-10 ${contact.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                <span className="text-lg">{contact.icon}</span>
              </div>
              <p className="text-xs font-medium">{contact.label}</p>
              <p className="text-lg font-bold text-primary">{contact.number}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Embassy */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold">{countryData.embassy.name}</h3>
        </div>
        <p className="text-xs text-gray-500">{countryData.embassy.address}</p>
        <div className="flex gap-2">
          <button onClick={() => handleCall(countryData.embassy.phone)}
            className="flex-1 bg-blue-50 text-blue-600 rounded-xl py-2.5 text-xs font-medium active:scale-95 flex items-center justify-center gap-1">
            <Phone className="w-3 h-3" /> {countryData.embassy.phone}
          </button>
          <button onClick={() => handleCall(countryData.embassy.emergency)}
            className="flex-1 bg-red-50 text-red-500 rounded-xl py-2.5 text-xs font-medium active:scale-95 flex items-center justify-center gap-1">
            <Phone className="w-3 h-3" /> חירום
          </button>
        </div>
        {countryData.embassy.hours && (
          <p className="text-[10px] text-gray-400">שעות: {countryData.embassy.hours}</p>
        )}
      </div>

      {/* Hospitals */}
      {countryData.hospitals && countryData.hospitals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-600">בתי חולים</h3>
          {countryData.hospitals.map((hospital) => (
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
      )}

      {/* Generic International Fallback */}
      {countryData === GENERIC_DATA && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold">מוקד חירום ישראלי בחו"ל</h3>
          </div>
          <p className="text-xs text-gray-500">
            משרד החוץ — מוקד חירום 24/7
          </p>
          <button onClick={() => handleCall('+972-2-530-3111')}
            className="w-full bg-blue-50 text-blue-600 rounded-xl py-2.5 text-xs font-medium active:scale-95 flex items-center justify-center gap-1">
            <Phone className="w-3 h-3" /> +972-2-530-3111
          </button>
        </div>
      )}

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
