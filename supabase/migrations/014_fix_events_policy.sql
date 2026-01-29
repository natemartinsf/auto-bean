-- Drop the old events_insert_admin policy if it still exists
-- It was replaced by events_insert_org in migration 010
DROP POLICY IF EXISTS "events_insert_admin" ON events;
