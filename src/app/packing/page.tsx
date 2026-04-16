'use client'

import { useState, useEffect, useMemo } from 'react'
import { Check, ChevronLeft, ChevronDown, ChevronUp, Luggage, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTrip } from '@/contexts/TripContext'

// ─── Types ───────────────────────────────────────────────────────────────────

type TripType = 'beach' | 'city' | 'trekking' | 'skiing' | 'business' | 'desert' | 'general'

interface PackingItem {
  id: string
  text: string
  checked: boolean
  category: string
  custom?: boolean
}

interface CategoryDef {
  id: string
  label: string
  icon: string
  items: string[]
}

// ─── Packing Data ─────────────────────────────────────────────────────────────

const PACKING_LISTS: Record<TripType, CategoryDef[]> = {
  beach: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות', 'ויזה (אם נדרשת)', 'צילום מסמכים בענן', 'כרטיס אשראי', 'כסף מזומן מקומי', 'פרטי הזמנות מלון'],
    },
    {
      id: 'clothing', label: 'ביגוד', icon: '👕',
      items: ['בגד ים (x2)', 'שורטים קלים (x3)', 'חולצות קצרות (x4)', 'שמלה / כותונת קלה', 'כיסוי לבגד ים', 'חולצה ארוכה לכניסה למקדשים', 'מכנסיים ארוכים קלים', 'כובע רחב שוליים', 'חגורה', 'תחתונים (x5)', 'גרביים (x3)'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['כפכפים לים / בריכה', 'סנדלים נוחים להליכה', 'נעלי הליכה קלות', 'נעלי ערב לסגנון'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['קרם הגנה SPF50+ (גדול)', 'קרם הגנה לפנים SPF50', 'שמן אחרי שמש (After Sun)', 'דוחה יתושים DEET', 'מגבת מיקרופייבר', 'שמפו / מרכך', 'דאודורנט', 'מברשת שיניים + משחה', 'תרופות אישיות', 'אנטי-היסטמין', 'כדורי בטן (לפת שעון / ביסמות)', 'פלסטרים ועזרה ראשונה', 'אספירין / איבופרופן', 'משקפי שמש עם UV', 'גלגלי לב לנסיעה'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה', icon: '🔌',
      items: ['מתאם חשמל לארץ היעד', 'פאוורבנק (20,000mAh)', 'כבל USB-C / Lightning', 'אוזניות', 'מצלמה עמידה למים / GoPro', 'מחזיק טלפון לאופנוע/קטנוע', 'כרטיס SIM מקומי / eSIM'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['שינוי בגדים אחד', 'טואלטיקה קטנה (100ml)', 'כרית צוואר לטיסה', 'מסכת שינה ואטמי אוזניים', 'חטיפים לדרך', 'ספר / קינדל', 'מנעול לתיק', 'ארנק קטן'],
    },
    {
      id: 'beach_gear', label: 'ציוד ים וחוף', icon: '🤿',
      items: ['מגבת חוף גדולה', 'משקפת צלילה (סנורקל)', 'אטמי אוזניים לים', 'תיק עמיד למים', 'ספסל חוף קל (אופציונלי)', 'כדור חוף', 'שקית עמידה למים לטלפון'],
    },
  ],

  city: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות', 'ויזה (אם נדרשת)', 'צילום מסמכים בענן', 'כרטיס אשראי', 'כסף מזומן מקומי', 'פרטי הזמנות מלון', 'כרטיסי תחבורה ציבורית'],
    },
    {
      id: 'clothing', label: 'ביגוד', icon: '👕',
      items: ['מכנסיים ארוכים (x2)', 'ג\'ינס', 'חולצות (x4)', 'חולצות T (x3)', 'סוודר / קרדיגן', 'מעיל / ג\'קט (לפי עונה)', 'שמלה / חולצה אלגנטית', 'חגורה', 'תחתונים (x5)', 'גרביים (x5)', 'מטרייה קטנה / פונצ\'ו'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['נעלי הליכה נוחות', 'נעלי ספורט', 'נעלי ערב / מגפיים', 'כפכפים לחדר מלון'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['שמפו / מרכך', 'דאודורנט', 'מברשת שיניים + משחה', 'גילוח', 'קרם לחות', 'תרופות אישיות', 'אספירין / איבופרופן', 'פלסטרים', 'מגבות לחות', 'ניילון רגליים (לנסיעות ארוכות)'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה', icon: '🔌',
      items: ['מתאם חשמל לארץ היעד', 'פאוורבנק', 'כבל טעינה', 'אוזניות', 'מצלמה', 'כרטיס SIM מקומי / eSIM', 'מנעול טוטו לתיק'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['שינוי בגדים', 'טואלטיקה קטנה (100ml)', 'כרית צוואר', 'מסכת שינה', 'חטיפים', 'ספר / קינדל'],
    },
    {
      id: 'city_extras', label: 'אביזרים לעיר', icon: '🗺️',
      items: ['מפה מודפסת / הורדת מפות offline', 'מנעול לתיק', 'ממיר כסף / כרטיס Wise', 'ספר מדריך / אפליקציית מסלול'],
    },
  ],

  trekking: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות (כולל הצלת ​​הליקופטר)', 'ויזה (אם נדרשת)', 'צילום מסמכים בענן', 'כרטיס אשראי + מזומן', 'אישורי טרקים / פרמיטים'],
    },
    {
      id: 'clothing', label: 'ביגוד', icon: '👕',
      items: ['חולצות נדיפות לחות (Dry-fit) (x4)', 'חולצה תרמית (x2)', 'מכנסי טרקינג (x2)', 'מכנסיים קצרים (x1)', 'פלייס / מידשייר', 'מעיל גשם / רוח', 'מעיל חורף קל לגובה', 'גרביים טכניות (x4)', 'תחתונים מנדפי לחות (x4)', 'כובע / גרב ראש', 'כפפות לגובה'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['נעלי טרקינג אנקל בהיות (מתוחות)', 'גרביים מגולגלות (x3 נוספות)', 'כפכפים למחנה', 'גיטרים / כיסויי נעל לגשם (אופציונלי)'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['קרם הגנה SPF50', 'שפתון עם הגנה', 'דוחה יתושים', 'מגבות לחות / Baby wipes', 'תרופות אישיות', 'תרופה לגובה (Diamox)', 'כדורי ניקוי מים / פילטר מים', 'Blister pads לרגליים', 'פלסטרים ועזרה ראשונה מורחבת', 'אנטיביוטיקה רחבת טווח (בהמלצת רופא)', 'משחת אנטי-ספטיק'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה', icon: '🔌',
      items: ['מתאם חשמל', 'פאוורבנק גדול (26,800mAh)', 'כבל טעינה', 'פנס ראש (Headlamp) + סוללות', 'GPS / שעון GPS', 'מצלמה עמידה למים', 'כרטיס SIM מקומי'],
    },
    {
      id: 'trekking_gear', label: 'ציוד טרקינג', icon: '⛺',
      items: ['תרמיל 40-60L', 'כיסוי גשם לתרמיל', 'מקלות הליכה', 'שק שינה (לפי טמפרטורת לילה)', 'כרית מתנפחת', 'מחצלת / כרית שינה קלה', 'מנורת מחנה / נרות', 'מצית / גפרורים', 'ציוד בישול קל (אופציונלי)', 'חבל 10m', 'תיק ראשוני לפיסגות'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['שינוי בגדים', 'טואלטיקה קטנה', 'כרית צוואר', 'חטיפים אנרגטיים', 'מסמכים חשובים'],
    },
  ],

  skiing: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות (כולל ספורט חורף)', 'כרטיס אשראי + מזומן', 'צילום מסמכים בענן', 'הזמנת מגורים', 'כרטיסי מעליות (Ski Pass)'],
    },
    {
      id: 'clothing', label: 'ביגוד חורף', icon: '🧥',
      items: ['מעיל סקי מקצועי (עמיד רוח/מים)', 'מכנסי סקי', 'שכבה תרמית עליונה (x2)', 'שכבה תרמית תחתונה (x2)', 'פלייס / מידשייר עבה', 'גרביים תרמיות לסקי (x3)', 'גרביים רגילות (x3)', 'תחתונים תרמיים (x3)', 'כובע גרב / בלקלבה', 'כפכפים לחדר'],
    },
    {
      id: 'ski_gear', label: 'ציוד סקי', icon: '⛷️',
      items: ['סקי / סנובורד (או השכרה)', 'מגפי סקי (או השכרה)', 'קסדת סקי', 'משקפת סקי (Goggles)', 'כפפות סקי עמידות (x2 זוגות)', 'מקלות סקי', 'מגן גב / מגן אגן (אופציונלי)'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['מגפי שלג לחוץ למגרש', 'נעלי בית / UGG לאחר הסקי'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['קרם הגנה SPF50 לשלג', 'שפתון עם הגנה לאחר השמש', 'קרם ידיים אינטנסיבי', 'חום גוף (Hand warmers)', 'תרופות אישיות', 'Ibuprofen / מרגיע שרירים', 'פלסטרים ועזרה ראשונה', 'טיפות עיניים לעיניים יבשות'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה', icon: '🔌',
      items: ['מתאם חשמל', 'פאוורבנק (סוללות מתרוקנות מהר בקור)', 'כבל טעינה', 'אוזניות Bluetooth עמידות', 'GoPro / מצלמת ספורט', 'כרטיס SIM מקומי'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['שינוי בגדים', 'טואלטיקה קטנה', 'כרית צוואר', 'חטיפים', 'מסמכים חשובים'],
    },
  ],

  business: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות', 'כרטיסי ביקור', 'מסמכי עבודה מודפסים', 'ויזה (אם נדרשת)', 'כרטיס אשראי חברה + אישי', 'כסף מזומן מקומי', 'אישורי הזמנות מלון'],
    },
    {
      id: 'clothing', label: 'ביגוד עסקי', icon: '👔',
      items: ['חליפה / בלייזר (x1-2)', 'חולצות מכופתרות (x3)', 'עניבות (x2)', 'מכנסי חליפה (x2)', 'שמלות / חצאית רשמית', 'חולצות קז\'ואל לנסיעה', 'ג\'קט קל', 'תחתונים (x5)', 'גרביים (x5)', 'גרביים שחורות לעסקים (x3)'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['נעלי עור / נעלי עסקים', 'נעלי ספורט / הליכה', 'כפכפים לחדר מלון'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה ועבודה', icon: '💼',
      items: ['מחשב נייד + מטען', 'עכבר נסיעה', 'מתאם HDMI / USB-C', 'פאוורבנק', 'מתאם חשמל לארץ היעד', 'אוזניות לשיחות וידאו', 'כרטיס SIM מקומי / eSIM', 'כבל גיבוי', 'USB stick', 'מנעול קבל לתיק מחשב'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['שמפו / מרכך', 'דאודורנט', 'מברשת שיניים + משחה', 'גילוח + קצף / מכשיר חשמלי', 'קרם לחות', 'עט שחור (חתימות)', 'תרופות אישיות', 'טיפות עיניים לטיסות ארוכות', 'פלסטרים', 'כדורים נגד ג\'ט-לג'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['מחשב נייד', 'שינוי בגדים', 'טואלטיקה קטנה (100ml)', 'מסמכים חשובים', 'כרית צוואר', 'מסכת שינה', 'אוזניות', 'עט ומחברת'],
    },
    {
      id: 'business_extras', label: 'אביזרי עסקים', icon: '🗂️',
      items: ['מחברת / פנקס', 'עט x2', 'קלסר קטן למסמכים', 'תיק כתף עסקי', 'מנעול TSA למזוודה'],
    },
  ],

  desert: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות', 'ויזה (אם נדרשת)', 'צילום מסמכים בענן', 'כרטיס אשראי + מזומן (כולל דולרים)', 'פרטי הזמנות'],
    },
    {
      id: 'clothing', label: 'ביגוד לאקלים חם יבש', icon: '👕',
      items: ['חולצות ארוכות קלות (Linen / כותנה) (x4)', 'מכנסיים ארוכים קלים (x2)', 'שורטים לשעות הפנאי', 'צעיף / כפייה', 'גרביים (x4)', 'תחתונים (x5)', 'כובע מגן שמש רחב שוליים', 'מעיל / שכבה ללילה (קר בלילה במדבר)'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['נעלי הליכה / סנדלי טרק', 'נעלי ערב קלות', 'כפכפים לחדר'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['קרם הגנה SPF50+ (גדול)', 'קרם שפתיים עם הגנה', 'קרם ידיים וגוף אינטנסיבי', 'דאודורנט', 'מברשת שיניים + משחה', 'תרופות אישיות', 'אנטי-היסטמין', 'פלסטרים ועזרה ראשונה', 'מגבות לחות', 'טיפות עיניים'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה', icon: '🔌',
      items: ['מתאם חשמל', 'פאוורבנק גדול', 'כבל טעינה', 'אוזניות', 'מצלמה', 'כרטיס SIM מקומי / eSIM'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['שינוי בגדים', 'טואלטיקה קטנה', 'כרית צוואר', 'חטיפים', 'מסמכים חשובים'],
    },
    {
      id: 'desert_extras', label: 'ציוד מיוחד למדבר/מזרח תיכון', icon: '🏜️',
      items: ['בקבוק מים גדול / Camelback', 'טבליות מלח / Electrolytes', 'מגבת מיקרופייבר', 'מנעול TSA', 'שקיות Ziploc עמידות לחול'],
    },
  ],

  general: [
    {
      id: 'docs', label: 'מסמכים ונייר', icon: '📄',
      items: ['דרכון', 'כרטיסי טיסה', 'ביטוח נסיעות', 'ויזה (אם נדרשת)', 'צילום מסמכים בענן', 'כרטיס אשראי', 'כסף מזומן מקומי', 'פרטי הזמנות'],
    },
    {
      id: 'clothing', label: 'ביגוד', icon: '👕',
      items: ['חולצות (x4)', 'מכנסיים ארוכים (x2)', 'שורטים (x2)', 'ג\'קט / שכבה', 'תחתונים (x5)', 'גרביים (x5)', 'כובע'],
    },
    {
      id: 'shoes', label: 'נעליים', icon: '👟',
      items: ['נעלי הליכה', 'סנדלים', 'כפכפים לחדר'],
    },
    {
      id: 'hygiene', label: 'היגיינה ובריאות', icon: '🧴',
      items: ['שמפו / מרכך', 'דאודורנט', 'מברשת שיניים + משחה', 'קרם הגנה', 'תרופות אישיות', 'פלסטרים ועזרה ראשונה', 'אספירין / איבופרופן'],
    },
    {
      id: 'electronics', label: 'אלקטרוניקה', icon: '🔌',
      items: ['מתאם חשמל', 'פאוורבנק', 'כבל טעינה', 'אוזניות', 'כרטיס SIM מקומי'],
    },
    {
      id: 'carryon', label: 'תיק יד / carry-on', icon: '🎒',
      items: ['שינוי בגדים', 'טואלטיקה קטנה', 'חטיפים', 'מסמכים חשובים', 'כרית צוואר'],
    },
  ],
}

const KIDS_CATEGORY: CategoryDef = {
  id: 'kids', label: 'לילדים / תינוק', icon: '🍼',
  items: ['חיתולים (כמות נדיבה)', 'מגבונים לחים', 'בקבוק / כוס ספיל', 'מזון תינוק / ילד', 'בגדי החלפה (x5)', 'כובע שמש לתינוק', 'קרם הגנה לתינוק SPF50', 'תרופות ילדים (אקמול / נורופן)', 'מוצץ', 'עגלה קלה / carrier', 'שמיכת נסיעה', 'צעצוע קטן לטיסה', 'שקית ניילון לחיתולים'],
}

// ─── Trip Type Detection ──────────────────────────────────────────────────────

const BEACH_KEYWORDS = ['תאילנד', 'thailand', 'מלדיביים', 'maldives', 'בלי', 'bali', 'פוקט', 'phuket', 'קוסמוי', 'koh samui', 'קנקון', 'cancun', 'מיאמי', 'miami', 'ברצלונה חוף', 'סרי לנקה', 'sri lanka', 'פיג\'י', 'fiji', 'קריביים', 'caribbean', 'האיטי', 'ג\'מייקה', 'jamaica', 'פיליפינים', 'philippines', 'ים', 'beach', 'חוף', 'tropical', 'טרופי', 'קיש', 'krabi', 'קראבי', 'goa', 'גואה', 'מאוריציוס', 'mauritius', 'אגם כחול', 'ספרד', 'יוון', 'greece', 'santorini', 'סנטוריני', 'mykonos', 'מיקונוס']

const CITY_KEYWORDS = ['paris', 'פריז', 'london', 'לונדון', 'new york', 'ניו יורק', 'nyc', 'amsterdam', 'אמסטרדם', 'rome', 'רומא', 'berlin', 'ברלין', 'madrid', 'מדריד', 'tokyo', 'טוקיו', 'seoul', 'סיאול', 'prague', 'פראג', 'budapest', 'בודפשט', 'vienna', 'וינה', 'lisbon', 'ליסבון', 'singapore', 'סינגפור', 'dubai', 'דובאי', 'istanbul', 'איסטנבול', 'bangkok', 'בנגקוק', 'עיר', 'city', 'מוזיאון', 'תרבות']

const TREKKING_KEYWORDS = ['נפאל', 'nepal', 'everest', 'אוורסט', 'himalaya', 'הימלאיה', 'patagonia', 'פטגוניה', 'peru', 'פרו', 'machu picchu', 'מאצ\'ו פיצ\'ו', 'andes', 'אנדים', 'trek', 'טרק', 'hiking', 'הייקינג', 'הרים', 'mountain', 'קילימנג\'רו', 'kilimanjaro', 'ג\'ונגל', 'jungle', 'costa rica', 'קוסטה ריקה', 'iceland', 'איסלנד', 'new zealand', 'ניו זילנד', 'scotland', 'סקוטלנד', 'אוסטריה', 'austria', 'שווייץ', 'switzerland']

const SKIING_KEYWORDS = ['סקי', 'ski', 'snowboard', 'סנובורד', 'alps', 'אלפים', 'verbier', 'verbier', 'chamonix', 'שמוני', 'zermatt', 'זרמט', 'innsbruck', 'אינסברוק', 'aspen', 'אספן', 'vail', 'courchevel', 'meribel', 'בוזלובה', 'banff', 'banff', 'whistler', 'קנדה סקי', 'ג\'פן סקי', 'niseko', 'חורף', 'winter', 'שלג', 'snow']

const BUSINESS_KEYWORDS = ['עסקים', 'business', 'כנס', 'conference', 'congress', 'פגישה', 'meeting', 'עבודה', 'work', 'trip עסקי', 'השתלמות', 'training', 'exhibition', 'תערוכה', 'linkedin', 'colleagues']

const DESERT_KEYWORDS = ['דובאי', 'dubai', 'אבו דאבי', 'abu dhabi', 'ריאד', 'riyadh', 'ירדן', 'jordan', 'פטרה', 'petra', 'וואדי', 'wadi', 'מרוקו', 'morocco', 'מרקש', 'marrakech', 'שארם', 'sharm', 'אילת', 'eilat', 'ספרד ים תיכון', 'קהיר', 'cairo', 'egypt', 'מצרים', 'oman', 'עומאן', 'מדבר', 'desert', 'bahrain', 'בחריין', 'kuwait', 'כווית']

const KIDS_KEYWORDS = ['תינוק', 'baby', 'ילד', 'child', 'kids', 'family', 'משפחה', 'ילדים', 'בת', 'בן', 'נכד', 'נכדה']

function detectTripType(destination: string, name: string): TripType {
  const text = `${destination} ${name}`.toLowerCase()

  if (SKIING_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return 'skiing'
  if (BUSINESS_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return 'business'
  if (TREKKING_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return 'trekking'
  if (BEACH_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return 'beach'
  if (DESERT_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return 'desert'
  if (CITY_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return 'city'
  return 'general'
}

function detectHasKids(travelers: { id: string; name: string }[], tripName: string): boolean {
  const names = travelers.map(t => t.name.toLowerCase()).join(' ')
  const text = `${names} ${tripName}`.toLowerCase()
  return KIDS_KEYWORDS.some(k => text.includes(k.toLowerCase()))
}

// ─── Trip type labels ─────────────────────────────────────────────────────────

const TRIP_TYPE_OPTIONS: { value: TripType; label: string; icon: string }[] = [
  { value: 'beach', label: 'ים / חוף', icon: '🏖️' },
  { value: 'city', label: 'עיר', icon: '🏙️' },
  { value: 'trekking', label: 'הרים / טרק', icon: '🏔️' },
  { value: 'skiing', label: 'סקי', icon: '⛷️' },
  { value: 'business', label: 'עסקים', icon: '💼' },
  { value: 'desert', label: 'מדבר / מזרח תיכון', icon: '🏜️' },
  { value: 'general', label: 'כללי', icon: '🧳' },
]

// ─── Wizard questions ─────────────────────────────────────────────────────────

const WIZARD_TYPES: { value: TripType; label: string; icon: string; desc: string; bg: string }[] = [
  { value: 'beach',    label: 'ים / חוף',           icon: '🏖️', desc: 'חוף ים, בריכה, שנורקל',     bg: 'from-cyan-400 to-blue-500' },
  { value: 'city',     label: 'עיר / תרבות',        icon: '🏙️', desc: 'טיסה, מוזיאונים, מסעדות',   bg: 'from-purple-400 to-indigo-500' },
  { value: 'trekking', label: 'הרים / טבע',         icon: '🏔️', desc: 'טרקים, קמפינג, טיבע',       bg: 'from-green-400 to-emerald-600' },
  { value: 'skiing',   label: 'סקי / שלג',           icon: '⛷️', desc: 'פיסטות, אפרס-סקי, חורף',   bg: 'from-blue-300 to-sky-600' },
  { value: 'business', label: 'עסקים',              icon: '💼', desc: 'כנסים, פגישות, עבודה',      bg: 'from-slate-500 to-gray-700' },
  { value: 'desert',   label: 'מדבר / מזרח תיכון', icon: '🏜️', desc: 'חום, חול, אתרים עתיקים',   bg: 'from-amber-400 to-orange-600' },
  { value: 'general',  label: 'כללי / מעורב',       icon: '🧳', desc: 'טיסה מעורבת, רשימה בסיסית', bg: 'from-gray-400 to-gray-600' },
]

// ─── Activity options for wizard ──────────────────────────────────────────────
const ACTIVITY_OPTIONS = [
  { value: 'beach',    icon: '🏖️', label: 'ים / חוף' },
  { value: 'city',     icon: '🏙️', label: 'עיר / תרבות' },
  { value: 'trekking', icon: '🥾', label: 'טבע / הרים' },
  { value: 'skiing',   icon: '⛷️', label: 'סקי / שלג' },
  { value: 'business', icon: '💼', label: 'עסקים' },
  { value: 'desert',   icon: '🏜️', label: 'מדבר / שמש' },
]

/**
 * Returns the set of activities that are geographically relevant to the
 * given destination + trip name. Used to hide nonsensical options from the
 * packing wizard (e.g. skiing in Thailand, beach in Madrid).
 *
 * Rules:
 *  - city / business: always shown
 *  - trekking: shown everywhere except flat micro-destinations (Maldives, Singapore)
 *  - skiing: only shown for alpine / cold-winter destinations
 *  - beach: shown when destination has a coastline; hidden for landlocked cities
 *  - desert: shown for arid / Middle-Eastern destinations
 *
 * When the destination is a whole country (e.g. "Spain"), the check is permissive —
 * Spain has coast so beach is shown even if trip name mentions "Madrid".
 * When the destination is a landlocked city (e.g. "Madrid"), beach is hidden
 * unless a coastal city appears in the trip name (e.g. "מדריד + ברצלונה").
 */
function getAvailableActivities(destination: string, tripName: string): Set<string> {
  const txt = `${destination} ${tripName}`.toLowerCase()

  const available = new Set(['city', 'business']) // always available

  // ── Trekking ───────────────────────────────────────────────────────────────
  available.add('trekking')
  if (['maldives', 'מלדיביים', 'singapore', 'סינגפור'].some(p => txt.includes(p))) {
    available.delete('trekking')
  }

  // ── Skiing — only alpine/winter destinations ───────────────────────────────
  const SKI_YES = [
    'ski', 'סקי', 'snow', 'שלג', 'alps', 'אלפים', 'winter',
    'switzerland', 'שווייץ', 'austria', 'אוסטריה', 'andorra', 'אנדורה',
    'norway', 'נורווגיה', 'sweden', 'שוודיה', 'finland', 'פינלנד',
    'iceland', 'איסלנד', 'scotland', 'סקוטלנד',
    'japan', 'יפן', 'niseko', 'hokkaido',
    'canada', 'קנדה', 'banff', 'whistler',
    'colorado', 'utah', 'vermont', 'aspen', 'vail', 'breckenridge',
    'innsbruck', 'zermatt', 'verbier', 'chamonix', 'courchevel', 'meribel',
    'st moritz', 'davos', 'gstaad', 'kitzbühel', 'kitzbuhel', 'lech',
    'bansko', 'bulgaria', 'בולגריה', 'romania', 'רומניה', 'zakopane',
    'new zealand', 'ניו זילנד',
    'germany', 'גרמניה', 'france', 'צרפת', 'italy', 'איטליה',
    // only if explicitly mentions ski/snow (for ambiguous countries)
  ]
  const SKI_NO = [
    'thailand', 'תאילנד', 'phuket', 'samui', 'krabi', 'pattaya',
    'indonesia', 'אינדונזיה', 'bali', 'lombok',
    'vietnam', 'וייטנאם', 'cambodia', 'קמבודיה', 'malaysia', 'מלזיה',
    'philippines', 'פיליפינים', 'maldives', 'מלדיביים', 'sri lanka',
    'india', 'הודו', 'goa', 'גואה', 'singapore', 'סינגפור',
    'mexico', 'מקסיקו', 'cancun', 'playa', 'caribbean', 'cuba', 'jamaica', 'barbados',
    'egypt', 'מצרים', 'sharm', 'hurghada',
    'uae', 'dubai', 'דובאי', 'abu dhabi', 'oman', 'עומן',
    'bahrain', 'kuwait', 'qatar', 'saudi', 'jordan', 'ירדן',
    'morocco', 'מרוקו', 'tunisia', 'algeria', 'libya',
    'kenya', 'tanzania', 'ethiopia', 'ghana', 'nigeria', 'senegal',
    'brazil', 'ברזיל', 'colombia', 'ecuador', 'costa rica',
    'hawaii', 'הוואי', 'tahiti', 'fiji',
    'israel', 'ישראל', 'eilat', 'אילת',
    'cyprus', 'קפריסין', 'malta',
  ]
  if (SKI_YES.some(p => txt.includes(p)) && !SKI_NO.some(p => txt.includes(p))) {
    available.add('skiing')
  }

  // ── Beach — check coasts, hide for pure landlocked cities ──────────────────
  const BEACH_YES = [
    // Tropical
    'thailand', 'תאילנד', 'phuket', 'samui', 'krabi', 'pattaya',
    'indonesia', 'אינדונזיה', 'bali', 'lombok',
    'vietnam', 'וייטנאם', 'da nang', 'hoi an', 'nha trang', 'phu quoc',
    'cambodia', 'sihanoukville', 'malaysia', 'penang', 'langkawi',
    'philippines', 'פיליפינים', 'boracay', 'palawan',
    'maldives', 'מלדיביים', 'sri lanka', 'india', 'הודו', 'goa', 'גואה',
    'mexico', 'מקסיקו', 'cancun', 'playa del carmen', 'tulum', 'los cabos',
    'caribbean', 'cuba', 'jamaica', 'barbados', 'dominican',
    'hawaii', 'הוואי', 'tahiti', 'fiji',
    'brazil', 'ברזיל', 'rio', 'florianopolis',
    // Mediterranean coast
    'spain', 'ספרד', 'barcelona', 'bcn', 'malaga', 'ibiza', 'mallorca',
    'valencia', 'alicante', 'marbella', 'benidorm',
    'greece', 'יוון', 'santorini', 'mykonos', 'crete', 'rhodes', 'corfu',
    'italy', 'איטליה', 'sicily', 'sardinia', 'naples', 'amalfi', 'rimini',
    'france', 'צרפת', 'nice', 'cannes', 'marseille', 'côte d\'azur',
    'portugal', 'פורטוגל', 'algarve', 'faro', 'cascais', 'sesimbra',
    'croatia', 'קרואטיה', 'split', 'dubrovnik', 'hvar',
    'turkey', 'טורקיה', 'antalya', 'bodrum', 'marmaris', 'fethiye',
    'cyprus', 'קפריסין', 'malta',
    'montenegro', 'albania',
    // Middle East & Africa coast
    'israel', 'ישראל', 'eilat', 'אילת', 'tel aviv', 'תל אביב', 'netanya',
    'egypt', 'מצרים', 'sharm', 'hurghada',
    'uae', 'dubai', 'דובאי', 'abu dhabi',
    'jordan', 'aqaba',
    'morocco', 'מרוקו', 'agadir', 'essaouira',
    'tunisia', 'djerba',
    // Americas coast
    'miami', 'florida', 'california', 'los angeles', 'san diego', 'santa monica',
    'australia', 'sydney', 'bondi', 'gold coast', 'cairns',
    'south africa', 'cape town', 'קייפ טאון',
    'singapore', 'sentosa', // small beach
  ]
  // Landlocked cities — only block beach if destination IS this city
  const BEACH_NO_CITIES = [
    'madrid', 'מדריד', 'paris', 'פריז',
    'berlin', 'ברלין', 'munich', 'מינכן', 'frankfurt', 'פרנקפורט',
    'vienna', 'וינה', 'prague', 'פראג', 'budapest', 'בודפשט',
    'warsaw', 'ורשה', 'krakow', 'קרקוב',
    'zurich', 'זוריך', 'geneva', 'ז\'נבה', 'bern',
    'milan', 'מילאנו', 'florence', 'פירנצה',
    'brussels', 'בריסל',
    'chicago', 'שיקגו', 'las vegas', 'לאס וגאס',
    'denver', 'dallas', 'atlanta', 'washington',
    'toronto', 'montreal',
    'kyoto', 'קיוטו',
    'beijing', 'moscow',
  ]

  const hasBeachKeyword   = BEACH_YES.some(p => txt.includes(p))
  // Destination field alone (not trip name) for landlocked check
  const destOnly          = destination.toLowerCase()
  const isLandlockedDest  = BEACH_NO_CITIES.some(p => destOnly.includes(p))
  // Trip name might add a coastal city even if destination is landlocked
  const nameHasCoastal    = BEACH_YES.some(p => tripName.toLowerCase().includes(p))

  if (hasBeachKeyword || (!isLandlockedDest && !hasBeachKeyword ? false : nameHasCoastal)) {
    available.add('beach')
  }
  if (isLandlockedDest && !nameHasCoastal) {
    available.delete('beach')
  }

  // ── Desert ─────────────────────────────────────────────────────────────────
  const DESERT_YES = [
    'egypt', 'מצרים', 'jordan', 'ירדן', 'petra', 'פטרה', 'wadi rum', 'aqaba',
    'israel', 'ישראל', 'eilat', 'אילת', 'negev', 'נגב', 'dead sea', 'ים המלח',
    'uae', 'dubai', 'דובאי', 'abu dhabi', 'oman', 'עומן',
    'saudi', 'qatar', 'kuwait', 'bahrain',
    'morocco', 'מרוקו', 'marrakech', 'מרקש', 'sahara',
    'tunisia', 'algeria', 'iran', 'iraq',
    'namibia', 'botswana',
    'peru', 'פרו', 'atacama', 'chile',
    'arizona', 'nevada', 'utah', 'new mexico', 'las vegas', 'phoenix',
    'australia', 'outback', 'uluru',
    'mongolia', 'gobi',
    'rajasthan', 'jaisalmer',
    'desert', 'מדבר',
  ]
  if (DESERT_YES.some(p => txt.includes(p))) available.add('desert')

  return available
}

interface WeatherInfo {
  avgMax: number; avgMin: number; rainProb: number
  isHot: boolean; isCold: boolean; isRainy: boolean
  description: string; emoji: string; loaded: boolean; failed: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PackingPage() {
  const { currentTrip } = useTrip()
  const [tripType, setTripType] = useState<TripType>('general')
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)   // 0=activities, 1=weather
  const [wActivities, setWActivities] = useState<string[]>([])
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [customItems, setCustomItems] = useState<{ id: string; text: string; category: string }[]>([])
  const [newItemText, setNewItemText] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('docs')
  const [showAddForm, setShowAddForm] = useState(false)

  const storageKey  = currentTrip ? `tripix_packing_v2_${currentTrip.id}` : 'tripix_packing_v2_default'
  const typeKey     = currentTrip ? `tripix_packing_type_${currentTrip.id}` : 'tripix_packing_type_default'
  const wizardKey   = currentTrip ? `tripix_packing_wizard_${currentTrip.id}` : 'tripix_packing_wizard_default'

  // Auto-detect trip type when trip changes — show wizard if not yet answered
  useEffect(() => {
    if (!currentTrip) return
    const wizardDone = localStorage.getItem(wizardKey)
    const savedType  = wizardDone ? localStorage.getItem(typeKey) : null  // only trust saved type if wizard was completed

    if (savedType && TRIP_TYPE_OPTIONS.find(o => o.value === savedType)) {
      setTripType(savedType as TripType)
      setShowWizard(false)
    } else if (!wizardDone) {
      const detected = detectTripType(currentTrip.destination || '', currentTrip.name || '')
      setTripType(detected)
      setWActivities([detected === 'general' ? 'city' : detected])
      setWizardStep(0)
      setShowWizard(true)
    } else {
      const detected = detectTripType(currentTrip.destination || '', currentTrip.name || '')
      setTripType(detected)
    }
  }, [currentTrip, typeKey, wizardKey])

  // Fetch weather when moving to step 1
  const fetchWeather = async () => {
    if (!currentTrip?.destination) {
      setWeatherInfo({ avgMax: 25, avgMin: 18, rainProb: 20, isHot: false, isCold: false, isRainy: false, description: 'מזג אוויר לא זמין', emoji: '⛅', loaded: true, failed: true })
      return
    }
    const city = currentTrip.destination.split(',')[0].trim()
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      const daily: { tempMax: number; tempMin: number; precipitationProb: number }[] = data.daily || []
      const len = daily.length || 1
      const avgMax   = Math.round(daily.reduce((s, d) => s + (d.tempMax ?? 25), 0) / len)
      const avgMin   = Math.round(daily.reduce((s, d) => s + (d.tempMin ?? 18), 0) / len)
      const rainProb = Math.round(daily.reduce((s, d) => s + (d.precipitationProb ?? 20), 0) / len)
      const isHot   = avgMax > 28
      const isCold  = avgMax < 14
      const isRainy = rainProb > 40

      let emoji = '☀️', description = ''
      if (isHot && isRainy) { emoji = '🌦️'; description = `חם וגשמי (${avgMax}°C / גשם ${rainProb}%)` }
      else if (isHot)       { emoji = '☀️'; description = `נעים וחם (${avgMax}°C)` }
      else if (isCold && isRainy) { emoji = '🌧️'; description = `קר וגשמי (${avgMax}°C / גשם ${rainProb}%)` }
      else if (isCold)      { emoji = '🥶'; description = `קר (${avgMax}°C)` }
      else if (isRainy)     { emoji = '☔'; description = `עם גשם (${avgMax}°C / גשם ${rainProb}%)` }
      else                  { emoji = '⛅'; description = `מזג אוויר נוח (${avgMax}°C)` }

      setWeatherInfo({ avgMax, avgMin, rainProb, isHot, isCold, isRainy, description, emoji, loaded: true, failed: false })
    } catch {
      setWeatherInfo({ avgMax: 25, avgMin: 18, rainProb: 20, isHot: false, isCold: false, isRainy: false, description: 'לא הצלחנו לטעון מזג אוויר', emoji: '⛅', loaded: true, failed: true })
    }
  }

  const goToWeatherStep = () => {
    setWizardStep(1)
    setWeatherInfo(null)
    fetchWeather()
  }

  const completeWizard = () => {
    // Primary type = first selected activity
    const primaryType = (wActivities[0] || 'general') as TripType
    setTripType(primaryType)
    setShowWizard(false)
    localStorage.setItem(typeKey, primaryType)
    localStorage.setItem(wizardKey, '1')

    // Add weather extras as custom items
    if (weatherInfo && !weatherInfo.failed) {
      const extras: { id: string; text: string; category: string }[] = []
      if (weatherInfo.isCold) {
        extras.push(
          { id: 'wx_thermal', text: 'חולצה תרמית / בסיס', category: 'clothing' },
          { id: 'wx_jacket', text: 'מעיל חורף כבד', category: 'clothing' },
          { id: 'wx_gloves', text: 'כפפות וצעיף', category: 'clothing' },
          { id: 'wx_socks', text: 'גרביים תרמיות', category: 'clothing' },
        )
      }
      if (weatherInfo.isRainy) {
        extras.push(
          { id: 'wx_umbrella', text: 'מטרייה קומפקטית', category: 'clothing' },
          { id: 'wx_raincoat', text: 'מעיל גשם / פונצ\'ו', category: 'clothing' },
          { id: 'wx_waterproof', text: 'נעליים עמידות למים', category: 'shoes' },
        )
      }
      if (weatherInfo.isHot) {
        extras.push(
          { id: 'wx_spf', text: 'קרם הגנה SPF50+ (2 יחידות)', category: 'hygiene' },
          { id: 'wx_hat', text: 'כובע שמש', category: 'clothing' },
          { id: 'wx_fan', text: 'מאוורר כף-יד נייד', category: 'other' },
        )
      }
      if (extras.length > 0) setCustomItems(prev => [...prev, ...extras])
    }
  }

  const selectWizardType = (type: TripType) => {
    setTripType(type)
    setShowWizard(false)
    localStorage.setItem(typeKey, type)
    localStorage.setItem(wizardKey, '1')
  }

  // Load checked items from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setCheckedItems(new Set(parsed.checked || []))
        setCustomItems(parsed.custom || [])
      } catch {
        // ignore
      }
    }
  }, [storageKey])

  // Save checked items to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({
      checked: Array.from(checkedItems),
      custom: customItems,
    }))
  }, [checkedItems, customItems, storageKey])

  // Save trip type — only after wizard is completed
  useEffect(() => {
    if (localStorage.getItem(wizardKey)) {
      localStorage.setItem(typeKey, tripType)
    }
  }, [tripType, typeKey, wizardKey])

  const hasKids = useMemo(() => {
    if (!currentTrip) return false
    return detectHasKids(currentTrip.travelers || [], currentTrip.name || '')
  }, [currentTrip])

  const categories = useMemo(() => {
    const base = PACKING_LISTS[tripType] || PACKING_LISTS.general
    if (hasKids) return [...base, KIDS_CATEGORY]
    return base
  }, [tripType, hasKids])

  // Build full item list: base + custom items
  const allItems = useMemo(() => {
    const items: PackingItem[] = []
    categories.forEach(cat => {
      cat.items.forEach(text => {
        const id = `${cat.id}__${text}`
        items.push({ id, text, checked: checkedItems.has(id), category: cat.id })
      })
    })
    customItems.forEach(ci => {
      items.push({ id: ci.id, text: ci.text, checked: checkedItems.has(ci.id), category: ci.category, custom: true })
    })
    return items
  }, [categories, checkedItems, customItems])

  const totalItems = allItems.length
  const totalChecked = allItems.filter(i => i.checked).length
  const progress = totalItems > 0 ? (totalChecked / totalItems) * 100 : 0

  const toggleItem = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const resetAll = () => {
    setCheckedItems(new Set())
  }

  const addCustomItem = () => {
    if (!newItemText.trim()) return
    const id = `custom_${Date.now()}`
    setCustomItems(prev => [...prev, { id, text: newItemText.trim(), category: newItemCategory }])
    setNewItemText('')
    setShowAddForm(false)
  }

  const removeCustomItem = (id: string) => {
    setCustomItems(prev => prev.filter(ci => ci.id !== id))
    setCheckedItems(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // ── Wizard overlay ──────────────────────────────────────────────────────────
  if (showWizard) {
    return (
      <div className="min-h-screen bg-gray-50"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        <div className="px-4 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            {wizardStep === 1 ? (
              <button onClick={() => setWizardStep(0)} className="active:scale-95 transition-transform p-1">
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
            ) : (
              <Link href="/dashboard" className="active:scale-95 transition-transform p-1">
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </Link>
            )}
            <h1 className="text-xl font-black" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>רשימת אריזה</h1>
            {/* Progress dots */}
            <div className="flex gap-1.5 mr-auto">
              {[0, 1].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${s <= wizardStep ? 'w-6' : 'w-3 bg-gray-200'}`}
                  style={s <= wizardStep ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined} />
              ))}
            </div>
          </div>

          {/* ── Step 0: Activities ── */}
          {wizardStep === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="text-center pt-1">
                <div className="text-4xl mb-2">🧳</div>
                <h2 className="text-xl font-bold text-gray-800">מה תעשו בנסיעה?</h2>
                <p className="text-sm text-gray-400 mt-1">ניתן לבחור מספר אפשרויות</p>
              </div>
              <div className="flex flex-wrap gap-2.5 justify-center">
                {ACTIVITY_OPTIONS.filter(act =>
                  getAvailableActivities(
                    currentTrip?.destination || '',
                    currentTrip?.name || ''
                  ).has(act.value)
                ).map(act => {
                  const sel = wActivities.includes(act.value)
                  return (
                    <button
                      key={act.value}
                      onClick={() => setWActivities(prev => sel ? prev.filter(a => a !== act.value) : [...prev, act.value])}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border-2 transition-all active:scale-95 ${sel ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200'}`}
                      style={sel ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : undefined}
                    >
                      <span className="text-base">{act.icon}</span> {act.label}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={goToWeatherStep}
                disabled={wActivities.length === 0}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-base disabled:opacity-40 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
              >
                המשך →
              </button>
            </motion.div>
          )}

          {/* ── Step 1: Weather confirmation ── */}
          {wizardStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="text-center pt-1">
                <div className="text-4xl mb-2">🌤️</div>
                <h2 className="text-xl font-bold text-gray-800">מזג אוויר בנסיעה</h2>
                {currentTrip?.destination && (
                  <p className="text-sm text-gray-400 mt-0.5">{currentTrip.destination}</p>
                )}
              </div>

              {!weatherInfo?.loaded ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">טוען מזג אוויר...</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="text-center">
                    <div className="text-4xl mb-1">{weatherInfo.emoji}</div>
                    <p className="font-bold text-lg text-gray-800">{weatherInfo.description}</p>
                    {!weatherInfo.failed && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {weatherInfo.avgMin}°C – {weatherInfo.avgMax}°C · גשם: {weatherInfo.rainProb}%
                      </p>
                    )}
                  </div>
                  {!weatherInfo.failed && (weatherInfo.isCold || weatherInfo.isRainy || weatherInfo.isHot) && (
                    <div className="bg-violet-50 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-bold text-violet-700 mb-1.5">מה נוסיף לרשימה:</p>
                      {weatherInfo.isCold && <p className="text-xs text-violet-600">❄️ בגדים חמים, שכבות, כפפות וצעיף</p>}
                      {weatherInfo.isRainy && <p className="text-xs text-violet-600">☔ מטרייה, מעיל גשם, נעליים עמידות</p>}
                      {weatherInfo.isHot && <p className="text-xs text-violet-600">☀️ קרם הגנה (x2), כובע שמש, מאוורר</p>}
                    </div>
                  )}
                  {!weatherInfo.failed && !weatherInfo.isCold && !weatherInfo.isRainy && !weatherInfo.isHot && (
                    <p className="text-center text-xs text-green-600 font-medium">✅ מזג אוויר נוח — הרשימה הבסיסית מספיקה</p>
                  )}
                </div>
              )}

              <button
                onClick={completeWizard}
                disabled={!weatherInfo?.loaded}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-base disabled:opacity-40 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
              >
                ✅ הצג רשימת אריזה
              </button>
              <p className="text-center text-xs text-gray-400">תמיד ניתן לשנות אחר כך</p>
            </motion.div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>רשימת אריזה</h1>
      </div>

      {/* Progress Card */}
      <div className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Luggage className="w-5 h-5" />
            <span className="text-sm font-medium">
              {currentTrip ? currentTrip.name : 'נסיעה'}
            </span>
          </div>
          <div className="text-left">
            <span className="text-2xl font-bold">{Math.round(progress)}%</span>
            <span className="text-xs text-white/70 mr-1">{totalChecked}/{totalItems}</span>
          </div>
        </div>
        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-white rounded-full"
          />
        </div>
        {progress === 100 && totalItems > 0 && (
          <p className="text-center text-sm mt-2 font-medium">🎉 הכל ארוז! תזכיר לנוח לפני הטיסה</p>
        )}
      </div>

      {/* Trip Type Selector */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <p className="text-xs font-bold text-gray-500 mb-2">סוג הנסיעה</p>
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTripType(opt.value)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                tripType === opt.value
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600'
              }`}
              style={tripType === opt.value ? { background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' } : {}}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reset & Add */}
      <div className="flex gap-2">
        <button
          onClick={resetAll}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white rounded-xl shadow-sm text-sm text-gray-500 active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          אפס הכל
        </button>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm text-white font-bold active:scale-95 transition-all flex-1 justify-center"
          style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
        >
          <Plus className="w-4 h-4" />
          הוסף פריט
        </button>
      </div>

      {/* Add Item Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <input
                type="text"
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                placeholder="שם הפריט..."
                className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <select
                  value={newItemCategory}
                  onChange={e => setNewItemCategory(e.target.value)}
                  className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
                <button
                  onClick={addCustomItem}
                  className="px-4 py-2 text-white rounded-2xl text-sm font-bold active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}
                >
                  הוסף
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories */}
      {categories.map(cat => {
        const catItems = allItems.filter(i => i.category === cat.id)
        const catChecked = catItems.filter(i => i.checked).length
        const isCollapsed = collapsedCategories.has(cat.id)
        const allDone = catItems.length > 0 && catChecked === catItems.length

        return (
          <div key={cat.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.icon}</span>
                <span className={`font-bold text-sm ${allDone ? 'text-green-600' : 'text-gray-800'}`}>
                  {cat.label}
                </span>
                {allDone && <span className="text-xs text-green-500 font-medium">✓ הושלם</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  allDone ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {catChecked}/{catItems.length}
                </span>
                {isCollapsed
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronUp className="w-4 h-4 text-gray-400" />
                }
              </div>
            </button>

            {/* Category Items */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {catItems.map(item => (
                      <motion.div
                        key={item.id}
                        layout
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          item.checked ? 'bg-green-50/40' : 'bg-white'
                        }`}
                      >
                        <button
                          onClick={() => toggleItem(item.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 active:scale-90 transition-all ${
                            item.checked
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {item.checked && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        <span className={`flex-1 text-sm ${
                          item.checked ? 'line-through text-gray-400' : 'text-gray-700'
                        }`}>
                          {item.text}
                        </span>
                        {item.custom && (
                          <button
                            onClick={() => removeCustomItem(item.id)}
                            className="text-gray-300 active:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  )
}
