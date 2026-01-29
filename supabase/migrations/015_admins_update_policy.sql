-- Allow super admins to update admin records (e.g., change organization)

-- Grant UPDATE permission to authenticated role (was missing from initial schema)
GRANT UPDATE ON admins TO authenticated;

CREATE POLICY "admins_update_super"
  ON admins FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
