'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  DollarSign,
  FileText,
  MapPin,
  Mail,
  Luggage,
  RefreshCw,
  Bot,
  Users,
  Menu,
  X,
  ArrowLeft,
  Star,
  Check,
  Plane,
  Globe,
  Shield,
  Car,
  ChevronDown,
} from 'lucide-react'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#6C47FF'
const PRIMARY_LIGHT = '#8B6FFF'
const PRIMARY_DARK = '#5030E0'

const features = [
  {
    icon: <DollarSign className="w-6 h-6" />,
    emoji: '💰',
    title: 'מעקב הוצאות',
    desc: 'רשום הוצאות ב-22 מטבעות עם המרה אוטומטית לשקל',
  },
  {
    icon: <FileText className="w-6 h-6" />,
    emoji: '📄',
    title: 'סריקת מסמכים',
    desc: 'חלץ פרטי הזמנה מ-PDF, תמונה או Gmail בלחיצה אחת',
  },
  {
    icon: <Plane className="w-6 h-6" />,
    emoji: '✈️',
    title: 'ציר זמן',
    desc: 'ראה את כל הטיסות, המלונות והפעילויות מסודרות לפי ימים',
  },
  {
    icon: <Mail className="w-6 h-6" />,
    emoji: '📧',
    title: 'אינטגרציית Gmail',
    desc: "חבר את הג'ימייל וקבל הזמנות ישירות לאפליקציה",
  },
  {
    icon: <Luggage className="w-6 h-6" />,
    emoji: '🧳',
    title: 'רשימת ציוד',
    desc: 'רשימות ציוד חכמות לפי סוג הטיול — חוף, עיר, טיול שטח',
  },
  {
    icon: <RefreshCw className="w-6 h-6" />,
    emoji: '💱',
    title: 'המרת מטבע',
    desc: 'שערים עדכניים לכל יעד עם מחשבון טיפ',
  },
  {
    icon: <Bot className="w-6 h-6" />,
    emoji: '🤖',
    title: 'עוזר AI',
    desc: 'שאל כל שאלה על הנסיעה וקבל תשובה מיידית',
  },
  {
    icon: <Users className="w-6 h-6" />,
    emoji: '👥',
    title: 'שיתוף הוצאות',
    desc: 'חלק הוצאות עם חברי הקבוצה ועקוב אחרי מי חייב למי',
  },
]

const steps = [
  {
    num: '01',
    title: 'צור חשבון',
    desc: 'הרשמה חינמית ב-30 שניות',
    icon: '🚀',
  },
  {
    num: '02',
    title: 'הוסף נסיעה',
    desc: 'הגדר יעד, תאריכים ותקציב',
    icon: '🗺️',
  },
  {
    num: '03',
    title: 'נסע בשלווה',
    desc: 'הכל מסודר — פשוט תיהנה',
    icon: '😎',
  },
]

const partners = [
  {
    name: 'Airalo',
    category: 'eSIM',
    icon: <Globe className="w-5 h-5" />,
    color: '#00C2FF',
    bg: '#EFF9FF',
    commission: '10%',
    desc: 'eSIM גלובלי לכל יעד',
  },
  {
    name: 'Holafly',
    category: 'eSIM',
    icon: <Globe className="w-5 h-5" />,
    color: '#FF6B35',
    bg: '#FFF3EE',
    commission: '8%',
    desc: 'גלישה ללא הגבלה בחו"ל',
  },
  {
    name: 'Nomad',
    category: 'eSIM',
    icon: <Globe className="w-5 h-5" />,
    color: '#4CAF50',
    bg: '#F0FAF0',
    commission: '9%',
    desc: 'חיבור אמין ב-190+ מדינות',
  },
  {
    name: 'World Nomads',
    category: 'ביטוח',
    icon: <Shield className="w-5 h-5" />,
    color: '#2196F3',
    bg: '#EFF5FF',
    commission: '12%',
    desc: 'ביטוח נסיעות מקיף לנוסעים',
  },
  {
    name: 'SafetyWing',
    category: 'ביטוח',
    icon: <Shield className="w-5 h-5" />,
    color: '#9C27B0',
    bg: '#F5EEFF',
    commission: '10%',
    desc: 'ביטוח חודשי לנוודים דיגיטליים',
  },
  {
    name: 'Rentalcars',
    category: 'השכרת רכב',
    icon: <Car className="w-5 h-5" />,
    color: '#FF9800',
    bg: '#FFF8EE',
    commission: '7%',
    desc: 'השוואת מחירי השכרת רכב',
  },
  {
    name: 'Discover Cars',
    category: 'השכרת רכב',
    icon: <Car className="w-5 h-5" />,
    color: '#F44336',
    bg: '#FFF0EE',
    commission: '8%',
    desc: 'השכרת רכב ב-145 מדינות',
  },
]

