---
name: tripix-supabase
description: |
  Tripix Supabase & database skill. Use whenever working on the database layer of the Tripix app — writing migrations, fixing RLS policies, modifying the schema, debugging Supabase queries, managing storage buckets, or handling auth flows. Trigger on: "Supabase", "מיגרציה", "סכמה", "RLS", "מסד נתונים", "database", "migration", "query", "policy", "storage bucket", "auth", or any mention of tables like trips, expenses, documents, profiles, trip_members, settlements, expense_splits. Also trigger when debugging data access issues, permission errors, or "row level security" problems.
---

# Tripix Supabase & Database Skill

This skill covers everything related to Supabase in Tripix: the database schema, migrations, Row Level Security, storage, auth, and query patterns.

## Database Schema

### Core Tables

**trips**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL
destination TEXT NOT NULL
start_date  DATE NOT NULL
end_date    DATE NOT NULL
budget_ils  NUMERIC
travelers   JSONB DEFAULT '[]'   -- [{id, name}]
notes       TEXT
trip_type   TEXT DEFAULT 'personal'  -- personal|bachelor|bachelorette|ski|family|friends|couples|work|other
user_id     UUID REFERENCES auth.users(id)  -- Added in migration 002
created_at  TIMESTAMPTZ DEFAULT now()
```

**expenses**
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id      UUID REFERENCES trips(id) ON DELETE CASCADE
title        TEXT NOT NULL
category     TEXT NOT NULL  -- flight|ferry|taxi|hotel|activity|food|shopping|other
amount       NUMERIC NOT NULL
currency     TEXT NOT NULL DEFAULT 'ILS'
amount_ils   NUMERIC  -- Auto-calculated by trigger
expense_date DATE NOT NULL
notes        TEXT
receipt_url  TEXT
source       TEXT DEFAULT 'manual'  -- manual|scan|document|voice
travelers    TEXT[] DEFAULT '{}'
is_paid      BOOLEAN DEFAULT true
paid_by      UUID   -- Added in migration 003
split_type   TEXT DEFAULT 'equal'  -- equal|custom|full
created_at   TIMESTAMPTZ DEFAULT now()
updated_at   TIMESTAMPTZ DEFAULT now()
```

**documents**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id         UUID REFERENCES trips(id) ON DELETE CASCADE
name            TEXT NOT NULL
doc_type        TEXT NOT NULL  -- passport|flight|hotel|ferry|activity|insurance|visa|other
traveler_id     TEXT           -- omer|wife|baby|all
file_url        TEXT
file_type       TEXT
extracted_data  JSONB DEFAULT '{}'
booking_ref     TEXT
valid_from      DATE
valid_until     DATE
flight_number   TEXT
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

**currency_rates**
```sql
currency    TEXT PRIMARY KEY
rate_to_ils NUMERIC NOT NULL
updated_at  TIMESTAMPTZ DEFAULT now()
```
Default values: USD=3.70, THB=0.105, EUR=4.00, GBP=4.65

### Multi-User Tables (Migration 002-003)

**profiles** (synced from auth.users)
```sql
id           UUID PRIMARY KEY REFERENCES auth.users(id)
email        TEXT
full_name    TEXT
role         TEXT DEFAULT 'user'  -- admin|user
avatar_url   TEXT
inbox_key    TEXT  -- For email forwarding
```

**trip_members**
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id      UUID REFERENCES trips(id) ON DELETE CASCADE
user_id      UUID REFERENCES auth.users(id)
display_name TEXT NOT NULL
email        TEXT
role         TEXT DEFAULT 'member'  -- owner|admin|member
joined_at    TIMESTAMPTZ DEFAULT now()
UNIQUE(trip_id, user_id)
```

**expense_splits**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
expense_id  UUID REFERENCES expenses(id) ON DELETE CASCADE
member_id   UUID REFERENCES trip_members(id) ON DELETE CASCADE
amount_ils  NUMERIC NOT NULL
is_paid     BOOLEAN DEFAULT false
```

**settlements**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE
from_member UUID REFERENCES trip_members(id)
to_member   UUID REFERENCES trip_members(id)
amount_ils  NUMERIC NOT NULL
settled_at  TIMESTAMPTZ DEFAULT now()
notes       TEXT
```

### Gmail Tables (Migration 005)

**gmail_connections**
```sql
user_id        UUID REFERENCES auth.users(id)
gmail_address  TEXT NOT NULL
access_token   TEXT
refresh_token  TEXT
token_expires  TIMESTAMPTZ
UNIQUE(user_id, gmail_address)  -- Supports multiple Gmail accounts per user
```

**email_ingests** (For email forwarding)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES auth.users(id)
from_addr   TEXT
subject     TEXT
body_text   TEXT
status      TEXT DEFAULT 'pending'
created_at  TIMESTAMPTZ DEFAULT now()
```

### Database Triggers

