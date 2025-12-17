#!/bin/bash

echo "=== Production Database Migration SQL Generator ==="
echo ""
echo "This script will generate SQL to update your production database"
echo "to match your current collection schemas."
echo ""

# Connect to database and check what tables exist
echo "Checking current production database schema..."
echo ""

docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload <<'EOF'

-- Check which tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

EOF

echo ""
echo "=== COMPREHENSIVE MIGRATION SQL ==="
echo "Copy and paste the SQL below into psql:"
echo ""
echo "docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload"
echo ""
echo "--- START SQL ---"
cat <<'SQL'

-- ============================================
-- MIGRATION: Update Production Database Schema
-- ============================================

BEGIN;

-- 1. Create users_rels table for assignedTeams feature
CREATE TABLE IF NOT EXISTS users_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  teams_id INTEGER REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS users_rels_parent_idx ON users_rels(parent_id);
CREATE INDEX IF NOT EXISTS users_rels_teams_idx ON users_rels(teams_id);
CREATE INDEX IF NOT EXISTS users_rels_order_idx ON users_rels("order");
CREATE INDEX IF NOT EXISTS users_rels_path_idx ON users_rels(path);

-- 2. Add active column to teams (for filtering active/inactive teams)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 3. Create matches_producers_observers table (renamed from producersObservers)
CREATE TABLE IF NOT EXISTS matches_producers_observers (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES production(id) ON DELETE SET NULL,
  name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS matches_producers_observers_parent_idx ON matches_producers_observers("_parent_id");
CREATE INDEX IF NOT EXISTS matches_producers_observers_order_idx ON matches_producers_observers("_order");

-- 4. Verify all expected tables exist (these should already exist, but checking anyway)

-- People table should exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'people') THEN
    RAISE EXCEPTION 'People table does not exist - this migration requires an existing database';
  END IF;
END $$;

-- Teams table should exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    RAISE EXCEPTION 'Teams table does not exist - this migration requires an existing database';
  END IF;
END $$;

-- 5. Add any missing columns to existing tables

-- Ensure teams has all required columns
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo INTEGER REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS region VARCHAR(255);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS co_captain_id INTEGER REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure matches has all required columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS region VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS league VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS season VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_elmt_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_opponent_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stream_url VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stream_streamed_by VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS faceit_lobby VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS vod VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS generate_slug BOOLEAN DEFAULT true;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;

-- Commit all changes
COMMIT;

-- Verify the changes
SELECT 'Migration completed successfully!' AS status;

-- Show what was created/modified
SELECT 'Tables created/verified:' AS info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users_rels', 'matches_producers_observers')
ORDER BY table_name;

SELECT 'Teams table columns:' AS info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teams' 
  AND column_name IN ('active', 'logo', 'region', 'rating', 'slug')
ORDER BY column_name;

SQL

echo "--- END SQL ---"
echo ""
echo "=== SAFER ALTERNATIVE: Use Payload's migrate command ==="
echo ""
echo "Instead of manual SQL, you can let Payload handle it:"
echo ""
echo "1. Add to .env.production:"
echo "   PAYLOAD_DB_PUSH=true"
echo ""
echo "2. Stop and remove the payload container:"
echo "   docker compose -f docker-compose.prod.yml down payload"
echo ""
echo "3. Start payload (it will auto-migrate):"
echo "   docker compose -f docker-compose.prod.yml up -d payload"
echo ""
echo "4. Watch the logs:"
echo "   docker compose -f docker-compose.prod.yml logs -f payload"
echo ""
echo "5. After migration succeeds, disable push mode:"
echo "   Remove PAYLOAD_DB_PUSH=true from .env.production"
echo "   docker compose -f docker-compose.prod.yml restart payload"
echo ""
