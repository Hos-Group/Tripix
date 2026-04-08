/**
 * Server-side signup route.
 * Runs on Vercel — NOT in the browser.
 * Uses the Admin SDK (service role key) to:
 *   1. Create the user
 *   2. Confirm the email immediately (no confirmation email required)
 *   3. Return success so the client can sign in right away
 *
 * The SUPABASE_SERVICE_ROLE_KEY is a SERVER-ONLY secret and is never
 * exposed to the browser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, fullName } = body as {
      email: string
      password: string
      fullName: string
    }

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'יש למלא את כל השדות' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'הסיסמא חייבת להכיל לפחות 6 תווים' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'כתובת האימייל אינה תקינה' }, { status: 400 })
    }

    // ── Admin Supabase client (server-side only) ───────────────────────────────
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Create user with email_confirm: true ──────────────────────────────────
    // This bypasses the email confirmation flow entirely.
    // The user is immediately active and can sign in.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    })

    if (error) {
      // Friendly Hebrew messages for common errors
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('user already')
      ) {
        return NextResponse.json(
          { error: 'כתובת האימייל כבר רשומה. נסה להתחבר.' },
          { status: 409 },
        )
      }
      console.error('[signup route] Supabase error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err) {
    console.error('[signup route] Unexpected error:', err)
    return NextResponse.json({ error: 'שגיאת שרת — נסה שוב' }, { status: 500 })
  }
}