**calculate_amount_ils** — Automatically converts amount to ILS on INSERT/UPDATE:
```sql
CREATE OR REPLACE FUNCTION calculate_amount_ils()
RETURNS TRIGGER AS $$
BEGIN
  SELECT rate_to_ils INTO NEW.amount_ils
  FROM currency_rates WHERE currency = NEW.currency;
  NEW.amount_ils := ROUND(NEW.amount * COALESCE(NEW.amount_ils, 1), 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
This means you never need to calculate `amount_ils` in application code — just insert `amount` and `currency`.

### Views

- **daily_summary**: Expenses grouped by trip_id + expense_date with count and total_ils
- **category_totals**: Expenses grouped by trip_id + category with count, total_ils, total_original

## Row Level Security (RLS) — Current State & Fixes

**RLS is currently DISABLED on most tables.** This is a critical security gap. Here's what exists and what needs to be added:

### What Exists (Migration 002)
```sql
-- profiles: Too permissive
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);  -- Anyone can read any profile
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

### What Needs to Be Added

**trips** — Users should only see their own trips or trips they're members of:
```sql
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_select" ON trips FOR SELECT USING (
  user_id = auth.uid() OR
  id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
);

CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "trips_update" ON trips FOR UPDATE USING (
  user_id = auth.uid() OR
  id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY "trips_delete" ON trips FOR DELETE USING (
  user_id = auth.uid()
);
```

**expenses** — Access through trip membership:
```sql
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (
  trip_id IN (
    SELECT id FROM trips WHERE user_id = auth.uid()
    UNION
    SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
  )
);
-- Similar for INSERT, UPDATE, DELETE
```

**documents** — Same pattern as expenses (access through trip).

When writing new RLS policies, always consider:
- Trip owners get full access
- Trip admins can modify
- Trip members can read
- Service role key bypasses RLS (used in API routes with `SUPABASE_SERVICE_ROLE_KEY`)

## Migration Patterns

Migrations live in `supabase/migrations/` with numeric prefixes:
- `001_initial_schema.sql` — Core tables
- `002_multi_user_trips.sql` — Multi-user support
- `003_shared_trips.sql` — Trip sharing & expense splitting
- `005_multi_gmail.sql` — Multiple Gmail accounts

### Writing New Migrations

Follow these conventions:
1. Name: `NNN_descriptive_name.sql` (next available number)
2. Make migrations **idempotent** — use `IF NOT EXISTS`, `CREATE OR REPLACE`
3. Always include rollback comments (`-- ROLLBACK: DROP TABLE ...`)
4. Test with empty database and with existing data

```sql
-- Example: Adding a new column safely
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- Example: Creating a table with RLS
CREATE TABLE IF NOT EXISTS trip_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trip_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_photos_access" ON trip_photos
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );
```

## Supabase Client Patterns

### Client-Side (Browser)
```typescript
import { supabase } from '@/lib/supabase'

// The client is a lazy-init singleton proxy
// Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
const { data, error } = await supabase
  .from('expenses')
  .select('*')
  .eq('trip_id', tripId)
  .order('expense_date', { ascending: false })
```

### Server-Side (API Routes)
```typescript
import { createClient } from '@supabase/supabase-js'

// Uses service role key — bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### Common Query Patterns
```typescript
// Fetch with filter
const { data } = await supabase.from('expenses').select('*').eq('trip_id', id)

// Insert
const { data, error } = await supabase.from('expenses').insert({ ...expense }).select().single()

// Update
const { error } = await supabase.from('expenses').update({ title: 'New' }).eq('id', expenseId)

// Delete
const { error } = await supabase.from('expenses').delete().eq('id', expenseId)

// File upload
const { error } = await supabase.storage.from('documents').upload(`${Date.now()}_${name}`, buffer)
const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
```

## Storage Buckets

- **documents**: Stores uploaded trip documents (PDFs, images)
- File naming: `${Date.now()}_${originalFileName}`
- Public URLs via `getPublicUrl()`

## Auth Flow

1. **Signup** (`/api/auth/signup`): Admin SDK creates user with `email_confirm: true` (skips email verification)
2. **Login**: Standard Supabase email/password via client SDK
3. **Google OAuth** (`/api/auth/google`): OAuth flow with redirect to `/api/auth/google/callback`
4. **Session**: Managed by Supabase client; `AuthContext` listens to `onAuthStateChange`
5. **Profile**: Auto-loaded from `profiles` table on session change

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, never expose to client
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Debugging Supabase Issues

1. **"Permission denied"**: Check if RLS is enabled and policies exist. Or use service role key in API routes.
2. **Empty data with no error**: Usually means RLS is filtering out rows. Check `auth.uid()` matches.
3. **Trigger not firing**: Verify the trigger is on the correct table and event (INSERT/UPDATE).
4. **File upload fails**: Check bucket exists and has correct policies. Default is restricted.
5. **Auth state not updating**: Make sure `onAuthStateChange` listener is active. Check AuthContext mounting.
