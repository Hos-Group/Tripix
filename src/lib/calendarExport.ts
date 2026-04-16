/**
 * calendarExport.ts
 * Generates a standard .ics (iCalendar) file from trip data.
 * The resulting file can be imported into any calendar app:
 *   Google Calendar, Apple Calendar, Outlook, etc.
 *
 * Events generated:
 *  - Trip duration (all-day event spanning the whole trip)
 *  - Each flight (timed event with departure/arrival times)
 *  - Each hotel stay (all-day multi-day event)
 *  - Each activity document (single-day event)
 *  - Each expense with a date (optional — disabled by default)
 */

export interface CalEvent {
  uid:         string
  summary:     string
  description: string
  location:    string
  dtStart:     string  // ISO datetime or date (YYYY-MM-DD)
  dtEnd:       string  // ISO datetime or date
  allDay:      boolean
  category:    'trip' | 'flight' | 'hotel' | 'activity' | 'expense' | 'car'
}

// ── iCalendar helpers ────────────────────────────────────────────────────────

/** Format a JS Date to iCal UTC string: 20250315T060000Z */
function toICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Format a date string (YYYY-MM-DD) to iCal all-day string: 20250315 */
function toICalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

/** Escape special chars in iCal text fields */
function esc(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// ── Main export function ─────────────────────────────────────────────────────

export interface TripCalendarData {
  tripId:      string
  tripName:    string
  destination: string
  startDate:   string  // YYYY-MM-DD
  endDate:     string  // YYYY-MM-DD
  events:      CalEvent[]
}

export function generateICS(data: TripCalendarData): string {
  const now = toICalDateTime(new Date())
  const prodId = '-//Tripix//Tripix Travel Planner//HE'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(data.tripName)}`,
    `X-WR-TIMEZONE:UTC`,
    `X-WR-CALDESC:${esc(`Tripix — ${data.tripName}`)}`,
  ]

  // ── Trip duration all-day event ───────────────────────────────────────────
  const tripEndPlusOne = new Date(data.endDate)
  tripEndPlusOne.setDate(tripEndPlusOne.getDate() + 1)
  const tripEndStr = tripEndPlusOne.toISOString().split('T')[0]

  lines.push(
    'BEGIN:VEVENT',
    `UID:trip-${data.tripId}@tripix.app`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${toICalDate(data.startDate)}`,
    `DTEND;VALUE=DATE:${toICalDate(tripEndStr)}`,
    `SUMMARY:🌏 ${esc(data.tripName)}`,
    `DESCRIPTION:${esc(`טיול ל${data.destination}`)}`,
    `LOCATION:${esc(data.destination)}`,
    'CATEGORIES:TRIPIX,TRIP',
    'TRANSP:TRANSPARENT',   // all-day trip shows as background, not blocking
    'END:VEVENT',
  )

  // ── Individual events ─────────────────────────────────────────────────────
  for (const ev of data.events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.uid}@tripix.app`)
    lines.push(`DTSTAMP:${now}`)

    if (ev.allDay) {
      // All-day: DTSTART;VALUE=DATE:20250315
      lines.push(`DTSTART;VALUE=DATE:${toICalDate(ev.dtStart)}`)
      // DTEND for all-day is exclusive (day after last day)
      const endDate = new Date(ev.dtEnd)
      endDate.setDate(endDate.getDate() + 1)
      lines.push(`DTEND;VALUE=DATE:${toICalDate(endDate.toISOString().split('T')[0])}`)
    } else {
      // Timed event
      lines.push(`DTSTART:${toICalDateTime(new Date(ev.dtStart))}`)
      lines.push(`DTEND:${toICalDateTime(new Date(ev.dtEnd))}`)
    }

    lines.push(`SUMMARY:${esc(ev.summary)}`)
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`)
    if (ev.location)    lines.push(`LOCATION:${esc(ev.location)}`)
    lines.push(`CATEGORIES:TRIPIX,${ev.category.toUpperCase()}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // iCal lines must be max 75 chars (fold at 75)
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** iCal line folding: lines > 75 chars are split with CRLF + space */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, 75))
  let i = 75
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join('\r\n')
}

// ── Build CalEvents from Supabase document data ──────────────────────────────

export interface RawDocument {
  id:             string
  doc_type:       string
  name:           string
  flight_number:  string | null
  valid_from:     string | null
  valid_until:    string | null
  booking_ref:    string | null
  extracted_data: Record<string, unknown> | null
}

export interface RawExpense {
  id:           string
  title:        string
  category:     string
  expense_date: string
  amount:       number
  currency:     string
  notes:        string | null
}

/**
 * Convert Supabase documents + expenses into CalEvent[] list.
 * Handles flights (timed), hotels (all-day multi-day), activities, car rentals.
 */
export function buildCalEvents(
  docs:     RawDocument[],
  expenses: RawExpense[],
  includeExpenses = false,
): CalEvent[] {
  const events: CalEvent[] = []

  for (const doc of docs) {
    const ext = (doc.extracted_data || {}) as Record<string, string>

    if (doc.doc_type === 'flight') {
      // ── Flight event ───────────────────────────────────────────────────
      const depDate = ext.departure_date || doc.valid_from
      const depTime = ext.departure_time || '00:00'
      const arrDate = ext.arrival_date   || depDate
      const arrTime = ext.arrival_time   || '02:00'
      if (!depDate) continue

      const depCity  = ext.departure_city   || ext.departure || 'Departure'
      const arrCity  = ext.destination_city || ext.arrival   || 'Arrival'
      const airline  = ext.airline          || ''
      const flightNo = doc.flight_number    || ext.flight_number || ''

      // Build ISO datetime strings
      const depDT = `${depDate}T${depTime.replace(':', ':')}:00`
      const arrDT = `${arrDate}T${arrTime.replace(':', ':')}:00`

      events.push({
        uid:         `flight-${doc.id}`,
        summary:     `✈️ ${flightNo ? flightNo + ' — ' : ''}${depCity} → ${arrCity}`,
        description: [
          airline     ? `חברת תעופה: ${airline}`    : '',
          flightNo    ? `טיסה: ${flightNo}`          : '',
          depTime     ? `המראה: ${depTime}`           : '',
          arrTime     ? `נחיתה: ${arrTime}`           : '',
          doc.booking_ref ? `אסמכתא: ${doc.booking_ref}` : '',
        ].filter(Boolean).join('\n'),
        location:    `${depCity} Airport`,
        dtStart:     depDT,
        dtEnd:       arrDT,
        allDay:      false,
        category:    'flight',
      })
    }

    else if (doc.doc_type === 'hotel') {
      // ── Hotel all-day event ────────────────────────────────────────────
      const checkIn  = ext.check_in  || doc.valid_from
      const checkOut = ext.check_out || doc.valid_until
      if (!checkIn) continue

      const hotelName = ext.hotel_name || doc.name || 'מלון'
      const city      = ext.destination_city || ext.hotel_city || ext.city || ''
      const nights    = (checkIn && checkOut)
        ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
        : 1

      events.push({
        uid:         `hotel-${doc.id}`,
        summary:     `🏨 ${hotelName}${city ? ' — ' + city : ''}`,
        description: [
          `צ'ק-אין: ${checkIn}`,
          checkOut ? `צ'ק-אאוט: ${checkOut}` : '',
          `${nights} לילות`,
          doc.booking_ref ? `אסמכתא: ${doc.booking_ref}` : '',
          ext.address ? `כתובת: ${ext.address}` : '',
        ].filter(Boolean).join('\n'),
        location:    [ext.address, city].filter(Boolean).join(', '),
        dtStart:     checkIn,
        dtEnd:       checkOut || checkIn,
        allDay:      true,
        category:    'hotel',
      })
    }

    else if (doc.doc_type === 'activity') {
      // ── Activity event ─────────────────────────────────────────────────
      const date = ext.date || ext.activity_date || doc.valid_from
      if (!date) continue

      const actName = ext.activity_name || ext.title || doc.name || 'פעילות'
      const time    = ext.start_time    || ext.time  || ''
      const location = ext.location || ext.venue || ext.place || ''

      let dtStart = date
      let dtEnd   = date
      let allDay  = true

      if (time) {
        dtStart = `${date}T${time}:00`
        const endTime = ext.end_time || addHours(time, 2)
        dtEnd   = `${date}T${endTime}:00`
        allDay  = false
      }

      events.push({
        uid:         `activity-${doc.id}`,
        summary:     `🎯 ${actName}`,
        description: [
          time     ? `שעה: ${time}`        : '',
          location ? `מיקום: ${location}` : '',
          doc.booking_ref ? `אסמכתא: ${doc.booking_ref}` : '',
        ].filter(Boolean).join('\n'),
        location,
        dtStart, dtEnd, allDay,
        category: 'activity',
      })
    }

    else if (doc.doc_type === 'ferry') {
      const date   = ext.departure_date || doc.valid_from
      if (!date) continue
      const depCity  = ext.departure_city || ext.from || 'Departure'
      const arrCity  = ext.destination_city || ext.to || 'Arrival'
      const depTime  = ext.departure_time || '00:00'
      const arrTime  = ext.arrival_time   || '03:00'
      const dtStart  = `${date}T${depTime}:00`
      const dtEnd    = `${ext.arrival_date || date}T${arrTime}:00`

      events.push({
        uid:      `ferry-${doc.id}`,
        summary:  `⛴️ מעבורת ${depCity} → ${arrCity}`,
        description: [
          ext.company ? `חברה: ${ext.company}` : '',
          doc.booking_ref ? `אסמכתא: ${doc.booking_ref}` : '',
        ].filter(Boolean).join('\n'),
        location: depCity,
        dtStart, dtEnd,
        allDay:   false,
        category: 'flight',
      })
    }
  }

  // ── Optional: include expenses as all-day reminders ───────────────────────
  if (includeExpenses) {
    for (const exp of expenses) {
      if (!exp.expense_date) continue
      events.push({
        uid:         `expense-${exp.id}`,
        summary:     `💰 ${exp.title}`,
        description: `${exp.amount} ${exp.currency}${exp.notes ? '\n' + exp.notes : ''}`,
        location:    '',
        dtStart:     exp.expense_date,
        dtEnd:       exp.expense_date,
        allDay:      true,
        category:    'expense',
      })
    }
  }

  // Sort by start date
  return events.sort((a, b) => a.dtStart.localeCompare(b.dtStart))
}

/** Add N hours to a HH:MM string, return HH:MM */
function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h + hours
  return `${String(total % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Trigger a browser download of the ICS file */
export function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
