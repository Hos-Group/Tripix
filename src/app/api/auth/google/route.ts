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

  // Optional email hint — pre-selects the account on Google's chooser
  const hint = req.nextUrl.searchParams.get('hint')?.trim() || ''

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type:   'offline',
    prompt:        'consent',
  })

  // login_hint tells Google to skip the account chooser (or pre-select the account)
  if (hint) params.set('login_hint', hint)

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  )
}
