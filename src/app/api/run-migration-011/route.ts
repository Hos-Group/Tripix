/**
 * TEMPORARY - ONE-TIME migration runner for gmail_watch columns.
 * Call: GET /api/run-migration-011?secret=MIGRATE_011_2026
 * Delete this file after running.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SECRET = 'MIGRATE_011_2026'

const MIGRATIONS = [
  `ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS history_id TEXT`,
  `ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS watch_expiry TIMESTAMPTZ`,
  `ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS watch_active BOOLEAN DEFAULT FALSE`,
  `CREATE INDEX IF NOT EXISTS gmail_connections_address_idx ON gmail_connections (gmail_address)`,
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const results: { sql: string; ok: boolean; error?: string }[] = []

  for (const sql of MIGRATIONS) {
    // Approach 1: exec_sql RPC
    const { error: rpcError } = await supabase.rpc('exec_sql', { query: sql })
    if (!rpcError) {
      results.push({ sql: sql.slice(0, 80), ok: true })
      continue
    }

    // Approach 2: raw REST call to exec_sql
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      })
      if (res.ok) {
        results.push({ sql: sql.slice(0, 80), ok: true })
        continue
      }
    } catch {
      // ignore
    }

    // Approach 3: pg module with DATABASE_URL env var
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.PG_CONNECTION_STRING
    if (dbUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Client } = require('pg')
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
        await client.connect()
        await client.query(sql)
        await client.end()
        results.push({ sql: sql.slice(0, 80), ok: true })
        continue
      } catch (pgErr: unknown) {
        const errMsg = pgErr instanceof Error ? pgErr.message : String(pgErr)
        results.push({ sql: sql.slice(0, 80), ok: false, error: `pg error: ${errMsg}` })
        continue
      }
    }

    results.push({ sql: sql.slice(0, 80), ok: false, error: `exec_sql not available: ${rpcError?.message}` })
  }

  // Verify: try selecting history_id column
  const { error: verifyError } = await supabase
    .from('gmail_connections')
    .select('history_id')
    .limit(0)
  const verified = !verifyError

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: failed.length,
    verified,
    verify_error: verifyError?.message,
    results,
    note: failed.length === 0
      ? 'Migration 011 complete!'
      : 'Some statements failed - may need manual SQL editor run',
  })
}
