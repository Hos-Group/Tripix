import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if admin already exists
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
  const adminExists = existing?.users?.some(u => u.email === 'info@homega3d.com')

  if (adminExists) {
    return NextResponse.json({ message: 'Admin already exists' })
  }

  // Create admin user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'info@homega3d.com',
    password: 'Halevy3125',
    email_confirm: true,
    user_metadata: { full_name: 'Omer Halevy' },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Admin created', userId: data.user.id })
}
