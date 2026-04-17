/**
 * GET /api/auth/microsoft
 *
 * Starts the Microsoft OAuth 2.0 flow for Outlook / Hotmail / Live mail.
 *
 * Flow:
 *   1. Build Microsoft authorization URL with required scopes
 *   2. Embed Supabase access token in state (for user identification on callback)
 *   3. Redirect browser to Microsoft login
 *
 * Required environment variables:
 *   MICROSOFT_CLIENT_ID       — Azure App Registration client ID
 *   NEXT_PUBLIC_APP_URL       — e.g. https://tripix-ruby.vercel.app
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hint  = searchParams.get('hint')  || ''  // email hint for account pre-selection
  const token = searchParams.get('token') || ''  // Supabase access token

  const clientId  = process.env.MICROSOFT_CLIENT_ID
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!clientId) {
    console.error('[auth/microsoft] MICROSOFT_CLIENT_ID not configured')
    return NextResponse.redirect(`${appUrl}/settings?microsoft=error`)
  }

  const redirectUri = `${appUrl}/api/auth/microsoft/callback`

  // State: base64url-encoded JSON with CSRF token + Supabase token
  const statePayload = JSON.stringify({ token, ts: Date.now() })
  const state = Buffer.from(statePayload).toString('base64url')

  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    redirect_uri:  redirectUri,
    response_mode: 'query',
    scope:         'offline_access Mail.Read User.Read',
    state,
    prompt:        'select_account',   // always show account chooser
  })

  // Pre-select account if hint provided
  if (hint) params.set('login_hint', hint)

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  return NextResponse.redirect(authUrl)
}
