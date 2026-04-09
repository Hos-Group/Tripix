-- Add cities array to trips table for multi-city trip planning
-- This improves email-to-trip matching when emails mention specific cities

ALTER TABLE trips ADD COLUMN IF NOT EXISTS cities JSONB DEFAULT '[]'::jsonb;
