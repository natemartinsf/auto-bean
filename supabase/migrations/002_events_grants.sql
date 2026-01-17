-- Add missing GRANT for events table
-- The RLS policies exist but the table-level GRANT was missing for authenticated users

GRANT INSERT, UPDATE, DELETE ON events TO authenticated;
