/**
 * GET /api/auth/microsoft/callback
 *
 * Handles the OAuth 2.0 callback from Microsoft.
 * Flow:
 *   1. Exchange authorization code for access + refresh tokens
 *   2. Fetch user's email from Microsoft Graph /me
 *   3. Get current Supabase session (from state token or cookie)
 *   4. Upsert row in `microsoft_connections` table
 *   5. Redirect to /settings?microsoft=connected
 *
 * Required environment variables:
 *   MICROSOFT_CLIENT_ID
 *   MICROSOFT_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface MicrosoftTokenResponse {
  access_token:  string
  refresh_token?: string
  expires_in:    number
  token_type:    string
  error?:        string
  error_description?: string
}

interface MicrosoftUser {
  mail?:                string
  userPrincipalName?:   string
  displayName?:         string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state') || ''

  // Decode state
  let stateToken = ''
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    stateToken = decoded?.token || ''
  } catch { /* state might be missing or malformed */ }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const failUrl    = `${appUrl}/settings?microsoft=error`
  const successUrl = `${appUrl}/settings?microsoft=connected`

  if (error || !code) {
    console.warn('[microsoft/callback] OAuth error:', error)
    return NextResponse.redirect(failUrl)
  }

  const clientId     = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('[microsoft/callback] Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET')
    return NextResponse.redirect(failUrl)
  }

  const redirectUri = `${appUrl}/api/auth/microsoft/callback`

  // ── Exchange code for tokens ──────────────────────────────────────────────
  let tokens: MicrosoftTokenResponse
  try {
    const tokenRes = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          code,
          client_id:     clientId,
          client_secret: clientSecret,
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
          scope:         'offline_access Mail.Read User.Read',
        }),
      },
    )
    tokens = await tokenRes.json() as MicrosoftTokenResponse
  } catch (err) {
    console.error('[microsoft/callback] Token exchange failed:', err)
    return NextResponse.redirect(failUrl)
  }

  if (tokens.error || !tokens.access_token) {
    console.error('[microsoft/callback] Token error:', tokens.error, tokens.error_description)
    return NextResponse.redirect(failUrl)
  }

  // ── Get email from Microsoft Graph /me ─────────────────────────────────────
  let msUser: MicrosoftUser
  try {
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    msUser = await userRes.json() as MicrosoftUser
  } catch (err) {
    console.error('[microsoft/callback] Graph /me failed:', err)
    return NextResponse.redirect(failUrl)
  }

  const email = msUser.mail || msUser.userPrincipalName || ''
  if (!email) {
    console.error('[microsoft/callback] No email in Microsoft user info')
    return NextResponse.redirect(failUrl)
  }

  const supabase = adminClient()
  let userId: string | null = null

  // ── 1. Try state token (most reliable) ───────────────────────────────────
  if (stateToken) {
    try {
      const { data: { user } } = await supabase.auth.getUser(stateToken)
      userId = user?.id || null
      if (userId) console.log('[microsoft/callback] User identified via state token')
    } catch { /* ignore */ }
  }

  // ── 2. Cookie fallback ────────────────────────────────────────────────────
  if (!userId) {
    const cookieHeader = req.headers.get('cookie') || ''
    const chunkKeys = cookieHeader.match(/sb-[^=]+-auth-token\.\d+=/g) || []
    let accessToken = ''
    if (chunkKeys.length > 0) {
      const sorted = chunkKeys.sort()
      for (const key of sorted) {
        const rx = new RegExp(key.replace('.', '\\.') + '([^;]+)')
        const m = cookieHeader.match(rx)
        if (m) accessToken += decodeURIComponent(m[1])
      }
    } else {
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
        if (userId) console.log('[microsoft/callback] User identified via cookie')
      } catch { /* ignore */ }
    }
  }

  // ── 3. Email match fallback ───────────────────────────────────────────────
  if (!userId) {
    const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const match = userList?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )
    userId = match?.id || null
    if (userId) console.log('[microsoft/callback] User identified via email match')
  }

  if (!userId) {
    console.error('[microsoft/callback] Could not identify Tripix user for:', email)
    return NextResponse.redirect(failUrl)
  }

  const expiryDate  = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const emailNormal = email.toLowerCase()

  // ── Upsert microsoft_connections ─────────────────────────────────────────
  const { data: existing } = await supabase
    .from('microsoft_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('email', emailNormal)
    .maybeSingle()

  let dbError
  if (existing?.id) {
    const { error } = await supabase
      .from('microsoft_connections')
      .update({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry:  expiryDate,
        needs_reauth:  false,
      })
      .eq('id', existing.id)
    dbError = error
  } else {
    const { error } = await supabase
      .from('microsoft_connections')
      .insert({
        user_id:       userId,
        email:         emailNormal,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expiry:  expiryDate,
        needs_reauth:  false,
      })
    dbError = error
  }

  if (dbError) {
    console.error('[microsoft/callback] DB save error:', dbError)
    return NextResponse.redirect(failUrl)
  }

  console.log(`[microsoft/callback] Microsoft connected for user ${userId}: ${email}`)
  return NextResponse.redirect(successUrl)
}
