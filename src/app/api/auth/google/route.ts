/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth 2.0 flow with gmail.readonly scope.
 * Redirects the user to Google's consent screen.
 *
 * Optional query params:
 *   hint — email address to pre-select on Google's account chooser
 *           e.g. /api/auth/google?hint=personal@gmail.com
 *           Passed to Google as `login_hint`, so the correct account
 *           is highlighted automatically.
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID       — OAuth 2.0 client ID from Google Cloud Console
 *   NEXT_PUBLIC_APP_URL    — e.g. https://tripix-ruby.vercel.app
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/google/callback`

  const hint  = req.nextUrl.searchParams.get('hint')?.trim()  || ''
  // Supabase access token passed from client — carry it through the OAuth round-trip
  // so the callback can identify the user even when cookies are missing (iOS PWA, new-tab)
  const token = req.nextUrl.searchParams.get('token')?.trim() || ''

  // Encode state as base64url JSON: { token, hint }
  const statePayload = Buffer.from(JSON.stringify({ token, hint })).toString('base64url')

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    // Only request non-restricted scopes so ANY user can connect (no 403 in Testing mode).
    // gmail.readonly is a Restricted scope that blocks non-test-users in Testing mode.
    // We verify Gmail ownership here; actual email processing uses the forwarding inbox.
    scope:         'https://www.googleapis.com/auth/userinfo.email openid',
    state:         statePayload,
  })

  if (hint) params.set('login_hint', hint)

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  )
}
