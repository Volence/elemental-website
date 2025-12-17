-- ============================================
-- PRODUCTION DATABASE MIGRATION
-- ============================================
-- This SQL updates the production database to match
-- the current collection schemas without data loss.
--
-- To apply:
-- docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < scripts/production-migration.sql
-- ============================================

BEGIN;

-- 1. CREATE: users_rels table (for assignedTeams feature)
CREATE TABLE IF NOT EXISTS users_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL,
  path VARCHAR(255) NOT NULL,
  teams_id INTEGER
);

-- Add foreign keys and indexes for users_rels
DO $$
BEGIN
  -- Add foreign key to users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_rels_parent_id_fkey'
  ) THEN
    ALTER TABLE users_rels 
    ADD CONSTRAINT users_rels_parent_id_fkey 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key to teams
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_rels_teams_id_fkey'
  ) THEN
    ALTER TABLE users_rels 
    ADD CONSTRAINT users_rels_teams_id_fkey 
    FOREIGN KEY (teams_id) REFERENCES teams(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_rels_parent_idx ON users_rels(parent_id);
CREATE INDEX IF NOT EXISTS users_rels_teams_idx ON users_rels(teams_id);
CREATE INDEX IF NOT EXISTS users_rels_order_idx ON users_rels("order");
CREATE INDEX IF NOT EXISTS users_rels_path_idx ON users_rels(path);

-- 2. ALTER: Add active column to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 3. CREATE: matches_producers_observers table
CREATE TABLE IF NOT EXISTS matches_producers_observers (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL,
  staff_id INTEGER,
  name VARCHAR(255)
);

-- Add foreign keys and indexes for matches_producers_observers
DO $$
BEGIN
  -- Add foreign key to matches
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_producers_observers_parent_id_fkey'
  ) THEN
    ALTER TABLE matches_producers_observers 
    ADD CONSTRAINT matches_producers_observers_parent_id_fkey 
    FOREIGN KEY ("_parent_id") REFERENCES matches(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key to production
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_producers_observers_staff_id_fkey'
  ) THEN
    ALTER TABLE matches_producers_observers 
    ADD CONSTRAINT matches_producers_observers_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES production(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS matches_producers_observers_parent_idx ON matches_producers_observers("_parent_id");
CREATE INDEX IF NOT EXISTS matches_producers_observers_order_idx ON matches_producers_observers("_order");

-- 4. VERIFY: Check that all critical tables exist
DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  -- Check for required tables
  SELECT ARRAY_AGG(required_table)
  INTO missing_tables
  FROM (
    VALUES 
      ('users'), ('teams'), ('people'), ('matches'), 
      ('media'), ('pages'), ('production')
  ) AS required(required_table)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = required.required_table
  );

  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing_tables, ', ');
  END IF;

  RAISE NOTICE 'All required tables exist ✓';
END $$;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

\echo ''
\echo '=== Migration Summary ==='
\echo ''

-- Show newly created tables
\echo 'Tables created:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users_rels', 'matches_producers_observers')
ORDER BY table_name;

-- Show teams columns
\echo ''
\echo 'Teams table has active column:'
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'teams' AND column_name = 'active'
) AS active_column_exists;

-- Count relationships
\echo ''
\echo 'Database statistics:'
SELECT 
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM teams) AS total_teams,
  (SELECT COUNT(*) FROM people) AS total_people,
  (SELECT COUNT(*) FROM matches) AS total_matches;

\echo ''
\echo '=== Migration Complete! ==='
\echo 'Restart Payload to apply changes:'
\echo 'docker compose -f docker-compose.prod.yml restart payload'
\echo ''
