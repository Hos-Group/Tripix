'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, FileText, Check, Loader2, ArrowRight, Edit3, AlertCircle, Shield, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Category, CATEGORY_META, Currency, CURRENCIES, CURRENCY_SYMBOL, DocType, DOC_TYPE_META, TravelerId } from '@/types'
import DocumentViewer from '@/components/DocumentViewer'
import { loadTravelers, getTravelerName, type Traveler } from '@/lib/travelers'
import { convertToILS } from '@/lib/rates'
import { getDestinationConfig, getDestinationCity } from '@/lib/destinations'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  buildExpenseFingerprint,
  insertWithDedup,
  type DuplicateExpense,
} from '@/lib/dedup'
import {
  computeFileHashFromBlob,
  buildDedupKey,
  findDuplicate,
  isDedupViolation,
  dedupReasonLabel,
} from '@/lib/documentDedup'

type ScanMode = 'choose' | 'receipt' | 'document' | 'passport'
type ScanStep = 'choose' | 'loading' | 'review' | 'confirm' | 'done'

// Passport-specific fields
interface PassportData {
  firstName: string
  lastName: string
  passportNumber: string
  dateOfBirth: string
  gender: string
  nationality: string
  issuingCountry: string
  issueDate: string
  validUntil: string
  traveler: TravelerId
}

interface FlightLeg {
  flightNumber: string
  airline: string
  departureCity: string
  departureAirport: string
  arrivalCity: string
  arrivalAirport: string
  departureDate: string
  departureTime: string
  arrivalDate: string
  arrivalTime: string
  isConnection: boolean
}

// Flight-specific fields
interface FlightData {
  passengerName: string
  bookingRef: string
  legs: FlightLeg[]
  hasConnection: boolean
  connectionCity: string
  connectionDurationMinutes: number
  traveler: TravelerId
  totalAmount: string
  totalCurrency: Currency
}

// Hotel-specific fields
interface HotelData {
  hotelName: string
  bookingRef: string
  checkIn: string
  checkOut: string
  traveler: TravelerId
  amount: string
  currency: Currency
}

// Generic document fields
interface GenericDocData {
  docName: string
  docType: DocType
  bookingRef: string
  traveler: TravelerId
  validFrom: string
  validUntil: string
  amount: string
  currency: Currency
}

