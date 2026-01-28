-- Fix admins SELECT policy: scope to own org for regular admins
-- Previously any admin could see all admins; now regular admins only
-- see admins in their own organization.

DROP POLICY "admins_select" ON admins;

CREATE POLICY "admins_select"
  ON admins FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_super_admin()
    OR organization_id = get_admin_org_id()
  );
