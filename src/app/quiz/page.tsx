'use client'

/**
 * /quiz — "לאן לטוס?" — Tripix Travel Recommendation Engine
 * 5 focused questions + seasonal scoring → top 4 personalized destinations
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, RotateCcw, Plane, Star } from 'lucide-react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Season detection
// ─────────────────────────────────────────────────────────────────────────────

type Season = 'winter' | 'spring' | 'summer' | 'autumn'

function getCurrentSeason(): Season {
  const m = new Date().getMonth() + 1 // 1-12
  if (m === 12 || m <= 2) return 'winter'
  if (m <= 5)             return 'spring'
  if (m <= 8)             return 'summer'
  return 'autumn'
}

const SEASON_LABEL: Record<Season, string> = {
  winter: 'חורף ❄️',
  spring: 'אביב 🌸',
  summer: 'קיץ ☀️',
  autumn: 'סתיו 🍂',
}

// ─────────────────────────────────────────────────────────────────────────────
// Quiz questions — 5 focused, no sub-text needed
// ─────────────────────────────────────────────────────────────────────────────

type AnswerTag =
  | 'backpacker' | 'comfort' | 'premium' | 'luxury'
  | 'short' | 'week' | 'long'
  | 'beach' | 'city' | 'adventure' | 'ski'
  | 'solo' | 'couple' | 'friends' | 'family'
  | 'near' | 'medium' | 'far'

interface Answer { id: string; label: string; emoji: string; tags: AnswerTag[] }
interface Question { id: string; text: string; answers: Answer[] }

const QUESTIONS: Question[] = [
  {
    id: 'budget',
    text: 'רמת החופשה?',
    answers: [
      { id: 'backpacker', label: 'Backpacker',  emoji: '🎒', tags: ['backpacker'] },
      { id: 'comfort',    label: 'Comfort',     emoji: '😊', tags: ['comfort'] },
      { id: 'premium',    label: 'Premium',     emoji: '✨', tags: ['premium'] },
      { id: 'luxury',     label: 'Luxury',      emoji: '👑', tags: ['luxury'] },
    ],
  },
  {
    id: 'duration',
    text: 'כמה ימים?',
    answers: [
      { id: 'short', label: 'סיטי בריק  4–5', emoji: '⚡', tags: ['short'] },
      { id: 'week',  label: 'שבוע',           emoji: '📅', tags: ['week'] },
      { id: 'long',  label: '10–14 יום',      emoji: '🌍', tags: ['long'] },
    ],
  },
  {
    id: 'vibe',
    text: 'מה הסגנון שלך?',
    answers: [
      { id: 'beach',     label: 'חוף ורגיעה',      emoji: '🏖️', tags: ['beach'] },
      { id: 'city',      label: 'עיר, תרבות, אוכל', emoji: '🏙️', tags: ['city'] },
      { id: 'adventure', label: 'הרפתקה וטבע',      emoji: '🧗', tags: ['adventure'] },
      { id: 'ski',       label: 'סקי ושלג',          emoji: '⛷️', tags: ['ski'] },
    ],
  },
  {
    id: 'with',
    text: 'עם מי?',
    answers: [
      { id: 'solo',    label: 'לבד',             emoji: '🎒', tags: ['solo'] },
      { id: 'couple',  label: 'זוג',             emoji: '❤️', tags: ['couple'] },
      { id: 'friends', label: 'חברים',           emoji: '👯', tags: ['friends'] },
      { id: 'family',  label: 'משפחה + ילדים',  emoji: '👨‍👩‍👧', tags: ['family'] },
    ],
  },
  {
    id: 'distance',
    text: 'כמה רחוק לטוס?',
    answers: [
      { id: 'near',   label: 'עד 5 שעות',   emoji: '🛫', tags: ['near'] },
      { id: 'medium', label: 'עד 10 שעות',  emoji: '🌏', tags: ['medium'] },
      { id: 'far',    label: 'לא משנה',     emoji: '🌍', tags: ['far'] },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Destination database
// ─────────────────────────────────────────────────────────────────────────────

type BudgetTier = 'backpacker' | 'comfort' | 'premium' | 'luxury'
type FlightZone = 'near' | 'medium' | 'far'  // near<5h, medium 5-10h, far>10h

interface Destination {
  key: string
  nameHe: string
  city: string          // city/region shown in results
  emoji: string
  tagline: string
  why: (season: Season) => string
  tags: AnswerTag[]
  budgetMin: BudgetTier // minimum budget tier
  flightZone: FlightZone
  seasonal: Record<Season, number>  // 0-3, how good is this destination this season
  skiDest?: boolean     // true = ski-specific destination
}

const DESTINATIONS: Destination[] = [

  // ── NEAR (up to 5h from Israel) ────────────────────────────────────────────

  {
    key: 'Greece', nameHe: 'יוון', city: 'סנטוריני / אתונה',
    emoji: '🇬🇷', tagline: 'כחול לבן, שקיעות, ים',
    why: s => s === 'summer' ? 'עונת השיא — ים מושלם, אנרגיה גבוהה' : s === 'spring' ? 'פחות צפוף, מחירים נמוכים, בלי חום קיצוני' : 'עונת ביניים, שקט יותר',
    tags: ['beach', 'city', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'comfort', flightZone: 'near',
    seasonal: { winter: 1, spring: 2, summer: 3, autumn: 2 },
  },
  {
    key: 'Turkey', nameHe: 'טורקיה', city: 'איסטנבול / קפדוקיה',
    emoji: '🇹🇷', tagline: 'מזרח ומערב, היסטוריה, אוכל',
    why: s => s === 'spring' || s === 'autumn' ? 'מזג האוויר הכי נעים לסיורים' : s === 'summer' ? 'חוף אגאי בשיא' : 'בלון הכדור בקפדוקיה — שלג = קסם',
    tags: ['city', 'beach', 'adventure', 'solo', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'near',
    seasonal: { winter: 2, spring: 3, summer: 3, autumn: 3 },
  },
  {
    key: 'Jordan', nameHe: 'ירדן', city: 'פטרה / ואדי רם',
    emoji: '🇯🇴', tagline: 'פטרה, מדבר, ים המלח',
    why: s => s === 'spring' || s === 'autumn' ? 'טמפ\' מושלמת לטיולים במדבר' : s === 'winter' ? 'ירוק, קריר, שקט — שעתיים טיסה' : 'חם מאוד, בואו מוקדם בבוקר',
    tags: ['adventure', 'city', 'solo', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'near',
    seasonal: { winter: 2, spring: 3, summer: 1, autumn: 3 },
  },
  {
    key: 'Egypt', nameHe: 'מצרים', city: 'שארם אל-שייח / הורגדה',
    emoji: '🇪🇬', tagline: 'אלמוגים, מדבר, עתיקות',
    why: s => s === 'winter' ? 'העונה הטובה ביותר — 25° ושמש' : s === 'autumn' ? 'ים מדהים, ריפים מלאי חיים' : s === 'spring' ? 'נעים עדיין לפני החום' : 'חם מאוד — תתכנן בהתאם',
    tags: ['beach', 'adventure', 'solo', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'near',
    seasonal: { winter: 3, spring: 2, summer: 1, autumn: 3 },
  },
  {
    key: 'UAE', nameHe: 'דובאי', city: 'דובאי',
    emoji: '🇦🇪', tagline: 'פאר, עתיד, ספארי מדברי',
    why: s => s === 'winter' ? 'הדובאי הכי טוב — 25°, כל מה שיש פתוח' : s === 'autumn' ? 'מתחמם — מחירים מוזלים' : s === 'spring' ? 'נעים עדיין לפני הקיץ' : 'חום קיצוני — מול, אינדור בלבד',
    tags: ['city', 'beach', 'solo', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'comfort', flightZone: 'near',
    seasonal: { winter: 3, spring: 2, summer: 1, autumn: 2 },
  },
  {
    key: 'Morocco', nameHe: 'מרוקו', city: 'מרקש / פס / דהאב',
    emoji: '🇲🇦', tagline: 'שווקים, ריאד, סהרה',
    why: s => s === 'spring' || s === 'autumn' ? 'מזג האוויר המושלם — לא חם ולא קר' : s === 'winter' ? 'טיול מדברי + הרי האטלס עם שלג' : 'חם מאוד — עדיף לרחצה בחוף',
    tags: ['adventure', 'city', 'solo', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'near',
    seasonal: { winter: 2, spring: 3, summer: 1, autumn: 3 },
  },

  // ── SKI (near/medium) ──────────────────────────────────────────────────────

  {
    key: 'Alps', nameHe: 'האלפים', city: 'שאמוני / ורבייה / זרמאט',
    emoji: '🏔️', tagline: 'סקי עולמי, קרחונים, כפרים',
    why: s => s === 'winter' ? 'ינואר-פברואר — שלג מושלם, 200+ מסלולים' : s === 'spring' ? 'סקי אביבי — שמש + שלג, עד מרץ' : 'אין שלג — עדיף יעד אחר',
    tags: ['ski', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'premium', flightZone: 'near',
    skiDest: true,
    seasonal: { winter: 3, spring: 2, summer: 0, autumn: 0 },
  },
  {
    key: 'Dolomites', nameHe: 'דולומיטים', city: 'קורטינה / ואל גארדנה',
    emoji: '⛰️', tagline: 'סקי איטלקי — אוכל + שלג',
    why: s => s === 'winter' ? 'הנוף הכי יפה לסקי בעולם — פיצה אחרי הסלאלום' : s === 'spring' ? 'סקי עד אפריל, אחר כך טיולי הרים' : 'לא עונת סקי',
    tags: ['ski', 'adventure', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'premium', flightZone: 'near',
    skiDest: true,
    seasonal: { winter: 3, spring: 2, summer: 1, autumn: 0 },
  },
  {
    key: 'Georgia', nameHe: 'גאורגיה (גודאורי)', city: 'גודאורי / תביליסי',
    emoji: '🇬🇪', tagline: 'סקי זול, חינג\'לי, אוירה',
    why: s => s === 'winter' ? 'הכי זול לסקי בעולם — ₪400/יום כולל סקי פס ואוכל' : s === 'spring' ? 'עיר תביליסי — אחת הכי מיוחדות שיש' : 'יפה בקיץ לטיולים',
    tags: ['ski', 'adventure', 'solo', 'friends', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'near',
    skiDest: true,
    seasonal: { winter: 3, spring: 1, summer: 1, autumn: 1 },
  },
  {
    key: 'Andorra', nameHe: 'אנדורה', city: 'גרנוולרה / אנדורה לה ויה',
    emoji: '🏳️', tagline: 'סקי + דיוטי פרי + פירנאים',
    why: s => s === 'winter' ? 'סקי + קניות פטורות ממס — קומבו מנצח' : 'לא עונת סקי — אין סיבה מיוחדת',
    tags: ['ski', 'friends', 'short'],
    budgetMin: 'comfort', flightZone: 'near',
    skiDest: true,
    seasonal: { winter: 3, spring: 1, summer: 0, autumn: 0 },
  },

  // ── MEDIUM (5-10h from Israel) ─────────────────────────────────────────────

  {
    key: 'Italy', nameHe: 'איטליה', city: 'רומא / פירנצה / אמלפי',
    emoji: '🇮🇹', tagline: 'אוכל, אמנות, la dolce vita',
    why: s => s === 'spring' ? 'הכי יפה — פרחים, אור זהב, בלי פקקים' : s === 'autumn' ? 'ענבים, טרופים, אורנג\' וחינם בעמק' : s === 'summer' ? 'חם, צפוף, יקר — אבל החוף מדהים' : 'כמעט ריק — מוזיאונים ללא תור',
    tags: ['city', 'beach', 'couple', 'friends', 'family', 'short', 'week', 'long'],
    budgetMin: 'comfort', flightZone: 'medium',
    seasonal: { winter: 1, spring: 3, summer: 2, autumn: 3 },
  },
  {
    key: 'Spain', nameHe: 'ספרד', city: 'ברצלונה / מדריד / איביזה',
    emoji: '🇪🇸', tagline: 'פלמנקו, טפאס, שמש, ים',
    why: s => s === 'summer' ? 'איביזה וברצלונה בשיא — אנרגיה מטורפת' : s === 'spring' || s === 'autumn' ? 'מושלם — לא קיץ, לא חורף, מחירים נוחים' : 'מדריד וברצלונה חיות גם בחורף',
    tags: ['beach', 'city', 'adventure', 'solo', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'medium',
    seasonal: { winter: 1, spring: 3, summer: 3, autumn: 3 },
  },
  {
    key: 'Portugal', nameHe: 'פורטוגל', city: 'ליסבון / פורטו / אלגארבה',
    emoji: '🇵🇹', tagline: 'פאדו, גלישה, אוכל, חינניות',
    why: s => s === 'spring' || s === 'summer' ? 'אלגארבה בשיא — חופים מדהימים' : s === 'autumn' ? 'ענבים, כמהין, ליסבון ריקה' : 'גשום אבל ליסבון חיה',
    tags: ['beach', 'city', 'adventure', 'solo', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'medium',
    seasonal: { winter: 1, spring: 3, summer: 3, autumn: 2 },
  },
  {
    key: 'France', nameHe: 'צרפת', city: 'פריז / ריביירה',
    emoji: '🇫🇷', tagline: 'אמנות, בישול, רומנטיקה',
    why: s => s === 'spring' ? 'פריז בפריחה — כמו בסרטים' : s === 'summer' ? 'קאן ונייס — ריביירה בשיא' : s === 'autumn' ? 'בציר יין, כמהין, ירידי אוכל' : 'פריז בחורף — קוסמופוליטי ורגוע',
    tags: ['city', 'beach', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'premium', flightZone: 'medium',
    seasonal: { winter: 1, spring: 3, summer: 3, autumn: 2 },
  },
  {
    key: 'Netherlands', nameHe: 'הולנד', city: 'אמסטרדם / כפר הצבעונים',
    emoji: '🇳🇱', tagline: 'צבעונים, תעלות, מוזיאונים',
    why: s => s === 'spring' ? 'אפריל = שדות הצבעונים בשיא — איקוניק' : s === 'summer' ? 'תיירות בשיא אבל יפה מאוד' : 'עירוני כל השנה, מוזיאון מהטובים',
    tags: ['city', 'solo', 'couple', 'friends', 'family', 'short', 'week'],
    budgetMin: 'comfort', flightZone: 'medium',
    seasonal: { winter: 1, spring: 3, summer: 2, autumn: 1 },
  },
  {
    key: 'Croatia', nameHe: 'קרואטיה', city: 'דוברובניק / ספליט / האיים',
    emoji: '🇭🇷', tagline: 'Game of Thrones, ים אדריאטי',
    why: s => s === 'summer' ? 'האיים בשיא — מי שמש ושמש' : s === 'spring' ? 'ריק, זול, ים שקוף כמו אריח' : s === 'autumn' ? 'עונת סיום — שקט ונהדר' : 'לא עונה — עדיף לבחור אחר',
    tags: ['beach', 'adventure', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'comfort', flightZone: 'medium',
    seasonal: { winter: 0, spring: 2, summer: 3, autumn: 2 },
  },
  {
    key: 'CzechRepublic', nameHe: 'פראג', city: 'פראג',
    emoji: '🇨🇿', tagline: 'ביירה, ארכיטקטורה, נייטליף',
    why: s => s === 'winter' ? 'שוקי הקריסמס — פנטזיה אירופאית' : s === 'spring' || s === 'summer' ? 'פסטיבלים, בגינות, ביירה בחוץ' : 'אדום-זהב ברחובות — עיר יפה',
    tags: ['city', 'solo', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'medium',
    seasonal: { winter: 2, spring: 3, summer: 3, autumn: 2 },
  },
  {
    key: 'Hungary', nameHe: 'בודפשט', city: 'בודפשט',
    emoji: '🇭🇺', tagline: 'ספא, ביירה, גשרים, פסטיבלים',
    why: s => s === 'summer' ? 'פסטיבל Sziget — מהגדולים בעולם' : s === 'winter' ? 'ספא עם קיטור בשלג — חוויה ייחודית' : 'נעים כל השנה, זול מאירופה',
    tags: ['city', 'solo', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'backpacker', flightZone: 'medium',
    seasonal: { winter: 2, spring: 2, summer: 3, autumn: 2 },
  },
  {
    key: 'Iceland', nameHe: 'איסלנד', city: 'רייקיאוויק / האות הצפוני',
    emoji: '🇮🇸', tagline: 'פיורדים, ברקים צפוניים, לבה',
    why: s => s === 'winter' ? 'זוהר הצפון — הסיכוי הטוב ביותר לראות אורות צפוניים' : s === 'summer' ? 'שמש חצות — 20 שעות אור, ירוק מדהים' : 'מעניין כל עונה — ולקנו פעיל',
    tags: ['adventure', 'solo', 'couple', 'friends', 'short', 'week'],
    budgetMin: 'premium', flightZone: 'medium',
    seasonal: { winter: 3, spring: 2, summer: 3, autumn: 2 },
  },
  {
    key: 'Norway', nameHe: 'נורבגיה', city: 'ברגן / פיורדים / לופוטן',
    emoji: '🇳🇴', tagline: 'פיורדים, אורות, וקינגים',
    why: s => s === 'summer' ? 'שמש חצות — פיורדים ירוקים, טיולים אינסופיים' : s === 'winter' ? 'אורות צפוניים + סקי + חשכה קסומה' : 'יפה מאוד אבל יקר — תתכנן מראש',
    tags: ['adventure', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'premium', flightZone: 'medium',
    seasonal: { winter: 2, spring: 2, summer: 3, autumn: 2 },
  },

  // ── FAR (10h+ from Israel) ─────────────────────────────────────────────────

  {
    key: 'Thailand', nameHe: 'תאילנד', city: 'בנגקוק / פוקט / קו סמוי',
    emoji: '🇹🇭', tagline: 'אוכל, חופים, מקדשים, חיים',
    why: s => s === 'winter' ? 'הדרום (פוקט) בשיא — ים שקוף, אין גשם' : s === 'spring' ? 'לפני העונה — זול וריק יחסית' : s === 'summer' ? 'עונת גשמים בדרום — הצפון (צ\'יאנג מאי) מדהים' : 'עונת המעבר — ים מתחיל להתפנות',
    tags: ['beach', 'adventure', 'city', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'backpacker', flightZone: 'far',
    seasonal: { winter: 3, spring: 2, summer: 2, autumn: 2 },
  },
  {
    key: 'Japan', nameHe: 'יפן', city: 'טוקיו / קיוטו / אוסקה',
    emoji: '🇯🇵', tagline: 'תרבות ייחודית, אוכל עולמי, נקי',
    why: s => s === 'spring' ? 'פריחת הדובדבן — אחת מחוויות החיים הבלתי נשכחות' : s === 'autumn' ? 'עלים אדומים וזהובים — יפן בסתיו = קסם' : s === 'winter' ? 'סקי בהוקאידו + אונסן + שלג' : 'חם ולח — עדיין מדהים',
    tags: ['city', 'adventure', 'ski', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'comfort', flightZone: 'far',
    seasonal: { winter: 2, spring: 3, summer: 1, autumn: 3 },
  },
  {
    key: 'Bali', nameHe: 'באלי', city: 'אובוד / סמיניאק / נוסה פניידה',
    emoji: '🇮🇩', tagline: 'ריהאן, גלים, ספא, רוחניות',
    why: s => s === 'summer' ? 'עונה יבשה — השמש שולטת, גלישה בשיא' : s === 'autumn' ? 'עדיין יבש — פחות תיירים, מחירים נמוכים' : s === 'winter' ? 'עונת הגשמים — אבל עדיין נהדר, הזול ביותר' : 'מעבר עונות — יפה עם קצת גשם',
    tags: ['beach', 'adventure', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'backpacker', flightZone: 'far',
    seasonal: { winter: 2, spring: 2, summer: 3, autumn: 3 },
  },
  {
    key: 'Vietnam', nameHe: 'וייטנאם', city: 'האנוי / הוי אן / הו צ\'י מין',
    emoji: '🇻🇳', tagline: 'נופים, אוכל, ספינות האלונג',
    why: s => s === 'winter' ? 'הצפון (האנוי, האלונג) — קריר ומושלם לטיולים' : s === 'spring' ? 'מרכז הוי אן בשיא — שמש ופרחים' : s === 'summer' ? 'הדרום (הו צ\'י מין, מקונג) — עונה יבשה' : 'ארץ ארוכה — תמיד יש מקום עם מזג אוויר מושלם',
    tags: ['adventure', 'city', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'backpacker', flightZone: 'far',
    seasonal: { winter: 3, spring: 3, summer: 2, autumn: 2 },
  },
  {
    key: 'Maldives', nameHe: 'מלדיביים', city: 'מאלה / אטולים',
    emoji: '🇲🇻', tagline: 'וילות על מים, אלמוגים, שלווה',
    why: s => s === 'winter' || s === 'spring' ? 'העונה היבשה — מים שקופים, שמש מובטחת' : s === 'summer' ? 'עונת גשמים — זול יותר, עדיין יפה' : 'מעבר — מחירים מוזלים',
    tags: ['beach', 'couple', 'solo', 'short', 'week'],
    budgetMin: 'luxury', flightZone: 'far',
    seasonal: { winter: 3, spring: 3, summer: 2, autumn: 2 },
  },
  {
    key: 'Seychelles', nameHe: 'סיישל', city: 'מאהה / לה דיג',
    emoji: '🏝️', tagline: 'גרניט, טורקיז, שמורות טבע',
    why: s => s === 'spring' || s === 'autumn' ? 'הגרנד אנסה בשיא — הים הכי יפה שתראה' : 'יפה כל השנה — גשם מגיע בהתראה קצרה',
    tags: ['beach', 'couple', 'solo', 'week', 'long'],
    budgetMin: 'luxury', flightZone: 'far',
    seasonal: { winter: 2, spring: 3, summer: 2, autumn: 3 },
  },
  {
    key: 'SriLanka', nameHe: 'סרי לנקה', city: 'קולומבו / גאלה / אנוראדהפורה',
    emoji: '🇱🇰', tagline: 'פילים, תה, ריפים, מקדשים',
    why: s => s === 'winter' || s === 'spring' ? 'הצד המערבי — ים שקוף ופילים חופשיים' : 'הצד המזרחי — גאלה ועיר ישנה',
    tags: ['adventure', 'city', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'backpacker', flightZone: 'far',
    seasonal: { winter: 3, spring: 3, summer: 1, autumn: 2 },
  },
  {
    key: 'Nepal', nameHe: 'נפאל', city: 'קטמנדו / פוקהרה / אוורסט',
    emoji: '🇳🇵', tagline: 'הימאלאיה, טרקינג, נשמה',
    why: s => s === 'spring' ? 'אוקטובר ואפריל — תקופת הטרקינג — נוף מדהים ושמיים נקיים' : s === 'autumn' ? 'הכי טוב לטרקינג — שמיים כחולים, שלג טרי' : 'גשם (קיץ) או קור עז (חורף)',
    tags: ['adventure', 'solo', 'friends', 'week', 'long'],
    budgetMin: 'backpacker', flightZone: 'far',
    seasonal: { winter: 1, spring: 3, summer: 1, autumn: 3 },
  },
  {
    key: 'Hokkaido', nameHe: 'הוקאידו (יפן)', city: 'ניסקו / סאפורו',
    emoji: '🎿', tagline: 'הסקי הטוב בעולם — אבקת שלג יפנית',
    why: s => s === 'winter' ? 'פברואר = פסטיבל השלג בסאפורו + הסקי הכי טוב באסיה' : 'לא עונת סקי — יפן כן, הוקאידו לא',
    tags: ['ski', 'adventure', 'couple', 'friends', 'week'],
    budgetMin: 'premium', flightZone: 'far',
    skiDest: true,
    seasonal: { winter: 3, spring: 0, summer: 0, autumn: 0 },
  },
  {
    key: 'Peru', nameHe: 'פרו', city: 'מאצ\'ו פיצ\'ו / קוסקו / ליים',
    emoji: '🇵🇪', tagline: 'אינקה, ג\'ונגל, מטבח עולמי',
    why: s => s === 'summer' || s === 'autumn' ? 'העונה היבשה — מאצ\'ו פיצ\'ו ללא עננים' : 'גשם — מאצ\'ו פיצ\'ו בענן אבל מיסטי',
    tags: ['adventure', 'solo', 'couple', 'friends', 'week', 'long'],
    budgetMin: 'comfort', flightZone: 'far',
    seasonal: { winter: 2, spring: 2, summer: 3, autumn: 3 },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Scoring engine
// ─────────────────────────────────────────────────────────────────────────────

const BUDGET_ORDER: BudgetTier[] = ['backpacker', 'comfort', 'premium', 'luxury']

function scoreDestinations(
  answers: Record<string, AnswerTag[]>,
  season: Season,
): Destination[] {
  const allTags = Object.values(answers).flat()

  const userBudget = (allTags.find(t =>
    ['backpacker','comfort','premium','luxury'].includes(t)
  ) ?? 'comfort') as BudgetTier

  const userDistance = (allTags.find(t =>
    ['near','medium','far'].includes(t)
  ) ?? 'far') as FlightZone

  const wantsski = allTags.includes('ski')

  return DESTINATIONS
    .map(dest => {
      let score = 0

      // 1. Seasonal score (0-9 pts) — the main driver
      score += dest.seasonal[season] * 3

      // 2. Style / vibe match (0-4 pts each)
      for (const tag of ['beach','city','adventure','ski'] as AnswerTag[]) {
        if (allTags.includes(tag) && dest.tags.includes(tag)) score += 4
      }

      // 3. With-whom match (0-2 pts)
      for (const tag of ['solo','couple','friends','family'] as AnswerTag[]) {
        if (allTags.includes(tag) && dest.tags.includes(tag)) score += 2
      }

      // 4. Duration match (0-2 pts)
      for (const tag of ['short','week','long'] as AnswerTag[]) {
        if (allTags.includes(tag) && dest.tags.includes(tag)) score += 2
      }

      // 5. Budget — penalise destinations the user can't afford
      const budgetIdx     = BUDGET_ORDER.indexOf(userBudget)
      const destBudgetIdx = BUDGET_ORDER.indexOf(dest.budgetMin)
      if (destBudgetIdx > budgetIdx) score -= 15       // way out of budget
      if (destBudgetIdx < budgetIdx - 1) score -= 2    // slight downgrade

      // 6. Distance filter
      if (userDistance === 'near' && dest.flightZone !== 'near') score -= 10
      if (userDistance === 'medium' && dest.flightZone === 'far') score -= 5

      // 7. Ski bonus / penalty
      if (wantsski && dest.skiDest) {
        // Strong boost in season, penalty out of season
        score += season === 'winter' ? 8 : season === 'spring' ? 3 : -10
      }
      if (!wantsski && dest.skiDest) score -= 12  // user doesn't want ski

      // 8. Small randomness for tie-breaking
      score += Math.random() * 0.5

      return { ...dest, _score: score }
    })
    .sort((a, b) => (b as Destination & { _score: number })._score - (a as Destination & { _score: number })._score)
    .slice(0, 4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const GRADIENT = 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)'

const BUDGET_RANGE: Record<BudgetTier, string> = {
  backpacker: 'עד $1,500',
  comfort:    '$1,500–$3,000',
  premium:    '$3,000–$6,000',
  luxury:     '$6,000+',
}

const TAG_LABEL: Partial<Record<AnswerTag, string>> = {
  beach: 'חוף ים', city: 'עיר', adventure: 'הרפתקה', ski: 'סקי',
  solo: 'סולו', couple: 'זוגות', friends: 'חברים', family: 'משפחה',
  backpacker: 'Backpacker', comfort: 'Comfort', premium: 'Premium', luxury: 'Luxury',
  short: 'סיטי בריק', week: 'שבוע', long: 'טיול ארוך',
  near: 'טיסה קצרה', medium: 'טיסה בינונית', far: 'כל מרחק',
}

export default function QuizPage() {
  const router    = useRouter()
  const season    = getCurrentSeason()

  const [step, setStep]         = useState(0)
  const [answers, setAnswers]   = useState<Record<string, AnswerTag[]>>({})
  const [results, setResults]   = useState<Destination[]>([])
  const [animDir, setAnimDir]   = useState(1)
  const [chosen, setChosen]     = useState<string | null>(null)

  const totalSteps = QUESTIONS.length
  const progress   = step === 0 ? 0 : Math.min((step / totalSteps) * 100, 100)

  function selectAnswer(qId: string, tags: AnswerTag[]) {
    const next = { ...answers, [qId]: tags }
    setAnswers(next)
    setAnimDir(1)
    if (step < totalSteps) {
      setTimeout(() => setStep(s => s + 1), 160)
    } else {
      setResults(scoreDestinations(next, season))
      setTimeout(() => setStep(totalSteps + 1), 160)
    }
  }

  function goBack() {
    if (step === 0) { router.back(); return }
    setAnimDir(-1)
    setStep(s => s - 1)
  }

  function restart() {
    setAnswers({}); setResults([]); setChosen(null)
    setAnimDir(-1); setStep(0)
  }

  const currentQ = step >= 1 && step <= totalSteps ? QUESTIONS[step - 1] : null
  const userBudget = (Object.values(answers).flat().find(t =>
    ['backpacker','comfort','premium','luxury'].includes(t)
  ) ?? 'comfort') as BudgetTier

  return (
    <div className="min-h-screen flex flex-col bg-gray-50"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={goBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-700">לאן לטוס? ✈️</p>
          <p className="text-[10px] text-gray-400">{SEASON_LABEL[season]}</p>
        </div>
        {step > 0 ? (
          <button onClick={restart}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm active:scale-95 transition-transform">
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
        ) : <div className="w-9" />}
      </div>

      {/* Progress */}
      {step > 0 && step <= totalSteps && (
        <div className="px-4 mb-1">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full"
              style={{ background: GRADIENT }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeInOut' }} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden px-4 pb-10">
        <AnimatePresence mode="wait" custom={animDir}>

          {/* ── Intro ── */}
          {step === 0 && (
            <motion.div key="intro"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[72vh] text-center gap-5">

              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg"
                style={{ background: GRADIENT }}>🌍</div>

              <div>
                <h2 className="text-2xl font-black text-gray-800 mb-2">לא יודע לאן לטוס?</h2>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                  5 שאלות מהירות — המנוע שלנו יתאים לך את היעד המושלם
                  <br />
                  <span className="font-medium" style={{ color: '#6C47FF' }}>
                    מסונכרן ל{SEASON_LABEL[season]} הנוכחי
                  </span>
                </p>
              </div>

              {/* Season indicator */}
              <div className="flex gap-2">
                {(['winter','spring','summer','autumn'] as Season[]).map(s => (
                  <div key={s} className={`w-2 h-2 rounded-full transition-all ${s === season ? 'scale-125' : 'bg-gray-200'}`}
                    style={s === season ? { background: GRADIENT, width: 24, borderRadius: 4 } : {}} />
                ))}
              </div>

              <button onClick={() => { setAnimDir(1); setStep(1) }}
                className="w-full max-w-xs py-4 rounded-2xl text-white font-bold text-base shadow-lg active:scale-95 transition-transform"
                style={{ background: GRADIENT }}>
                בואו נמצא יעד! 🚀
              </button>
            </motion.div>
          )}

          {/* ── Questions ── */}
          {currentQ && (
            <motion.div key={`q-${step}`}
              custom={animDir}
              initial={{ opacity: 0, x: animDir * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: animDir * -30 }}
              transition={{ duration: 0.25 }}
              className="pt-5 space-y-4">

              <h2 className="text-xl font-black text-gray-800">{currentQ.text}</h2>

              <div className={`grid gap-3 ${currentQ.answers.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {currentQ.answers.map(ans => {
                  const isSkiOff = ans.id === 'ski' && season !== 'winter' && season !== 'spring'
                  return (
                    <button key={ans.id}
                      onClick={() => selectAnswer(currentQ.id, ans.tags)}
                      className="relative flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-2xl bg-white shadow-sm border-2 active:scale-95 transition-all"
                      style={{ borderColor: 'transparent' }}>
                      <span className="text-3xl">{ans.emoji}</span>
                      <span className="text-sm font-semibold text-gray-700 text-center leading-tight">{ans.label}</span>
                      {/* Budget range hint */}
                      {currentQ.id === 'budget' && (
                        <span className="text-[9px] text-gray-400">
                          {BUDGET_RANGE[ans.id as BudgetTier]}
                        </span>
                      )}
                      {/* Off-season ski warning */}
                      {isSkiOff && (
                        <span className="text-[9px] text-amber-500 font-medium">לא עונה עכשיו</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="text-center text-xs text-gray-400">{step} / {totalSteps}</p>
            </motion.div>
          )}

          {/* ── Results ── */}
          {step > totalSteps && (
            <motion.div key="results"
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="pt-4 space-y-3">

              <div className="text-center mb-3">
                <h2 className="text-xl font-black text-gray-800">היעדים המושלמים עבורך 🎯</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  מותאם ל{SEASON_LABEL[season]} · {BUDGET_RANGE[userBudget]}
                </p>
              </div>

              {results.map((dest, i) => (
                <motion.div key={dest.key}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}>

                  <button onClick={() => setChosen(chosen === dest.key ? null : dest.key)}
                    className="w-full text-right">
                    <div className={`bg-white rounded-2xl overflow-hidden border-2 transition-all shadow-sm ${chosen === dest.key ? 'border-violet-500' : 'border-transparent'}`}>

                      <div className="p-4 flex items-start gap-3">
                        <div className="text-3xl flex-shrink-0 leading-none pt-0.5">{dest.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {i === 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                style={{ background: GRADIENT }}>
                                ⭐ הכי מתאים לך
                              </span>
                            )}
                            {/* Seasonal badge */}
                            {dest.seasonal[season] === 3 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                                עונה מושלמת ✓
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-gray-800">{dest.nameHe}</h3>
                          <p className="text-xs text-gray-400">{dest.city}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {[...Array(dest.seasonal[season])].map((_, si) => (
                            <Star key={si} className="w-3 h-3 inline-block" fill="#6C47FF" stroke="none" />
                          ))}
                        </div>
                      </div>

                      {/* Why this season */}
                      <div className="px-4 pb-3">
                        <p className="text-sm text-gray-600 leading-relaxed">
                          💡 {dest.why(season)}
                        </p>
                      </div>

                      {/* Tags */}
                      <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                        {dest.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full font-medium">
                            {TAG_LABEL[tag] || tag}
                          </span>
                        ))}
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                          {{ near: '✈️ עד 5ש\'', medium: '✈️ 5-10ש\'', far: '✈️ 10ש\'+' }[dest.flightZone]}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* CTA on select */}
                  <AnimatePresence>
                    {chosen === dest.key && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <Link
                          href={`/trips/new?dest=${encodeURIComponent(dest.city.split('/')[0].trim() + ', ' + dest.nameHe)}`}
                          className="flex items-center justify-center gap-2 mt-2 py-3.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-transform"
                          style={{ background: GRADIENT }}>
                          <Plane className="w-4 h-4" />
                          יאללה, מתכננים {dest.nameHe}!
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              <button onClick={restart}
                className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 bg-white">
                <RotateCcw className="w-4 h-4" /> נסה עם תשובות שונות
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
