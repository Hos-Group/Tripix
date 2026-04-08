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
      id: key,
      name: config.country,
      nameHe: config.countryHe,
      currency: config.currency,
    }))
    .sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'))
}

export function searchDestinations(query: string) {
  if (!query.trim()) return getDestinationList()
  const lower = query.toLowerCase()
  return getDestinationList().filter(d =>
    d.name.toLowerCase().includes(lower) ||
    d.nameHe.includes(query)
  )
}
