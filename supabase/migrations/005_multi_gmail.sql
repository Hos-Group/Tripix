-- Migration 005: Allow multiple Gmail accounts per user
--
-- Previously gmail_connections had UNIQUE(user_id) — one Gmail per user.
-- Now we allow multiple accounts: UNIQUE(user_id, gmail_address).
--
-- Run this in the Supabase SQL Editor.

-- Step 1: Drop the old single-account unique constraint
ALTER TABLE gmail_connections
  DROP CONSTRAINT IF EXISTS gmail_connections_user_id_key;

-- Step 2: Add composite unique constraint (user can have same Gmail only once)
ALTER TABLE gmail_connections
  ADD CONSTRAINT gmail_connections_user_gmail_unique
  UNIQUE (user_id, gmail_address);

-- Step 3: Update RLS policies (already correct — based on user_id, no change needed)
-- Existing policy: auth.uid() = user_id covers all rows for that user
