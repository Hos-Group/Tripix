import { redirect } from 'next/navigation'

/**
 * Root route — sends every visitor straight into the app.
 *
 * Why a server-side redirect (and not the marketing landing page that used
 * to live here)?
 *  1. Returning users land on their data instantly, no extra hop.
 *  2. New users hit /auth/login (the AuthProvider catches them and
 *     redirects automatically — see `PUBLIC_PATHS` in AuthContext).
 *  3. The marketing page is preserved at /landing for when we want it.
 *
 * No client JS, no flash of marketing content — just an HTTP redirect.
 */
export default function RootPage() {
  redirect('/dashboard')
}
