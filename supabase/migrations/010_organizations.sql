-- Organizations: replace event_admins with org-based access control
-- Admins belong to an org, events belong to an org, access is determined by org match.

-- ============================================================================
-- 1. CREATE ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ADD ORGANIZATION_ID TO ADMINS AND EVENTS (nullable for backfill)
-- ============================================================================

ALTER TABLE admins ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE events ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- ============================================================================
-- 3. BACKFILL: Create default org, assign all existing admins and events
-- ============================================================================

INSERT INTO organizations (name) VALUES ('Default');

UPDATE admins SET organization_id = (SELECT id FROM organizations WHERE name = 'Default');
UPDATE events SET organization_id = (SELECT id FROM organizations WHERE name = 'Default');

-- ============================================================================
-- 4. SET NOT NULL AFTER BACKFILL
-- ============================================================================

ALTER TABLE admins ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================================
-- 5. HELPER FUNCTION: get_admin_org_id()
-- ============================================================================
-- Returns the current authenticated user's organization_id.
-- is_super_admin() already exists from migration 009.

CREATE OR REPLACE FUNCTION get_admin_org_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM public.admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. DROP OLD EVENT_ADMINS-BASED RLS POLICIES
-- ============================================================================

DROP POLICY "events_update_admin" ON events;
DROP POLICY "events_delete_admin" ON events;
DROP POLICY "beers_update_admin" ON beers;
DROP POLICY "beers_delete_admin" ON beers;
DROP POLICY "event_admins_select_admin" ON event_admins;
DROP POLICY "event_admins_insert_admin" ON event_admins;
DROP POLICY "event_admins_delete_admin" ON event_admins;

-- ============================================================================
-- 7. CREATE NEW ORG-BASED RLS POLICIES
-- ============================================================================

-- Events: admin's org matches event's org, OR super admin
CREATE POLICY "events_update_org"
  ON events FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_admin_org_id()
    OR is_super_admin()
  );

CREATE POLICY "events_delete_org"
  ON events FOR DELETE
  TO authenticated
  USING (
    organization_id = get_admin_org_id()
    OR is_super_admin()
  );

-- Beers: admin's org matches the beer's event's org, OR super admin
CREATE POLICY "beers_update_org"
  ON beers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = beers.event_id
      AND e.organization_id = get_admin_org_id()
    )
    OR is_super_admin()
  );

CREATE POLICY "beers_delete_org"
  ON beers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = beers.event_id
      AND e.organization_id = get_admin_org_id()
    )
    OR is_super_admin()
  );

-- ============================================================================
-- 8. ORGANIZATIONS TABLE: RLS + GRANTS
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- All admins can see organizations
CREATE POLICY "organizations_select_admin"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only super admins can create/update/delete organizations
CREATE POLICY "organizations_insert_super_admin"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "organizations_update_super_admin"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "organizations_delete_super_admin"
  ON organizations FOR DELETE
  TO authenticated
  USING (is_super_admin());

GRANT SELECT ON organizations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON organizations TO authenticated;

-- ============================================================================
-- 9. DROP EVENT_ADMINS TABLE
-- ============================================================================
-- Indexes idx_event_admins_admin_id and idx_event_admins_event_id are
-- dropped automatically with the table.

-- Revoke grants before dropping
REVOKE ALL ON event_admins FROM authenticated;

DROP TABLE event_admins;

-- ============================================================================
-- 10. ADD INDEXES
-- ============================================================================

CREATE INDEX idx_admins_org ON admins(organization_id);
CREATE INDEX idx_events_org ON events(organization_id);
