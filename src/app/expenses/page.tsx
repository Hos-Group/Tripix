'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Trash2, X, ChevronDown, Wallet, Split, Pencil, FileText, Mail } from 'lucide-react'
import DocumentViewer from '@/components/DocumentViewer'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { formatMoney, getTripDays, formatDateShort } from '@/lib/utils'
import { Expense, Category, Currency, CATEGORY_META, CURRENCIES, CURRENCY_SYMBOL } from '@/types'
import { format } from 'date-fns'
import { convertToILS } from '@/lib/rates'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import SplitExpense from '@/components/trip/SplitExpense'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { itemVariants, sheetVariants, spring, staggerContainer } from '@/lib/motion'
import HotelStaysStrip from '@/components/hotel/HotelStaysStrip'
import QuickChargeSheet from '@/components/hotel/QuickChargeSheet'
import StayReport from '@/components/hotel/StayReport'
import { buildHotelStays, type HotelStay, type HotelDocumentRow, type ExpenseRow as HotelExpenseRow } from '@/components/hotel/hotelTab'
import { tFormat } from '@/lib/i18n'

const CATEGORIES: Category[] = [
  'food', 'hotel', 'flight', 'taxi', 'activity', 'shopping',
  'car_rental', 'train', 'ferry', 'museum', 'sport', 'nightlife',
  'spa', 'pharmacy', 'sim', 'insurance', 'visa', 'tips',
  'travel_gear', 'laundry', 'parking', 'other',
]

