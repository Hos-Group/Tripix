-- Tripix Initial Schema

-- Currency rates table
CREATE TABLE currency_rates (
  currency TEXT PRIMARY KEY,
  rate_to_ils NUMERIC(10, 4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO currency_rates (currency, rate_to_ils) VALUES
  ('ILS', 1),
  ('USD', 3.70),
  ('THB', 0.105),
  ('EUR', 4.00),
  ('GBP', 4.65);

-- Trips table
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget_ils NUMERIC(12, 2),
  travelers JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default trip
INSERT INTO trips (name, destination, start_date, end_date, travelers) VALUES (
  'טיול תאילנד 2026',
  'תאילנד',
  '2026-04-11',
  '2026-05-01',
  '[{"id": "omer", "name": "אומר"}, {"id": "wife", "name": "אשתי"}, {"id": "baby", "name": "תינוקת"}]'
);

-- Expenses table
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('flight', 'ferry', 'taxi', 'hotel', 'activity', 'food', 'shopping', 'other')),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  amount_ils NUMERIC(12, 2),
  expense_date DATE NOT NULL,
  notes TEXT,
  receipt_url TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'scan', 'document', 'voice')),
  travelers TEXT[] DEFAULT '{}',
  is_paid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-calculate amount_ils trigger
CREATE OR REPLACE FUNCTION calculate_amount_ils()
RETURNS TRIGGER AS $$
BEGIN
  SELECT NEW.amount * cr.rate_to_ils INTO NEW.amount_ils
  FROM currency_rates cr
  WHERE cr.currency = NEW.currency;

  IF NEW.amount_ils IS NULL THEN
    NEW.amount_ils := NEW.amount;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_amount_ils
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION calculate_amount_ils();

-- Documents table
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('passport', 'flight', 'hotel', 'ferry', 'activity', 'insurance', 'visa', 'other')),
  traveler_id TEXT DEFAULT 'all',
  file_url TEXT,
  file_type TEXT,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  booking_ref TEXT,
  valid_from DATE,
  valid_until DATE,
  flight_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily summary view
CREATE VIEW daily_summary AS
SELECT
  expense_date,
  COUNT(*) AS expense_count,
  SUM(amount_ils) AS total_ils,
  jsonb_object_agg(category, cat_total) AS category_breakdown
FROM (
  SELECT
    expense_date,
    category,
    SUM(amount_ils) AS cat_total
  FROM expenses
  GROUP BY expense_date, category
) sub
GROUP BY expense_date
ORDER BY expense_date;

-- Category totals view
CREATE VIEW category_totals AS
SELECT
  category,
  SUM(amount_ils) AS total_ils,
  COUNT(*) AS expense_count,
  ROUND(SUM(amount_ils) * 100.0 / NULLIF((SELECT SUM(amount_ils) FROM expenses), 0), 1) AS percentage
FROM expenses
GROUP BY category
ORDER BY total_ils DESC;

-- Storage buckets (run via Supabase dashboard or CLI)
-- CREATE POLICY for buckets: receipts, documents

-- Enable RLS (optional, for production)
-- ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_expenses_trip_date ON expenses(trip_id, expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_documents_trip ON documents(trip_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
