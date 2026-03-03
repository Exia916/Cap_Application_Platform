BEGIN;

-- 1) Ensure roles_lookup has the common baseline roles (safe to re-run)
INSERT INTO roles_lookup (code, label, is_active, sort_order)
VALUES
  ('ADMIN',      'Admin',      true, 10),
  ('SUPERVISOR', 'Supervisor', true, 20),
  ('USER',       'User',       true, 30),
  ('MANAGER',    'Manager',    true, 40),
  ('TECH',       'Tech',       true, 50)
ON CONFLICT (code) DO NOTHING;

-- 2) Convert users.role enum -> text (keeps existing values)
ALTER TABLE users
  ALTER COLUMN role TYPE text
  USING role::text;

-- 3) Normalize existing stored role values (optional but recommended)
UPDATE users
SET role = UPPER(TRIM(role))
WHERE role IS NOT NULL;

-- 4) Make sure any role values already in users exist in roles_lookup BEFORE adding FK
--    (prevents FK failures on legacy values)
INSERT INTO roles_lookup (code, label, is_active, sort_order)
SELECT
  u.role AS code,
  INITCAP(LOWER(u.role)) AS label,
  true AS is_active,
  999 AS sort_order
FROM (SELECT DISTINCT role FROM users WHERE role IS NOT NULL AND role <> '') u
ON CONFLICT (code) DO NOTHING;

-- 5) Add FK to roles_lookup(code)
--    Drop old constraint if you happened to create one earlier
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_fkey'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_fkey;
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_fkey
  FOREIGN KEY (role)
  REFERENCES roles_lookup(code);

-- 6) Make role required (optional; comment out if you allow null roles)
ALTER TABLE users
  ALTER COLUMN role SET NOT NULL;

COMMIT;