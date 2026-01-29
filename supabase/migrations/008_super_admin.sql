-- Super admin role: only super admins can manage other admins and view access requests

ALTER TABLE admins ADD COLUMN is_super BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: set site owner as super admin
UPDATE admins SET is_super = TRUE
WHERE email = (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'super_admin_email');
