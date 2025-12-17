-- Add role and assignment columns to users table
-- Run this locally to add the new user role fields

-- Add role column (enum type)
DO $$ 
BEGIN
    -- Create enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
        CREATE TYPE enum_users_role AS ENUM ('admin', 'team-manager', 'staff-manager', 'production-manager');
    END IF;
END $$;

-- Add role column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role enum_users_role NOT NULL DEFAULT 'team-manager';
    END IF;
END $$;

-- Add assigned_team_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'assigned_team_id'
    ) THEN
        ALTER TABLE users ADD COLUMN assigned_team_id INTEGER;
        ALTER TABLE users ADD CONSTRAINT users_assigned_team_id_fkey 
            FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add assigned_org_staff_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'assigned_org_staff_id'
    ) THEN
        ALTER TABLE users ADD COLUMN assigned_org_staff_id INTEGER;
        ALTER TABLE users ADD CONSTRAINT users_assigned_org_staff_id_fkey 
            FOREIGN KEY (assigned_org_staff_id) REFERENCES organization_staff(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add assigned_production_staff_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'assigned_production_staff_id'
    ) THEN
        ALTER TABLE users ADD COLUMN assigned_production_staff_id INTEGER;
        ALTER TABLE users ADD CONSTRAINT users_assigned_production_staff_id_fkey 
            FOREIGN KEY (assigned_production_staff_id) REFERENCES production(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Set first user to admin if no users have admin role
UPDATE users 
SET role = 'admin' 
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin');

SELECT 'Migration complete! User role columns have been added.' AS status;
