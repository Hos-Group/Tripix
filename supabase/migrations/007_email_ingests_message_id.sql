-- Migration 007: Add gmail_message_id to email_ingests for reliable deduplication
--
-- Run this in the Supabase SQL Editor.
--
-- Previously deduplication relied on Claude extracting the same hotel/flight name
-- every scan. Claude is non-deterministic — the same email can yield "Anantara Koh
-- Phangan" one run and "Anantara Rasananda" the next, bypassing the name+date check.
--
-- Storing the raw Gmail message ID lets us skip already-processed emails
-- completely, regardless of what Claude extracts.

ALTER TABLE email_ingests
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Index for fast lookup during dedup check
CREATE INDEX IF NOT EXISTS idx_email_ingests_gmail_message_id
  ON email_ingests (user_id, gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;
