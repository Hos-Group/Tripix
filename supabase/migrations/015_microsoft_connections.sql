-- ============================================================
-- 015_microsoft_connections.sql
-- Add support for Microsoft / Outlook / Hotmail email accounts.
--
-- Mirror of gmail_connections but for Microsoft Graph API OAuth.
-- The email column can be any Microsoft account:
--   user@outlook.com, user@hotmail.com, user@live.com,
--   or any corporate Exchange / M365 address.
-- ============================================================

CREATE TABLE IF NOT EXISTS microsoft_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The Microsoft email address
  email         TEXT NOT NULL,

  -- OAuth 2.0 tokens from Microsoft identity platform
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry  TIMESTAMPTZ,

  -- Set to true when token is revoked / expired and needs re-auth
  needs_reauth  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT microsoft_connections_user_email_unique UNIQUE (user_id, email)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE microsoft_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "microsoft_connections_select" ON microsoft_connections;
DROP POLICY IF EXISTS "microsoft_connections_insert" ON microsoft_connections;
DROP POLICY IF EXISTS "microsoft_connections_update" ON microsoft_connections;
DROP POLICY IF EXISTS "microsoft_connections_delete" ON microsoft_connections;

CREATE POLICY "microsoft_connections_select" ON microsoft_connections
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "microsoft_connections_insert" ON microsoft_connections
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "microsoft_connections_update" ON microsoft_connections
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "microsoft_connections_delete" ON microsoft_connections
  FOR DELETE USING (user_id = auth.uid());

-- ── Auto-update updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_microsoft_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_microsoft_connections_updated_at ON microsoft_connections;
CREATE TRIGGER trg_microsoft_connections_updated_at
  BEFORE UPDATE ON microsoft_connections
  FOR EACH ROW EXECUTE FUNCTION update_microsoft_connections_updated_at();
