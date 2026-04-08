-- Trip memories table
CREATE TABLE IF NOT EXISTS trip_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  memory_date DATE NOT NULL,
  text TEXT,
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, memory_date)
);

CREATE INDEX IF NOT EXISTS idx_memories_trip ON trip_memories(trip_id);
