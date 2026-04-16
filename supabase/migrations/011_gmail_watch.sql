-- Migration 011: Gmail Push Notifications support
--
-- Adds push-notification state to gmail_connections so we can do
-- real-time incremental scans instead of polling once a day.
--
-- history_id   — last Gmail historyId we processed; incremental scan
--               starts from here so we only process NEW messages
-- watch_expiry — when the Gmail watch (Pub/Sub subscription) expires
--               (Gmail gives 7 days; we renew every 6 via cron)
-- watch_active — true while a watch is registered and not yet expired
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE gmail_connections
  ADD COLUMN IF NOT EXISTS history_id    TEXT,
  ADD COLUMN IF NOT EXISTS watch_expiry  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS watch_active  BOOLEAN DEFAULT FALSE;

-- Index for fast lookup by gmail_address (used in webhook handler)
CREATE INDEX IF NOT EXISTS gmail_connections_address_idx
  ON gmail_connections (gmail_address);
