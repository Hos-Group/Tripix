/**
 * Tripix Analytics — Mixpanel wrapper
 * Usage: track('trip_created', { destination: 'Thailand' })
 */

import mixpanel from 'mixpanel-browser'

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || ''
let initialized = false

function init() {
  if (initialized || !TOKEN || typeof window === 'undefined') return
  mixpanel.init(TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage',
    ignore_dnt: false,
  })
  initialized = true
}

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  init()
  if (!initialized) return
  mixpanel.identify(userId)
  if (props) mixpanel.people.set(props)
}

export function track(event: string, props?: Record<string, unknown>) {
  init()
  if (!initialized) {
    // In dev without token — just console log
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, props)
    }
    return
  }
  mixpanel.track(event, props)
}

export function resetUser() {
  if (!initialized) return
  mixpanel.reset()
}

// ── Typed event helpers ──────────────────────────────────────────────────────

export const Analytics = {
  // Auth
  signedUp:        (method = 'email') => track('signed_up', { method }),
  signedIn:        (method = 'email') => track('signed_in', { method }),
  signedOut:       ()                  => track('signed_out'),

  // Trips
  tripCreated:     (destination: string, type: string) =>
    track('trip_created', { destination, type }),
  tripSelected:    (destination: string) =>
    track('trip_selected', { destination }),
  tripDeleted:     ()                    => track('trip_deleted'),

  // Pages
  pageViewed:      (page: string)        => track('page_viewed', { page }),

  // Documents
  documentScanned: (type: string)        => track('document_scanned', { type }),
  documentUploaded:(type: string)        => track('document_uploaded', { type }),

  // Gmail
  gmailConnected:  ()                    => track('gmail_connected'),
  gmailImported:   (count: number)       => track('gmail_imported', { count }),

  // Affiliate / Monetisation
  esimClicked:     (country: string)     => track('esim_clicked', { country }),
  insuranceClicked:(country: string)     => track('insurance_clicked', { country }),
  esimPurchased:   (country: string, amount: number) =>
    track('esim_purchased', { country, amount }),

  // Expenses
  expenseAdded:    (currency: string, amount: number) =>
    track('expense_added', { currency, amount }),
}