export default function ScanPage() {
  const { currentTrip } = useTrip()
  const { user } = useAuth()
  const [mode, setMode] = useState<ScanMode>('choose')
  const [step, setStep] = useState<ScanStep>('choose')
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [noAiMode, setNoAiMode] = useState(false)
  const [detectedDocType, setDetectedDocType] = useState<DocType>('other')
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState<Category>('food')
  const [editAmount, setEditAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState<Currency>('ILS')
  const [editDate, setEditDate] = useState(new Date().toISOString().split('T')[0])
  const [editNotes, setEditNotes] = useState('')

  // Passport fields — default traveler = first traveler in trip (resolved after load)
  const [passport, setPassport] = useState<PassportData>({ firstName: '', lastName: '', passportNumber: '', dateOfBirth: '', gender: '', nationality: '', issuingCountry: '', issueDate: '', validUntil: '', traveler: 'all' })

  // Flight fields
  const emptyLeg: FlightLeg = { flightNumber: '', airline: '', departureCity: '', departureAirport: '', arrivalCity: '', arrivalAirport: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', isConnection: false }
  const [flight, setFlight] = useState<FlightData>({ passengerName: '', bookingRef: '', legs: [{ ...emptyLeg }], hasConnection: false, connectionCity: '', connectionDurationMinutes: 0, traveler: 'all', totalAmount: '', totalCurrency: 'ILS' })

  // Hotel fields
  const [hotel, setHotel] = useState<HotelData>({ hotelName: '', bookingRef: '', checkIn: '', checkOut: '', traveler: 'all', amount: '', currency: 'ILS' })

  // Generic fields
  const [generic, setGeneric] = useState<GenericDocData>({ docName: '', docType: 'other', bookingRef: '', traveler: 'all', validFrom: '', validUntil: '', amount: '', currency: 'ILS' })

  const [saving, setSaving] = useState(false)
  const [savedFileUrl, setSavedFileUrl] = useState<string | null>(null)
  const [showViewer, setShowViewer] = useState(false)
  const [dbTravelers, setDbTravelers] = useState<Traveler[]>([])
  const [dupExpenseWarning, setDupExpenseWarning] = useState<DuplicateExpense | null>(null)

  // Load travelers for current trip; default passport traveler to first traveler
  useEffect(() => {
    loadTravelers(currentTrip?.id).then(travelers => {
      setDbTravelers(travelers)
      if (travelers.length > 0) {
        setPassport(prev => ({ ...prev, traveler: travelers[0].id }))
      }
    })
  }, [currentTrip?.id])

  // Set default currency from trip destination (runs client-side only, avoids SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('tripix_currency') as Currency | null
    if (saved) {
      setEditCurrency(saved)
      setHotel(h => ({ ...h, currency: saved }))
      setGeneric(g => ({ ...g, currency: saved }))
      return
    }
    if (!currentTrip?.destination) return
    const key = getDestinationCity(currentTrip.destination)
    const cfg = getDestinationConfig(key)
    if (cfg?.currency) {
      const c = cfg.currency as Currency
      setEditCurrency(c)
      setHotel(h => ({ ...h, currency: c }))
      setGeneric(g => ({ ...g, currency: c }))
    }
  }, [currentTrip?.id])

  // Auto-match passenger name to traveler
  const matchTraveler = (name: string): TravelerId => {
    if (!name || dbTravelers.length === 0) return 'all'
    const lower = name.toLowerCase()
    for (const t of dbTravelers) {
      const tName = t.name.toLowerCase()
      // Match if traveler name appears in passenger name or vice versa
      const tParts = tName.split(/\s+/)
      const nParts = lower.split(/\s+/)
      const match = tParts.some(p => p.length > 2 && lower.includes(p)) ||
                    nParts.some(p => p.length > 2 && tName.includes(p))
      if (match) return t.id as TravelerId
    }
    return 'all'
  }

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  const handleFileSelect = async (selectedFile: File, context: 'receipt' | 'document') => {
    setFile(selectedFile)
    setStep('loading')

    try {
      const base64 = await fileToBase64(selectedFile)
      const mediaType = selectedFile.type || 'image/jpeg'

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType, context }),
      })

      const result = await res.json()

      if (result.error === 'NO_API_KEY') {
        toast('Claude API לא מוגדר — מילוי ידני', { icon: 'ℹ️' })
        setNoAiMode(true)
        setStep('review')
        return
      }

      if (!res.ok) throw new Error(result.error)

      const d = result.data
      setExtractedData(d)
      setNoAiMode(false)

      if (context === 'receipt') {
        setEditTitle(d.title || '')
        setEditCategory(d.category || 'food')
        setEditAmount(String(d.amount || ''))
        setEditCurrency(d.currency || 'THB')
        setEditDate(d.date || new Date().toISOString().split('T')[0])
        setEditNotes(d.notes || '')
      } else {
        const docType = (d.doc_type as DocType) || 'other'
        setDetectedDocType(docType)

        if (docType === 'passport' || mode === 'passport') {
          setDetectedDocType('passport')
          setPassport({
            firstName: d.first_name || '',
            lastName: d.last_name || '',
            passportNumber: d.passport_number || '',
            dateOfBirth: d.date_of_birth || '',
            gender: d.gender || '',
            nationality: d.nationality || '',
            issuingCountry: d.issuing_country || '',
            issueDate: d.issue_date || '',
            validUntil: d.valid_until || '',
            traveler: matchTraveler(d.full_name || d.first_name || ''),
          })
        } else if (docType === 'flight') {
          const legs: FlightLeg[] = (d.legs || []).map((leg: Record<string, unknown>) => ({
            flightNumber: (leg.flight_number as string) || '',
            airline: (leg.airline as string) || '',
            departureCity: (leg.departure_city as string) || '',
            departureAirport: (leg.departure_airport as string) || '',
            arrivalCity: (leg.arrival_city as string) || '',
            arrivalAirport: (leg.arrival_airport as string) || '',
            departureDate: (leg.departure_date as string) || '',
            departureTime: (leg.departure_time as string) || '',
            arrivalDate: (leg.arrival_date as string) || '',
            arrivalTime: (leg.arrival_time as string) || '',
            isConnection: !!leg.is_connection,
          }))
          setFlight({
            passengerName: d.passenger_name || d.full_name || '',
            bookingRef: d.booking_ref || '',
            legs: legs.length > 0 ? legs : [{ ...emptyLeg }],
            hasConnection: !!d.has_connection,
            connectionCity: d.connection_city || '',
            connectionDurationMinutes: d.connection_duration_minutes || 0,
            traveler: matchTraveler(d.passenger_name || d.full_name || ''),
            totalAmount: d.total_amount ? String(d.total_amount) : '',
            totalCurrency: d.total_currency || 'ILS',
          })
        } else if (docType === 'hotel') {
          setHotel({
            hotelName: d.hotel_name || d.items?.[0]?.title || '',
            bookingRef: d.booking_ref || '',
            checkIn: d.check_in || '',
            checkOut: d.check_out || '',
            traveler: matchTraveler(d.passenger_name || d.full_name || ''),
            amount: d.total_amount ? String(d.total_amount) : (d.items?.[0]?.amount ? String(d.items[0].amount) : ''),
            currency: d.total_currency || d.items?.[0]?.currency || 'ILS',
          })
        } else {
          setGeneric({
            docName: d.items?.[0]?.title || d.hotel_name || selectedFile.name.replace(/\.[^.]+$/, ''),
            docType: docType,
            bookingRef: d.booking_ref || '',
            traveler: matchTraveler(d.passenger_name || d.full_name || ''),
            validFrom: d.departure_date || d.check_in || '',
            validUntil: d.valid_until || d.check_out || d.arrival_date || '',
            amount: d.items?.[0]?.amount ? String(d.items[0].amount) : '',
            currency: d.items?.[0]?.currency || 'ILS',
          })
        }
      }

      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בסריקה')
      setNoAiMode(true)
      setStep('review')
    }
  }

  // Build confirmation summary based on doc type
  const getConfirmSummary = (): { title: string; lines: { label: string; value: string }[] } => {
    if (mode === 'receipt') {
      const meta = CATEGORY_META[editCategory]
      return {
        title: `${meta.icon} ${editTitle}`,
        lines: [
          { label: 'קטגוריה', value: meta.label },
          { label: 'סכום', value: `${CURRENCY_SYMBOL[editCurrency]}${editAmount}` },
          { label: 'תאריך', value: editDate },
          ...(editNotes ? [{ label: 'הערות', value: editNotes }] : []),
        ],
      }
    }

    const dt = getActiveDocType()
    const meta = DOC_TYPE_META[dt]

    if (dt === 'passport') {
      return {
        title: `${meta.icon} דרכון — ${passport.firstName} ${passport.lastName}`,
        lines: [
          { label: 'שם פרטי', value: passport.firstName },
          { label: 'שם משפחה', value: passport.lastName },
          { label: 'מספר דרכון', value: passport.passportNumber },
          { label: 'תאריך לידה', value: passport.dateOfBirth },
          { label: 'מין', value: passport.gender === 'M' ? 'זכר' : passport.gender === 'F' ? 'נקבה' : '' },
          { label: 'לאומיות', value: passport.nationality },
          { label: 'מדינה מנפיקה', value: passport.issuingCountry },
          { label: 'הנפקה', value: passport.issueDate },
          { label: 'תוקף', value: passport.validUntil },
          { label: 'נוסע', value: getTravelerName(dbTravelers, passport.traveler) },
        ],
      }
    }

    if (dt === 'flight') {
      const firstLeg = flight.legs[0]
      const lastLeg = flight.legs[flight.legs.length - 1]
      const routeTitle = firstLeg && lastLeg
        ? `${firstLeg.departureCity} → ${flight.hasConnection ? flight.connectionCity + ' → ' : ''}${lastLeg.arrivalCity}`
        : 'טיסה'

      const legLines = flight.legs.flatMap((leg, i) => [
        { label: `טיסה ${i + 1}`, value: `${leg.flightNumber} ${leg.airline}`.trim() },
        { label: `  מוצא`, value: `${leg.departureCity} (${leg.departureAirport}) · ${leg.departureDate} ${leg.departureTime}` },
        { label: `  יעד`, value: `${leg.arrivalCity} (${leg.arrivalAirport}) · ${leg.arrivalDate} ${leg.arrivalTime}` },
      ])

      const connLines = flight.hasConnection ? [
        { label: 'קונקשיין', value: `${flight.connectionCity} — ${Math.floor(flight.connectionDurationMinutes / 60)}:${String(flight.connectionDurationMinutes % 60).padStart(2, '0')} שעות` },
      ] : []

      return {
        title: `${meta.icon} ${routeTitle}`,
        lines: [
          { label: 'נוסע', value: flight.passengerName },
          { label: 'הזמנה', value: flight.bookingRef },
          ...legLines,
          ...connLines,
          ...(flight.totalAmount ? [{ label: 'סכום כולל', value: `${CURRENCY_SYMBOL[flight.totalCurrency]}${flight.totalAmount}` }] : []),
        ],
      }
    }

    if (dt === 'hotel') {
      return {
        title: `${meta.icon} ${hotel.hotelName}`,
        lines: [
          { label: 'הזמנה', value: hotel.bookingRef },
          { label: 'צ\'ק אין', value: hotel.checkIn },
          { label: 'צ\'ק אאוט', value: hotel.checkOut },
          { label: 'נוסע', value: getTravelerName(dbTravelers, hotel.traveler) },
          ...(hotel.amount ? [{ label: 'סכום', value: `${CURRENCY_SYMBOL[hotel.currency]}${hotel.amount}` }] : []),
        ],
      }
    }

    return {
      title: `${meta.icon} ${generic.docName}`,
      lines: [
        { label: 'סוג', value: meta.label },
        { label: 'הזמנה', value: generic.bookingRef },
        { label: 'נוסע', value: getTravelerName(dbTravelers, generic.traveler) },
        ...(generic.validFrom ? [{ label: 'מתאריך', value: generic.validFrom }] : []),
        ...(generic.validUntil ? [{ label: 'עד', value: generic.validUntil }] : []),
        ...(generic.amount ? [{ label: 'סכום', value: `${CURRENCY_SYMBOL[generic.currency]}${generic.amount}` }] : []),
      ],
    }
  }

  const getActiveDocType = (): DocType => {
    if (mode === 'passport') return 'passport'
    if (detectedDocType !== 'other') return detectedDocType
    return generic.docType
  }

  const handleConfirm = () => setStep('confirm')

  const handleSave = async (force = false) => {
    setSaving(true)
    try {
      if (!currentTrip) { toast.error('בחר טיול קודם'); return }
      const tripId = currentTrip.id

      // SHA-256 the file BEFORE storage upload — lets us short-circuit when
      // the same exact PDF/image was uploaded to this trip already.
      let contentHash: string | null = null
      if (file && mode !== 'receipt') {
        try { contentHash = await computeFileHashFromBlob(file) }
        catch (hashErr) { console.warn('[scan] hash failed:', hashErr) }
      }

      // Upload file
      let fileUrl: string | null = null
      if (file) {
        const bucket = mode === 'receipt' ? 'receipts' : 'documents'
        const fileName = `${Date.now()}_${file.name}`
        const { data: uploaded, error: upErr } = await supabase.storage
          .from(bucket)
          .upload(fileName, file)
        if (!upErr && uploaded) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploaded.path)
          fileUrl = urlData.publicUrl
        }
      }

      if (mode === 'receipt') {
        const fingerprint = buildExpenseFingerprint(tripId, parseFloat(editAmount), editDate, editTitle.trim())
        const receiptAmountIls = await convertToILS(parseFloat(editAmount), editCurrency, editDate)
        const result = await insertWithDedup({
          table:       'expenses',
          trip_id:     tripId,
          payload:     {
            trip_id:      tripId,
            user_id:      user?.id,
            title:        editTitle.trim(),
            category:     editCategory,
            amount:       parseFloat(editAmount),
            currency:     editCurrency,
            amount_ils:   receiptAmountIls,
            expense_date: editDate,
            notes:        editNotes || null,
            receipt_url:  fileUrl,
            source:       noAiMode ? 'manual' : 'scan',
          },
          contentHash: fingerprint,
          softDedup:   true,
          force,
        })
        if (result.duplicate) {
          setDupExpenseWarning(result.existing as DuplicateExpense)
          setSaving(false)
          return
        }
      } else {
        const dt = getActiveDocType()

        // Build document record based on type
        let docRecord: Record<string, unknown> = {
          trip_id: tripId,
          user_id: user?.id,
          doc_type: dt,
          file_url: fileUrl,
          file_type: file?.type,
          extracted_data: extractedData || {},
        }

        if (dt === 'passport') {
          docRecord = {
            ...docRecord,
            name: `דרכון ${passport.firstName} ${passport.lastName}`,
            traveler_id: passport.traveler,
            valid_until: passport.validUntil || null,
            valid_from: passport.issueDate || null,
            booking_ref: passport.passportNumber || null,
            extracted_data: {
              ...(extractedData || {}),
              full_name: `${passport.firstName} ${passport.lastName}`,
              first_name: passport.firstName,
              last_name: passport.lastName,
              passport_number: passport.passportNumber,
              date_of_birth: passport.dateOfBirth,
              gender: passport.gender,
              nationality: passport.nationality,
              issuing_country: passport.issuingCountry,
              issue_date: passport.issueDate,
              valid_until: passport.validUntil,
            },
          }
        } else if (dt === 'flight') {
          const firstLeg = flight.legs[0]
          const lastLeg = flight.legs[flight.legs.length - 1]
          const flightName = firstLeg && lastLeg
            ? `${firstLeg.departureCity} → ${lastLeg.arrivalCity}`
            : 'כרטיס טיסה'
          docRecord = {
            ...docRecord,
            name: flightName,
            traveler_id: flight.traveler,
            booking_ref: flight.bookingRef || null,
            flight_number: flight.legs.map(l => l.flightNumber).filter(Boolean).join(', ') || null,
            valid_from: firstLeg?.departureDate || null,
            valid_until: lastLeg?.arrivalDate || null,
            extracted_data: { ...(extractedData || {}), legs: flight.legs, has_connection: flight.hasConnection, connection_city: flight.connectionCity, connection_duration_minutes: flight.connectionDurationMinutes },
          }
        } else if (dt === 'hotel') {
          docRecord = { ...docRecord, name: hotel.hotelName || 'הזמנת מלון', traveler_id: hotel.traveler, booking_ref: hotel.bookingRef || null, valid_from: hotel.checkIn || null, valid_until: hotel.checkOut || null }
        } else {
          docRecord = { ...docRecord, name: generic.docName || 'מסמך', traveler_id: generic.traveler, booking_ref: generic.bookingRef || null, valid_from: generic.validFrom || null, valid_until: generic.validUntil || null }
        }

        // ── Unified dedup (content hash + logical signature) ─────────────
        const dedupKey = buildDedupKey({
          doc_type:      dt,
          booking_ref:   docRecord.booking_ref as string | null,
          traveler_id:   docRecord.traveler_id as string | null,
          valid_from:    docRecord.valid_from  as string | null,
          name:          docRecord.name        as string | null,
          flight_number: docRecord.flight_number as string | null,
        })
        docRecord.content_hash = contentHash
        docRecord.dedup_key    = dedupKey

        if (!force) {
          const existing = await findDuplicate(supabase, tripId, {
            content_hash: contentHash,
            dedup_key:    dedupKey,
          })
          if (existing) {
            toast.error(`${dedupReasonLabel(existing.reason)} — "${existing.name}" כבר קיים`)
            setSaving(false)
            setStep('review')
            return
          }
        }

        const { data: insertedDoc, error: docErr } = await supabase
          .from('documents')
          .insert(docRecord)
          .select('id')
          .single()

        if (docErr) {
          if (isDedupViolation(docErr)) {
            toast.error('המסמך כבר קיים בטיול הזה')
            setSaving(false)
            setStep('review')
            return
          }
          throw docErr
        }

        const docId = insertedDoc?.id

        // ── Save expense(s) linked to document ──────────────────────────────
        const amt = dt === 'flight' ? flight.totalAmount : dt === 'hotel' ? hotel.amount : generic.amount
        const cur = dt === 'flight' ? flight.totalCurrency : dt === 'hotel' ? hotel.currency : generic.currency

        if (dt === 'flight' && amt && parseFloat(amt) > 0) {
          // One expense per flight (not per leg) — all legs are a single
          // purchase. Per-segment display on the timeline reads from
          // documents.extracted_data.legs, so we don't need phantom ₪0 rows
          // that would violate the DB CHECK (amount > 0) constraint and
          // pollute the Expenses page.
          const firstLeg = flight.legs[0]
          const lastLeg  = flight.legs[flight.legs.length - 1]
          const flightTitle =
            (firstLeg?.departureCity && lastLeg?.arrivalCity)
              ? `${firstLeg.departureCity} → ${lastLeg.arrivalCity}`
              : (firstLeg?.departureAirport && lastLeg?.arrivalAirport)
                ? `${firstLeg.departureAirport} → ${lastLeg.arrivalAirport}`
                : 'כרטיס טיסה'
          const flightDate = firstLeg?.departureDate || new Date().toISOString().split('T')[0]
          const flightAmt  = parseFloat(amt)
          const flightIls  = await convertToILS(flightAmt, cur, flightDate)
          const flightNotes = [
            flight.legs.map(l => l.flightNumber).filter(Boolean).join(' · ') || null,
            flight.hasConnection ? `דרך ${flight.connectionCity || 'קונקשיין'}` : null,
            flight.bookingRef ? `אישור: ${flight.bookingRef}` : null,
          ].filter(Boolean).join('\n') || null

          await supabase.from('expenses').insert({
            trip_id:      tripId,
            user_id:      user?.id,
            title:        flightTitle,
            category:     'flight',
            amount:       flightAmt,
            currency:     cur,
            amount_ils:   flightIls,
            expense_date: flightDate,
            source:       'document',
            document_id:  docId || null,
            notes:        flightNotes,
          })
        } else if (amt && parseFloat(amt) > 0) {
          // Hotels, ferries, activities, generic — one expense
          const expCat   = dt === 'hotel' ? 'hotel' : dt === 'ferry' ? 'ferry' : dt === 'activity' ? 'activity' : 'other'
          const expDate  = dt === 'hotel' ? hotel.checkIn : generic.validFrom
          const expTitle = dt === 'hotel' ? hotel.hotelName : generic.docName
          const finalDate = expDate || new Date().toISOString().split('T')[0]
          const amountIls = await convertToILS(parseFloat(amt), cur, finalDate)
          await supabase.from('expenses').insert({
            trip_id:      tripId,
            user_id:      user?.id,
            title:        expTitle,
            category:     expCat,
            amount:       parseFloat(amt),
            currency:     cur,
            amount_ils:   amountIls,
            expense_date: finalDate,
            source:       'document',
            document_id:  docId || null,
            notes:        null,
          })
        }
      }

      setSavedFileUrl(fileUrl)
      setStep('done')
      toast.success('נשמר בהצלחה!')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בשמירה')
    }
    setSaving(false)
  }

  const resetState = () => {
    setMode('choose')
    setStep('choose')
    setExtractedData(null)
    setFile(null)
    setNoAiMode(false)
    setDetectedDocType('other')
    setSavedFileUrl(null)
    setShowViewer(false)
    setDupExpenseWarning(null)
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  const inputClass = 'w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-primary/20 transition-all'
  const selectClass = 'w-full bg-surface-secondary rounded-2xl px-4 py-3 text-sm font-medium outline-none'

  const getFileFormat = () => {
    if (!file) return ''
    if (file.type === 'application/pdf') return 'PDF'
    if (file.type.startsWith('image/')) return file.type.split('/')[1].toUpperCase()
    return file.name.split('.').pop()?.toUpperCase() || ''
  }

  const getDocTypeLabel = () => {
    const dt = getActiveDocType()
    return DOC_TYPE_META[dt]?.label || 'מסמך'
  }

  const FileInfoBar = () => {
    if (!file) return null
    return (
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs">
        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">{getFileFormat()}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">{getDocTypeLabel()}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-400 truncate flex-1">{file.name}</span>
      </div>
    )
  }

  const TravelerSelect = ({ value, onChange }: { value: TravelerId; onChange: (v: TravelerId) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value as TravelerId)} className={selectClass}>
      <option value="all">כולם</option>
      {dbTravelers.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black tracking-tight gradient-text pt-1">סריקה חכמה</h1>

      <AnimatePresence mode="wait">
        {/* Choose */}
        {step === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">בחרו מה לסרוק — Tripix ינתח הכל אוטומטית</p>

            {/* Primary camera button */}
            <button
              type="button"
              onClick={() => { setMode('receipt'); cameraRef.current?.click() }}
              aria-label="צלם קבלה — בינה מלאכותית תמלא את הפרטים אוטומטית"
              className="w-full relative overflow-hidden rounded-3xl p-7 active:scale-95 transition-all text-white focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              style={{ background: 'linear-gradient(140deg, #6C47FF 0%, #9B7BFF 60%, #B9A0FF 100%)', boxShadow: '0 12px 32px rgba(108,71,255,0.35)' }}>
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-32 h-32 rounded-full bg-white/8 animate-ping" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </span>
              <div className="relative flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center"
                  style={{ backdropFilter: 'blur(8px)' }} aria-hidden="true">
                  <Camera className="w-10 h-10 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-black text-xl tracking-tight">צלם קבלה</p>
                  <p className="text-sm text-white/85 mt-0.5">AI מחלץ הכל אוטומטית</p>
                </div>
              </div>
            </button>

            {/* Secondary options */}
            {[
              { m: 'document' as ScanMode, icon: Upload,   bg: 'rgba(59,130,246,0.10)',  iconColor: '#3B82F6', title: 'העלה מסמך הזמנה', sub: 'טיסה / מלון / מעבורת / פעילות', useCamera: false },
              { m: 'passport' as ScanMode, icon: FileText, bg: 'rgba(16,185,129,0.10)', iconColor: '#10B981', title: 'סרוק דרכון',          sub: 'חילוץ פרטי דרכון אוטומטי',    useCamera: false },
            ].map(({ m, icon: Icon, bg, iconColor, title, sub, useCamera }) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); (useCamera ? cameraRef : fileRef).current?.click() }}
                aria-label={`${title} — ${sub}`}
                className="w-full bg-white rounded-2xl p-5 min-h-[80px] shadow-card flex items-center gap-4 active:scale-95 transition-all border border-gray-50/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }} aria-hidden="true">
                  <Icon className="w-6 h-6" style={{ color: iconColor }} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                </div>
              </button>
            ))}

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f, 'receipt') }} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f, mode === 'receipt' ? 'receipt' : 'document') }} />
          </motion.div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-3xl p-10 shadow-card text-center border border-gray-50/80">
            <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'rgba(108,71,255,0.10)' }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="font-black text-lg tracking-tight mb-1">Claude מנתח...</p>
            <p className="text-sm text-gray-400">
              {mode === 'receipt' && 'מחלץ פרטי קבלה'}
              {mode === 'document' && 'מחלץ פרטי הזמנה'}
              {mode === 'passport' && 'מחלץ פרטי דרכון'}
            </p>
          </motion.div>
        )}

        {/* Review — Receipt */}
        {step === 'review' && mode === 'receipt' && (
          <motion.div key="review-receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">{noAiMode ? 'מילוי ידני' : 'בדוק ועדכן'}</span>
            </div>
            <FileInfoBar />

            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="שם ההוצאה *" className={inputClass} />
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as Category)} className={selectClass}>
              {Object.entries(CATEGORY_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="סכום *" className={`flex-1 ${inputClass}`} />
              <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value as Currency)} className="w-24 bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none">
                {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>)}
              </select>
            </div>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass} />
            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="הערות" className={inputClass} />

            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={!editTitle.trim() || !editAmount}
                className="flex-1 text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                המשך לאישור
              </button>
              <button onClick={resetState} className="px-4 bg-gray-100 rounded-xl py-3 text-gray-500 active:scale-95">ביטול</button>
            </div>
          </motion.div>
        )}

        {/* Review — Passport */}
        {step === 'review' && (mode === 'passport' || (mode === 'document' && detectedDocType === 'passport')) && (
          <motion.div key="review-passport" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-bold">🛂 פרטי דרכון</span>
            </div>
            <FileInfoBar />

            <div className="flex gap-2">
              <input type="text" value={passport.firstName} onChange={(e) => setPassport(p => ({ ...p, firstName: e.target.value }))} placeholder="שם פרטי *" className={`flex-1 ${inputClass}`} />
              <input type="text" value={passport.lastName} onChange={(e) => setPassport(p => ({ ...p, lastName: e.target.value }))} placeholder="שם משפחה *" className={`flex-1 ${inputClass}`} />
            </div>
            <input type="text" value={passport.passportNumber} onChange={(e) => setPassport(p => ({ ...p, passportNumber: e.target.value }))} placeholder="מספר דרכון *" className={inputClass} />
            <div>
              <label className="text-xs text-gray-500 mr-1">תאריך לידה</label>
              <input type="date" value={passport.dateOfBirth} onChange={(e) => setPassport(p => ({ ...p, dateOfBirth: e.target.value }))} className={inputClass} />
            </div>
            <div className="flex gap-2">
              <select value={passport.gender} onChange={(e) => setPassport(p => ({ ...p, gender: e.target.value }))} className={`flex-1 ${selectClass}`}>
                <option value="">מין</option>
                <option value="M">זכר</option>
                <option value="F">נקבה</option>
              </select>
              <input type="text" value={passport.nationality} onChange={(e) => setPassport(p => ({ ...p, nationality: e.target.value }))} placeholder="לאומיות" className={`flex-1 ${inputClass}`} />
            </div>
            <input type="text" value={passport.issuingCountry} onChange={(e) => setPassport(p => ({ ...p, issuingCountry: e.target.value }))} placeholder="מדינה מנפיקה" className={inputClass} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mr-1">תאריך הנפקה</label>
                <input type="date" value={passport.issueDate} onChange={(e) => setPassport(p => ({ ...p, issueDate: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mr-1">תוקף</label>
                <input type="date" value={passport.validUntil} onChange={(e) => setPassport(p => ({ ...p, validUntil: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <TravelerSelect value={passport.traveler} onChange={(v) => setPassport(p => ({ ...p, traveler: v }))} />

            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={!passport.firstName.trim() || !passport.lastName.trim()}
                className="flex-1 text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>
                המשך לאישור
              </button>
              <button onClick={resetState} className="px-4 bg-gray-100 rounded-xl py-3 text-gray-500 active:scale-95">ביטול</button>
            </div>
          </motion.div>
        )}

        {/* Review — Flight */}
        {step === 'review' && mode === 'document' && detectedDocType === 'flight' && (
          <motion.div key="review-flight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-bold">✈️ כרטיס טיסה</span>
            </div>
            <FileInfoBar />

            <input type="text" value={flight.passengerName} onChange={(e) => setFlight(f => ({ ...f, passengerName: e.target.value }))} placeholder="שם הנוסע (כפי שבמסמך)" className={inputClass} />
            <input type="text" value={flight.bookingRef} onChange={(e) => setFlight(f => ({ ...f, bookingRef: e.target.value }))} placeholder="מספר הזמנה / PNR" className={inputClass} />

            {/* Flights */}
            {flight.legs.map((leg, i) => (
              <div key={i} className={`rounded-2xl p-4 space-y-3 border ${leg.isConnection ? 'bg-orange-50/50 border-orange-200' : 'bg-blue-50/30 border-blue-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{leg.isConnection ? '🔄' : '✈️'}</span>
                    <span className="text-xs font-bold text-gray-700">
                      טיסה {i + 1}{leg.isConnection ? ' (קונקשיין)' : ''}
                    </span>
                  </div>
                  {flight.legs.length > 1 && (
                    <button onClick={() => setFlight(f => ({ ...f, legs: f.legs.filter((_, idx) => idx !== i) }))}
                      className="text-[10px] text-red-400 active:scale-95">הסר</button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input type="text" value={leg.flightNumber}
                    onChange={(e) => { const legs = [...flight.legs]; legs[i] = { ...legs[i], flightNumber: e.target.value }; setFlight(f => ({ ...f, legs })) }}
                    placeholder="מספר טיסה" className={`flex-1 ${inputClass}`} />
                  <input type="text" value={leg.airline}
                    onChange={(e) => { const legs = [...flight.legs]; legs[i] = { ...legs[i], airline: e.target.value }; setFlight(f => ({ ...f, legs })) }}
                    placeholder="חברת תעופה" className={`flex-1 ${inputClass}`} />
                </div>

                {/* Route visualization */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-center">
                    <input type="text" value={leg.departureCity}
                      onChange={(e) => { const legs = [...flight.legs]; legs[i] = { ...legs[i], departureCity: e.target.value }; setFlight(f => ({ ...f, legs })) }}
                      placeholder="מוצא" className="w-full bg-white rounded-lg px-3 py-2 text-sm text-center outline-none font-medium" />
                    <p className="text-[10px] text-gray-400 mt-0.5">{leg.departureAirport || 'קוד'}</p>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div className="flex-1 text-center">
                    <input type="text" value={leg.arrivalCity}
                      onChange={(e) => { const legs = [...flight.legs]; legs[i] = { ...legs[i], arrivalCity: e.target.value }; setFlight(f => ({ ...f, legs })) }}
                      placeholder="יעד" className="w-full bg-white rounded-lg px-3 py-2 text-sm text-center outline-none font-medium" />
                    <p className="text-[10px] text-gray-400 mt-0.5">{leg.arrivalAirport || 'קוד'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 font-medium">המראה</label>
                    <p className="text-sm font-medium">{leg.departureDate} {leg.departureTime}</p>
                  </div>
                  <div className="flex-1 text-left">
                    <label className="text-[10px] text-gray-500 font-medium">נחיתה</label>
                    <p className="text-sm font-medium">{leg.arrivalDate} {leg.arrivalTime}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Connection info */}
            {flight.hasConnection && (
              <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-2">
                <span className="text-orange-500 text-sm">🔄</span>
                <span className="text-xs font-medium text-orange-700">
                  קונקשיין ב-{flight.connectionCity} — {Math.floor(flight.connectionDurationMinutes / 60)}:{String(flight.connectionDurationMinutes % 60).padStart(2, '0')} שעות המתנה
                </span>
              </div>
            )}

            <TravelerSelect value={flight.traveler} onChange={(v) => setFlight(f => ({ ...f, traveler: v }))} />

            <div className="flex gap-2">
              <input type="number" value={flight.totalAmount} onChange={(e) => setFlight(f => ({ ...f, totalAmount: e.target.value }))} placeholder="סכום כולל (Total)" className={`flex-1 ${inputClass}`} />
              <select value={flight.totalCurrency} onChange={(e) => setFlight(f => ({ ...f, totalCurrency: e.target.value as Currency }))} className="w-24 bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none">
                {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>)}
              </select>
            </div>

            {/* Timeline info: one expense per leg */}
            {flight.legs.length > 1 && (
              <div className="bg-blue-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <span className="text-blue-500 text-sm flex-shrink-0">📅</span>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  <strong>{flight.legs.length} רגלי טיסה</strong> יווצרו בציר הזמן — כל רגל בתאריך ההמראה שלו.
                  הסכום הכולל יוצמד לרגל הראשון; שאר הרגלים יסומנו כ&quot;כלול במחיר הכרטיס&quot;.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleConfirm} className="flex-1 text-white rounded-2xl py-3 font-bold active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>המשך לאישור</button>
              <button onClick={resetState} className="px-4 bg-gray-100 rounded-xl py-3 text-gray-500 active:scale-95">ביטול</button>
            </div>
          </motion.div>
        )}

        {/* Review — Hotel */}
        {step === 'review' && mode === 'document' && detectedDocType === 'hotel' && (
          <motion.div key="review-hotel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-bold">🏨 הזמנת מלון</span>
            </div>
            <FileInfoBar />

            <input type="text" value={hotel.hotelName} onChange={(e) => setHotel(h => ({ ...h, hotelName: e.target.value }))} placeholder="שם המלון *" className={inputClass} />
            <input type="text" value={hotel.bookingRef} onChange={(e) => setHotel(h => ({ ...h, bookingRef: e.target.value }))} placeholder="מספר הזמנה" className={inputClass} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mr-1">צ&apos;ק אין</label>
                <input type="date" value={hotel.checkIn} onChange={(e) => setHotel(h => ({ ...h, checkIn: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mr-1">צ&apos;ק אאוט</label>
                <input type="date" value={hotel.checkOut} onChange={(e) => setHotel(h => ({ ...h, checkOut: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <TravelerSelect value={hotel.traveler} onChange={(v) => setHotel(h => ({ ...h, traveler: v }))} />
            <div className="flex gap-2">
              <input type="number" value={hotel.amount} onChange={(e) => setHotel(h => ({ ...h, amount: e.target.value }))} placeholder="סכום (אם ידוע)" className={`flex-1 ${inputClass}`} />
              <select value={hotel.currency} onChange={(e) => setHotel(h => ({ ...h, currency: e.target.value as Currency }))} className="w-24 bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none">
                {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={!hotel.hotelName.trim()}
                className="flex-1 text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>המשך לאישור</button>
              <button onClick={resetState} className="px-4 bg-gray-100 rounded-xl py-3 text-gray-500 active:scale-95">ביטול</button>
            </div>
          </motion.div>
        )}

        {/* Review — Generic (ferry, activity, insurance, visa, other) */}
        {step === 'review' && mode === 'document' && !['passport', 'flight', 'hotel'].includes(detectedDocType) && (
          <motion.div key="review-generic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              {noAiMode ? <AlertCircle className="w-4 h-4 text-orange-500" /> : <Edit3 className="w-4 h-4 text-primary" />}
              <span className="text-sm font-bold">{noAiMode ? 'מילוי ידני' : 'פרטי מסמך'}</span>
            </div>
            <FileInfoBar />

            <input type="text" value={generic.docName} onChange={(e) => setGeneric(g => ({ ...g, docName: e.target.value }))} placeholder="שם המסמך *" className={inputClass} />
            <select value={generic.docType} onChange={(e) => setGeneric(g => ({ ...g, docType: e.target.value as DocType }))} className={selectClass}>
              {Object.entries(DOC_TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
            </select>
            <input type="text" value={generic.bookingRef} onChange={(e) => setGeneric(g => ({ ...g, bookingRef: e.target.value }))} placeholder="מספר הזמנה" className={inputClass} />
            <TravelerSelect value={generic.traveler} onChange={(v) => setGeneric(g => ({ ...g, traveler: v }))} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mr-1">מתאריך</label>
                <input type="date" value={generic.validFrom} onChange={(e) => setGeneric(g => ({ ...g, validFrom: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mr-1">עד תאריך</label>
                <input type="date" value={generic.validUntil} onChange={(e) => setGeneric(g => ({ ...g, validUntil: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-2">
              <input type="number" value={generic.amount} onChange={(e) => setGeneric(g => ({ ...g, amount: e.target.value }))} placeholder="סכום" className={`flex-1 ${inputClass}`} />
              <select value={generic.currency} onChange={(e) => setGeneric(g => ({ ...g, currency: e.target.value as Currency }))} className="w-24 bg-gray-50 rounded-xl px-3 py-3 text-sm outline-none">
                {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={!generic.docName.trim()}
                className="flex-1 text-white rounded-2xl py-3 font-bold active:scale-95 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6C47FF 0%, #9B7BFF 100%)' }}>המשך לאישור</button>
              <button onClick={resetState} className="px-4 bg-gray-100 rounded-xl py-3 text-gray-500 active:scale-95">ביטול</button>
            </div>
          </motion.div>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-center">אשר את הנתונים</p>

            {(() => {
              const summary = getConfirmSummary()
              return (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="font-bold text-base">{summary.title}</p>
                  {summary.lines.filter(l => l.value).map((line, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-500">{line.label}</span>
                      <span className="font-medium">{line.value}</span>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Duplicate receipt warning — shown when a similar expense already exists */}
            {dupExpenseWarning && mode === 'receipt' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-amber-800">הוצאה דומה כבר קיימת</p>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {dupExpenseWarning.title} — {dupExpenseWarning.amount} {dupExpenseWarning.currency} ({dupExpenseWarning.expense_date})
                </p>
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex-1 text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded-lg py-2 font-bold active:scale-95 transition-all disabled:opacity-40">
                    {saving ? 'שומר...' : 'שמור בכל זאת'}
                  </button>
                  <button
                    onClick={() => { setDupExpenseWarning(null); setStep('review') }}
                    className="flex-1 text-xs bg-gray-100 text-gray-600 rounded-lg py-2 font-semibold active:scale-95">
                    חזור לעריכה
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => handleSave()} disabled={saving}
                  className="flex-1 bg-green-500 text-white rounded-xl py-3 font-medium active:scale-95 transition-transform disabled:opacity-50">
                  {saving ? 'שומר...' : 'אישור ושמירה'}
                </button>
                <button onClick={() => setStep('review')}
                  className="px-4 bg-gray-100 rounded-xl py-3 text-gray-500 active:scale-95">
                  חזור לעריכה
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Done */}
        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <p className="font-bold text-lg mb-1">נשמר בהצלחה!</p>
            <p className="text-sm text-gray-400 mb-4">
              {detectedDocType === 'flight' && flight.legs.length > 1
                ? `${flight.legs.length} רגלי טיסה נוספו לציר הזמן בתאריכים הנכונים`
                : 'המסמך והנתונים נשמרו במערכת'}
            </p>
            <div className="flex flex-col gap-3">
              {savedFileUrl && (
                <button onClick={() => setShowViewer(true)}
                  className="bg-white border-2 border-primary text-primary rounded-xl px-6 py-3 font-medium active:scale-95 transition-transform inline-flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  צפה במסמך
                </button>
              )}
              <button onClick={resetState}
                className="bg-primary text-white rounded-xl px-6 py-3 font-medium active:scale-95 transition-transform inline-flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" />
                סריקה נוספת
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showViewer && savedFileUrl && (
        <DocumentViewer url={savedFileUrl} onClose={() => setShowViewer(false)} />
      )}
    </div>
  )
}
