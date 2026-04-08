-- ============================================================
-- Email Intelligence: email_ingests table + inbox_key on profiles
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add inbox_key to profiles (unique per user, used as email prefix)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inbox_key TEXT;

-- Generate inbox_key for existing users who don't have one
UPDATE profiles
SET inbox_key = LOWER(REPLACE(gen_random_uuid()::TEXT, '-', ''))
WHERE inbox_key IS NULL;

-- Unique index on inbox_key
CREATE UNIQUE INDEX IF NOT EXISTS profiles_inbox_key_idx ON profiles(inbox_key);

-- 2. Create email_ingests table
CREATE TABLE IF NOT EXISTS email_ingests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL,
  expense_id      UUID REFERENCES expenses(id) ON DELETE SET NULL,

  -- Raw email data
  from_address    TEXT,
  subject         TEXT,
  raw_html        TEXT,
  raw_text        TEXT,

  -- AI-parsed data
  parsed_data     JSONB,

  -- Matching metadata
  match_score     INTEGER DEFAULT 0,
  match_reason    TEXT,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'matched', 'unmatched', 'processed', 'ignored')),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS for email_ingests
ALTER TABLE email_ingests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_ingests_select" ON email_ingests;
DROP POLICY IF EXISTS "email_ingests_update" ON email_ingests;

CREATE POLICY "email_ingests_select" ON email_ingests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "email_ingests_update" ON email_ingests
  FOR UPDATE USING (user_id = auth.uid());

-- 4. Add source + email_ingest_id to expenses (for traceability)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS email_ingest_id UUID REFERENCES email_ingests(id) ON DELETE SET NULL;

-- 5. Trigger: auto-generate inbox_key for new users
CREATE OR REPLACE FUNCTION auto_generate_inbox_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inbox_key IS NULL THEN
    NEW.inbox_key := LOWER(REPLACE(gen_random_uuid()::TEXT, '-', ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_inbox_key ON profiles;
CREATE TRIGGER trg_auto_inbox_key
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_generate_inbox_key();
