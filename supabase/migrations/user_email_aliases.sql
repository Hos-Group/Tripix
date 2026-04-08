-- ============================================================
-- User Email Aliases: link multiple email addresses to one account
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS user_email_aliases (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The linked email address (must be unique across the system)
  email                TEXT NOT NULL,
  label                TEXT NOT NULL DEFAULT 'personal'
                       CHECK (label IN ('personal', 'work', 'other')),

  -- Verification state
  verified             BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token   TEXT,
  token_expires_at     TIMESTAMPTZ,

  created_at           TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_email_aliases_email_unique UNIQUE (email)
);

-- RLS
ALTER TABLE user_email_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aliases_select" ON user_email_aliases
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "aliases_insert" ON user_email_aliases
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "aliases_delete" ON user_email_aliases
  FOR DELETE USING (user_id = auth.uid());

-- Index for fast lookup by email (used in email-ingest routing)
CREATE INDEX IF NOT EXISTS user_email_aliases_email_idx
  ON user_email_aliases (email) WHERE verified = TRUE;
