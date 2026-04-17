-- ============================================================
-- 012_collaborative_trips.sql
-- Collaborative trips: trip_members + splits
-- ============================================================

-- ── 1. trip_members ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email  TEXT,
  invited_name   TEXT,
  role           TEXT        NOT NULL DEFAULT 'viewer'
                             CHECK (role IN ('owner','editor','viewer')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('active','pending','declined')),
  joined_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_members_trip_id_idx  ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS trip_members_user_id_idx  ON trip_members(user_id);
CREATE INDEX IF NOT EXISTS trip_members_email_idx    ON trip_members(invited_email);

-- ── 2. splits ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS splits (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  expense_id        UUID        REFERENCES expenses(id) ON DELETE SET NULL,
  paid_by_user_id   UUID,
  paid_by_name      TEXT        NOT NULL,
  total_amount      NUMERIC     NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'ILS',
  description       TEXT,
  split_type        TEXT        NOT NULL DEFAULT 'equal'
                                CHECK (split_type IN ('equal','custom')),
  -- participants: [{ user_id?, name, email?, amount, paid: bool }]
  participants      JSONB       NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS splits_trip_id_idx     ON splits(trip_id);
CREATE INDEX IF NOT EXISTS splits_expense_id_idx  ON splits(expense_id);

-- ── 3. RLS ───────────────────────────────────────────────────
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits       ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member (active) of a trip, or the trip owner?
CREATE OR REPLACE FUNCTION is_trip_member(p_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id
      AND user_id  = auth.uid()
      AND status   = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM trips
    WHERE id      = p_trip_id
      AND user_id = auth.uid()
  );
$$;

-- trip_members policies
CREATE POLICY "members_select" ON trip_members
  FOR SELECT USING (is_trip_member(trip_id));

CREATE POLICY "members_insert" ON trip_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips WHERE id = trip_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_id = trip_members.trip_id
        AND user_id = auth.uid()
        AND role IN ('owner','editor')
        AND status = 'active'
    )
  );

CREATE POLICY "members_update" ON trip_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trips WHERE id = trip_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM trip_members tm2
      WHERE tm2.trip_id = trip_members.trip_id
        AND tm2.user_id = auth.uid()
        AND tm2.role IN ('owner','editor')
        AND tm2.status = 'active'
    )
    -- allow a member to update their own row (accept/decline invite)
    OR user_id = auth.uid()
  );

CREATE POLICY "members_delete" ON trip_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips WHERE id = trip_id AND user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- splits policies
CREATE POLICY "splits_select" ON splits
  FOR SELECT USING (is_trip_member(trip_id));

CREATE POLICY "splits_insert" ON splits
  FOR INSERT WITH CHECK (is_trip_member(trip_id));

CREATE POLICY "splits_update" ON splits
  FOR UPDATE USING (is_trip_member(trip_id));

CREATE POLICY "splits_delete" ON splits
  FOR DELETE USING (
    paid_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM trips WHERE id = trip_id AND user_id = auth.uid()
    )
  );

-- ── 4. Seed owner row when a trip is created ─────────────────
-- When the owner creates a trip they are automatically the first active member.
CREATE OR REPLACE FUNCTION auto_add_trip_owner()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.user_id, 'owner', 'active', now())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_trip_owner ON trips;
CREATE TRIGGER trg_auto_add_trip_owner
  AFTER INSERT ON trips
  FOR EACH ROW EXECUTE FUNCTION auto_add_trip_owner();
