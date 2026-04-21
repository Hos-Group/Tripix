export interface DestinationConfig {
  country: string
  countryHe: string
  currency: string
  currencySymbol: string
  timezone: string
  emergencyPolice: string
  emergencyAmbulance: string
  emergencyFire: string
  touristPolice?: string
  embassyPhone?: string
  languages: string[]
  plugType: string
  drivingSide: 'right' | 'left'
  tipCustom: string
}

export const DESTINATIONS: Record<string, DestinationConfig> = {
  // Middle East
  Israel: { country: 'Israel', countryHe: 'ישראל', currency: 'ILS', currencySymbol: '₪', timezone: 'Asia/Jerusalem', emergencyPolice: '100', emergencyAmbulance: '101', emergencyFire: '102', languages: ['Hebrew','Arabic','English'], plugType: 'C/H', drivingSide: 'right', tipCustom: '10-15% במסעדות' },

  // Asia
  Thailand: { country: 'Thailand', countryHe: 'תאילנד', currency: 'THB', currencySymbol: '฿', timezone: 'Asia/Bangkok', emergencyPolice: '191', emergencyAmbulance: '1669', emergencyFire: '199', touristPolice: '1155', embassyPhone: '+66-2-204-9200', languages: ['Thai','English'], plugType: 'A/B/C', drivingSide: 'left', tipCustom: '10-20 THB שירות, 50-100 THB מסעדות' },
  Japan: { country: 'Japan', countryHe: 'יפן', currency: 'JPY', currencySymbol: '¥', timezone: 'Asia/Tokyo', emergencyPolice: '110', emergencyAmbulance: '119', emergencyFire: '119', languages: ['Japanese'], plugType: 'A/B', drivingSide: 'left', tipCustom: 'אין צורך בטיפ' },
  China: { country: 'China', countryHe: 'סין', currency: 'CNY', currencySymbol: '¥', timezone: 'Asia/Shanghai', emergencyPolice: '110', emergencyAmbulance: '120', emergencyFire: '119', languages: ['Chinese'], plugType: 'A/C/I', drivingSide: 'right', tipCustom: 'אין צורך בטיפ' },
  SouthKorea: { country: 'South Korea', countryHe: 'דרום קוריאה', currency: 'KRW', currencySymbol: '₩', timezone: 'Asia/Seoul', emergencyPolice: '112', emergencyAmbulance: '119', emergencyFire: '119', languages: ['Korean'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'אין צורך בטיפ' },
  India: { country: 'India', countryHe: 'הודו', currency: 'INR', currencySymbol: '₹', timezone: 'Asia/Kolkata', emergencyPolice: '100', emergencyAmbulance: '108', emergencyFire: '101', languages: ['Hindi','English'], plugType: 'C/D/M', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Vietnam: { country: 'Vietnam', countryHe: 'וייטנאם', currency: 'VND', currencySymbol: '₫', timezone: 'Asia/Ho_Chi_Minh', emergencyPolice: '113', emergencyAmbulance: '115', emergencyFire: '114', languages: ['Vietnamese'], plugType: 'A/C', drivingSide: 'right', tipCustom: '5-10% מסעדות יוקרתיות' },
  Indonesia: { country: 'Indonesia', countryHe: 'אינדונזיה', currency: 'IDR', currencySymbol: 'Rp', timezone: 'Asia/Jakarta', emergencyPolice: '110', emergencyAmbulance: '118', emergencyFire: '113', languages: ['Indonesian','English'], plugType: 'C/F', drivingSide: 'left', tipCustom: '5-10% במסעדות' },
  Philippines: { country: 'Philippines', countryHe: 'פיליפינים', currency: 'PHP', currencySymbol: '₱', timezone: 'Asia/Manila', emergencyPolice: '117', emergencyAmbulance: '911', emergencyFire: '160', languages: ['Filipino','English'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Malaysia: { country: 'Malaysia', countryHe: 'מלזיה', currency: 'MYR', currencySymbol: 'RM', timezone: 'Asia/Kuala_Lumpur', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '994', languages: ['Malay','English'], plugType: 'G', drivingSide: 'left', tipCustom: 'אין חובה, 10% יוקרתי' },
  Singapore: { country: 'Singapore', countryHe: 'סינגפור', currency: 'SGD', currencySymbol: 'S$', timezone: 'Asia/Singapore', emergencyPolice: '999', emergencyAmbulance: '995', emergencyFire: '995', languages: ['English','Chinese','Malay'], plugType: 'G', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Cambodia: { country: 'Cambodia', countryHe: 'קמבודיה', currency: 'USD', currencySymbol: '$', timezone: 'Asia/Phnom_Penh', emergencyPolice: '117', emergencyAmbulance: '119', emergencyFire: '118', languages: ['Khmer','English'], plugType: 'A/C', drivingSide: 'right', tipCustom: '$1-2 במסעדות' },
  SriLanka: { country: 'Sri Lanka', countryHe: 'סרי לנקה', currency: 'LKR', currencySymbol: 'Rs', timezone: 'Asia/Colombo', emergencyPolice: '119', emergencyAmbulance: '110', emergencyFire: '110', languages: ['Sinhala','Tamil','English'], plugType: 'D/G', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Nepal: { country: 'Nepal', countryHe: 'נפאל', currency: 'NPR', currencySymbol: '₨', timezone: 'Asia/Kathmandu', emergencyPolice: '100', emergencyAmbulance: '102', emergencyFire: '101', languages: ['Nepali','English'], plugType: 'C/D', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Maldives: { country: 'Maldives', countryHe: 'מלדיביים', currency: 'USD', currencySymbol: '$', timezone: 'Indian/Maldives', emergencyPolice: '119', emergencyAmbulance: '102', emergencyFire: '118', languages: ['Dhivehi','English'], plugType: 'G', drivingSide: 'left', tipCustom: '10% כלול בחשבון' },
  UAE: { country: 'UAE', countryHe: 'איחוד האמירויות', currency: 'AED', currencySymbol: 'د.إ', timezone: 'Asia/Dubai', emergencyPolice: '999', emergencyAmbulance: '998', emergencyFire: '997', languages: ['Arabic','English'], plugType: 'G', drivingSide: 'right', tipCustom: '10-15% במסעדות' },
  Jordan: { country: 'Jordan', countryHe: 'ירדן', currency: 'JOD', currencySymbol: 'JD', timezone: 'Asia/Amman', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Arabic','English'], plugType: 'B/C/D/F/G/J', drivingSide: 'right', tipCustom: '10% במסעדות' },

  // Europe
  Italy: { country: 'Italy', countryHe: 'איטליה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Rome', emergencyPolice: '112', emergencyAmbulance: '118', emergencyFire: '115', languages: ['Italian'], plugType: 'C/F/L', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  France: { country: 'France', countryHe: 'צרפת', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Paris', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French'], plugType: 'C/E', drivingSide: 'right', tipCustom: 'כלול בחשבון, עיגול' },
  Spain: { country: 'Spain', countryHe: 'ספרד', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Madrid', emergencyPolice: '091', emergencyAmbulance: '061', emergencyFire: '080', languages: ['Spanish','Catalan'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10%, עיגול בברים' },
  Germany: { country: 'Germany', countryHe: 'גרמניה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Berlin', emergencyPolice: '110', emergencyAmbulance: '112', emergencyFire: '112', languages: ['German'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  UK: { country: 'United Kingdom', countryHe: 'בריטניה', currency: 'GBP', currencySymbol: '£', timezone: 'Europe/London', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['English'], plugType: 'G', drivingSide: 'left', tipCustom: '10-15% במסעדות' },
  Netherlands: { country: 'Netherlands', countryHe: 'הולנד', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Amsterdam', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Dutch','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  Portugal: { country: 'Portugal', countryHe: 'פורטוגל', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Lisbon', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Portuguese'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  Greece: { country: 'Greece', countryHe: 'יוון', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Athens', emergencyPolice: '100', emergencyAmbulance: '166', emergencyFire: '199', languages: ['Greek','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  Turkey: { country: 'Turkey', countryHe: 'טורקיה', currency: 'TRY', currencySymbol: '₺', timezone: 'Europe/Istanbul', emergencyPolice: '155', emergencyAmbulance: '112', emergencyFire: '110', languages: ['Turkish'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  Croatia: { country: 'Croatia', countryHe: 'קרואטיה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Zagreb', emergencyPolice: '192', emergencyAmbulance: '194', emergencyFire: '193', languages: ['Croatian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },
  CzechRepublic: { country: 'Czech Republic', countryHe: 'צ\'כיה', currency: 'CZK', currencySymbol: 'Kč', timezone: 'Europe/Prague', emergencyPolice: '158', emergencyAmbulance: '155', emergencyFire: '150', languages: ['Czech','English'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Hungary: { country: 'Hungary', countryHe: 'הונגריה', currency: 'HUF', currencySymbol: 'Ft', timezone: 'Europe/Budapest', emergencyPolice: '107', emergencyAmbulance: '104', emergencyFire: '105', languages: ['Hungarian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Austria: { country: 'Austria', countryHe: 'אוסטריה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Vienna', emergencyPolice: '133', emergencyAmbulance: '144', emergencyFire: '122', languages: ['German'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10% במסעדות' },
  Switzerland: { country: 'Switzerland', countryHe: 'שווייץ', currency: 'CHF', currencySymbol: 'CHF', timezone: 'Europe/Zurich', emergencyPolice: '117', emergencyAmbulance: '144', emergencyFire: '118', languages: ['German','French','Italian'], plugType: 'C/J', drivingSide: 'right', tipCustom: 'כלול בחשבון' },
  Poland: { country: 'Poland', countryHe: 'פולין', currency: 'PLN', currencySymbol: 'zł', timezone: 'Europe/Warsaw', emergencyPolice: '997', emergencyAmbulance: '999', emergencyFire: '998', languages: ['Polish'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Romania: { country: 'Romania', countryHe: 'רומניה', currency: 'RON', currencySymbol: 'lei', timezone: 'Europe/Bucharest', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Romanian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Bulgaria: { country: 'Bulgaria', countryHe: 'בולגריה', currency: 'BGN', currencySymbol: 'лв', timezone: 'Europe/Sofia', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Bulgarian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Sweden: { country: 'Sweden', countryHe: 'שבדיה', currency: 'SEK', currencySymbol: 'kr', timezone: 'Europe/Stockholm', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Swedish','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'עיגול, 5-10%' },
  Norway: { country: 'Norway', countryHe: 'נורבגיה', currency: 'NOK', currencySymbol: 'kr', timezone: 'Europe/Oslo', emergencyPolice: '112', emergencyAmbulance: '113', emergencyFire: '110', languages: ['Norwegian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'עיגול, לא חובה' },
  Denmark: { country: 'Denmark', countryHe: 'דנמרק', currency: 'DKK', currencySymbol: 'kr', timezone: 'Europe/Copenhagen', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Danish','English'], plugType: 'C/K', drivingSide: 'right', tipCustom: 'כלול בחשבון' },
  Finland: { country: 'Finland', countryHe: 'פינלנד', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Helsinki', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Finnish','Swedish','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Iceland: { country: 'Iceland', countryHe: 'איסלנד', currency: 'ISK', currencySymbol: 'kr', timezone: 'Atlantic/Reykjavik', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Icelandic','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Ireland: { country: 'Ireland', countryHe: 'אירלנד', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Dublin', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['English','Irish'], plugType: 'G', drivingSide: 'left', tipCustom: '10-15% במסעדות' },
  Belgium: { country: 'Belgium', countryHe: 'בלגיה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Brussels', emergencyPolice: '101', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Dutch','French','German'], plugType: 'C/E', drivingSide: 'right', tipCustom: 'כלול, עיגול' },
  Cyprus: { country: 'Cyprus', countryHe: 'קפריסין', currency: 'EUR', currencySymbol: '€', timezone: 'Asia/Nicosia', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Greek','Turkish','English'], plugType: 'G', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Montenegro: { country: 'Montenegro', countryHe: 'מונטנגרו', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Podgorica', emergencyPolice: '122', emergencyAmbulance: '124', emergencyFire: '123', languages: ['Montenegrin','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Albania: { country: 'Albania', countryHe: 'אלבניה', currency: 'ALL', currencySymbol: 'L', timezone: 'Europe/Tirane', emergencyPolice: '129', emergencyAmbulance: '127', emergencyFire: '128', languages: ['Albanian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Georgia: { country: 'Georgia', countryHe: 'גאורגיה', currency: 'GEL', currencySymbol: '₾', timezone: 'Asia/Tbilisi', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Georgian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10% במסעדות' },

  // Americas
  USA: { country: 'United States', countryHe: 'ארה"ב', currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'A/B', drivingSide: 'right', tipCustom: '15-20% במסעדות, $1-2 לברמן' },
  Canada: { country: 'Canada', countryHe: 'קנדה', currency: 'CAD', currencySymbol: 'C$', timezone: 'America/Toronto', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English','French'], plugType: 'A/B', drivingSide: 'right', tipCustom: '15-20% במסעדות' },
  Mexico: { country: 'Mexico', countryHe: 'מקסיקו', currency: 'MXN', currencySymbol: '$', timezone: 'America/Mexico_City', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10-15% במסעדות' },
  Brazil: { country: 'Brazil', countryHe: 'ברזיל', currency: 'BRL', currencySymbol: 'R$', timezone: 'America/Sao_Paulo', emergencyPolice: '190', emergencyAmbulance: '192', emergencyFire: '193', languages: ['Portuguese'], plugType: 'C/N', drivingSide: 'right', tipCustom: '10% כלול בחשבון' },
  Argentina: { country: 'Argentina', countryHe: 'ארגנטינה', currency: 'ARS', currencySymbol: '$', timezone: 'America/Buenos_Aires', emergencyPolice: '101', emergencyAmbulance: '107', emergencyFire: '100', languages: ['Spanish'], plugType: 'C/I', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Colombia: { country: 'Colombia', countryHe: 'קולומביה', currency: 'COP', currencySymbol: '$', timezone: 'America/Bogota', emergencyPolice: '123', emergencyAmbulance: '125', emergencyFire: '119', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Peru: { country: 'Peru', countryHe: 'פרו', currency: 'PEN', currencySymbol: 'S/', timezone: 'America/Lima', emergencyPolice: '105', emergencyAmbulance: '116', emergencyFire: '116', languages: ['Spanish'], plugType: 'A/B/C', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Chile: { country: 'Chile', countryHe: 'צ\'ילה', currency: 'CLP', currencySymbol: '$', timezone: 'America/Santiago', emergencyPolice: '133', emergencyAmbulance: '131', emergencyFire: '132', languages: ['Spanish'], plugType: 'C/L', drivingSide: 'right', tipCustom: '10% במסעדות' },
  CostaRica: { country: 'Costa Rica', countryHe: 'קוסטה ריקה', currency: 'CRC', currencySymbol: '₡', timezone: 'America/Costa_Rica', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Cuba: { country: 'Cuba', countryHe: 'קובה', currency: 'CUP', currencySymbol: '$', timezone: 'America/Havana', emergencyPolice: '106', emergencyAmbulance: '104', emergencyFire: '105', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10% CUC במסעדות' },
  DominicanRepublic: { country: 'Dominican Republic', countryHe: 'הרפובליקה הדומיניקנית', currency: 'DOP', currencySymbol: 'RD$', timezone: 'America/Santo_Domingo', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10% במסעדות' },

  // Africa
  Morocco: { country: 'Morocco', countryHe: 'מרוקו', currency: 'MAD', currencySymbol: 'MAD', timezone: 'Africa/Casablanca', emergencyPolice: '190', emergencyAmbulance: '150', emergencyFire: '150', languages: ['Arabic','French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10% במסעדות' },
  SouthAfrica: { country: 'South Africa', countryHe: 'דרום אפריקה', currency: 'ZAR', currencySymbol: 'R', timezone: 'Africa/Johannesburg', emergencyPolice: '10111', emergencyAmbulance: '10177', emergencyFire: '10177', languages: ['English','Afrikaans','Zulu'], plugType: 'M/N', drivingSide: 'left', tipCustom: '10-15% במסעדות' },
  Kenya: { country: 'Kenya', countryHe: 'קניה', currency: 'KES', currencySymbol: 'KSh', timezone: 'Africa/Nairobi', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Swahili','English'], plugType: 'G', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Tanzania: { country: 'Tanzania', countryHe: 'טנזניה', currency: 'TZS', currencySymbol: 'TSh', timezone: 'Africa/Dar_es_Salaam', emergencyPolice: '112', emergencyAmbulance: '114', emergencyFire: '112', languages: ['Swahili','English'], plugType: 'D/G', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Egypt: { country: 'Egypt', countryHe: 'מצרים', currency: 'EGP', currencySymbol: 'E£', timezone: 'Africa/Cairo', emergencyPolice: '122', emergencyAmbulance: '123', emergencyFire: '180', languages: ['Arabic'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10-15% במסעדות' },

  // Oceania
  Australia: { country: 'Australia', countryHe: 'אוסטרליה', currency: 'AUD', currencySymbol: 'A$', timezone: 'Australia/Sydney', emergencyPolice: '000', emergencyAmbulance: '000', emergencyFire: '000', languages: ['English'], plugType: 'I', drivingSide: 'left', tipCustom: '10% במסעדות, לא חובה' },
  NewZealand: { country: 'New Zealand', countryHe: 'ניו זילנד', currency: 'NZD', currencySymbol: 'NZ$', timezone: 'Pacific/Auckland', emergencyPolice: '111', emergencyAmbulance: '111', emergencyFire: '111', languages: ['English','Maori'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Fiji: { country: 'Fiji', countryHe: 'פיג\'י', currency: 'FJD', currencySymbol: 'FJ$', timezone: 'Pacific/Fiji', emergencyPolice: '917', emergencyAmbulance: '911', emergencyFire: '910', languages: ['English','Fijian'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא חובה' },

  // More Asia
  Taiwan: { country: 'Taiwan', countryHe: 'טייוואן', currency: 'TWD', currencySymbol: 'NT$', timezone: 'Asia/Taipei', emergencyPolice: '110', emergencyAmbulance: '119', emergencyFire: '119', languages: ['Chinese','English'], plugType: 'A/B', drivingSide: 'right', tipCustom: 'לא מקובל' },
  HongKong: { country: 'Hong Kong', countryHe: 'הונג קונג', currency: 'HKD', currencySymbol: 'HK$', timezone: 'Asia/Hong_Kong', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Chinese','English'], plugType: 'G', drivingSide: 'left', tipCustom: '10% במסעדות' },
  Macau: { country: 'Macau', countryHe: 'מקאו', currency: 'MOP', currencySymbol: 'MOP$', timezone: 'Asia/Macau', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Chinese','Portuguese'], plugType: 'G', drivingSide: 'left', tipCustom: '10% במסעדות יוקרתיות' },
  Mongolia: { country: 'Mongolia', countryHe: 'מונגוליה', currency: 'MNT', currencySymbol: '₮', timezone: 'Asia/Ulaanbaatar', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Mongolian'], plugType: 'C/E', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Myanmar: { country: 'Myanmar', countryHe: 'מיאנמר', currency: 'MMK', currencySymbol: 'K', timezone: 'Asia/Yangon', emergencyPolice: '199', emergencyAmbulance: '192', emergencyFire: '191', languages: ['Burmese'], plugType: 'A/C/D/G', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Laos: { country: 'Laos', countryHe: 'לאוס', currency: 'LAK', currencySymbol: '₭', timezone: 'Asia/Vientiane', emergencyPolice: '191', emergencyAmbulance: '195', emergencyFire: '190', languages: ['Lao'], plugType: 'A/B/C/E/F', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Bangladesh: { country: 'Bangladesh', countryHe: 'בנגלדש', currency: 'BDT', currencySymbol: '৳', timezone: 'Asia/Dhaka', emergencyPolice: '999', emergencyAmbulance: '199', emergencyFire: '199', languages: ['Bengali'], plugType: 'A/C/D/G/K', drivingSide: 'left', tipCustom: '5-10%' },
  Pakistan: { country: 'Pakistan', countryHe: 'פקיסטן', currency: 'PKR', currencySymbol: '₨', timezone: 'Asia/Karachi', emergencyPolice: '15', emergencyAmbulance: '115', emergencyFire: '16', languages: ['Urdu','English'], plugType: 'C/D', drivingSide: 'left', tipCustom: '10%' },
  Uzbekistan: { country: 'Uzbekistan', countryHe: 'אוזבקיסטן', currency: 'UZS', currencySymbol: 'сўм', timezone: 'Asia/Tashkent', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Uzbek','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Kazakhstan: { country: 'Kazakhstan', countryHe: 'קזחסטן', currency: 'KZT', currencySymbol: '₸', timezone: 'Asia/Almaty', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Kazakh','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Azerbaijan: { country: 'Azerbaijan', countryHe: 'אזרבייג\'ן', currency: 'AZN', currencySymbol: '₼', timezone: 'Asia/Baku', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Azerbaijani','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Oman: { country: 'Oman', countryHe: 'עומאן', currency: 'OMR', currencySymbol: 'OMR', timezone: 'Asia/Muscat', emergencyPolice: '9999', emergencyAmbulance: '9999', emergencyFire: '9999', languages: ['Arabic','English'], plugType: 'G', drivingSide: 'right', tipCustom: '10% במסעדות' },
  Bahrain: { country: 'Bahrain', countryHe: 'בחריין', currency: 'BHD', currencySymbol: 'BD', timezone: 'Asia/Bahrain', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Arabic','English'], plugType: 'G', drivingSide: 'right', tipCustom: '10%' },
  Qatar: { country: 'Qatar', countryHe: 'קטאר', currency: 'QAR', currencySymbol: 'QR', timezone: 'Asia/Qatar', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Arabic','English'], plugType: 'G', drivingSide: 'right', tipCustom: '10-15%' },
  Kuwait: { country: 'Kuwait', countryHe: 'כווית', currency: 'KWD', currencySymbol: 'KD', timezone: 'Asia/Kuwait', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Arabic','English'], plugType: 'G', drivingSide: 'right', tipCustom: '10%' },
  SaudiArabia: { country: 'Saudi Arabia', countryHe: 'ערב הסעודית', currency: 'SAR', currencySymbol: 'SAR', timezone: 'Asia/Riyadh', emergencyPolice: '999', emergencyAmbulance: '997', emergencyFire: '998', languages: ['Arabic'], plugType: 'G', drivingSide: 'right', tipCustom: '10-15%' },

  // More Europe
  Serbia: { country: 'Serbia', countryHe: 'סרביה', currency: 'RSD', currencySymbol: 'din', timezone: 'Europe/Belgrade', emergencyPolice: '192', emergencyAmbulance: '194', emergencyFire: '193', languages: ['Serbian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  NorthMacedonia: { country: 'North Macedonia', countryHe: 'מקדוניה הצפונית', currency: 'MKD', currencySymbol: 'ден', timezone: 'Europe/Skopje', emergencyPolice: '192', emergencyAmbulance: '194', emergencyFire: '193', languages: ['Macedonian','Albanian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  BosniaHerzegovina: { country: 'Bosnia & Herzegovina', countryHe: 'בוסניה', currency: 'BAM', currencySymbol: 'KM', timezone: 'Europe/Sarajevo', emergencyPolice: '122', emergencyAmbulance: '124', emergencyFire: '123', languages: ['Bosnian','Croatian','Serbian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Slovenia: { country: 'Slovenia', countryHe: 'סלובניה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Ljubljana', emergencyPolice: '113', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Slovenian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Slovakia: { country: 'Slovakia', countryHe: 'סלובקיה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Bratislava', emergencyPolice: '158', emergencyAmbulance: '155', emergencyFire: '150', languages: ['Slovak','English'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Lithuania: { country: 'Lithuania', countryHe: 'ליטא', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Vilnius', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Lithuanian','English'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10%' },
  Latvia: { country: 'Latvia', countryHe: 'לטביה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Riga', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Latvian','English','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Estonia: { country: 'Estonia', countryHe: 'אסטוניה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Tallinn', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Estonian','English','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Malta: { country: 'Malta', countryHe: 'מלטה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Malta', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Maltese','English'], plugType: 'G', drivingSide: 'left', tipCustom: '10%' },
  Luxembourg: { country: 'Luxembourg', countryHe: 'לוקסמבורג', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Luxembourg', emergencyPolice: '113', emergencyAmbulance: '112', emergencyFire: '112', languages: ['French','German','Luxembourgish'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'כלול בחשבון' },
  Monaco: { country: 'Monaco', countryHe: 'מונאקו', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Monaco', emergencyPolice: '17', emergencyAmbulance: '18', emergencyFire: '18', languages: ['French'], plugType: 'C/E/F', drivingSide: 'right', tipCustom: '15%' },
  Armenia: { country: 'Armenia', countryHe: 'ארמניה', currency: 'AMD', currencySymbol: '֏', timezone: 'Asia/Yerevan', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Armenian','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Ukraine: { country: 'Ukraine', countryHe: 'אוקראינה', currency: 'UAH', currencySymbol: '₴', timezone: 'Europe/Kiev', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Ukrainian','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Moldova: { country: 'Moldova', countryHe: 'מולדובה', currency: 'MDL', currencySymbol: 'L', timezone: 'Europe/Chisinau', emergencyPolice: '902', emergencyAmbulance: '903', emergencyFire: '901', languages: ['Romanian','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },

  // More Americas
  Ecuador: { country: 'Ecuador', countryHe: 'אקוודור', currency: 'USD', currencySymbol: '$', timezone: 'America/Guayaquil', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Bolivia: { country: 'Bolivia', countryHe: 'בוליביה', currency: 'BOB', currencySymbol: 'Bs', timezone: 'America/La_Paz', emergencyPolice: '110', emergencyAmbulance: '118', emergencyFire: '119', languages: ['Spanish'], plugType: 'A/C', drivingSide: 'right', tipCustom: '10%' },
  Paraguay: { country: 'Paraguay', countryHe: 'פרגוואי', currency: 'PYG', currencySymbol: '₲', timezone: 'America/Asuncion', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '132', languages: ['Spanish','Guarani'], plugType: 'C', drivingSide: 'right', tipCustom: '10%' },
  Uruguay: { country: 'Uruguay', countryHe: 'אורוגוואי', currency: 'UYU', currencySymbol: '$U', timezone: 'America/Montevideo', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Spanish'], plugType: 'C/F/I/L', drivingSide: 'right', tipCustom: '10%' },
  Panama: { country: 'Panama', countryHe: 'פנמה', currency: 'USD', currencySymbol: '$', timezone: 'America/Panama', emergencyPolice: '104', emergencyAmbulance: '911', emergencyFire: '103', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Guatemala: { country: 'Guatemala', countryHe: 'גואטמלה', currency: 'GTQ', currencySymbol: 'Q', timezone: 'America/Guatemala', emergencyPolice: '110', emergencyAmbulance: '128', emergencyFire: '122', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Honduras: { country: 'Honduras', countryHe: 'הונדורס', currency: 'HNL', currencySymbol: 'L', timezone: 'America/Tegucigalpa', emergencyPolice: '199', emergencyAmbulance: '195', emergencyFire: '198', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Nicaragua: { country: 'Nicaragua', countryHe: 'ניקרגואה', currency: 'NIO', currencySymbol: 'C$', timezone: 'America/Managua', emergencyPolice: '118', emergencyAmbulance: '128', emergencyFire: '115', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Jamaica: { country: 'Jamaica', countryHe: 'ג\'מייקה', currency: 'JMD', currencySymbol: 'J$', timezone: 'America/Jamaica', emergencyPolice: '119', emergencyAmbulance: '110', emergencyFire: '110', languages: ['English'], plugType: 'A/B', drivingSide: 'left', tipCustom: '10-15%' },
  Bahamas: { country: 'Bahamas', countryHe: 'בהאמה', currency: 'BSD', currencySymbol: 'B$', timezone: 'America/Nassau', emergencyPolice: '919', emergencyAmbulance: '919', emergencyFire: '919', languages: ['English'], plugType: 'A/B', drivingSide: 'left', tipCustom: '15-20%' },
  TrinidadTobago: { country: 'Trinidad & Tobago', countryHe: 'טרינידד וטובגו', currency: 'TTD', currencySymbol: 'TT$', timezone: 'America/Port_of_Spain', emergencyPolice: '999', emergencyAmbulance: '990', emergencyFire: '990', languages: ['English'], plugType: 'A/B', drivingSide: 'left', tipCustom: '10-15%' },

  // More Africa
  Tunisia: { country: 'Tunisia', countryHe: 'תוניסיה', currency: 'TND', currencySymbol: 'DT', timezone: 'Africa/Tunis', emergencyPolice: '197', emergencyAmbulance: '190', emergencyFire: '198', languages: ['Arabic','French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Ghana: { country: 'Ghana', countryHe: 'גאנה', currency: 'GHS', currencySymbol: '₵', timezone: 'Africa/Accra', emergencyPolice: '191', emergencyAmbulance: '193', emergencyFire: '192', languages: ['English'], plugType: 'D/G', drivingSide: 'right', tipCustom: '10%' },
  Nigeria: { country: 'Nigeria', countryHe: 'ניגריה', currency: 'NGN', currencySymbol: '₦', timezone: 'Africa/Lagos', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['English'], plugType: 'D/G', drivingSide: 'right', tipCustom: '10%' },
  Ethiopia: { country: 'Ethiopia', countryHe: 'אתיופיה', currency: 'ETB', currencySymbol: 'Br', timezone: 'Africa/Addis_Ababa', emergencyPolice: '991', emergencyAmbulance: '907', emergencyFire: '939', languages: ['Amharic','English'], plugType: 'C/E/F/L', drivingSide: 'right', tipCustom: '10%' },
  Rwanda: { country: 'Rwanda', countryHe: 'רואנדה', currency: 'RWF', currencySymbol: 'RF', timezone: 'Africa/Kigali', emergencyPolice: '112', emergencyAmbulance: '912', emergencyFire: '112', languages: ['Kinyarwanda','French','English'], plugType: 'C/J', drivingSide: 'right', tipCustom: '10%' },
  Uganda: { country: 'Uganda', countryHe: 'אוגנדה', currency: 'UGX', currencySymbol: 'USh', timezone: 'Africa/Kampala', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['English','Swahili'], plugType: 'G', drivingSide: 'left', tipCustom: '10%' },
  Mozambique: { country: 'Mozambique', countryHe: 'מוזמביק', currency: 'MZN', currencySymbol: 'MT', timezone: 'Africa/Maputo', emergencyPolice: '119', emergencyAmbulance: '117', emergencyFire: '198', languages: ['Portuguese'], plugType: 'C/F/M', drivingSide: 'left', tipCustom: '10%' },
  Namibia: { country: 'Namibia', countryHe: 'נמיביה', currency: 'NAD', currencySymbol: 'N$', timezone: 'Africa/Windhoek', emergencyPolice: '10111', emergencyAmbulance: '211111', emergencyFire: '2032270', languages: ['English','Afrikaans'], plugType: 'D/M', drivingSide: 'left', tipCustom: '10%' },
  Botswana: { country: 'Botswana', countryHe: 'בוצוואנה', currency: 'BWP', currencySymbol: 'P', timezone: 'Africa/Gaborone', emergencyPolice: '999', emergencyAmbulance: '997', emergencyFire: '998', languages: ['English','Tswana'], plugType: 'D/G/M', drivingSide: 'left', tipCustom: '10%' },
  Madagascar: { country: 'Madagascar', countryHe: 'מדגסקר', currency: 'MGA', currencySymbol: 'Ar', timezone: 'Indian/Antananarivo', emergencyPolice: '117', emergencyAmbulance: '117', emergencyFire: '118', languages: ['Malagasy','French'], plugType: 'C/D/E/J/K', drivingSide: 'right', tipCustom: '10%' },
  Mauritius: { country: 'Mauritius', countryHe: 'מאוריציוס', currency: 'MUR', currencySymbol: '₨', timezone: 'Indian/Mauritius', emergencyPolice: '999', emergencyAmbulance: '114', emergencyFire: '995', languages: ['English','French','Creole'], plugType: 'C/G', drivingSide: 'left', tipCustom: '10%' },
  Seychelles: { country: 'Seychelles', countryHe: 'סיישל', currency: 'SCR', currencySymbol: '₨', timezone: 'Indian/Mahe', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Seychellois Creole','English','French'], plugType: 'G', drivingSide: 'left', tipCustom: '5-10%' },
  Zanzibar: { country: 'Zanzibar', countryHe: 'זנזיבר', currency: 'TZS', currencySymbol: 'TSh', timezone: 'Africa/Dar_es_Salaam', emergencyPolice: '112', emergencyAmbulance: '114', emergencyFire: '112', languages: ['Swahili','English'], plugType: 'D/G', drivingSide: 'left', tipCustom: '10%' },

  // More Oceania
  Tahiti: { country: 'Tahiti', countryHe: 'טהיטי', currency: 'XPF', currencySymbol: '₣', timezone: 'Pacific/Tahiti', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French','Tahitian'], plugType: 'A/B/E', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Samoa: { country: 'Samoa', countryHe: 'סמואה', currency: 'WST', currencySymbol: 'WS$', timezone: 'Pacific/Apia', emergencyPolice: '995', emergencyAmbulance: '996', emergencyFire: '994', languages: ['Samoan','English'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Tonga: { country: 'Tonga', countryHe: 'טונגה', currency: 'TOP', currencySymbol: 'T$', timezone: 'Pacific/Tongatapu', emergencyPolice: '922', emergencyAmbulance: '933', emergencyFire: '999', languages: ['Tongan','English'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Vanuatu: { country: 'Vanuatu', countryHe: 'ונואטו', currency: 'VUV', currencySymbol: 'VT', timezone: 'Pacific/Efate', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Bislama','English','French'], plugType: 'I', drivingSide: 'right', tipCustom: 'לא מקובל' },
  PapuaNewGuinea: { country: 'Papua New Guinea', countryHe: 'פפואה גינאה החדשה', currency: 'PGK', currencySymbol: 'K', timezone: 'Pacific/Port_Moresby', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['English','Tok Pisin'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  SolomonIslands: { country: 'Solomon Islands', countryHe: 'איי שלמה', currency: 'SBD', currencySymbol: 'SI$', timezone: 'Pacific/Guadalcanal', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['English'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Kiribati: { country: 'Kiribati', countryHe: 'קיריבאטי', currency: 'AUD', currencySymbol: 'A$', timezone: 'Pacific/Tarawa', emergencyPolice: '999', emergencyAmbulance: '994', emergencyFire: '994', languages: ['English','Gilbertese'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Palau: { country: 'Palau', countryHe: 'פלאו', currency: 'USD', currencySymbol: '$', timezone: 'Pacific/Palau', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English','Palauan'], plugType: 'A/B', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Micronesia: { country: 'Micronesia', countryHe: 'מיקרונזיה', currency: 'USD', currencySymbol: '$', timezone: 'Pacific/Pohnpei', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'A/B', drivingSide: 'right', tipCustom: 'לא מקובל' },
  MarshallIslands: { country: 'Marshall Islands', countryHe: 'איי מרשל', currency: 'USD', currencySymbol: '$', timezone: 'Pacific/Majuro', emergencyPolice: '625', emergencyAmbulance: '625', emergencyFire: '625', languages: ['English','Marshallese'], plugType: 'A/B', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Nauru: { country: 'Nauru', countryHe: 'נאורו', currency: 'AUD', currencySymbol: 'A$', timezone: 'Pacific/Nauru', emergencyPolice: '110', emergencyAmbulance: '111', emergencyFire: '112', languages: ['Nauruan','English'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },
  Tuvalu: { country: 'Tuvalu', countryHe: 'טובלו', currency: 'AUD', currencySymbol: 'A$', timezone: 'Pacific/Funafuti', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['Tuvaluan','English'], plugType: 'I', drivingSide: 'left', tipCustom: 'לא מקובל' },

  // More Middle East & Asia
  Iraq: { country: 'Iraq', countryHe: 'עיראק', currency: 'IQD', currencySymbol: 'ع.د', timezone: 'Asia/Baghdad', emergencyPolice: '104', emergencyAmbulance: '122', emergencyFire: '115', languages: ['Arabic','Kurdish'], plugType: 'C/D/G', drivingSide: 'right', tipCustom: '10%' },
  Iran: { country: 'Iran', countryHe: 'איראן', currency: 'IRR', currencySymbol: '﷼', timezone: 'Asia/Tehran', emergencyPolice: '110', emergencyAmbulance: '115', emergencyFire: '125', languages: ['Persian'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Lebanon: { country: 'Lebanon', countryHe: 'לבנון', currency: 'LBP', currencySymbol: 'ل.ل', timezone: 'Asia/Beirut', emergencyPolice: '112', emergencyAmbulance: '140', emergencyFire: '175', languages: ['Arabic','French','English'], plugType: 'A/B/C/D', drivingSide: 'right', tipCustom: '10-15%' },
  Syria: { country: 'Syria', countryHe: 'סוריה', currency: 'SYP', currencySymbol: '£S', timezone: 'Asia/Damascus', emergencyPolice: '112', emergencyAmbulance: '110', emergencyFire: '113', languages: ['Arabic'], plugType: 'C/E/L', drivingSide: 'right', tipCustom: '10%' },
  Yemen: { country: 'Yemen', countryHe: 'תימן', currency: 'YER', currencySymbol: '﷼', timezone: 'Asia/Aden', emergencyPolice: '194', emergencyAmbulance: '191', emergencyFire: '191', languages: ['Arabic'], plugType: 'A/D/G', drivingSide: 'right', tipCustom: '10%' },
  Afghanistan: { country: 'Afghanistan', countryHe: 'אפגניסטן', currency: 'AFN', currencySymbol: '؋', timezone: 'Asia/Kabul', emergencyPolice: '119', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Pashto','Dari'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Kyrgyzstan: { country: 'Kyrgyzstan', countryHe: 'קירגיזסטן', currency: 'KGS', currencySymbol: 'сом', timezone: 'Asia/Bishkek', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Kyrgyz','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Tajikistan: { country: 'Tajikistan', countryHe: 'טג\'יקיסטן', currency: 'TJS', currencySymbol: 'SM', timezone: 'Asia/Dushanbe', emergencyPolice: '02', emergencyAmbulance: '03', emergencyFire: '01', languages: ['Tajik','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Turkmenistan: { country: 'Turkmenistan', countryHe: 'טורקמניסטן', currency: 'TMT', currencySymbol: 'T', timezone: 'Asia/Ashgabat', emergencyPolice: '02', emergencyAmbulance: '03', emergencyFire: '01', languages: ['Turkmen','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Brunei: { country: 'Brunei', countryHe: 'ברוניי', currency: 'BND', currencySymbol: 'B$', timezone: 'Asia/Brunei', emergencyPolice: '993', emergencyAmbulance: '991', emergencyFire: '995', languages: ['Malay','English'], plugType: 'G', drivingSide: 'left', tipCustom: 'לא מקובל' },
  EastTimor: { country: 'East Timor', countryHe: 'טימור-לסטה', currency: 'USD', currencySymbol: '$', timezone: 'Asia/Dili', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Portuguese','Tetum'], plugType: 'C/E/F/I', drivingSide: 'left', tipCustom: '10%' },
  Bhutan: { country: 'Bhutan', countryHe: 'בהוטן', currency: 'BTN', currencySymbol: 'Nu', timezone: 'Asia/Thimphu', emergencyPolice: '113', emergencyAmbulance: '112', emergencyFire: '110', languages: ['Dzongkha'], plugType: 'D/F/G', drivingSide: 'left', tipCustom: '10%' },

  // More Europe
  Russia: { country: 'Russia', countryHe: 'רוסיה', currency: 'RUB', currencySymbol: '₽', timezone: 'Europe/Moscow', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10-15%' },
  Belarus: { country: 'Belarus', countryHe: 'בלארוס', currency: 'BYN', currencySymbol: 'Br', timezone: 'Europe/Minsk', emergencyPolice: '102', emergencyAmbulance: '103', emergencyFire: '101', languages: ['Belarusian','Russian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Kosovo: { country: 'Kosovo', countryHe: 'קוסובו', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Belgrade', emergencyPolice: '192', emergencyAmbulance: '194', emergencyFire: '193', languages: ['Albanian','Serbian'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Andorra: { country: 'Andorra', countryHe: 'אנדורה', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Andorra', emergencyPolice: '110', emergencyAmbulance: '116', emergencyFire: '118', languages: ['Catalan'], plugType: 'C/F', drivingSide: 'right', tipCustom: '5-10%' },
  Liechtenstein: { country: 'Liechtenstein', countryHe: 'ליכטנשטיין', currency: 'CHF', currencySymbol: 'CHF', timezone: 'Europe/Vaduz', emergencyPolice: '117', emergencyAmbulance: '144', emergencyFire: '118', languages: ['German'], plugType: 'C/J', drivingSide: 'right', tipCustom: 'כלול בחשבון' },
  SanMarino: { country: 'San Marino', countryHe: 'סן מרינו', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/San_Marino', emergencyPolice: '112', emergencyAmbulance: '118', emergencyFire: '115', languages: ['Italian'], plugType: 'C/F/L', drivingSide: 'right', tipCustom: '10%' },
  Vatican: { country: 'Vatican', countryHe: 'הוותיקן', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Vatican', emergencyPolice: '112', emergencyAmbulance: '118', emergencyFire: '115', languages: ['Italian','Latin'], plugType: 'C/F/L', drivingSide: 'right', tipCustom: '10%' },

  // More Americas
  Venezuela: { country: 'Venezuela', countryHe: 'ונצואלה', currency: 'VES', currencySymbol: 'Bs.S', timezone: 'America/Caracas', emergencyPolice: '171', emergencyAmbulance: '171', emergencyFire: '171', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Belize: { country: 'Belize', countryHe: 'בליז', currency: 'BZD', currencySymbol: 'BZ$', timezone: 'America/Belize', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English','Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  ElSalvador: { country: 'El Salvador', countryHe: 'אל סלבדור', currency: 'USD', currencySymbol: '$', timezone: 'America/El_Salvador', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '913', languages: ['Spanish'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Haiti: { country: 'Haiti', countryHe: 'האיטי', currency: 'HTG', currencySymbol: 'G', timezone: 'America/Port-au-Prince', emergencyPolice: '114', emergencyAmbulance: '116', emergencyFire: '118', languages: ['Haitian Creole','French'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  Barbados: { country: 'Barbados', countryHe: 'ברבדוס', currency: 'BBD', currencySymbol: 'Bds$', timezone: 'America/Barbados', emergencyPolice: '211', emergencyAmbulance: '511', emergencyFire: '311', languages: ['English'], plugType: 'A/B', drivingSide: 'left', tipCustom: '10-15%' },
  Grenada: { country: 'Grenada', countryHe: 'גרנדה', currency: 'XCD', currencySymbol: 'EC$', timezone: 'America/Grenada', emergencyPolice: '911', emergencyAmbulance: '434', emergencyFire: '911', languages: ['English'], plugType: 'G', drivingSide: 'left', tipCustom: '10%' },
  SaintLucia: { country: 'Saint Lucia', countryHe: 'סנט לוסיה', currency: 'XCD', currencySymbol: 'EC$', timezone: 'America/St_Lucia', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'G', drivingSide: 'left', tipCustom: '10%' },
  Guyana: { country: 'Guyana', countryHe: 'גיאנה', currency: 'GYD', currencySymbol: 'G$', timezone: 'America/Guyana', emergencyPolice: '911', emergencyAmbulance: '913', emergencyFire: '912', languages: ['English'], plugType: 'A/B/D', drivingSide: 'left', tipCustom: '10%' },
  Suriname: { country: 'Suriname', countryHe: 'סורינם', currency: 'SRD', currencySymbol: 'Sr$', timezone: 'America/Paramaribo', emergencyPolice: '115', emergencyAmbulance: '113', emergencyFire: '110', languages: ['Dutch'], plugType: 'A/B/C/F', drivingSide: 'right', tipCustom: '10%' },
  SaintVincent: { country: 'Saint Vincent & the Grenadines', countryHe: 'סנט וינסנט', currency: 'XCD', currencySymbol: 'EC$', timezone: 'America/St_Vincent', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'A/B/G', drivingSide: 'left', tipCustom: '10%' },
  Antigua: { country: 'Antigua & Barbuda', countryHe: 'אנטיגואה', currency: 'XCD', currencySymbol: 'EC$', timezone: 'America/Antigua', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'A/B', drivingSide: 'left', tipCustom: '10%' },
  SaintKitts: { country: 'Saint Kitts & Nevis', countryHe: 'סנט קיטס', currency: 'XCD', currencySymbol: 'EC$', timezone: 'America/St_Kitts', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'A/B', drivingSide: 'left', tipCustom: '10%' },

  // More Africa
  Algeria: { country: 'Algeria', countryHe: 'אלג\'יריה', currency: 'DZD', currencySymbol: 'دج', timezone: 'Africa/Algiers', emergencyPolice: '17', emergencyAmbulance: '14', emergencyFire: '14', languages: ['Arabic','French'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Libya: { country: 'Libya', countryHe: 'לוב', currency: 'LYD', currencySymbol: 'LD', timezone: 'Africa/Tripoli', emergencyPolice: '193', emergencyAmbulance: '193', emergencyFire: '193', languages: ['Arabic'], plugType: 'C/L', drivingSide: 'right', tipCustom: 'לא מקובל' },
  Sudan: { country: 'Sudan', countryHe: 'סודן', currency: 'SDG', currencySymbol: 'ج.س', timezone: 'Africa/Khartoum', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['Arabic','English'], plugType: 'C/D', drivingSide: 'right', tipCustom: '10%' },
  SouthSudan: { country: 'South Sudan', countryHe: 'דרום סודן', currency: 'SSP', currencySymbol: '£', timezone: 'Africa/Juba', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['English'], plugType: 'C/D', drivingSide: 'right', tipCustom: '10%' },
  Somalia: { country: 'Somalia', countryHe: 'סומליה', currency: 'SOS', currencySymbol: 'Sh', timezone: 'Africa/Mogadishu', emergencyPolice: '888', emergencyAmbulance: '888', emergencyFire: '888', languages: ['Somali','Arabic'], plugType: 'A/D', drivingSide: 'right', tipCustom: '10%' },
  Eritrea: { country: 'Eritrea', countryHe: 'אריתריאה', currency: 'ERN', currencySymbol: 'Nkf', timezone: 'Africa/Asmara', emergencyPolice: '113', emergencyAmbulance: '114', emergencyFire: '115', languages: ['Tigrinya','Arabic','English'], plugType: 'C/L', drivingSide: 'right', tipCustom: '10%' },
  Djibouti: { country: 'Djibouti', countryHe: 'ג\'יבוטי', currency: 'DJF', currencySymbol: 'Fdj', timezone: 'Africa/Djibouti', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French','Arabic'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Cameroon: { country: 'Cameroon', countryHe: 'קמרון', currency: 'XAF', currencySymbol: 'Fr', timezone: 'Africa/Douala', emergencyPolice: '117', emergencyAmbulance: '119', emergencyFire: '118', languages: ['French','English'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  DRC: { country: 'DR Congo', countryHe: 'קונגו (DRC)', currency: 'CDF', currencySymbol: 'FC', timezone: 'Africa/Kinshasa', emergencyPolice: '112', emergencyAmbulance: '912', emergencyFire: '118', languages: ['French','Lingala','Swahili'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Congo: { country: 'Republic of Congo', countryHe: 'קונגו-ברזאויל', currency: 'XAF', currencySymbol: 'Fr', timezone: 'Africa/Brazzaville', emergencyPolice: '117', emergencyAmbulance: '118', emergencyFire: '118', languages: ['French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  CentralAfricanRepublic: { country: 'Central African Republic', countryHe: 'הרפובליקה המרכז-אפריקאית', currency: 'XAF', currencySymbol: 'Fr', timezone: 'Africa/Bangui', emergencyPolice: '117', emergencyAmbulance: '1220', emergencyFire: '118', languages: ['French','Sango'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Chad: { country: 'Chad', countryHe: 'צ\'אד', currency: 'XAF', currencySymbol: 'Fr', timezone: 'Africa/Ndjamena', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French','Arabic'], plugType: 'C/D/E/F', drivingSide: 'right', tipCustom: '10%' },
  Niger: { country: 'Niger', countryHe: 'ניז\'ר', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Niamey', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French'], plugType: 'A/B/C/D/E/F', drivingSide: 'right', tipCustom: '10%' },
  Mali: { country: 'Mali', countryHe: 'מאלי', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Bamako', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  BurkinaFaso: { country: 'Burkina Faso', countryHe: 'בורקינה פאסו', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Ouagadougou', emergencyPolice: '17', emergencyAmbulance: '112', emergencyFire: '18', languages: ['French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Senegal: { country: 'Senegal', countryHe: 'סנגל', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Dakar', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['French'], plugType: 'C/D/E/K', drivingSide: 'right', tipCustom: '10%' },
  Gambia: { country: 'Gambia', countryHe: 'גמביה', currency: 'GMD', currencySymbol: 'D', timezone: 'Africa/Banjul', emergencyPolice: '117', emergencyAmbulance: '116', emergencyFire: '118', languages: ['English'], plugType: 'G', drivingSide: 'right', tipCustom: '10%' },
  Guinea: { country: 'Guinea', countryHe: 'גינאה', currency: 'GNF', currencySymbol: 'Fr', timezone: 'Africa/Conakry', emergencyPolice: '117', emergencyAmbulance: '118', emergencyFire: '118', languages: ['French'], plugType: 'C/F/K', drivingSide: 'right', tipCustom: '10%' },
  GuineaBissau: { country: 'Guinea-Bissau', countryHe: 'גינאה-ביסאו', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Bissau', emergencyPolice: '117', emergencyAmbulance: '118', emergencyFire: '118', languages: ['Portuguese'], plugType: 'C', drivingSide: 'right', tipCustom: '10%' },
  SierraLeone: { country: 'Sierra Leone', countryHe: 'סיירה לאונה', currency: 'SLL', currencySymbol: 'Le', timezone: 'Africa/Freetown', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '019', languages: ['English'], plugType: 'D/G', drivingSide: 'right', tipCustom: '10%' },
  Liberia: { country: 'Liberia', countryHe: 'ליבריה', currency: 'LRD', currencySymbol: 'L$', timezone: 'Africa/Monrovia', emergencyPolice: '911', emergencyAmbulance: '911', emergencyFire: '911', languages: ['English'], plugType: 'A/B', drivingSide: 'right', tipCustom: '10%' },
  IvoryCoast: { country: "Côte d'Ivoire", countryHe: "חוף השנהב", currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Abidjan', emergencyPolice: '111', emergencyAmbulance: '185', emergencyFire: '180', languages: ['French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Togo: { country: 'Togo', countryHe: 'טוגו', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Lome', emergencyPolice: '117', emergencyAmbulance: '118', emergencyFire: '118', languages: ['French'], plugType: 'C', drivingSide: 'right', tipCustom: '10%' },
  Benin: { country: 'Benin', countryHe: 'בנין', currency: 'XOF', currencySymbol: 'Fr', timezone: 'Africa/Porto-Novo', emergencyPolice: '117', emergencyAmbulance: '112', emergencyFire: '118', languages: ['French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  EquatorialGuinea: { country: 'Equatorial Guinea', countryHe: 'גינאה המשוונית', currency: 'XAF', currencySymbol: 'Fr', timezone: 'Africa/Malabo', emergencyPolice: '112', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Spanish','French','Portuguese'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Gabon: { country: 'Gabon', countryHe: 'גאבון', currency: 'XAF', currencySymbol: 'Fr', timezone: 'Africa/Libreville', emergencyPolice: '1730', emergencyAmbulance: '1300', emergencyFire: '18', languages: ['French'], plugType: 'C', drivingSide: 'right', tipCustom: '10%' },
  Angola: { country: 'Angola', countryHe: 'אנגולה', currency: 'AOA', currencySymbol: 'Kz', timezone: 'Africa/Luanda', emergencyPolice: '113', emergencyAmbulance: '112', emergencyFire: '115', languages: ['Portuguese'], plugType: 'C', drivingSide: 'right', tipCustom: '10%' },
  Zambia: { country: 'Zambia', countryHe: 'זמביה', currency: 'ZMW', currencySymbol: 'ZK', timezone: 'Africa/Lusaka', emergencyPolice: '991', emergencyAmbulance: '992', emergencyFire: '993', languages: ['English'], plugType: 'C/D/G', drivingSide: 'left', tipCustom: '10%' },
  Zimbabwe: { country: 'Zimbabwe', countryHe: 'זימבבווה', currency: 'USD', currencySymbol: '$', timezone: 'Africa/Harare', emergencyPolice: '995', emergencyAmbulance: '994', emergencyFire: '993', languages: ['English','Shona','Ndebele'], plugType: 'D/G', drivingSide: 'left', tipCustom: '10%' },
  Malawi: { country: 'Malawi', countryHe: 'מלאווי', currency: 'MWK', currencySymbol: 'MK', timezone: 'Africa/Blantyre', emergencyPolice: '999', emergencyAmbulance: '998', emergencyFire: '999', languages: ['English','Chichewa'], plugType: 'G', drivingSide: 'left', tipCustom: '10%' },
  Lesotho: { country: 'Lesotho', countryHe: 'לסוטו', currency: 'LSL', currencySymbol: 'L', timezone: 'Africa/Maseru', emergencyPolice: '123', emergencyAmbulance: '121', emergencyFire: '122', languages: ['Sesotho','English'], plugType: 'M', drivingSide: 'left', tipCustom: '10%' },
  Eswatini: { country: 'Eswatini', countryHe: 'אסוואטיני', currency: 'SZL', currencySymbol: 'L', timezone: 'Africa/Mbabane', emergencyPolice: '999', emergencyAmbulance: '977', emergencyFire: '933', languages: ['Swati','English'], plugType: 'M', drivingSide: 'left', tipCustom: '10%' },
  CapeVerde: { country: 'Cape Verde', countryHe: 'כף ורדה', currency: 'CVE', currencySymbol: '$', timezone: 'Atlantic/Cape_Verde', emergencyPolice: '132', emergencyAmbulance: '130', emergencyFire: '131', languages: ['Portuguese'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },
  Comoros: { country: 'Comoros', countryHe: 'קומורו', currency: 'KMF', currencySymbol: 'Fr', timezone: 'Indian/Comoro', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '18', languages: ['Comorian','Arabic','French'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  SaoTome: { country: 'São Tomé & Príncipe', countryHe: 'סאו טומה ופרינסיפה', currency: 'STN', currencySymbol: 'Db', timezone: 'Africa/Sao_Tome', emergencyPolice: '113', emergencyAmbulance: '112', emergencyFire: '112', languages: ['Portuguese'], plugType: 'C/F', drivingSide: 'right', tipCustom: '10%' },

  // Missing Africa
  Burundi: { country: 'Burundi', countryHe: 'בורונדי', currency: 'BIF', currencySymbol: 'Fr', timezone: 'Africa/Bujumbura', emergencyPolice: '117', emergencyAmbulance: '117', emergencyFire: '118', languages: ['Kirundi','French','English'], plugType: 'C/E', drivingSide: 'right', tipCustom: '10%' },
  Mauritania: { country: 'Mauritania', countryHe: 'מאוריטניה', currency: 'MRU', currencySymbol: 'UM', timezone: 'Africa/Nouakchott', emergencyPolice: '17', emergencyAmbulance: '15', emergencyFire: '118', languages: ['Arabic','French'], plugType: 'C', drivingSide: 'right', tipCustom: '10%' },

  // Missing Caribbean
  Dominica: { country: 'Dominica', countryHe: 'דומיניקה', currency: 'XCD', currencySymbol: 'EC$', timezone: 'America/Dominica', emergencyPolice: '999', emergencyAmbulance: '999', emergencyFire: '999', languages: ['English'], plugType: 'D/G', drivingSide: 'left', tipCustom: '10%' },

  // Missing Asia
  NorthKorea: { country: 'North Korea', countryHe: 'צפון קוריאה', currency: 'KPW', currencySymbol: '₩', timezone: 'Asia/Pyongyang', emergencyPolice: '110', emergencyAmbulance: '119', emergencyFire: '119', languages: ['Korean'], plugType: 'A/C', drivingSide: 'right', tipCustom: 'לא מקובל' },
}

// Popular cities per country key
export const DESTINATION_CITIES: Record<string, string[]> = {
  // Asia
  Thailand:        ['בנגקוק', 'פוקט', 'צ\'יאנג מאי', 'פאטייה', 'קו סמוי', 'קראבי', 'קו פנגאן', 'קו לנטה'],
  Japan:           ['טוקיו', 'אוסקה', 'קיוטו', 'הירושימה', 'סאפורו', 'נארה', 'פוקואוקה', 'נגויה'],
  Vietnam:         ['האנוי', 'הו צ\'י מין', 'הוי אן', 'דה נאנג', 'האלונג בי', 'נינ\'ה בינ\'ה', 'פו קוק'],
  Indonesia:       ['באלי', 'ג\'קרטה', 'לומבוק', 'יוגיאקרטה', 'קומודו', 'מדורה', 'ג\'אווה'],
  India:           ['מומבאי', 'דלהי', 'גואה', 'ג\'יפור', 'אגרה', 'ורנסי', 'קרלה', 'מומבאי'],
  SouthKorea:      ['סיאול', 'בוסאן', 'ג\'ג\'ו', 'ג\'ונג\'ו', 'גיאונג\'ו', 'אינצ\'ון'],
  China:           ['בייג\'ינג', 'שנגחאי', 'שנג\'ן', 'גואנג\'ואו', 'שיאן', 'צ\'נגדו', 'האנג\'ואו'],
  Cambodia:        ['פנום פן', 'סיאם ריפ', 'סיהאנוקוויל', 'בטמבנג'],
  Malaysia:        ['קואלה לומפור', 'פנאנג', 'לנקאווי', 'מלקה', 'קוצ\'ינג'],
  Singapore:       ['סינגפור'],
  Philippines:     ['מנילה', 'בוראקי', 'פלאוואן', 'צבו', 'סיארגאו'],
  UAE:             ['דובאי', 'אבו דאבי', 'שארג\'ה', 'ראס אל חיימה'],
  Jordan:          ['פטרה', 'עמאן', 'עקבה', 'וואדי רום', 'ירש'],
  Israel:          ['תל אביב', 'ירושלים', 'חיפה', 'אילת', 'נצרת', 'הנגב'],
  Maldives:        ['מאלה', 'ביה', 'מאאפושי'],
  Nepal:           ['קטמנדו', 'פוקארה', 'לומביני', 'צ\'יטוואן'],
  SriLanka:        ['קולומבו', 'קנדי', 'גאלה', 'סיגיריה', 'נוארה אליה'],

  // Europe
  Italy:           ['רומא', 'פירנצה', 'ונציה', 'מילאנו', 'נאפולי', 'אמאלפי', 'צינקווה טרה', 'סיציליה', 'בולוניה'],
  France:          ['פריז', 'ניס', 'ליון', 'מרסיי', 'בורדו', 'סטרסבורג', 'מונפלייה', 'רן'],
  Spain:           ['ברצלונה', 'מדריד', 'סביליה', 'ולנסיה', 'גרנדה', 'איביזה', 'מיורקה', 'מלגה'],
  Greece:          ['אתונה', 'סנטוריני', 'מיקונוס', 'כרתים', 'רודוס', 'קורפו', 'מיטלני', 'תסלוניקי'],
  UK:              ['לונדון', 'אדינבורו', 'מנצ\'סטר', 'בת\'', 'אוקספורד', 'ליברפול', 'קיימברידג\''],
  Portugal:        ['ליסבון', 'פורטו', 'אלגארבה', 'סינטרה', 'מדיירה', 'אזורס'],
  Germany:         ['ברלין', 'מינכן', 'המבורג', 'פרנקפורט', 'קלן', 'הידלברג', 'רוטנבורג'],
  Netherlands:     ['אמסטרדם', 'רוטרדם', 'האג', 'אוטרכט', 'גרונינגן'],
  Austria:         ['וינה', 'זלצבורג', 'אינסברוק', 'גרץ', 'הלשטאט'],
  Switzerland:     ['ציריך', 'ז\'נבה', 'ברן', 'לוצרן', 'אינטרלקן'],
  Turkey:          ['איסטנבול', 'קפדוקיה', 'אנטליה', 'פמוקקלה', 'בודרום', 'אפסוס', 'טרבזון'],
  Croatia:         ['דובובניק', 'ספליט', 'זאגרב', 'הוואר', 'קורצ\'ולה', 'ריאקה'],
  CzechRepublic:   ['פראג', 'ברנו', 'צ\'סקי קרומלוב', 'קרלובי ורי'],
  Hungary:         ['בודפשט', 'ברלץ', 'פץ'],
  Poland:          ['וורשה', 'קרקוב', 'גדנסק', 'וורוצלב', 'פוזנן'],
  Norway:          ['אוסלו', 'ברגן', 'טרומסו', 'גיירנגר'],
  Sweden:          ['סטוקהולם', 'גיוטבורג', 'מלמה', 'אפוסלה'],
  Denmark:         ['קופנהגן', 'ארהוס', 'אודנסה'],
  Iceland:         ['רייקיאביק', 'אקורייר', 'ויק'],
  Ireland:         ['דבלין', 'גלוואי', 'קורק', 'קילרני'],
  Belgium:         ['בריסל', 'ברוז\'', 'גנט', 'אנטורפ'],
  Georgia:         ['טביליסי', 'בטומי', 'קזבגי', 'מצחטה'],
  Montenegro:      ['קוטור', 'בודוה', 'דובר', 'פודגוריצה'],
  Albania:         ['טירנה', 'בראט', 'ס\'קודר', 'ג\'ירוקסטר'],

  // Americas
  USA:             ['ניו יורק', 'לוס אנג\'לס', 'מיאמי', 'לאס וגאס', 'שיקגו', 'סן פרנסיסקו', 'אורלנדו', 'נשוויל', 'בוסטון', 'סיאטל', 'הוואי', 'ניו אורלינס'],
  Canada:          ['טורונטו', 'ונקובר', 'מונטריאל', 'קוויבק', 'קלגרי', 'ויקטוריה'],
  Mexico:          ['מקסיקו סיטי', 'קנקון', 'טולום', 'גוואדלחרה', 'קבו סן לוקס', 'אואחאקה'],
  Brazil:          ['ריו דה ז\'נירו', 'סאו פאולו', 'סלבדור', 'פלוריאנופוליס', 'מנאוס', 'פורטו דה גאלינאס'],
  Argentina:       ['בואנוס איירס', 'מנדוזה', 'פטגוניה', 'איגואסו', 'קורדובה', 'סלטה'],
  Peru:            ['ליסבון', 'קוסקו', 'מאצ\'ו פיצ\'ו', 'ארקיפה', 'אמזונס', 'פאראקס'],
  Colombia:        ['בוגוטה', 'קרטאחנה', 'מדיין', 'קלי', 'סנטה מרטה'],

  // Africa
  Morocco:         ['מרקש', 'קזבלנקה', 'פאס', 'שפשאוון', 'מראקש', 'אסאואירה', 'מרזוגה'],
  SouthAfrica:     ['קייפ טאון', 'יוהנסבורג', 'קרוגר', 'דרבן', 'סדן', 'גרדן ראוט'],
  Egypt:           ['קהיר', 'לוקסור', 'הורגדה', 'שרם אל שיח\'', 'אסוואן', 'אלכסנדריה', 'דהב'],
  Kenya:           ['נייורובי', 'מסאי מארה', 'מומבסה', 'אמבוסלי', 'צ\'אמה'],
  Tanzania:        ['זנזיבר', 'סרנגטי', 'קילימנג\'רו', 'דאר א-סלאם', 'נגורונגורו'],

  // Oceania
  Australia:       ['סידני', 'מלבורן', 'בריסביין', 'פרת\'', 'קיירנס', 'גולד קוסט', 'אוקלנד', 'האוס ריף'],
  NewZealand:      ['אוקלנד', 'קווינסטאון', 'כריסטצ\'רץ\'', 'ולינגטון', 'רוטורואה', 'הוקס ביי'],
}

// Countries with state/province sub-level → cities
export const COUNTRY_STATES: Record<string, Record<string, string[]>> = {
  USA: {
    'קליפורניה':        ['לוס אנג\'לס', 'סן פרנסיסקו', 'סן דייגו', 'סנטה ברברה', 'פאלם ספרינגס', 'מונטרי'],
    'ניו יורק':         ['ניו יורק סיטי', 'בופאלו', 'נייאגרה פולס', 'האמפטונס'],
    'פלורידה':          ['מיאמי', 'אורלנדו', 'טמפה', 'פורט לודרדייל', 'קי ווסט', 'ג\'קסונוויל'],
    'טקסס':             ['יוסטון', 'אוסטין', 'דאלאס', 'סן אנטוניו', 'אל פאסו'],
    'הוואי':            ['הונולולו', 'מאואי', 'קאואי', 'ביג איילנד', 'לאנאי'],
    'אריזונה':          ['פיניקס', 'סקוטסדייל', 'טוסון', 'גרנד קניון', 'סדונה'],
    'נבדה':             ['לאס וגאס', 'ריינו', 'לייק טאהו'],
    'קולורדו':          ['דנבר', 'אספן', 'וויל', 'בולדר', 'קולורדו ספרינגס'],
    'וושינגטון DC':     ['וושינגטון DC', 'אלכסנדריה'],
    'לואיזיאנה':        ['ניו אורלינס', 'באטון רוז\''],
    'מסצ\'וסטס':        ['בוסטון', 'קייפ קוד', 'סיילם'],
    'אילינוי':          ['שיקגו', 'ספרינגפילד'],
    'וושינגטון':        ['סיאטל', 'ספוקאן', 'ולה ולה'],
    'טנסי':             ['נשוויל', 'ממפיס', 'נוקסוויל'],
    'ג\'ורג\'יה':       ['אטלנטה', 'סוואנה'],
    'אורגון':           ['פורטלנד', 'בנד', 'אשלנד'],
    'יוטה':             ['סולט לייק סיטי', 'פארק סיטי', 'מואב', 'ציון', 'ברייס קניון'],
    'ניו מקסיקו':       ['סנטה פה', 'אלבוקרקי', 'טאוס'],
    'קרוליינה הצפונית': ['שרלוט', 'אשוויל', 'ראלי'],
    'פנסילבניה':        ['פילדלפיה', 'פיטסבורג', 'לנקסטר'],
    'מינסוטה':          ['מיניאפוליס', 'סנט פול', 'דולות\''],
    'מישיגן':           ['דטרויט', 'גרנד ראפידס', 'טרברס סיטי'],
    'אלסקה':            ['אנקורג\'', 'פירבנקס', 'ג\'ונו', 'קטמאי'],
    'מונטנה':           ['מיסולה', 'גלייסייר', 'ילוסטון'],
    'קרוליינה הדרומית': ['צ\'ארלסטון', 'מירטל ביץ\''],
  },
  Canada: {
    'אונטריו':           ['טורונטו', 'אוטווה', 'נייאגרה פולס', 'קינגסטון'],
    'קוויבק':            ['מונטריאל', 'קוויבק סיטי', 'גספ', 'טרמבלאן'],
    'בריטיש קולומביה':  ['ונקובר', 'ויקטוריה', 'וויסלר', 'קלואנה', 'קלגרי'],
    'אלברטה':           ['קלגרי', 'אדמונטון', 'ג\'אספר', 'בניף', 'לייק לואיז'],
    'מניטובה':          ['ווינימפג', 'צ\'רצ\'יל'],
    'נובה סקוטיה':       ['הליפקס', 'קייפ ברטון'],
    'סקצ\'ואן':         ['רג\'ינה', 'ססקטון'],
  },
  Australia: {
    'ניו סאות\' ויילס': ['סידני', 'ניוקאסל', 'ביירון ביי', 'הנטר ואלי'],
    'ויקטוריה':         ['מלבורן', 'גריאמפינס', 'מורנינגטון', 'ילס'],
    'קווינסלנד':        ['בריסביין', 'גולד קוסט', 'קיירנס', 'האמילטון איילנד', 'סאנשיין קוסט'],
    'אוסטרליה המערבית': ['פרת\'', 'ברום', 'מרגרט ריבר', 'אקסמות\''],
    'דרום אוסטרליה':    ['אדלייד', 'אי קנגורו', 'ברוסה ואלי'],
    'טסמניה':           ['הובארט', 'לאונסטון', 'קריידל מאונטין'],
    'שטח הבירה':        ['קנברה'],
    'הצפון':            ['דארווין', 'אולורו', 'קתרין'],
  },
}

export function getCountryStates(countryKey: string): string[] {
  return Object.keys(COUNTRY_STATES[countryKey] || {})
}

export function getStateCities(countryKey: string, state: string): string[] {
  return COUNTRY_STATES[countryKey]?.[state] || []
}

export function hasStates(countryKey: string): boolean {
  return countryKey in COUNTRY_STATES
}

export function getDestinationCities(destinationKey: string): string[] {
  return DESTINATION_CITIES[destinationKey] || []
}

// ─── Country flag emojis (keyed by DESTINATIONS key) ────────────────────────
export const COUNTRY_FLAGS: Record<string, string> = {
  // Middle East
  Israel: '🇮🇱',
  // Asia
  Thailand: '🇹🇭', Japan: '🇯🇵', China: '🇨🇳', SouthKorea: '🇰🇷', India: '🇮🇳',
  Vietnam: '🇻🇳', Indonesia: '🇮🇩', Philippines: '🇵🇭', Malaysia: '🇲🇾',
  Singapore: '🇸🇬', Cambodia: '🇰🇭', SriLanka: '🇱🇰', Nepal: '🇳🇵',
  Maldives: '🇲🇻', UAE: '🇦🇪', Jordan: '🇯🇴', Taiwan: '🇹🇼', HongKong: '🇭🇰',
  Macau: '🇲🇴', Mongolia: '🇲🇳', Myanmar: '🇲🇲', Laos: '🇱🇦',
  Bangladesh: '🇧🇩', Pakistan: '🇵🇰', Uzbekistan: '🇺🇿', Kazakhstan: '🇰🇿',
  Azerbaijan: '🇦🇿', Oman: '🇴🇲', Bahrain: '🇧🇭', Qatar: '🇶🇦',
  Kuwait: '🇰🇼', SaudiArabia: '🇸🇦', Iraq: '🇮🇶', Iran: '🇮🇷',
  Lebanon: '🇱🇧', Syria: '🇸🇾', Yemen: '🇾🇪', Afghanistan: '🇦🇫',
  Kyrgyzstan: '🇰🇬', Tajikistan: '🇹🇯', Turkmenistan: '🇹🇲',
  Brunei: '🇧🇳', EastTimor: '🇹🇱', Bhutan: '🇧🇹', NorthKorea: '🇰🇵',
  // Europe
  Italy: '🇮🇹', France: '🇫🇷', Spain: '🇪🇸', Germany: '🇩🇪', UK: '🇬🇧',
  Netherlands: '🇳🇱', Portugal: '🇵🇹', Greece: '🇬🇷', Turkey: '🇹🇷',
  Croatia: '🇭🇷', CzechRepublic: '🇨🇿', Hungary: '🇭🇺', Austria: '🇦🇹',
  Switzerland: '🇨🇭', Poland: '🇵🇱', Romania: '🇷🇴', Bulgaria: '🇧🇬',
  Sweden: '🇸🇪', Norway: '🇳🇴', Denmark: '🇩🇰', Finland: '🇫🇮',
  Iceland: '🇮🇸', Ireland: '🇮🇪', Belgium: '🇧🇪', Cyprus: '🇨🇾',
  Montenegro: '🇲🇪', Albania: '🇦🇱', Georgia: '🇬🇪', Armenia: '🇦🇲',
  Ukraine: '🇺🇦', Moldova: '🇲🇩', Russia: '🇷🇺', Belarus: '🇧🇾',
  Serbia: '🇷🇸', NorthMacedonia: '🇲🇰', BosniaHerzegovina: '🇧🇦',
  Slovenia: '🇸🇮', Slovakia: '🇸🇰', Lithuania: '🇱🇹', Latvia: '🇱🇻',
  Estonia: '🇪🇪', Malta: '🇲🇹', Luxembourg: '🇱🇺', Monaco: '🇲🇨',
  Kosovo: '🇽🇰', Andorra: '🇦🇩', Liechtenstein: '🇱🇮',
  SanMarino: '🇸🇲', Vatican: '🇻🇦',
  // Americas
  USA: '🇺🇸', Canada: '🇨🇦', Mexico: '🇲🇽', Brazil: '🇧🇷',
  Argentina: '🇦🇷', Colombia: '🇨🇴', Peru: '🇵🇪', Chile: '🇨🇱',
  CostaRica: '🇨🇷', Cuba: '🇨🇺', DominicanRepublic: '🇩🇴',
  Ecuador: '🇪🇨', Bolivia: '🇧🇴', Paraguay: '🇵🇾', Uruguay: '🇺🇾',
  Panama: '🇵🇦', Guatemala: '🇬🇹', Honduras: '🇭🇳', Nicaragua: '🇳🇮',
  Jamaica: '🇯🇲', Bahamas: '🇧🇸', TrinidadTobago: '🇹🇹',
  Venezuela: '🇻🇪', Belize: '🇧🇿', ElSalvador: '🇸🇻', Haiti: '🇭🇹',
  Barbados: '🇧🇧', Grenada: '🇬🇩', SaintLucia: '🇱🇨', Guyana: '🇬🇾',
  Suriname: '🇸🇷', SaintVincent: '🇻🇨', Antigua: '🇦🇬',
  SaintKitts: '🇰🇳', Dominica: '🇩🇲',
  // Africa
  Morocco: '🇲🇦', SouthAfrica: '🇿🇦', Kenya: '🇰🇪', Tanzania: '🇹🇿',
  Egypt: '🇪🇬', Tunisia: '🇹🇳', Ghana: '🇬🇭', Nigeria: '🇳🇬',
  Ethiopia: '🇪🇹', Rwanda: '🇷🇼', Uganda: '🇺🇬', Mozambique: '🇲🇿',
  Namibia: '🇳🇦', Botswana: '🇧🇼', Madagascar: '🇲🇬', Mauritius: '🇲🇺',
  Seychelles: '🇸🇨', Zanzibar: '🇹🇿', Algeria: '🇩🇿', Libya: '🇱🇾',
  Sudan: '🇸🇩', SouthSudan: '🇸🇸', Somalia: '🇸🇴', Eritrea: '🇪🇷',
  Djibouti: '🇩🇯', Cameroon: '🇨🇲', DRC: '🇨🇩', Congo: '🇨🇬',
  CentralAfricanRepublic: '🇨🇫', Chad: '🇹🇩', Niger: '🇳🇪',
  Mali: '🇲🇱', BurkinaFaso: '🇧🇫', Senegal: '🇸🇳', Gambia: '🇬🇲',
  Guinea: '🇬🇳', GuineaBissau: '🇬🇼', SierraLeone: '🇸🇱',
  Liberia: '🇱🇷', IvoryCoast: '🇨🇮', Togo: '🇹🇬', Benin: '🇧🇯',
  EquatorialGuinea: '🇬🇶', Gabon: '🇬🇦', Angola: '🇦🇴',
  Zambia: '🇿🇲', Zimbabwe: '🇿🇼', Malawi: '🇲🇼', Lesotho: '🇱🇸',
  Eswatini: '🇸🇿', CapeVerde: '🇨🇻', Comoros: '🇰🇲', SaoTome: '🇸🇹',
  Burundi: '🇧🇮', Mauritania: '🇲🇷',
  // Oceania
  Australia: '🇦🇺', NewZealand: '🇳🇿', Fiji: '🇫🇯', Tahiti: '🇵🇫',
  Samoa: '🇼🇸', Tonga: '🇹🇴', Vanuatu: '🇻🇺', PapuaNewGuinea: '🇵🇬',
  SolomonIslands: '🇸🇧', Kiribati: '🇰🇮', Palau: '🇵🇼',
  Micronesia: '🇫🇲', MarshallIslands: '🇲🇭', Nauru: '🇳🇷', Tuvalu: '🇹🇻',
}

export function getCountryFlag(key: string): string {
  return COUNTRY_FLAGS[key] || '🌍'
}

/**
 * Extract the primary city from a destination string like "Bangkok, Thailand" or "בנגקוק, תאילנד".
 * Handles both ASCII comma and Arabic comma ، as delimiters.
 */
export function getDestinationCity(destination: string): string {
  if (!destination) return ''
  return destination.split(/[,،]/)[0].trim()
}

export function getDestinationConfig(destination: string): DestinationConfig | null {
  const exact = DESTINATIONS[destination]
  if (exact) return exact

  const lower = destination.toLowerCase()
  for (const [key, config] of Object.entries(DESTINATIONS)) {
    if (key.toLowerCase() === lower || config.countryHe === destination || config.country.toLowerCase() === lower) return config
  }
  return null
}

export function getDestinationList() {
  return Object.entries(DESTINATIONS)
    .map(([key, config]) => ({
      id:     key,
      name:   config.country,
      nameHe: config.countryHe,
      currency: config.currency,
      flag:   COUNTRY_FLAGS[key] || '🌍',
    }))
    .sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'))
}

export function searchDestinations(query: string) {
  const list = getDestinationList()
  if (!query.trim()) return list
  const lower = query.toLowerCase().trim()
  // Score: exact start of Hebrew name gets priority
  return list
    .map(d => {
      let score = 0
      if (d.nameHe.startsWith(query))                   score += 10
      else if (d.nameHe.includes(query))                score += 5
      if (d.name.toLowerCase().startsWith(lower))       score += 8
      else if (d.name.toLowerCase().includes(lower))    score += 4
      if (d.currency.toLowerCase().includes(lower))     score += 2
      return { ...d, score }
    })
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
}