const stats = [
  { value: '2,000+', label: 'נוסעים' },
  { value: '22', label: 'מטבעות' },
  { value: '8+', label: 'שותפויות' },
  { value: '4.9★', label: 'דירוג' },
]

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedStat({ value, label }: { value: string; label: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-black text-white mb-2">{value}</div>
      <div className="text-purple-200 text-sm md:text-base font-medium">{label}</div>
    </motion.div>
  )
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative flex justify-center items-center">
      {/* Glow rings */}
      <div
        className="absolute rounded-full opacity-20 animate-pulse"
        style={{
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, #fff 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full opacity-10"
        style={{
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, #fff 0%, transparent 70%)',
          animationDelay: '0.5s',
        }}
      />

      {/* Phone frame */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        style={{
          width: 240,
          height: 480,
          borderRadius: 36,
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 24,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.5)',
          }}
        />

        {/* Screen content */}
        <div style={{ padding: '52px 16px 16px', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 700 }}>✈️ פריז 2025</div>
            <div
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 8,
                padding: '2px 8px',
                fontSize: 11,
                color: 'white',
              }}
            >
              7 ימים
            </div>
          </div>

          {/* Budget card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 16,
              padding: 12,
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginBottom: 4 }}>תקציב</div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>₪8,500</div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
              <div style={{ width: '62%', height: '100%', borderRadius: 2, background: 'white' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>₪5,270 הוצאו</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>62%</div>
            </div>
          </div>

          {/* Mini expenses list */}
          {[
            { label: '🏨 מלון Le Marais', amount: '₪1,200', color: '#FFD700' },
            { label: '✈️ Air France', amount: '₪2,400', color: '#00C2FF' },
            { label: '🍽️ מסעדה', amount: '₪340', color: '#FF6B6B' },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '8px 10px',
              }}
            >
              <div style={{ color: 'white', fontSize: 10 }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: 11, fontWeight: 700 }}>{item.amount}</div>
            </div>
          ))}

          {/* Bottom nav bar */}
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-around' }}>
            {['🏠', '💰', '📄', '🧳', '⚙️'].map((icon, i) => (
              <div
                key={i}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: i === 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                {icon}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        style={{
          position: 'absolute',
          right: -20,
          top: 80,
          background: 'white',
          borderRadius: 14,
          padding: '8px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          fontSize: 12,
          fontWeight: 700,
          color: '#1a1a2e',
          whiteSpace: 'nowrap',
        }}
      >
        💱 $1 = ₪3.72
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        style={{
          position: 'absolute',
          left: -24,
          bottom: 140,
          background: 'white',
          borderRadius: 14,
          padding: '8px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          fontSize: 12,
          fontWeight: 700,
          color: '#1a1a2e',
          whiteSpace: 'nowrap',
        }}
      >
        📧 הזמנה התקבלה!
      </motion.div>
    </div>
  )
}

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0]
  index: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group bg-white rounded-2xl p-5 border border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all cursor-default"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110"
        style={{ background: `linear-gradient(135deg, ${PRIMARY}15, ${PRIMARY_LIGHT}20)` }}
      >
        {feature.emoji}
      </div>
      <h3 className="font-bold text-gray-900 text-base mb-1">{feature.title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="font-sans overflow-x-hidden" style={{ direction: 'rtl' }}>
      {/* ── Navbar ── */}
      <header
        className="fixed top-0 right-0 left-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 select-none">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-lg"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
            >
              +
            </div>
            <span
              className="font-black text-xl"
              style={{ color: scrolled ? '#1a1a2e' : 'white' }}
            >
              Tripix
            </span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'תכונות', id: 'features' },
              { label: 'שותפויות', id: 'partners' },
              { label: 'מחיר', id: 'pricing' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-sm font-semibold transition-colors hover:opacity-70"
                style={{ color: scrolled ? '#4B5563' : 'rgba(255,255,255,0.9)' }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:bg-white/10"
              style={{ color: scrolled ? PRIMARY : 'white', border: `1.5px solid ${scrolled ? PRIMARY : 'rgba(255,255,255,0.5)'}` }}
            >
              התחבר
            </Link>
            <Link
              href="/auth/login"
              className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
              style={{ background: scrolled ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` : 'white', color: scrolled ? 'white' : PRIMARY }}
            >
              התחל בחינם
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-xl transition-all"
            style={{ color: scrolled ? '#1a1a2e' : 'white' }}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-white border-t border-gray-100"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
          >
            <div className="flex flex-col p-4 gap-3">
              {[
                { label: 'תכונות', id: 'features' },
                { label: 'שותפויות', id: 'partners' },
                { label: 'מחיר', id: 'pricing' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-right py-3 font-semibold text-gray-700 border-b border-gray-50"
                >
                  {item.label}
                </button>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-3 rounded-xl font-semibold border-2 text-purple-600"
                  style={{ borderColor: PRIMARY, color: PRIMARY }}
                >
                  התחבר
                </Link>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-3 rounded-xl font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
                >
                  התחל בחינם
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 50%, #A78BFA 100%)` }}
      >
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Animated blobs */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'white', filter: 'blur(80px)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, -8, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15"
          style={{ background: '#C4B5FD', filter: 'blur(100px)' }}
        />

        <motion.div style={{ y: heroY }} className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div>
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                מנהל הנסיעות הטוב ביותר לישראלים
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight text-white mb-6"
              >
                ניהל את הנסיעה
                <br />
                <span style={{ color: '#FFD700' }}>שלך בחכמה</span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-purple-100 leading-relaxed mb-8"
              >
                כל ההוצאות, המסמכים, הלו&quot;ז והכלים שאתה צריך —
                <br />
                במקום אחד
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-4 mb-10"
              >
                <Link
                  href="/auth/login"
                  className="flex items-center gap-2 px-7 py-4 rounded-2xl font-bold text-base transition-all hover:scale-[1.03] active:scale-95 shadow-lg"
                  style={{
                    background: 'white',
                    color: PRIMARY,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  }}
                >
                  התחל בחינם
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => scrollTo('features')}
                  className="flex items-center gap-2 px-7 py-4 rounded-2xl font-bold text-base text-white transition-all hover:bg-white/10"
                  style={{ border: '2px solid rgba(255,255,255,0.5)' }}
                >
                  צפה בתכונות
                  <ChevronDown className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Floating stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap gap-3"
              >
                {[
                  { val: '2,000+', label: 'נוסעים' },
                  { val: '22', label: 'מטבעות' },
                  { val: '200+', label: 'יעדים' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
                  >
                    <span className="font-black text-yellow-300">{s.val}</span>
                    {s.label}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Phone mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="flex justify-center md:justify-end"
            >
              <PhoneMockup />
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="text-center mb-14">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
              style={{ background: `${PRIMARY}15`, color: PRIMARY }}
            >
              תכונות
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl font-black text-gray-900 mb-4"
            >
              כל מה שצריך לנסיעה מושלמת
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-gray-500 text-lg max-w-2xl mx-auto"
            >
              כלים חכמים שנבנו במיוחד עבור הנוסע הישראלי
            </motion.p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="py-20 md:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
              style={{ background: `${PRIMARY}15`, color: PRIMARY }}
            >
              איך זה עובד?
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl font-black text-gray-900 mb-4"
            >
              שלושה צעדים פשוטים
            </motion.h2>
          </div>

          <div className="relative">
            {/* Connecting line (desktop) */}
            <div
              className="hidden md:block absolute top-14 right-[16.6%] left-[16.6%] h-0.5 opacity-20"
              style={{ background: `linear-gradient(to left, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
            />

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="text-center relative"
                >
                  {/* Step number circle */}
                  <div
                    className="w-28 h-28 rounded-3xl flex flex-col items-center justify-center mx-auto mb-6 text-4xl relative"
                    style={{
                      background: `linear-gradient(135deg, ${PRIMARY}15, ${PRIMARY_LIGHT}25)`,
                      border: `2px solid ${PRIMARY}30`,
                    }}
                  >
                    {step.icon}
                    <div
                      className="absolute -top-3 -right-3 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white"
                      style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-500">{step.desc}</p>

                  {/* Arrow between steps (desktop) */}
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-14 -left-4 text-gray-300 text-2xl">
                      ←
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA under steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-12"
          >
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base transition-all hover:scale-[1.03] active:scale-95 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})`, boxShadow: `0 8px 24px ${PRIMARY}40` }}
            >
              מתחילים עכשיו — בחינם
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Partners Section ── */}
      <section id="partners" className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
              style={{ background: `${PRIMARY}15`, color: PRIMARY }}
            >
              שותפויות
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl font-black text-gray-900 mb-4"
            >
              שותפויות בלעדיות
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-gray-500 text-lg max-w-2xl mx-auto"
            >
              מוצרים ושירותים שנבחרו בקפידה להשלמת הנסיעה שלך
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {partners.map((partner, i) => (
              <motion.div
                key={partner.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0 }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: partner.bg, color: partner.color }}
                  >
                    {partner.icon}
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: `${partner.color}15`, color: partner.color }}
                  >
                    {partner.category}
                  </span>
                </div>
                <h3 className="font-black text-gray-900 text-base mb-1">{partner.name}</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-3">{partner.desc}</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                  <Check className="w-3 h-3" style={{ color: partner.color }} />
                  עמלה {partner.commission} על כל הזמנה
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-10"
          >
            <Link
              href="/partners"
              className="inline-flex items-center gap-2 font-bold transition-all hover:gap-3"
              style={{ color: PRIMARY }}
            >
              לכל השותפויות
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section
        className="py-20 md:py-28"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)` }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              מספרים שמדברים בעד עצמם
            </h2>
            <p className="text-purple-200 text-lg">הקהילה שלנו גדלה מדי יום</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, i) => (
              <AnimatedStat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 max-w-2xl mx-auto text-center"
          >
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-white text-lg font-medium leading-relaxed mb-4">
              &quot;Tripix שינה לי את כל חוויית הנסיעה. כל ההוצאות מסודרות, המסמכים בטוח, והעוזר ה-AI עונה לי על כל שאלה. בלתי אפשרי לנסוע בלי זה עכשיו.&quot;
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                ד
              </div>
              <div className="text-right">
                <div className="text-white font-semibold text-sm">דניאל כ.</div>
                <div className="text-purple-200 text-xs">נסיעה לתאילנד, 2024</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing/CTA Section ── */}
      <section id="pricing" className="py-20 md:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-6"
            style={{ background: `${PRIMARY}15`, color: PRIMARY }}
          >
            מחיר
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-gray-900 mb-6"
          >
            מוכן לנסוע בחכמה?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-gray-500 text-lg md:text-xl max-w-xl mx-auto mb-12"
          >
            הצטרף לאלפי נוסעים שכבר מנהלים את הנסיעות שלהם עם Tripix
          </motion.p>

          {/* Pricing card */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-sm mx-auto rounded-3xl p-8 mb-10 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`,
              boxShadow: `0 24px 60px ${PRIMARY}40`,
            }}
          >
            {/* Shine overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{ background: 'linear-gradient(135deg, white 0%, transparent 60%)' }}
            />
            <div className="relative z-10">
              <div className="text-purple-200 text-sm font-semibold mb-2">חינמי לגמרי</div>
              <div className="text-white text-6xl font-black mb-1">₪0</div>
              <div className="text-purple-200 text-sm mb-8">לתמיד</div>
              <ul className="space-y-3 mb-8 text-right">
                {[
                  'ניהול נסיעות ללא הגבלה',
                  'מעקב הוצאות ב-22 מטבעות',
                  'סריקת מסמכים ו-Gmail',
                  'עוזר AI מובנה',
                  'שיתוף עם חברי קבוצה',
                  'רשימות ציוד חכמות',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="block w-full py-4 rounded-2xl font-bold text-center transition-all hover:scale-[1.02] active:scale-95"
                style={{ background: 'white', color: PRIMARY, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
              >
                התחל בחינם ←
              </Link>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-gray-400 text-sm"
          >
            ללא כרטיס אשראי · ללא התחייבות · ביטול בכל עת
          </motion.p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            {/* Logo & tagline */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xl"
                  style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
                >
                  +
                </div>
                <span className="font-black text-xl text-white">Tripix</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                מנהל הנסיעות החכם לנוסע הישראלי.
                <br />
                כל הכלים שצריך — במקום אחד.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-bold mb-4">קישורים</h4>
              <ul className="space-y-2">
                {[
                  { label: 'תכונות', id: 'features' },
                  { label: 'שותפויות', href: '/partners' },
                  { label: 'פרטיות', href: '/privacy' },
                  { label: 'יצירת קשר', href: 'mailto:hello@tripix.app' },
                ].map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link href={link.href} className="text-gray-400 text-sm hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <button
                        onClick={() => link.id && scrollTo(link.id)}
                        className="text-gray-400 text-sm hover:text-white transition-colors"
                      >
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* App links */}
            <div>
              <h4 className="text-white font-bold mb-4">האפליקציה</h4>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
              >
                התחל בחינם
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="mt-4 flex gap-3">
                {/* Social placeholders */}
                {['𝕏', 'in', 'f'].map((s) => (
                  <div
                    key={s}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 text-sm font-bold hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-gray-500 text-sm"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span>© 2025 Tripix. כל הזכויות שמורות.</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-gray-300 transition-colors">מדיניות פרטיות</Link>
              <Link href="/terms" className="hover:text-gray-300 transition-colors">תנאי שימוש</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
