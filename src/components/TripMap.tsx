'use client'

/**
 * TripMap — Leaflet/CartoDB interactive trip map.
 * Loaded dynamically (no SSR) because Leaflet requires window.
 *
 * Shows:
 *  ✈️  Departure / Arrival markers with numbered sequence badges
 *  🔀  Connection indicators when 2+ flights on same day
 *  🏨  Hotel markers (rounded-square) with sequence numbers
 *  🚗  Car rental pickup / dropoff markers connected by dashed line
 *  〰  Curved arc lines between flight origin and destination
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface FlightMarker {
  id:          string
  type:        'departure' | 'arrival' | 'connection'
  coords:      [number, number]
  flightNo:    string
  airline:     string
  depCity:     string
  arrCity:     string
  depTime:     string
  arrTime:     string
  date:        string
  seqNum?:     number
  isConnection?: boolean
}

interface FlightPath {
  id:          string
  from:        [number, number]
  to:          [number, number]
  flightNo:    string
  isConnection?: boolean
}

interface HotelMarker {
  id:          string
  coords:      [number, number]
  name:        string
  checkIn:     string
  checkOut:    string
  nights:      number
  seqNum?:     number
}

interface CarRentalMarker {
  id:              string
  pickupCoords:    [number, number] | null
  dropoffCoords:   [number, number] | null
  company:         string
  carType:         string
  pickupDate:      string
  dropoffDate:     string
  pickupLocation:  string
  dropoffLocation: string
  pickupSeqNum?:   number
  dropoffSeqNum?:  number
}

interface Props {
  flights:    FlightMarker[]
  paths:      FlightPath[]
  hotels:     HotelMarker[]
  carRentals: CarRentalMarker[]
}

// ── Curved great-circle arc ──────────────────────────────────────────────────
function arcPoints(from: [number, number], to: [number, number], steps = 40): [number, number][] {
  const [lat1, lng1] = from.map(x => x * Math.PI / 180)
  const [lat2, lng2] = to.map(x => x * Math.PI / 180)

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
  ))

  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const f  = i / steps
    const A  = Math.sin((1 - f) * d) / Math.sin(d)
    const B  = Math.sin(f * d) / Math.sin(d)
    const x  = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
    const y  = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
    const z  = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lt = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)) * 180 / Math.PI
    const lg = Math.atan2(y, x) * 180 / Math.PI
    points.push([lt, lg])
  }
  return points
}

// ── Sequence badge HTML ──────────────────────────────────────────────────────
function seqBadge(num?: number): string {
  if (!num) return ''
  return `<div style="
    position:absolute;top:-7px;left:-7px;
    background:#111;color:white;
    font-size:9px;font-weight:800;
    border-radius:99px;
    width:16px;height:16px;
    display:flex;align-items:center;justify-content:center;
    border:1.5px solid white;
    line-height:1;
  ">${num}</div>`
}

// ── Custom DivIcon helpers ───────────────────────────────────────────────────

function flightIcon(type: 'departure' | 'arrival', isConnection = false, seqNum?: number) {
  const bg    = type === 'departure' ? '#2563EB' : '#059669'
  const emoji = type === 'departure' ? '↗️' : '↘️'
  const size  = isConnection ? 32 : 36
  const badge = isConnection
    ? `<div style="position:absolute;top:-6px;right:-6px;background:#F59E0B;color:white;font-size:8px;border-radius:99px;padding:1px 4px;font-weight:700;line-height:1.4">CNX</div>`
    : ''

  return L.divIcon({
    className: '',
    iconSize:  [size, size],
    iconAnchor:[size / 2, size / 2],
    html: `
      <div style="
        position:relative;
        width:${size}px;height:${size}px;
        background:${bg};
        border-radius:50%;
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:${size * 0.42}px;
        cursor:pointer;
      ">
        ${emoji}
        ${badge}
        ${seqBadge(seqNum)}
      </div>`,
  })
}

function hotelIcon(seqNum?: number) {
  return L.divIcon({
    className: '',
    iconSize:  [36, 36],
    iconAnchor:[18, 18],
    html: `
      <div style="
        position:relative;
        width:36px;height:36px;
        background:#7C3AED;
        border-radius:8px;
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;
        cursor:pointer;
      ">🏨${seqBadge(seqNum)}</div>`,
  })
}

function carRentalIcon(kind: 'pickup' | 'dropoff', seqNum?: number) {
  const bg = kind === 'pickup' ? '#EA580C' : '#C2410C'
  const label = kind === 'pickup' ? 'P' : 'D'
  return L.divIcon({
    className: '',
    iconSize:  [36, 36],
    iconAnchor:[18, 18],
    html: `
      <div style="
        position:relative;
        width:36px;height:36px;
        background:${bg};
        border-radius:8px;
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        cursor:pointer;
      ">
        <span style="font-size:14px;line-height:1;">🚗</span>
        <span style="font-size:7px;color:white;font-weight:700;line-height:1;">${label}</span>
        ${seqBadge(seqNum)}
      </div>`,
  })
}

// ── Format helpers ──────────────────────────────────────────────────────────
function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TripMap({ flights, paths, hotels, carRentals }: Props) {
  const mapRef       = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // ── Init map ────────────────────────────────────────────────────────
    const map = L.map(containerRef.current, {
      zoomControl:        true,
      attributionControl: true,
    })
    mapRef.current = map

    // CartoDB Positron — light, clean, professional
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    const allPoints: L.LatLngTuple[] = []

    // ── Flight arc paths ────────────────────────────────────────────────
    for (const path of paths) {
      const pts   = arcPoints(path.from, path.to)
      const color = path.isConnection ? '#F59E0B' : '#2563EB'
      L.polyline(pts, {
        color,
        weight:    3,
        opacity:   0.8,
        dashArray: path.isConnection ? '6 4' : undefined,
      }).addTo(map)
      allPoints.push(path.from, path.to)
    }

    // ── Flight markers ──────────────────────────────────────────────────
    for (const f of flights) {
      const icon = flightIcon(f.type as 'departure' | 'arrival', f.isConnection, f.seqNum)

      const typeLabel = f.type === 'departure' ? `🛫 המראה — ${f.depCity}` : `🛬 נחיתה — ${f.arrCity}`
      const connBadge = f.isConnection
        ? `<div style="background:#F59E0B;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-bottom:4px;font-weight:600;">🔀 קונקשין</div>`
        : ''
      const seqLine = f.seqNum
        ? `<div style="font-size:10px;color:#6B7280;font-weight:600;margin-bottom:2px;">תחנה #${f.seqNum}</div>`
        : ''

      const popup = L.popup({
        closeButton: false,
        className:   'trip-popup',
        offset:      [0, -18],
        maxWidth:    200,
      }).setContent(`
        <div dir="rtl" style="font-family:-apple-system,sans-serif;min-width:160px;">
          ${connBadge}
          ${seqLine}
          <div style="font-size:13px;font-weight:700;margin-bottom:2px;">${f.flightNo}</div>
          <div style="font-size:11px;color:#555;margin-bottom:4px;">${f.airline}</div>
          <div style="font-size:12px;font-weight:600;color:#1D4ED8;">${typeLabel}</div>
          <div style="font-size:11px;color:#555;margin-top:2px;">${f.depCity} → ${f.arrCity}</div>
          ${f.depTime ? `<div style="font-size:11px;color:#777;margin-top:2px;">🕐 המראה: ${f.depTime}</div>` : ''}
          ${f.arrTime ? `<div style="font-size:11px;color:#777;">🕐 נחיתה: ${f.arrTime}</div>` : ''}
          <div style="font-size:10px;color:#999;margin-top:3px;">${fmtDate(f.date)}</div>
        </div>
      `)

      const marker = L.marker(f.coords, { icon }).addTo(map).bindPopup(popup)
      marker.on('mouseover', () => marker.openPopup())
      marker.on('mouseout',  () => setTimeout(() => marker.closePopup(), 300))
      allPoints.push(f.coords)
    }

    // ── Hotel markers ───────────────────────────────────────────────────
    for (const h of hotels) {
      const icon = hotelIcon(h.seqNum)
      const seqLine = h.seqNum
        ? `<div style="font-size:10px;color:#6B7280;font-weight:600;margin-bottom:2px;">תחנה #${h.seqNum}</div>`
        : ''

      const popup = L.popup({
        closeButton: false,
        className:   'trip-popup',
        offset:      [0, -18],
        maxWidth:    200,
      }).setContent(`
        <div dir="rtl" style="font-family:-apple-system,sans-serif;min-width:160px;">
          ${seqLine}
          <div style="font-size:13px;font-weight:700;margin-bottom:4px;">🏨 ${h.name}</div>
          <div style="font-size:11px;color:#555;">
            <span style="color:#059669;font-weight:600;">צ׳ק אין:</span> ${fmtDate(h.checkIn)}
          </div>
          <div style="font-size:11px;color:#555;margin-top:1px;">
            <span style="color:#DC2626;font-weight:600;">צ׳ק אאוט:</span> ${fmtDate(h.checkOut)}
          </div>
          ${h.nights > 0 ? `<div style="font-size:11px;color:#777;margin-top:3px;">🌙 ${h.nights} לילות</div>` : ''}
        </div>
      `)

      const marker = L.marker(h.coords, { icon }).addTo(map).bindPopup(popup)
      marker.on('mouseover', () => marker.openPopup())
      marker.on('mouseout',  () => setTimeout(() => marker.closePopup(), 300))
      allPoints.push(h.coords)
    }

    // ── Car rental markers ──────────────────────────────────────────────
    for (const c of carRentals) {
      // Dashed connecting line between pickup and dropoff
      if (c.pickupCoords && c.dropoffCoords) {
        const same = c.pickupCoords[0] === c.dropoffCoords[0] && c.pickupCoords[1] === c.dropoffCoords[1]
        if (!same) {
          L.polyline([c.pickupCoords, c.dropoffCoords], {
            color:     '#EA580C',
            weight:    2,
            opacity:   0.6,
            dashArray: '8 5',
          }).addTo(map)
        }
      }

      const companyLine = c.company ? `<div style="font-size:11px;color:#555;margin-bottom:2px;">🏢 ${c.company}</div>` : ''
      const carTypeLine = c.carType ? `<div style="font-size:11px;color:#555;margin-bottom:4px;">🚗 ${c.carType}</div>` : ''

      if (c.pickupCoords) {
        const icon = carRentalIcon('pickup', c.pickupSeqNum)
        const seqLine = c.pickupSeqNum
          ? `<div style="font-size:10px;color:#6B7280;font-weight:600;margin-bottom:2px;">תחנה #${c.pickupSeqNum}</div>`
          : ''
        const popup = L.popup({
          closeButton: false,
          className:   'trip-popup',
          offset:      [0, -18],
          maxWidth:    220,
        }).setContent(`
          <div dir="rtl" style="font-family:-apple-system,sans-serif;min-width:160px;">
            ${seqLine}
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">🚗 איסוף רכב</div>
            ${companyLine}${carTypeLine}
            <div style="font-size:11px;color:#555;">
              <span style="color:#059669;font-weight:600;">מיקום:</span> ${c.pickupLocation}
            </div>
            <div style="font-size:10px;color:#999;margin-top:3px;">${fmtDate(c.pickupDate)}</div>
          </div>
        `)
        const marker = L.marker(c.pickupCoords, { icon }).addTo(map).bindPopup(popup)
        marker.on('mouseover', () => marker.openPopup())
        marker.on('mouseout',  () => setTimeout(() => marker.closePopup(), 300))
        allPoints.push(c.pickupCoords)
      }

      if (c.dropoffCoords) {
        const sameAsPickup = c.pickupCoords &&
          c.pickupCoords[0] === c.dropoffCoords[0] &&
          c.pickupCoords[1] === c.dropoffCoords[1]
        if (!sameAsPickup) {
          const icon = carRentalIcon('dropoff', c.dropoffSeqNum)
          const seqLine = c.dropoffSeqNum
            ? `<div style="font-size:10px;color:#6B7280;font-weight:600;margin-bottom:2px;">תחנה #${c.dropoffSeqNum}</div>`
            : ''
          const popup = L.popup({
            closeButton: false,
            className:   'trip-popup',
            offset:      [0, -18],
            maxWidth:    220,
          }).setContent(`
            <div dir="rtl" style="font-family:-apple-system,sans-serif;min-width:160px;">
              ${seqLine}
              <div style="font-size:13px;font-weight:700;margin-bottom:4px;">🚗 החזרת רכב</div>
              ${companyLine}${carTypeLine}
              <div style="font-size:11px;color:#555;">
                <span style="color:#DC2626;font-weight:600;">מיקום:</span> ${c.dropoffLocation}
              </div>
              <div style="font-size:10px;color:#999;margin-top:3px;">${fmtDate(c.dropoffDate)}</div>
            </div>
          `)
          const marker = L.marker(c.dropoffCoords, { icon }).addTo(map).bindPopup(popup)
          marker.on('mouseover', () => marker.openPopup())
          marker.on('mouseout',  () => setTimeout(() => marker.closePopup(), 300))
          allPoints.push(c.dropoffCoords)
        }
      }
    }

    // ── Fit map to all markers ──────────────────────────────────────────
    if (allPoints.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: 10 })
      } catch {
        map.setView([20, 50], 3)
      }
    } else {
      map.setView([20, 50], 3)
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [flights, paths, hotels, carRentals])

  return (
    <>
      {/* Inject popup styles */}
      <style>{`
        .trip-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.18);
          border: 1px solid rgba(0,0,0,0.06);
          padding: 0;
        }
        .trip-popup .leaflet-popup-content {
          margin: 10px 12px;
        }
        .trip-popup .leaflet-popup-tip-container {
          display: none;
        }
        .leaflet-control-attribution {
          font-size: 9px !important;
        }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
