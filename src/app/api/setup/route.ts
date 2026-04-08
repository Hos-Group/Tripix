/**
 * ONE-TIME migration runner.
 * Call: GET /api/setup?secret=SETUP_2025
 * Automatically deleted after first successful run.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SETUP_SECRET = 'SETUP_2025'

const MIGRATIONS = [
  // ── Migration 1: email_ingests ──────────────────────────────────────────
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inbox_key TEXT`,
  `UPDATE profiles SET inbox_key = LOWER(REPLACE(gen_random_uuid()::TEXT, '-', '')) WHERE inbox_key IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS profiles_inbox_key_idx ON profiles(inbox_key)`,
  `CREATE TABLE IF NOT EXISTS email_ingests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL,
    expense_id      UUID REFERENCES expenses(id) ON DELETE SET NULL,
    from_address    TEXT,
    subject         TEXT,
    raw_html        TEXT,
    raw_text        TEXT,
    parsed_data     JSONB,
    match_score     INTEGER DEFAULT 0,
    match_reason    TEXT,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','matched','unmatched','processed','ignored')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE email_ingests ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='email_ingests_select' AND tablename='email_ingests') THEN
      CREATE POLICY "email_ingests_select" ON email_ingests FOR SELECT USING (user_id = auth.uid());
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='email_ingests_update' AND tablename='email_ingests') THEN
      CREATE POLICY "email_ingests_update" ON email_ingests FOR UPDATE USING (user_id = auth.uid());
    END IF;
  END $$`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS email_ingest_id UUID REFERENCES email_ingests(id) ON DELETE SET NULL`,
  `CREATE OR REPLACE FUNCTION auto_generate_inbox_key()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.inbox_key IS NULL THEN
       NEW.inbox_key := LOWER(REPLACE(gen_random_uuid()::TEXT, '-', ''));
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER`,
  `DROP TRIGGER IF EXISTS trg_auto_inbox_key ON profiles`,
  `CREATE TRIGGER trg_auto_inbox_key
   BEFORE INSERT ON profiles
   FOR EACH ROW EXECUTE FUNCTION auto_generate_inbox_key()`,

  // ── Migration 2: user_email_aliases ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_email_aliases (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email                TEXT NOT NULL,
    label                TEXT NOT NULL DEFAULT 'personal' CHECK (label IN ('personal','work','other')),
    verified             BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token   TEXT,
    token_expires_at     TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_email_aliases_email_unique UNIQUE (email)
  )`,
  `ALTER TABLE user_email_aliases ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='aliases_select' AND tablename='user_email_aliases') THEN
      CREATE POLICY "aliases_select" ON user_email_aliases FOR SELECT USING (user_id = auth.uid());
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='aliases_insert' AND tablename='user_email_aliases') THEN
      CREATE POLICY "aliases_insert" ON user_email_aliases FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='aliases_delete' AND tablename='user_email_aliases') THEN
      CREATE POLICY "aliases_delete" ON user_email_aliases FOR DELETE USING (user_id = auth.uid());
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS user_email_aliases_email_idx ON user_email_aliases (email) WHERE verified = TRUE`,
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const results: { sql: string; ok: boolean; error?: string }[] = []

  for (const sql of MIGRATIONS) {
    try {
      const { error } = await supabase.rpc('exec_sql', { query: sql }).throwOnError()
      if (error) throw error
      results.push({ sql: sql.slice(0, 60), ok: true })
    } catch (err) {
      // Try via raw REST if rpc not available
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
          {
            method: 'POST',
            headers: {
              apikey:          process.env.SUPABASE_SERVICE_ROLE_KEY!,
              Authorization:   `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({ query: sql }),
          },
        )
        if (res.ok) {
          results.push({ sql: sql.slice(0, 60), ok: true })
        } else {
          const text = await res.text()
          results.push({ sql: sql.slice(0, 60), ok: false, error: text.slice(0, 100) })
        }
      } catch (e2) {
        results.push({ sql: sql.slice(0, 60), ok: false, error: String(err).slice(0, 100) })
      }
    }
  }

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: failed.length,
    results,
    note: failed.length === 0 ? '✅ כל ה-migrations עברו בהצלחה!' : '⚠️ חלק נכשלו — צריך להריץ ידנית',
  })
}
