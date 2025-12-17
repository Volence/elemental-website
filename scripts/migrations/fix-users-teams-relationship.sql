-- Fix users_rels table for assignedTeams relationship
-- Payload uses *_rels tables with specific structure: id, order, parent_id, path, {collection}_id

-- Step 1: Drop the incorrect table if it exists
DROP TABLE IF EXISTS users_assigned_teams CASCADE;

-- Step 2: Create the correct users_rels table (Payload naming convention)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users_rels'
    ) THEN
        CREATE TABLE users_rels (
            id SERIAL PRIMARY KEY,
            "order" INTEGER,
            parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            path VARCHAR(255) NOT NULL,
            teams_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_users_rels_parent ON users_rels(parent_id);
        CREATE INDEX idx_users_rels_teams ON users_rels(teams_id);
        CREATE INDEX idx_users_rels_path ON users_rels(path);
        
        -- Unique constraint to prevent duplicates
        CREATE UNIQUE INDEX idx_users_rels_unique ON users_rels(parent_id, path, teams_id) WHERE teams_id IS NOT NULL;
    END IF;
END $$;

-- Step 3: Migrate any existing data from users_assigned_teams (if it still exists)
-- This handles the case where the old table wasn't dropped yet
DO $$ 
DECLARE
    user_team_record RECORD;
    path_value VARCHAR(255) := 'assignedTeams';
BEGIN
    -- Check if old table exists and has data
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users_assigned_teams'
    ) THEN
        -- Migrate data
        FOR user_team_record IN 
            SELECT _parent_id, assigned_teams_id, _order
            FROM users_assigned_teams
        LOOP
            -- Insert into users_rels with proper structure
            INSERT INTO users_rels (parent_id, path, teams_id, "order")
            VALUES (user_team_record._parent_id, path_value, user_team_record.assigned_teams_id, COALESCE(user_team_record._order, 0))
            ON CONFLICT (parent_id, path, teams_id) DO NOTHING;
        END LOOP;
        
        -- Drop old table after migration
        DROP TABLE users_assigned_teams CASCADE;
    END IF;
END $$;

SELECT 'Migration complete! users_rels table created with correct structure.' AS status;
