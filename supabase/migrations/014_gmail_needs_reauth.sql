-- ============================================================
-- 014_gmail_needs_reauth.sql
-- Add needs_reauth flag to gmail_connections.
-- Set when token refresh returns invalid_grant (revoked token).
-- UI uses this to prompt the user to reconnect.
-- ============================================================

ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN DEFAULT FALSE;
