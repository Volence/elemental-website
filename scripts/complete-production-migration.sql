-- ============================================
-- COMPLETE PRODUCTION DATABASE MIGRATION
-- ============================================
-- This migration handles ALL schema updates needed
-- to bring production database in sync with code.
--
-- Includes:
-- 1. Users table: Add role column
-- 2. Users relationships: Create users_rels table
-- 3. Teams table: Add active column
-- 4. Matches table: Add all required columns
-- 5. Matches arrays: Create related tables
-- ============================================

BEGIN;

-- ============================================
-- 1. USERS TABLE UPDATES
-- ============================================

-- Add role column
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

-- Make role NOT NULL
DO $$
BEGIN
  ALTER TABLE users ALTER COLUMN role SET NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL; -- Ignore if already NOT NULL
END $$;

-- ============================================
-- 2. USERS RELATIONSHIPS
-- ============================================

-- Create users_rels for assignedTeams
CREATE TABLE IF NOT EXISTS users_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL,
  path VARCHAR(255) NOT NULL,
  teams_id INTEGER
);

-- Add foreign keys for users_rels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_rels_parent_id_fkey'
  ) THEN
    ALTER TABLE users_rels 
    ADD CONSTRAINT users_rels_parent_id_fkey 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_rels_teams_id_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    ALTER TABLE users_rels 
    ADD CONSTRAINT users_rels_teams_id_fkey 
    FOREIGN KEY (teams_id) REFERENCES teams(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_rels_parent_idx ON users_rels(parent_id);
CREATE INDEX IF NOT EXISTS users_rels_teams_idx ON users_rels(teams_id);
CREATE INDEX IF NOT EXISTS users_rels_order_idx ON users_rels("order");
CREATE INDEX IF NOT EXISTS users_rels_path_idx ON users_rels(path);

-- ============================================
-- 3. TEAMS TABLE UPDATES
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- ============================================
-- 4. MATCHES TABLE UPDATES
-- ============================================

-- First, handle the status enum if it exists
DO $$
BEGIN
  -- Drop the enum type if it exists (we'll use VARCHAR instead for flexibility)
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_matches_status') THEN
    -- First, alter column to not use enum
    ALTER TABLE matches ALTER COLUMN status TYPE VARCHAR(255);
    -- Then drop the enum
    DROP TYPE enum_matches_status;
    RAISE NOTICE 'Dropped enum_matches_status, using VARCHAR instead';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not drop enum, continuing...';
END $$;

-- Add all required columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_id INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS region VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS league VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS season VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status VARCHAR(255) DEFAULT 'scheduled';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_elmt_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_opponent_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stream_url VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stream_streamed_by VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS faceit_lobby VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS vod VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS generate_slug BOOLEAN DEFAULT true;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add team foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_team_id_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    ALTER TABLE matches 
    ADD CONSTRAINT matches_team_id_fkey 
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 5. MATCHES ARRAY TABLES
-- ============================================

-- Producers/Observers table
CREATE TABLE IF NOT EXISTS matches_producers_observers (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL,
  staff_id INTEGER,
  name VARCHAR(255)
);

-- Casters table
CREATE TABLE IF NOT EXISTS matches_casters (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL,
  caster_id INTEGER,
  name VARCHAR(255)
);

-- Add foreign keys for matches_producers_observers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_producers_observers_parent_fkey'
  ) THEN
    ALTER TABLE matches_producers_observers 
    ADD CONSTRAINT matches_producers_observers_parent_fkey 
    FOREIGN KEY ("_parent_id") REFERENCES matches(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_producers_observers_staff_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production') THEN
    ALTER TABLE matches_producers_observers 
    ADD CONSTRAINT matches_producers_observers_staff_fkey 
    FOREIGN KEY (staff_id) REFERENCES production(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign keys for matches_casters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_casters_parent_fkey'
  ) THEN
    ALTER TABLE matches_casters 
    ADD CONSTRAINT matches_casters_parent_fkey 
    FOREIGN KEY ("_parent_id") REFERENCES matches(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_casters_caster_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production') THEN
    ALTER TABLE matches_casters 
    ADD CONSTRAINT matches_casters_caster_fkey 
    FOREIGN KEY (caster_id) REFERENCES production(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS matches_producers_observers_parent_idx ON matches_producers_observers("_parent_id");
CREATE INDEX IF NOT EXISTS matches_producers_observers_order_idx ON matches_producers_observers("_order");
CREATE INDEX IF NOT EXISTS matches_casters_parent_idx ON matches_casters("_parent_id");
CREATE INDEX IF NOT EXISTS matches_casters_order_idx ON matches_casters("_order");
CREATE INDEX IF NOT EXISTS matches_date_idx ON matches(date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);
CREATE INDEX IF NOT EXISTS matches_team_idx ON matches(team_id);

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

\echo ''
\echo '=== Migration Complete! ==='
\echo ''

\echo 'Users table:'
SELECT id, name, email, role FROM users ORDER BY created_at;

\echo ''
\echo 'Database tables created:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE 'users_%' OR table_name LIKE 'matches_%' OR table_name = 'teams')
ORDER BY table_name;

\echo ''
\echo 'Record counts:'
SELECT 
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM teams) AS teams,
  (SELECT COUNT(*) FROM matches) AS matches,
  (SELECT COUNT(*) FROM people) AS people;

\echo ''
\echo '=== All Done! Restart Payload: ==='
\echo 'docker compose -f docker-compose.prod.yml restart payload'
\echo ''
