'use client'

/**
 * /quiz — "לאן לטוס?" — Travel destination quiz
 * 6 short questions → 3 personalized destination recommendations
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, RotateCcw, Plane, MapPin, Clock, ThumbsUp } from 'lucide-react'
import Link from 'next/link'

// ── Quiz data ──────────────────────────────────────────────────────────────────

interface Answer {
  id: string
  label: string
  emoji: string
  tags: string[]
}

interface Question {
  id: string
  text: string
  sub?: string
  answers: Answer[]
}

const QUESTIONS: Question[] = [
  {
    id: 'budget',
    text: 'מה התקציב שלך?',
    sub: 'עלות כוללת לאדם כולל טיסה',
    answers: [
      { id: 'low',      label: 'חסכוני',        emoji: '💸', tags: ['budget-low'] },
      { id: 'mid',      label: 'בינוני',         emoji: '💳', tags: ['budget-mid'] },
      { id: 'high',     label: 'פרמיום',         emoji: '💎', tags: ['budget-high'] },
      { id: 'any',      label: 'לא משנה',        emoji: '🤷', tags: ['budget-low','budget-mid','budget-high'] },
    ],
  },
  {
    id: 'duration',
    text: 'כמה זמן?',
    sub: 'משך הטיול הרצוי',
    answers: [
      { id: 'short',    label: '3–5 ימים',       emoji: '🏃', tags: ['short'] },
      { id: 'week',     label: 'שבוע',            emoji: '📅', tags: ['week'] },
      { id: 'long',     label: '2 שבועות+',       emoji: '🌍', tags: ['long'] },
      { id: 'any',      label: 'גמיש',            emoji: '🎲', tags: ['short','week','long'] },
    ],
  },
  {
    id: 'climate',
    text: 'איזה אקלים אתה אוהב?',
    answers: [
      { id: 'tropical', label: 'חמים ולח',        emoji: '🌴', tags: ['tropical'] },
      { id: 'warm',     label: 'חמים ויבש',       emoji: '☀️', tags: ['warm'] },
      { id: 'mild',     label: 'נעים ומתון',      emoji: '🌤', tags: ['mild'] },
      { id: 'cold',     label: 'קריר / שלג',      emoji: '❄️', tags: ['cold'] },
    ],
  },
  {
    id: 'vibe',
    text: 'מה הסגנון שלך?',
    answers: [
      { id: 'beach',    label: 'חוף ים ורגיעה',   emoji: '🏖️', tags: ['beach'] },
      { id: 'city',     label: 'עיר ותרבות',       emoji: '🏙️', tags: ['city','culture'] },
      { id: 'adventure',label: 'הרפתקאות וטבע',   emoji: '🧗', tags: ['adventure','nature'] },
      { id: 'food',     label: 'אוכל ולילות',      emoji: '🍜', tags: ['food','nightlife'] },
    ],
  },
  {
    id: 'with',
    text: 'עם מי אתה טס?',
    answers: [
      { id: 'solo',     label: 'לבד',             emoji: '🎒', tags: ['solo'] },
      { id: 'couple',   label: 'עם בן/בת זוג',    emoji: '❤️', tags: ['couple'] },
      { id: 'friends',  label: 'חברים',            emoji: '👯', tags: ['friends'] },
      { id: 'family',   label: 'משפחה עם ילדים',  emoji: '👨‍👩‍👧', tags: ['family'] },
    ],
  },
  {
    id: 'priority',
    text: 'מה הכי חשוב לך?',
    answers: [
      { id: 'photo',    label: 'נופים לתמונות',   emoji: '📸', tags: ['scenic','nature'] },
      { id: 'food2',    label: 'חוויית אוכל',      emoji: '🍣', tags: ['food'] },
      { id: 'history',  label: 'היסטוריה ותרבות',  emoji: '🏛️', tags: ['culture','history'] },
      { id: 'party',    label: 'נייטליף ובילויים', emoji: '🎉', tags: ['nightlife','friends'] },
    ],
  },
]

// ── Destination database ────────────────────────────────────────────────────────

interface Destination {
  key: string
  nameHe: string
  nameEn: string
  city: string        // main city to fly to
  emoji: string
  tagline: string
  why: string         // short "למה ?" sentence
  tags: string[]      // matching tags
  score?: number      // calculated at runtime
}

const DESTINATIONS: Destination[] = [
  // Asia - budget-friendly
  {
    key: 'Thailand', nameHe: 'תאילנד', nameEn: 'Thailand', city: 'בנגקוק',
    emoji: '🇹🇭', tagline: 'אוכל מדהים, חופים, מקדשים',
    why: 'היעד הפופולרי ביותר של ישראלים — לא מקרי',
    tags: ['budget-low','budget-mid','tropical','beach','food','adventure','culture','solo','couple','friends','week','long','scenic'],
  },
  {
    key: 'Japan', nameHe: 'יפן', nameEn: 'Japan', city: 'טוקיו',
    emoji: '🇯🇵', tagline: 'עולם אחר לגמרי',
    why: 'תרבות ייחודית, אוכל מהשורה הראשונה, נקי ובטוח',
    tags: ['budget-mid','budget-high','mild','city','culture','food','history','solo','couple','friends','week','long','scenic'],
  },
  {
    key: 'Vietnam', nameHe: 'וייטנאם', nameEn: 'Vietnam', city: 'האנוי',
    emoji: '🇻🇳', tagline: 'ירוק, זול, מרהיב',
    why: 'ערך הכסף הטוב ביותר באסיה — נופים עוצרי נשימה',
    tags: ['budget-low','tropical','beach','food','adventure','nature','solo','couple','friends','long','scenic'],
  },
  {
    key: 'Indonesia', nameHe: 'בלי (אינדונזיה)', nameEn: 'Bali', city: 'באלי',
    emoji: '🇮🇩', tagline: 'רוחניות, גלים, עיצוב מדהים',
    why: 'האי הכי אינסטגרמי בעולם — אין ויכוח',
    tags: ['budget-low','budget-mid','tropical','beach','culture','adventure','nature','solo','couple','friends','week','long','scenic'],
  },
  {
    key: 'Cambodia', nameHe: 'קמבודיה', nameEn: 'Cambodia', city: 'סיאם ריפ',
    emoji: '🇰🇭', tagline: 'אנגקור ואט — חייב לראות',
    why: 'אחת מפלאות העולם, טיסות זולות מתאילנד',
    tags: ['budget-low','tropical','culture','history','adventure','solo','friends','week','long'],
  },
  {
    key: 'SriLanka', nameHe: 'סרי לנקה', nameEn: 'Sri Lanka', city: 'קולומבו',
    emoji: '🇱🇰', tagline: 'גן עדן לא מפורסם מספיק',
    why: 'חופים, ג\'ונגל, פיל, תה — הכל במדינה קטנה',
    tags: ['budget-low','budget-mid','tropical','beach','nature','adventure','culture','solo','couple','friends','week','long','scenic'],
  },
  {
    key: 'India', nameHe: 'הודו', nameEn: 'India', city: 'גואה',
    emoji: '🇮🇳', tagline: 'חוויה שתשנה אותך',
    why: 'צבע, טעם, תרבות — אין מקום כזה בעולם',
    tags: ['budget-low','tropical','warm','culture','history','food','adventure','solo','friends','long','scenic'],
  },
  // Europe
  {
    key: 'Italy', nameHe: 'איטליה', nameEn: 'Italy', city: 'רומא',
    emoji: '🇮🇹', tagline: 'אוכל, היסטוריה, רומנטיקה',
    why: 'פיצה, פסטה, קולוסיאום — איטליה מספרת את עצמה',
    tags: ['budget-mid','budget-high','mild','city','culture','history','food','couple','friends','family','short','week','scenic'],
  },
  {
    key: 'Spain', nameHe: 'ספרד', nameEn: 'Spain', city: 'ברצלונה',
    emoji: '🇪🇸', tagline: 'שמש, פלמנקו, טפאס',
    why: 'חיי לילה, חוף וארכיטקטורה — ברצלונה נותנת הכל',
    tags: ['budget-mid','warm','beach','city','culture','food','nightlife','solo','couple','friends','short','week','scenic'],
  },
  {
    key: 'Greece', nameHe: 'יוון', nameEn: 'Greece', city: 'אתונה / סנטוריני',
    emoji: '🇬🇷', tagline: 'כחול ולבן, פלאפל ושקיעות',
    why: 'סנטוריני — השקיעה הכי יפה בעולם. ללא דיון',
    tags: ['budget-mid','warm','beach','culture','history','food','couple','friends','family','short','week','scenic'],
  },
  {
    key: 'Portugal', nameHe: 'פורטוגל', nameEn: 'Portugal', city: 'ליסבון',
    emoji: '🇵🇹', tagline: 'גל הגלישה הגדול + פסטל נאטה',
    why: 'הסוד הכי שמור באירופה — עדיין מחירים סבירים',
    tags: ['budget-mid','mild','beach','city','culture','food','adventure','solo','couple','friends','short','week','scenic'],
  },
  {
    key: 'Croatia', nameHe: 'קרואטיה', nameEn: 'Croatia', city: 'דוברובניק',
    emoji: '🇭🇷', tagline: 'Game of Thrones + ים אדריאטי',
    why: 'מים כחולים, חומות עתיקות — דוברובניק היא אגדה',
    tags: ['budget-mid','mild','beach','culture','history','adventure','couple','friends','short','week','scenic'],
  },
  {
    key: 'Turkey', nameHe: 'טורקיה', nameEn: 'Turkey', city: 'איסטנבול',
    emoji: '🇹🇷', tagline: 'מזרח ומערב במחיר טוב',
    why: 'איסטנבול היא אחת הערים הכי עשירות תרבותית בעולם',
    tags: ['budget-low','budget-mid','warm','city','culture','history','food','beach','solo','couple','friends','family','short','week','scenic'],
  },
  {
    key: 'UAE', nameHe: 'דובאי', nameEn: 'Dubai', city: 'דובאי',
    emoji: '🇦🇪', tagline: 'עתיד, יוקרה, ענקי',
    why: 'ברג\'ה חליפה, מדבר, שופינג — ה-WOW מובטח',
    tags: ['budget-high','warm','city','adventure','nightlife','solo','couple','friends','family','short','week'],
  },
  {
    key: 'Morocco', nameHe: 'מרוקו', nameEn: 'Morocco', city: 'מרקש',
    emoji: '🇲🇦', tagline: 'מבוך שווקים ושמש מדברית',
    why: 'הג\'לבייה, הסוק, הריאד — מזרח שקרוב',
    tags: ['budget-low','budget-mid','warm','culture','history','food','adventure','nature','solo','couple','friends','week','scenic'],
  },
  {
    key: 'Maldives', nameHe: 'מלדיביים', nameEn: 'Maldives', city: 'מאלה',
    emoji: '🇲🇻', tagline: 'וילה על המים — פשוט שם',
    why: 'הבנגלו מעל האוקיאנוס — זה לא חופשה, זה חוויה',
    tags: ['budget-high','tropical','beach','couple','scenic','week'],
  },
  {
    key: 'Nepal', nameHe: 'נפאל', nameEn: 'Nepal', city: 'קטמנדו',
    emoji: '🇳🇵', tagline: 'אוורסט, טרקינג, נשמה',
    why: 'לו טרק בהימאלאיה — הנסיעה שמשנה ממ\u05b4ד',
    tags: ['budget-low','cold','adventure','nature','solo','friends','long','scenic'],
  },
  {
    key: 'CzechRepublic', nameHe: 'פראג', nameEn: 'Prague', city: 'פראג',
    emoji: '🇨🇿', tagline: 'אגדת אירופה הקלאסית',
    why: 'ביירה זולה, ארכיטקטורה קסומה — סיטי בריק מושלם',
    tags: ['budget-low','budget-mid','mild','cold','city','culture','history','nightlife','food','solo','couple','friends','short'],
  },
  {
    key: 'Hungary', nameHe: 'בודפשט', nameEn: 'Budapest', city: 'בודפשט',
    emoji: '🇭🇺', tagline: 'בתי מרחץ + ספא + בירה',
    why: 'מחצית מהמחיר של וינה, כפול הכיף',
    tags: ['budget-low','budget-mid','mild','city','culture','history','nightlife','food','solo','couple','friends','short'],
  },
  {
    key: 'UK', nameHe: 'לונדון', nameEn: 'London', city: 'לונדון',
    emoji: '🇬🇧', tagline: 'מוזיאונים חינמיים, תרבות עולמית',
    why: 'אפשר לשלושה ימים — מוזיאונים, בורוסוק, תיאטרון',
    tags: ['budget-mid','budget-high','mild','city','culture','history','food','nightlife','solo','couple','friends','family','short','week'],
  },
  {
    key: 'France', nameHe: 'פריז', nameEn: 'Paris', city: 'פריז',
    emoji: '🇫🇷', tagline: 'אהבה, אמנות, קרואסון',
    why: 'יש סיבה שכולם חולמים על פריז',
    tags: ['budget-high','mild','city','culture','history','food','couple','friends','short','scenic'],
  },
  {
    key: 'Jordan', nameHe: 'ירדן', nameEn: 'Jordan', city: 'עמאן / פטרה',
    emoji: '🇯🇴', tagline: 'פטרה + ים המלח + וואדי רם',
    why: 'שעתיים טיסה, עולם שלם — ועם ויזה ישראלית',
    tags: ['budget-low','budget-mid','warm','culture','history','adventure','nature','solo','couple','friends','short','week','scenic'],
  },
  {
    key: 'Philippines', nameHe: 'פיליפינים', nameEn: 'Philippines', city: 'פלאוואן',
    emoji: '🇵🇭', tagline: '7,000 איים לבחור',
    why: 'המים השקופים ביותר בעולם — אל נאידו ב-TOP 1',
    tags: ['budget-low','tropical','beach','adventure','nature','solo','couple','friends','long','scenic'],
  },
]

// ── Scoring engine ──────────────────────────────────────────────────────────────

function scoreDestinations(selectedTags: string[]): Destination[] {
  return DESTINATIONS
    .map(dest => {
      let score = 0
      for (const tag of selectedTags) {
        if (dest.tags.includes(tag)) score += 2
      }
      // Small random tiebreaker for variety
      score += Math.random() * 0.4
      return { ...dest, score }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
}

// ── Component ──────────────────────────────────────────────────────────────────

const GRADIENT = 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)'

export default function QuizPage() {
  const router = useRouter()
  const [step, setStep]               = useState(0)      // 0 = intro, 1-6 = questions, 7 = results
  const [answers, setAnswers]         = useState<Record<string, string[]>>({})
  const [results, setResults]         = useState<Destination[]>([])
  const [animDir, setAnimDir]         = useState(1)       // 1 = forward, -1 = backward
  const [chosen, setChosen]           = useState<Destination | null>(null)

  const totalSteps = QUESTIONS.length
  const progress   = step === 0 ? 0 : step <= totalSteps ? (step / totalSteps) * 100 : 100

  function selectAnswer(qId: string, tags: string[]) {
    const next = { ...answers, [qId]: tags }
    setAnswers(next)

    if (step < totalSteps) {
      setAnimDir(1)
      setTimeout(() => setStep(s => s + 1), 180)
    } else {
      // Calculate results
      const allTags = Object.values(next).flat()
      setResults(scoreDestinations(allTags))
      setAnimDir(1)
      setTimeout(() => setStep(totalSteps + 1), 180)
    }
  }

  function goBack() {
    if (step === 0) { router.back(); return }
    setAnimDir(-1)
    setStep(s => s - 1)
  }

  function restart() {
    setAnswers({})
    setResults([])
    setChosen(null)
    setAnimDir(-1)
    setStep(0)
  }

  const currentQ = step >= 1 && step <= totalSteps ? QUESTIONS[step - 1] : null

  return (
    <div className="min-h-screen flex flex-col bg-gray-50"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={goBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <h1 className="text-base font-bold text-gray-700">לאן לטוס? ✈️</h1>

        {step > 0 && step <= totalSteps && (
          <button onClick={restart}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm active:scale-95 transition-transform">
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
        )}
        {(step === 0 || step > totalSteps) && <div className="w-9" />}
      </div>

      {/* Progress bar */}
      {step > 0 && step <= totalSteps && (
        <div className="px-4 mb-1">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: GRADIENT }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            שאלה {step} מתוך {totalSteps}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden px-4 pb-8">
        <AnimatePresence mode="wait" custom={animDir}>
          {/* ── Intro ── */}
          {step === 0 && (
            <motion.div key="intro"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-6">

              <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-lg"
                style={{ background: GRADIENT }}>
                🌍
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-800 mb-2">
                  לא יודע לאן לטוס?
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                  6 שאלות קצרות — ואנחנו נמצא לך את היעד המושלם עבורך
                </p>
              </div>

              <div className="flex gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> דקה אחת</div>
                <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> 20+ יעדים</div>
                <div className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> מותאם אישית</div>
              </div>

              <button onClick={() => { setAnimDir(1); setStep(1) }}
                className="w-full max-w-xs py-4 rounded-2xl text-white font-bold text-lg shadow-lg active:scale-95 transition-transform"
                style={{ background: GRADIENT }}>
                בואו נמצא יעד! 🚀
              </button>
            </motion.div>
          )}

          {/* ── Questions ── */}
          {currentQ && (
            <motion.div key={`q-${step}`}
              custom={animDir}
              initial={{ opacity: 0, x: animDir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: animDir * -40 }}
              transition={{ duration: 0.28 }}
              className="pt-6 space-y-5">

              <div>
                <h2 className="text-xl font-black text-gray-800 leading-snug">{currentQ.text}</h2>
                {currentQ.sub && <p className="text-sm text-gray-400 mt-1">{currentQ.sub}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {currentQ.answers.map(ans => {
                  const selected = answers[currentQ.id]?.includes(ans.tags[0])
                  return (
                    <button key={ans.id}
                      onClick={() => selectAnswer(currentQ.id, ans.tags)}
                      className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white shadow-sm border-2 active:scale-95 transition-all"
                      style={selected
                        ? { borderColor: '#6C47FF', background: '#F5F2FF' }
                        : { borderColor: 'transparent' }}>
                      <span className="text-3xl">{ans.emoji}</span>
                      <span className="text-sm font-semibold text-gray-700 text-center leading-tight">
                        {ans.label}
                      </span>
                      {selected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: GRADIENT }}>
                          <span className="text-white text-[9px]">✓</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ── Results ── */}
          {step > totalSteps && (
            <motion.div key="results"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="pt-4 space-y-4">

              <div className="text-center mb-2">
                <h2 className="text-xl font-black text-gray-800">היעדים המושלמים עבורך! 🎯</h2>
                <p className="text-sm text-gray-400 mt-1">על בסיס התשובות שלך</p>
              </div>

              {results.map((dest, i) => (
                <motion.div key={dest.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12 }}>

                  <button
                    onClick={() => setChosen(chosen?.key === dest.key ? null : dest)}
                    className="w-full text-right"
                  >
                    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${chosen?.key === dest.key ? 'border-violet-500' : 'border-transparent'}`}>
                      {/* Top bar */}
                      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-gray-50">
                          {dest.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {i === 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                style={{ background: GRADIENT }}>
                                ⭐ הכי מתאים
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-gray-800 mt-0.5">{dest.nameHe}</h3>
                          <p className="text-xs text-gray-400">{dest.tagline}</p>
                        </div>
                      </div>

                      {/* Why section */}
                      <div className="px-4 pb-3">
                        <p className="text-sm text-gray-600 leading-relaxed">💡 {dest.why}</p>
                      </div>

                      {/* Tags */}
                      <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                        {dest.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full font-medium">
                            {{
                              'beach': 'חוף ים', 'city': 'עיר', 'culture': 'תרבות',
                              'food': 'אוכל', 'adventure': 'הרפתקה', 'nature': 'טבע',
                              'history': 'היסטוריה', 'nightlife': 'לילות', 'scenic': 'נופים',
                              'budget-low': 'חסכוני', 'budget-mid': 'בינוני', 'budget-high': 'פרמיום',
                              'tropical': 'טרופי', 'warm': 'חמים', 'mild': 'נעים', 'cold': 'קריר',
                              'solo': 'סולו', 'couple': 'זוגות', 'friends': 'חברים', 'family': 'משפחה',
                              'short': 'סיטי-בריק', 'week': 'שבוע', 'long': 'טיול ארוך',
                            }[tag] || tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>

                  {/* CTA — shown when card is selected */}
                  <AnimatePresence>
                    {chosen?.key === dest.key && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <Link
                          href={`/trips/new?dest=${encodeURIComponent(dest.city + ', ' + dest.nameHe)}`}
                          className="flex items-center justify-center gap-2 mt-2 py-3.5 rounded-2xl text-white font-bold shadow-md active:scale-95 transition-transform"
                          style={{ background: GRADIENT }}>
                          <Plane className="w-4 h-4" />
                          יאללה, בואו נתכנן את {dest.nameHe}!
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Start over */}
              <button onClick={restart}
                className="w-full py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform bg-white">
                <RotateCcw className="w-4 h-4" />
                נסה שוב עם תשובות שונות
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
