-- Tighten short_codes RLS: block all client-side inserts
-- Server actions use service role which bypasses RLS

DROP POLICY IF EXISTS "short_codes_insert" ON short_codes;
CREATE POLICY "short_codes_insert" ON short_codes FOR INSERT WITH CHECK (false);

-- Grant INSERT to service_role for server-side inserts
GRANT INSERT ON short_codes TO service_role;
