-- Short codes: 8-char lowercase alphanumeric codes mapped to UUIDs
-- Replaces full UUIDs in all public-facing URLs

CREATE TABLE short_codes (
  code TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('event', 'voter', 'manage', 'brewer')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_short_codes_target ON short_codes (target_type, target_id);

-- RLS: anyone can read codes (needed for URL resolution), authenticated + anon can insert
ALTER TABLE short_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "short_codes_select" ON short_codes FOR SELECT USING (true);
CREATE POLICY "short_codes_insert" ON short_codes FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON short_codes TO anon, authenticated;

-- Backfill: generate 8-char a-z0-9 codes for existing data
-- Using a Postgres function for reliable in-SQL generation

CREATE OR REPLACE FUNCTION generate_short_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
  random_bytes BYTEA;
BEGIN
  random_bytes := gen_random_bytes(8);
  FOR i IN 0..7 LOOP
    result := result || substr(chars, (get_byte(random_bytes, i) % 36) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Backfill events (type 'event')
INSERT INTO short_codes (code, target_type, target_id)
SELECT generate_short_code(), 'event', id FROM events;

-- Backfill events (type 'manage')
INSERT INTO short_codes (code, target_type, target_id)
SELECT generate_short_code(), 'manage', id FROM events;

-- Backfill beers (type 'brewer')
INSERT INTO short_codes (code, target_type, target_id)
SELECT generate_short_code(), 'brewer', id FROM beers;
