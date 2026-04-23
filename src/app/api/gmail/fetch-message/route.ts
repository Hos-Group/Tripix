/**
 * POST /api/gmail/fetch-message
 *
 * Fetch the raw HTML + metadata of an email by its provider message ID,
 * so the client can render it inside the app instead of sending the user
 * out to Gmail Web.
 *
 * Body:  { gmail_message_id: string }   // "<id>" for Gmail, "ms_<id>" for Outlook
 * Returns:
 *   200 — { html, subject, from, date, provider: 'gmail' | 'microsoft' }
 *   401 — not authenticated
 *   404 — message not found across any connected account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken, getEmailBody, getMessageMetadata } from '@/lib/gmailClient'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

interface GmailConnection {
  id:            string
  user_id:       string
  gmail_address: string
  access_token:  string | null
  refresh_token: string | null
  token_expiry:  string | null
}

interface MicrosoftConnection {
  id:            string
  user_id:       string
  email:         string
  access_token:  string | null
  refresh_token: string | null
  token_expiry:  string | null
}

// ── Gmail helpers ─────────────────────────────────────────────────────────────

async function ensureGmailAccessToken(c: GmailConnection, supabase: ReturnType<typeof adminClient>): Promise<string | null> {
  const expiry = c.token_expiry ? new Date(c.token_expiry).getTime() : 0
  const isExpired = !c.access_token || expiry < Date.now() + 60_000
  if (!isExpired) return c.access_token
  if (!c.refresh_token) return null

  try {
    const newToken = await refreshAccessToken(c.refresh_token)
    await supabase.from('gmail_connections').update({
      access_token: newToken,
      token_expiry: new Date(Date.now() + 3500_000).toISOString(),
    }).eq('id', c.id)
    return newToken
  } catch {
    return null
  }
}

async function fetchGmailMessage(
  supabase: ReturnType<typeof adminClient>,
  userId:   string,
  gmailId:  string,
): Promise<{ html: string; subject: string; from: string; date: string } | null> {
  const { data: conns } = await supabase
    .from('gmail_connections')
    .select('id, user_id, gmail_address, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)

  if (!conns?.length) return null

  for (const c of conns as GmailConnection[]) {
    const token = await ensureGmailAccessToken(c, supabase)
    if (!token) continue
    try {
      const [html, meta] = await Promise.all([
        getEmailBody(token, gmailId),
        getMessageMetadata(token, gmailId),
      ])
      if (!html && !meta) continue
      return {
        html:    html || '',
        subject: meta?.subject || '',
        from:    meta?.from    || '',
        date:    meta?.date    || '',
      }
    } catch {
      continue    // try next connection
    }
  }
  return null
}

// ── Microsoft Graph helpers ───────────────────────────────────────────────────

async function refreshMicrosoftToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope:         'offline_access Mail.Read User.Read',
      }),
    })
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

async function fetchMicrosoftMessage(
  supabase: ReturnType<typeof adminClient>,
  userId:   string,
  msgId:    string,
): Promise<{ html: string; subject: string; from: string; date: string } | null> {
  const { data: conns } = await supabase
    .from('microsoft_connections')
    .select('id, user_id, email, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)

  if (!conns?.length) return null

  for (const c of conns as MicrosoftConnection[]) {
    let token = c.access_token
    const expired = !token || (c.token_expiry && new Date(c.token_expiry).getTime() < Date.now() + 60_000)
    if (expired && c.refresh_token) {
      token = await refreshMicrosoftToken(c.refresh_token)
      if (token) {
        await supabase.from('microsoft_connections').update({
          access_token: token,
          token_expiry: new Date(Date.now() + 3500_000).toISOString(),
        }).eq('id', c.id)
      }
    }
    if (!token) continue

    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${msgId}?$select=subject,from,receivedDateTime,body`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) continue
      const msg = await res.json() as {
        subject?: string
        from?: { emailAddress?: { address?: string; name?: string } }
        receivedDateTime?: string
        body?: { contentType?: string; content?: string }
      }
      const html =
        msg.body?.contentType === 'html' ? (msg.body.content || '')
        : `<pre style="white-space:pre-wrap;font-family:sans-serif;padding:16px">${
            (msg.body?.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          }</pre>`
      return {
        html,
        subject: msg.subject || '',
        from:    msg.from?.emailAddress?.address || msg.from?.emailAddress?.name || '',
        date:    msg.receivedDateTime || '',
      }
    } catch {
      continue
    }
  }
  return null
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authHeader  = req.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!bearerToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerToken)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rawId: string
  try {
    const body = await req.json() as { gmail_message_id?: string }
    rawId = (body.gmail_message_id || '').trim()
  } catch {
    return NextResponse.json({ error: 'גוף הבקשה אינו תקין' }, { status: 400 })
  }
  if (!rawId) return NextResponse.json({ error: 'חסר gmail_message_id' }, { status: 400 })

  const isMicrosoft = rawId.startsWith('ms_')
  const providerId  = isMicrosoft ? rawId.slice(3) : rawId
  const provider    = isMicrosoft ? 'microsoft' : 'gmail'

  const result = isMicrosoft
    ? await fetchMicrosoftMessage(supabase, user.id, providerId)
    : await fetchGmailMessage(supabase, user.id, providerId)

  if (!result) {
    return NextResponse.json(
      { error: 'לא הצלחנו למשוך את המייל — ייתכן שהחיבור פג תוקף' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ...result, provider })
}
