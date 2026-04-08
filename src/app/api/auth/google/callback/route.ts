/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth 2.0 callback from Google.
 * Flow:
 *   1. Exchange authorization code for access + refresh tokens
 *   2. Fetch user's Gmail address from Google userinfo API
 *   3. Get current Supabase session from cookie (or Authorization header)
 *   4. Upsert row in `gmail_connections` table
 *   5. Redirect to /settings?gmail=connected
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID       — OAuth 2.0 client ID
 *   GOOGLE_CLIENT_SECRET   — OAuth 2.0 client secret
 *   NEXT_PUBLIC_APP_URL    — e.g. https://tripix-ruby.vercel.app
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Supabase admin client (bypasses RLS) ──────────────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface GoogleTokenResponse {
  access_token:  string
  refresh_token?: string
  expires_in:    number
  token_type:    string
  error?:        string
  error_description?: string
}

interface GoogleUserInfo {
  email: string
  verified_email: boolean
  name?: string
  picture?: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const failUrl    = `${appUrl}/settings?gmail=error`
  const successUrl = `${appUrl}/settings?gmail=connected`

  // ── Handle user denial ────────────────────────────────────────────────────
  if (error || !code) {
    console.warn('[google/callback] OAuth error or missing code:', error)
    return NextResponse.redirect(failUrl)
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('[google/callback] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
    return NextResponse.redirect(failUrl)
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`

  // ── Exchange code for tokens ──────────────────────────────────────────────
  let tokens: GoogleTokenResponse
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })
    tokens = await tokenRes.json() as GoogleTokenResponse
  } catch (err) {
    console.error('[google/callback] Token exchange failed:', err)
    return NextResponse.redirect(failUrl)
  }

  if (tokens.error || !tokens.access_token) {
    console.error('[google/callback] Token error:', tokens.error, tokens.error_description)
    return NextResponse.redirect(failUrl)
  }

  // ── Get Gmail address from Google userinfo ────────────────────────────────
  let userInfo: GoogleUserInfo
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    userInfo = await userRes.json() as GoogleUserInfo
  } catch (err) {
    console.error('[google/callback] userinfo fetch failed:', err)
    return NextResponse.redirect(failUrl)
  }

  if (!userInfo.email) {
    console.error('[google/callback] No email in userinfo')
    return NextResponse.redirect(failUrl)
  }

  // ── Identify the Tripix user from the session cookie ─────────────────────
  // The browser should already have a Supabase session cookie set.
  // We use the service role client + the JWT from the cookie to resolve user.
  const supabase = adminClient()

  // Try to read the Supabase session token from the cookie
  const cookieHeader = req.headers.get('cookie') || ''
  const sbTokenMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
  let userId: string | null = null

  if (sbTokenMatch) {
    try {
      const cookieValue = decodeURIComponent(sbTokenMatch[1])
      // Cookie may be JSON array ["access_token","refresh_token"] or just the token string
      let accessToken: string
      try {
        const parsed = JSON.parse(cookieValue)
        accessToken = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || cookieValue)
      } catch {
        accessToken = cookieValue
      }
      const { data: { user } } = await supabase.auth.getUser(accessToken)
      userId = user?.id || null
    } catch (err) {
      console.warn('[google/callback] Could not parse session cookie:', err)
    }
  }

  // Fallback: look up user by their primary email matching the Gmail address
  if (!userId) {
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const match = userList?.users?.find(
      u => u.email?.toLowerCase() === userInfo.email.toLowerCase()
    )
    userId = match?.id || null
  }

  if (!userId) {
    console.error('[google/callback] Could not identify Tripix user for Gmail:', userInfo.email)
    return NextResponse.redirect(failUrl)
  }

  // ── Calculate token expiry ────────────────────────────────────────────────
  const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // ── Upsert gmail_connections row ──────────────────────────────────────────
  const { error: dbError } = await supabase
    .from('gmail_connections')
    .upsert(
      {
        user_id:       userId,
        gmail_address: userInfo.email.toLowerCase(),
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry:  expiryDate,
      },
      { onConflict: 'user_id,gmail_address' },
    )

  if (dbError) {
    console.error('[google/callback] DB upsert error:', dbError)
    return NextResponse.redirect(failUrl)
  }

  console.log(`[google/callback] Gmail connected for user ${userId}: ${userInfo.email}`)
  return NextResponse.redirect(successUrl)
}
