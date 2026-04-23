-- Migration 020: Add connection_type to gmail_connections
--
-- Distinguishes between:
--   'oauth'  — full OAuth connection with access/refresh tokens (legacy, can scan directly)
--   'linked' — address-only connection via userinfo.email scope (no tokens, uses forwarding)
--
-- All existing connections that have an access_token are considered 'oauth'.
-- New connections through the updated OAuth flow (userinfo.email only) are 'linked'.

ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'linked'
  CHECK (connection_type IN ('oauth', 'linked'));

-- Backfill: rows that already have an access_token are legacy OAuth connections
UPDATE gmail_connections
SET connection_type = 'oauth'
WHERE access_token IS NOT NULL AND connection_type = 'linked';
