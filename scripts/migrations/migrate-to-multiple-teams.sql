-- Migrate from single assigned_team_id to multiple assignedTeams
-- This creates a junction table for the many-to-many relationship

-- Step 1: Create junction table for users_assigned_teams (Payload naming convention)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users_assigned_teams'
    ) THEN
        CREATE TABLE users_assigned_teams (
            id SERIAL PRIMARY KEY,
            _parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            _order INTEGER,
            assigned_teams_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(_parent_id, assigned_teams_id)
        );
        
        CREATE INDEX idx_users_assigned_teams_parent ON users_assigned_teams(_parent_id);
        CREATE INDEX idx_users_assigned_teams_team ON users_assigned_teams(assigned_teams_id);
    END IF;
END $$;

-- Step 2: Migrate existing assigned_team_id data to the junction table
DO $$ 
DECLARE
    user_record RECORD;
BEGIN
    -- Only migrate if assigned_team_id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'assigned_team_id'
    ) THEN
        -- Migrate existing single team assignments
        FOR user_record IN 
            SELECT id, assigned_team_id 
            FROM users 
            WHERE assigned_team_id IS NOT NULL
        LOOP
            -- Insert into junction table if not already exists
            INSERT INTO users_assigned_teams (_parent_id, _order, assigned_teams_id)
            VALUES (user_record.id, 0, user_record.assigned_team_id)
            ON CONFLICT (_parent_id, assigned_teams_id) DO NOTHING;
        END LOOP;
        
        -- Drop the old column after migration
        ALTER TABLE users DROP COLUMN IF EXISTS assigned_team_id;
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_assigned_team_id_fkey;
    END IF;
END $$;

SELECT 'Migration complete! Users can now be assigned to multiple teams.' AS status;
