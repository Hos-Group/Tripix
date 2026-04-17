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
import { registerGmailWatch } from '@/lib/gmailClient'

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
  const state = searchParams.get('state') || ''

  // Decode the state payload we set in /api/auth/google
  let stateToken = ''
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    stateToken = decoded?.token || ''
  } catch { /* state might be missing or malformed */ }

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

  const supabase = adminClient()
  let userId: string | null = null

  // ── 1. Try the token from OAuth state (most reliable — works on iOS PWA) ──
  if (stateToken) {
    try {
      const { data: { user } } = await supabase.auth.getUser(stateToken)
      userId = user?.id || null
      if (userId) console.log('[google/callback] User identified via state token')
    } catch (err) {
      console.warn('[google/callback] State token invalid:', err)
    }
  }

  // ── 2. Fallback: try session cookie (works in desktop browsers) ───────────
  if (!userId) {
    const cookieHeader = req.headers.get('cookie') || ''
    // Supabase may split large tokens into chunks (.0, .1 …) — join them first
    const chunkKeys = cookieHeader.match(/sb-[^=]+-auth-token\.\d+=/g) || []
    let accessToken = ''
    if (chunkKeys.length > 0) {
      // Multi-chunk token: collect chunks in order
      const sorted = chunkKeys.sort()
      for (const key of sorted) {
        const rx = new RegExp(key.replace('.', '\\.') + '([^;]+)')
        const m = cookieHeader.match(rx)
        if (m) accessToken += decodeURIComponent(m[1])
      }
    } else {
      // Single-cookie token
      const m = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
      if (m) {
        const raw = decodeURIComponent(m[1])
        try {
          const parsed = JSON.parse(raw)
          accessToken = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || raw)
        } catch { accessToken = raw }
      }
    }
    if (accessToken) {
      try {
        const { data: { user } } = await supabase.auth.getUser(accessToken)
        userId = user?.id || null
        if (userId) console.log('[google/callback] User identified via cookie')
      } catch (err) {
        console.warn('[google/callback] Cookie token invalid:', err)
      }
    }
  }

  // ── 3. Last fallback: match by email ─────────────────────────────────────
  if (!userId) {
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const match = userList?.users?.find(
      u => u.email?.toLowerCase() === userInfo.email.toLowerCase()
    )
    userId = match?.id || null
    if (userId) console.log('[google/callback] User identified via email match')
  }

  if (!userId) {
    console.error('[google/callback] Could not identify Tripix user for Gmail:', userInfo.email)
    return NextResponse.redirect(failUrl)
  }

  // ── Calculate token expiry ────────────────────────────────────────────────
  const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // ── Save gmail_connections row (update if exists, insert if not) ─────────
  const gmailAddress = userInfo.email.toLowerCase()
  const rowData = {
    user_id:       userId,
    gmail_address: gmailAddress,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_expiry:  expiryDate,
  }

  // Check if a row already exists for this user+email combo
  const { data: existing } = await supabase
    .from('gmail_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('gmail_address', gmailAddress)
    .maybeSingle()

  let dbError
  if (existing?.id) {
    // Row exists → update tokens + clear any reauth flag
    const { error } = await supabase
      .from('gmail_connections')
      .update({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry:  expiryDate,
        needs_reauth:  false,
      })
      .eq('id', existing.id)
    dbError = error
  } else {
    // No row → insert fresh
    const { error } = await supabase
      .from('gmail_connections')
      .insert(rowData)
    dbError = error
  }

  if (dbError) {
    console.error('[google/callback] DB save error:', dbError)
    return NextResponse.redirect(failUrl)
  }

  console.log(`[google/callback] Gmail connected for user ${userId}: ${userInfo.email}`)

  // ── Register Gmail push notifications (real-time sync) ───────────────────
  // If GMAIL_PUBSUB_TOPIC is configured, register a watch so new emails trigger
  // an immediate webhook call instead of waiting for the daily cron scan.
  if (process.env.GMAIL_PUBSUB_TOPIC) {
    try {
      const watchResult = await registerGmailWatch(tokens.access_token)
      const expiresAt   = new Date(Number(watchResult.expiration)).toISOString()

      await supabase
        .from('gmail_connections')
        .update({
          history_id:   watchResult.historyId,
          watch_expiry: expiresAt,
          watch_active: true,
        })
        .eq('user_id', userId)
        .eq('gmail_address', gmailAddress)

      console.log(
        `[google/callback] Gmail watch registered for ${gmailAddress}: ` +
        `historyId=${watchResult.historyId}, expires=${expiresAt}`,
      )
    } catch (watchErr) {
      // Non-fatal — daily cron will still scan
      console.warn('[google/callback] Watch registration failed (non-fatal):', watchErr)
    }
  }

  return NextResponse.redirect(successUrl)
}
