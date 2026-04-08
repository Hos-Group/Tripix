/**
 * GET /api/email-aliases/verify?token=...
 *
 * Called when user clicks the verification link in their email.
 * Marks the alias as verified and redirects to the app.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tripix-ruby.vercel.app'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/settings?verify=invalid`)
  }

  const supabase = adminClient()

  // Find alias with this token
  const { data: alias } = await supabase
    .from('user_email_aliases')
    .select('id, email, token_expires_at, verified')
    .eq('verification_token', token)
    .single()

  if (!alias) {
    return NextResponse.redirect(`${APP_URL}/settings?verify=notfound`)
  }

  if (alias.verified) {
    // Already verified — just redirect
    return NextResponse.redirect(`${APP_URL}/settings?verify=already&email=${encodeURIComponent(alias.email)}`)
  }

  // Check expiry
  if (alias.token_expires_at && new Date(alias.token_expires_at) < new Date()) {
    return NextResponse.redirect(`${APP_URL}/settings?verify=expired`)
  }

  // Mark as verified
  await supabase
    .from('user_email_aliases')
    .update({
      verified:            true,
      verification_token:  null,
      token_expires_at:    null,
    })
    .eq('id', alias.id)

  return NextResponse.redirect(
    `${APP_URL}/settings?verify=success&email=${encodeURIComponent(alias.email)}`,
  )
}