export default function ExpensesPage() {
  const { currentTrip } = useTrip()
  const { user } = useAuth()
  const { t, dir, lang } = useLanguage()
  const reduce = useReducedMotion()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [splitExpense, setSplitExpense] = useState<Expense | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ title: string; date: string } | null>(null)
  const [duplicateResolver, setDuplicateResolver] = useState<((ok: boolean) => void) | null>(null)
  const [hotelDocs, setHotelDocs]     = useState<HotelDocumentRow[]>([])
  const [chargingStay, setChargingStay] = useState<HotelStay | null>(null)
  const [reportStay, setReportStay]   = useState<HotelStay | null>(null)

  // ── Doc viewer (opens the document or email linked to an expense) ──────
  const [docViewerUrl,       setDocViewerUrl]       = useState<string | null>(null)
  const [docViewerTitle,     setDocViewerTitle]     = useState<string>('')
  const [docViewerSubtitle,  setDocViewerSubtitle]  = useState<string>('')
  const [docViewerType,      setDocViewerType]      = useState<string | undefined>(undefined)
  const [docViewerHtml,      setDocViewerHtml]      = useState<string | null>(null)
  const [docViewerLoading,   setDocViewerLoading]   = useState(false)
  const closeDocViewer = useCallback(() => {
    setDocViewerUrl(null); setDocViewerHtml(null); setDocViewerTitle('')
    setDocViewerSubtitle(''); setDocViewerType(undefined); setDocViewerLoading(false)
  }, [])

  // Open whatever the expense is attached to:
  //   1. document_id → fetch the linked document; prefer file_url, else email HTML
  //   2. receipt_url → open directly (manual receipt upload, no document row)
  const openExpenseDoc = useCallback(async (exp: Expense) => {
    const receiptUrl = (exp as unknown as { receipt_url?: string | null }).receipt_url || null
    const docId      = (exp as unknown as { document_id?: string | null }).document_id || null

    // 1. Linked document — look it up and route to file or email
    if (docId) {
      setDocViewerLoading(true)
      const { data: doc } = await supabase
        .from('documents')
        .select('id, name, file_url, file_type, doc_type, gmail_message_id')
        .eq('id', docId)
        .maybeSingle()
      if (doc?.file_url) {
        setDocViewerTitle(doc.name || exp.title)
        setDocViewerSubtitle(CATEGORY_META[exp.category]?.label || '')
        setDocViewerType(doc.doc_type || undefined)
        setDocViewerUrl(doc.file_url)
        setDocViewerLoading(false)
        return
      }
      if (doc?.gmail_message_id) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          if (!token) { toast.error('לא מחובר'); setDocViewerLoading(false); return }
          const res = await fetch('/api/gmail/fetch-message', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ gmail_message_id: doc.gmail_message_id }),
          })
          const json = await res.json()
          if (!res.ok) { toast.error(json.error || 'לא הצלחנו למשוך את המייל'); setDocViewerLoading(false); return }
          setDocViewerTitle(doc.name || exp.title)
          setDocViewerSubtitle(json.from || '')
          setDocViewerType(doc.doc_type || undefined)
          setDocViewerHtml(json.html || '<p style="padding:20px;color:#888">המייל ריק</p>')
        } catch {
          toast.error('שגיאת רשת')
        } finally {
          setDocViewerLoading(false)
        }
        return
      }
      setDocViewerLoading(false)
      toast('למסמך אין תצוגה זמינה')
      return
    }

    // 2. Raw receipt upload (scan → expense without document row)
    if (receiptUrl) {
      setDocViewerTitle(exp.title)
      setDocViewerSubtitle(CATEGORY_META[exp.category]?.label || '')
      setDocViewerType(undefined)
      setDocViewerUrl(receiptUrl)
      return
    }

    toast('אין מסמך מקושר להוצאה זו')
  }, [])

  // Lookup of expense → whether it has any viewable attachment.
  const expenseHasDoc = (e: Expense): boolean => {
    const r = (e as unknown as { receipt_url?: string | null }).receipt_url
    const d = (e as unknown as { document_id?: string | null }).document_id
    return Boolean(r || d)
  }

  // Form state
  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState<Category>('food')
  const [expenseDate, setExpenseDate] = useState('')
  const [amount, setAmount]         = useState('')
  const [currency, setCurrency]     = useState<Currency>('THB')
  const [notes, setNotes]           = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!currentTrip) { setExpenses([]); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (!error) setExpenses(data || [])
    } catch (err) {
      console.error('Supabase not configured:', err)
    }
    setLoading(false)
  }, [currentTrip])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // Load hotel documents for the current trip — drives the "Hotel Tab" strip.
  const fetchHotels = useCallback(async () => {
    if (!currentTrip) { setHotelDocs([]); return }
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, trip_id, name, doc_type, extracted_data, valid_from, valid_until')
        .eq('trip_id', currentTrip.id)
        .eq('doc_type', 'hotel')
      setHotelDocs((data as HotelDocumentRow[] | null) || [])
    } catch (err) {
      console.error('[expenses] fetchHotels failed:', err)
    }
  }, [currentTrip])
  useEffect(() => { fetchHotels() }, [fetchHotels])

  const hotelStays: HotelStay[] = buildHotelStays(
    hotelDocs,
    expenses as unknown as HotelExpenseRow[],
  )

  const tripDays = getTripDays()

  const resetForm = () => {
    setTitle(''); setAmount(''); setNotes(''); setCategory('food'); setCurrency('THB'); setExpenseDate('')
    setEditingId(null)
  }

  const startEdit = (exp: Expense) => {
    setEditingId(exp.id)
    setTitle(exp.title)
    setCategory(exp.category)
    setExpenseDate(exp.expense_date)
    setAmount(String(exp.amount))
    setCurrency(exp.currency)
    setNotes(exp.notes || '')
    setShowForm(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (!title.trim() || !amount || !expenseDate) {
      toast.error(t('exp_fill_required'))
      return
    }
    setSaving(true)
    if (!currentTrip) { toast.error(t('exp_select_trip')); setSaving(false); return }

    const amountIls = await convertToILS(parseFloat(amount), currency, expenseDate)

    if (editingId) {
      const { error } = await supabase.from('expenses').update({
        title: title.trim(),
        category,
        amount: parseFloat(amount),
        currency,
        amount_ils: amountIls,
        expense_date: expenseDate,
        notes: notes.trim() || null,
      }).eq('id', editingId)

      if (error) {
        toast.error(t('exp_error_save'))
      } else {
        toast.success(t('exp_saved'))
        resetForm(); setShowForm(false)
        fetchExpenses()
      }
    } else {
      // Route through the API so dedup (409) and content_hash computation are
      // centralized. Re-submit with force=true when the user confirms.
      const submitExpense = async (force = false) => {
        const res = await fetch('/api/expenses', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            trip_id:      currentTrip.id,
            user_id:      user?.id,
            title:        title.trim(),
            category,
            amount:       parseFloat(amount),
            currency,
            amount_ils:   amountIls,
            expense_date: expenseDate,
            notes:        notes.trim() || null,
            source:       'manual',
            force,
          }),
        })
        return res
      }

      let res = await submitExpense(false)
      if (res.status === 409) {
        const { duplicate } = await res.json() as { duplicate?: { title: string; expense_date: string } }
        setDuplicatePrompt({
          title: duplicate?.title || title.trim(),
          date: duplicate?.expense_date || expenseDate,
        })
        const keep = await new Promise<boolean>((resolve) => {
          setDuplicateResolver(() => resolve)
        })
        setDuplicatePrompt(null)
        setDuplicateResolver(null)
        if (keep) {
          res = await submitExpense(true)
        } else {
          setSaving(false)
          return
        }
      }

      if (!res.ok) {
        toast.error(t('exp_error_save'))
      } else {
        toast.success(t('exp_saved'))
        resetForm(); setShowForm(false)
        fetchExpenses()
      }
    }
    setSaving(false)
  }

  const requestDelete = (exp: Expense) => setDeletingExpense(exp)

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return
    setDeleting(true)
    const { id, document_id } = deletingExpense

    // Delete the expense first
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      toast.error(t('exp_error_delete'))
      return
    }

    // If the expense was auto-created from a document, delete that document too
    if (document_id) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (token) {
          await fetch('/api/documents/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: [document_id] }),
          })
        }
      } catch (e) {
        console.warn('[expenses] Document cascade-delete failed:', e)
      }
    }

    toast.success(t('exp_deleted'))
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeletingExpense(null)
  }

  const filtered = expenses.filter(e => {
    if (filterCat && e.category !== filterCat) return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = filtered.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.expense_date]) acc[e.expense_date] = []
    acc[e.expense_date].push(e)
    return acc
  }, {})

  const totalIls = expenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTotal = expenses.filter(e => e.expense_date === todayStr).reduce((s, e) => s + (e.amount_ils || 0), 0)

  if (loading) {
    return (
      <div className="page-enter space-y-4 pt-2" dir={dir}>
        <div className="flex items-center justify-between pt-1">
          <h1 className="text-2xl font-black tracking-tight gradient-text">{t('exp_title')}</h1>
          <span className="sr-only">{t('exp_loading')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[60px] rounded-2xl skeleton" />
          <div className="h-[60px] rounded-2xl skeleton" />
        </div>
        <div className="h-[48px] rounded-2xl skeleton" />
        <ListSkeleton rows={6} />
      </div>
    )
  }

  return (
    <div className="space-y-4" dir={dir}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-2xl font-black tracking-tight gradient-text">{t('exp_title')}</h1>
        <button
          type="button"
          onClick={() => { if (showForm) resetForm(); setShowForm(v => !v) }}
          aria-label={showForm ? t('exp_form_close') : t('exp_form_open')}
          aria-expanded={showForm}
          aria-controls="expense-form"
          className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 transition-all text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          style={{ background: showForm ? 'linear-gradient(135deg,#EF4444,#F87171)' : 'linear-gradient(135deg,#6C47FF,#9B7BFF)' }}>
          {showForm ? <X className="w-5 h-5" aria-hidden="true" /> : <Plus className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-card border border-gray-50/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">{t('exp_total_label')}</p>
            <p className="text-base font-black text-gray-900 leading-tight">{formatMoney(totalIls)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl px-4 py-3 shadow-card border border-gray-50/80 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <span className="text-base">📅</span>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium">{t('exp_today_label')}</p>
            <p className="text-base font-black text-gray-900 leading-tight">{formatMoney(todayTotal)}</p>
          </div>
        </div>
      </div>

      {/* ── Add Expense Form (slide-down sheet) ── */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            id="expense-form"
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.ui }}
            exit={{ opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
            aria-labelledby="expense-form-heading"
            className="bg-white rounded-3xl p-5 shadow-elev-3 border border-gray-50 space-y-3"
          >
            <h2 id="expense-form-heading" className="text-sm font-bold text-gray-800 mb-1">
              {editingId ? t('exp_form_title_edit') : t('exp_form_title_new')}
            </h2>

            {/* Title */}
            <div className="flex flex-col gap-1">
              <label htmlFor="exp-title" className="text-xs font-semibold text-gray-700">
                {t('exp_name')} <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="exp-title"
                type="text"
                placeholder={t('exp_name')}
                value={title}
                required
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white transition-all min-h-[48px]"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label htmlFor="exp-category" className="text-xs font-semibold text-gray-700">{t('exp_category')}</label>
              <div className="relative">
                <select
                  id="exp-category"
                  value={category}
                  onChange={e => setCategory(e.target.value as Category)}
                  className="w-full bg-surface-secondary rounded-2xl px-4 py-3 pl-10 text-sm font-medium outline-none appearance-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white min-h-[48px]"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label htmlFor="exp-date" className="text-xs font-semibold text-gray-700">
                {t('exp_date')} <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="exp-date"
                  value={expenseDate}
                  required
                  onChange={e => setExpenseDate(e.target.value)}
                  className="w-full bg-surface-secondary rounded-2xl px-4 py-3 pl-10 text-sm font-medium outline-none appearance-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white min-h-[48px]"
                >
                  <option value="">{t('exp_pick_date')}</option>
                  {tripDays.map(day => {
                    const val = format(day, 'yyyy-MM-dd')
                    return <option key={val} value={val}>{formatDateShort(day)} — {t('dash_day')} {tripDays.indexOf(day) + 1}</option>
                  })}
                </select>
                <ChevronDown aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="exp-amount" className="text-xs font-semibold text-gray-700">
                  {t('exp_amount')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder={t('exp_amount')}
                  value={amount}
                  required
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white transition-all min-h-[48px]"
                />
              </div>
              <div className="flex flex-col gap-1 w-28">
                <label htmlFor="exp-currency" className="text-xs font-semibold text-gray-700">{t('exp_currency')}</label>
                <div className="relative">
                  <select
                    id="exp-currency"
                    value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                    className="w-full bg-surface-secondary rounded-2xl px-3 py-3 pl-8 text-sm font-medium outline-none appearance-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white min-h-[48px]"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label htmlFor="exp-notes" className="text-xs font-semibold text-gray-700">
                {t('exp_notes')} <span className="text-gray-400 font-normal">{t('exp_optional')}</span>
              </label>
              <input
                id="exp-notes"
                type="text"
                placeholder={t('exp_notes')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white transition-all min-h-[48px]"
              />
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving || undefined}
              className="w-full text-white rounded-2xl py-4 min-h-[52px] font-bold text-sm active:scale-95 transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400"
              style={{ background: saving ? '#9CA3AF' : 'linear-gradient(135deg,#10B981,#34D399)' }}
            >
              {saving ? t('exp_saving') : editingId ? t('exp_update_btn') : t('exp_save_btn')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Hotel Tab — active/upcoming/ended stays (tap to charge or view report) ── */}
      <HotelStaysStrip
        stays={hotelStays}
        onCharge={setChargingStay}
        onViewReport={setReportStay}
      />

      {/* ── Search ── */}
      <div className="relative">
        <label htmlFor="exp-search" className="sr-only">{t('exp_search_label')}</label>
        <Search aria-hidden="true" className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id="exp-search"
          type="search"
          placeholder={t('exp_search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white rounded-2xl pr-10 pl-10 py-3 text-sm font-medium shadow-card outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all min-h-[48px]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label={t('exp_search_clear')}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Category filter pills ── */}
      <div role="group" aria-label={t('exp_filter_by_cat')} className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilterCat(null)}
          aria-pressed={!filterCat}
          className="flex-shrink-0 px-4 py-2 min-h-[36px] rounded-full text-xs font-bold active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          style={!filterCat
            ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
            : { background: 'white', color: '#4B5563' }}>
          הכל
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCat(filterCat === cat ? null : cat)}
            aria-pressed={filterCat === cat}
            aria-label={`${t('exp_filter_by')} ${CATEGORY_META[cat].label}`}
            className="flex-shrink-0 px-3.5 py-2 min-h-[36px] rounded-full text-xs font-bold active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={filterCat === cat
              ? { background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)', color: 'white' }
              : { background: 'white', color: '#4B5563' }}>
            <span aria-hidden="true">{CATEGORY_META[cat].icon}</span> {CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* ── Expense list grouped by date ── */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-3xl shadow-card">
          {search || filterCat ? (
            <EmptyState
              icon={Search}
              title={t('exp_no_results')}
              description={t('exp_no_results_hint')}
              action={(
                <button
                  type="button"
                  onClick={() => { setSearch(''); setFilterCat(null) }}
                  className="w-full py-3 min-h-[48px] rounded-2xl bg-primary/10 text-primary font-bold text-sm active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('exp_clear_filter')}
                </button>
              )}
            />
          ) : (
            <EmptyState
              icon={Wallet}
              title={t('exp_no_expenses')}
              description={t('exp_no_expenses_hint')}
              action={(
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="w-full py-3.5 min-h-[52px] rounded-2xl text-white font-bold text-sm active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  style={{ background: 'linear-gradient(135deg,#6C47FF,#9B7BFF)' }}
                >
                  <span className="inline-flex items-center gap-2 justify-center"><Plus className="w-4 h-4" aria-hidden="true" /> {t('exp_add_first')}</span>
                </button>
              )}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayExpenses]) => {
              const dayTotal = dayExpenses.reduce((s, e) => s + (e.amount_ils || 0), 0)
              const isToday = date === todayStr
              return (
                <div key={date}>
                  {/* Date header */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">{formatDateShort(date)}</span>
                      {isToday && (
                        <span className="text-[10px] font-bold text-primary bg-primary-50 px-2 py-0.5 rounded-full">
                          היום
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-700">{formatMoney(dayTotal)}</span>
                  </div>

                  {/* Day expenses card */}
                  <motion.div
                    layout
                    variants={staggerContainer}
                    initial={reduce ? false : 'initial'}
                    animate="animate"
                    className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-50/80"
                  >
                  <AnimatePresence initial={false} mode="popLayout">
                  {dayExpenses.map((exp, i) => {
                      const meta = CATEGORY_META[exp.category]
                      return (
                        <motion.div
                          key={exp.id}
                          layout="position"
                          variants={itemVariants}
                          exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                          transition={spring.ui}
                          className={`grid items-center gap-2 px-3.5 py-3 transition-colors
                            ${expenseHasDoc(exp) ? 'cursor-pointer hover:bg-primary/5 active:bg-primary/10' : 'active:bg-gray-50'}
                            ${i < dayExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}
                          style={{ gridTemplateColumns: '36px minmax(0,1fr) auto' }}
                          onClick={(e) => {
                            // Don't trigger when the user hits one of the action icons
                            if ((e.target as HTMLElement).closest('button')) return
                            if (expenseHasDoc(exp)) openExpenseDoc(exp)
                          }}
                          role={expenseHasDoc(exp) ? 'button' : undefined}
                          tabIndex={expenseHasDoc(exp) ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (!expenseHasDoc(exp)) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault(); openExpenseDoc(exp)
                            }
                          }}
                        >
                          {/* Icon */}
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                            style={{ backgroundColor: meta.color + '18' }}>
                            {meta.icon}
                          </div>

                          {/* Info — wraps to 2 lines if needed */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 break-words">{exp.title}</p>
                              {expenseHasDoc(exp) && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5 flex-shrink-0">
                                  <FileText className="w-2.5 h-2.5" strokeWidth={2.2} />
                                  מסמך
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">{meta.label}</p>
                          </div>

                          {/* Amount + actions stacked vertically to reclaim horizontal space */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="text-end">
                              <p className="text-sm font-bold text-gray-900 leading-tight whitespace-nowrap">-{formatMoney(exp.amount_ils)}</p>
                              {exp.currency !== 'ILS' && (
                                <p className="text-[10px] text-gray-400 whitespace-nowrap">
                                  {CURRENCY_SYMBOL[exp.currency as Currency]}{exp.amount}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5" role="group" aria-label={`${t('exp_actions_for')} ${exp.title}`}>
                              {expenseHasDoc(exp) && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openExpenseDoc(exp) }}
                                  aria-label={`צפה במסמך של ${exp.title}`}
                                  title="צפה במסמך המקושר"
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-primary/70 active:text-primary active:bg-primary/10 hover:text-primary hover:bg-primary/10 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                  <FileText className="w-3.5 h-3.5" aria-hidden="true" strokeWidth={2.2} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startEdit(exp)}
                                aria-label={`${t('exp_edit_action')} ${exp.title}`}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 active:text-primary active:bg-primary/10 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSplitExpense(exp)}
                                aria-label={`${t('exp_split_action')} — ${exp.title}`}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 active:text-primary active:bg-primary/10 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                <Split className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(exp)}
                                aria-label={`${t('exp_delete_action')} ${exp.title}`}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 active:text-red-500 active:bg-red-50 transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                  </motion.div>
                </div>
              )
            })}
        </div>
      )}
      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={!!deletingExpense}
        title={t('exp_confirm_delete_title')}
        description={
          deletingExpense
            ? `"${deletingExpense.title}" — ${formatMoney(deletingExpense.amount_ils || 0)}. ${t('exp_confirm_delete_desc')}`
            : undefined
        }
        confirmLabel={t('exp_delete_permanent')}
        cancelLabel={t('cancel')}
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeletingExpense(null)}
      />

      {/* ── Duplicate expense confirmation ── */}
      <ConfirmDialog
        open={!!duplicatePrompt}
        title={t('exp_dup_title')}
        description={
          duplicatePrompt
            ? tFormat('exp_dup_desc', lang, { title: `"${duplicatePrompt.title}"`, date: duplicatePrompt.date })
            : undefined
        }
        confirmLabel={t('exp_dup_keep')}
        cancelLabel={t('cancel')}
        variant="primary"
        onConfirm={() => duplicateResolver?.(true)}
        onCancel={() => duplicateResolver?.(false)}
      />

      {/* ── Split Expense Modal ── */}
      <AnimatePresence>
        {splitExpense && currentTrip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={e => { if (e.target === e.currentTarget) setSplitExpense(null) }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-10 overflow-y-auto"
              style={{ maxHeight: '85vh' }}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <SplitExpense
                tripId={currentTrip.id}
                expenseId={splitExpense.id}
                defaultAmount={splitExpense.amount_ils}
                defaultCurrency={splitExpense.currency}
                defaultDescription={splitExpense.title}
                onSaved={() => setSplitExpense(null)}
                onClose={() => setSplitExpense(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hotel Tab sheets ── */}
      <QuickChargeSheet
        stay={chargingStay}
        userId={user?.id}
        onClose={() => setChargingStay(null)}
        onSaved={() => { setChargingStay(null); fetchExpenses() }}
      />
      <StayReport
        stay={reportStay}
        onClose={() => setReportStay(null)}
      />

      {/* In-app viewer for the document / receipt / email linked to an expense */}
      {(docViewerUrl !== null || docViewerHtml !== null || docViewerLoading) && (
        <DocumentViewer
          url={docViewerUrl}
          htmlContent={docViewerHtml}
          htmlLoading={docViewerLoading}
          title={docViewerTitle}
          subtitle={docViewerSubtitle}
          docType={docViewerType}
          onClose={closeDocViewer}
        />
      )}
    </div>
  )
}
