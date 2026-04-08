import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, eachDayOfInterval, parseISO, differenceInDays, isToday } from 'date-fns'
import { he } from 'date-fns/locale'
import { Currency, CURRENCY_SYMBOL, Expense } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const RATES: Record<string, number> = {
  ILS: 1,
  USD: 3.70,
  THB: 0.105,
  EUR: 4.00,
  GBP: 4.65,
}

export function toILS(amount: number, currency: Currency): number {
  return Math.round(amount * (RATES[currency] || 1) * 100) / 100
}

export function formatMoney(amount: number, currency: Currency = 'ILS'): string {
  const symbol = CURRENCY_SYMBOL[currency] || currency
  return `${symbol}${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function getTripStart(): Date {
  return parseISO(process.env.NEXT_PUBLIC_TRIP_START || '2026-04-11')
}

export function getTripEnd(): Date {
  return parseISO(process.env.NEXT_PUBLIC_TRIP_END || '2026-05-01')
}

export function getTripDays(): Date[] {
  return eachDayOfInterval({ start: getTripStart(), end: getTripEnd() })
}

export function getTripDayNumber(date: Date): number {
  return differenceInDays(date, getTripStart()) + 1
}

export function getDaysRemaining(): number {
  const today = new Date()
  const end = getTripEnd()
  const diff = differenceInDays(end, today)
  return Math.max(0, diff)
}

export function isTripDay(date: Date): boolean {
  return isToday(date)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

export interface DailySummary {
  date: string
  dayNumber: number
  totalIls: number
  expenses: Expense[]
  isToday: boolean
}

export function buildDailySummaries(expenses: Expense[]): DailySummary[] {
  const days = getTripDays()
  return days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayExpenses = expenses.filter((e) => e.expense_date === dateStr)
    const totalIls = dayExpenses.reduce((sum, e) => sum + (e.amount_ils || 0), 0)
    return {
      date: dateStr,
      dayNumber: getTripDayNumber(day),
      totalIls,
      expenses: dayExpenses,
      isToday: isToday(day),
    }
  })
}
