-- Migration 006: Fix documents RLS + email_ingests source column
--
-- Run this in the Supabase SQL Editor.

-- ── 1. Enable RLS on documents ────────────────────────────────────────────────
-- Previously documents had no RLS, meaning client-side queries could read
-- all documents regardless of ownership (or none if RLS was manually enabled
-- without policies).
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow users to SELECT documents that belong to their trips
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM trips WHERE user_id = auth.uid()
    )
  );

-- Allow users to INSERT documents for their trips
DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (
    trip_id IN (
      SELECT id FROM trips WHERE user_id = auth.uid()
    )
  );

-- Allow users to UPDATE documents for their trips
DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (
    trip_id IN (
      SELECT id FROM trips WHERE user_id = auth.uid()
    )
  );

-- Allow users to DELETE documents for their trips
DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (
    trip_id IN (
      SELECT id FROM trips WHERE user_id = auth.uid()
    )
  );

-- ── 2. Add source column to email_ingests ─────────────────────────────────────
-- The scanner writes source='gmail_trip_import' but the column was missing.
ALTER TABLE email_ingests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- ── 3. Enable RLS on expenses (same pattern) ──────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

-- ── 4. Enable RLS on trips ────────────────────────────────────────────────────
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trips_select" ON trips;
CREATE POLICY "trips_select" ON trips
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trips_insert" ON trips;
CREATE POLICY "trips_insert" ON trips
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "trips_update" ON trips;
CREATE POLICY "trips_update" ON trips
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trips_delete" ON trips;
CREATE POLICY "trips_delete" ON trips
  FOR DELETE USING (user_id = auth.uid());
