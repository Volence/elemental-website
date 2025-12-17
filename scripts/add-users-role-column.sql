-- ============================================
-- ADD MISSING users.role COLUMN
-- ============================================
-- Quick fix for: "column users.role does not exist"
-- ============================================

BEGIN;

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(255) DEFAULT 'team-manager';

-- Set default role for existing users
UPDATE users 
SET role = 'team-manager' 
WHERE role IS NULL;

-- Set steve@volence.dev as admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'steve@volence.dev';

-- Make role NOT NULL after setting defaults
ALTER TABLE users 
ALTER COLUMN role SET NOT NULL;

COMMIT;

-- Verify
SELECT 'Users table role column:' AS info;
SELECT id, name, email, role, created_at 
FROM users 
ORDER BY created_at ASC;
