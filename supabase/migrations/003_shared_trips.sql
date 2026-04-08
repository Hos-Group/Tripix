-- Migration: Shared/Group trips support

-- Trip types for categorization
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_type TEXT DEFAULT 'personal'
  CHECK (trip_type IN ('personal', 'bachelor', 'bachelorette', 'ski', 'family', 'friends', 'couples', 'work', 'other'));

-- Trip members table - who is part of each trip
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Expense splits - who owes what for each expense
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  member_id UUID REFERENCES trip_members(id) ON DELETE CASCADE,
  amount_ils NUMERIC(12, 2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  UNIQUE(expense_id, member_id)
);

-- Add paid_by to expenses to track who paid
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES trip_members(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS split_type TEXT DEFAULT 'equal'
  CHECK (split_type IN ('equal', 'custom', 'full'));

-- Settlements - record when debts are settled
CREATE TABLE IF NOT EXISTS settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  from_member UUID REFERENCES trip_members(id) ON DELETE CASCADE,
  to_member UUID REFERENCES trip_members(id) ON DELETE CASCADE,
  amount_ils NUMERIC(12, 2) NOT NULL,
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member ON expense_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_trip ON settlements(trip_id);
