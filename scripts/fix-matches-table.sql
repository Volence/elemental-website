-- ============================================
-- FIX MATCHES TABLE SCHEMA
-- ============================================
-- Ensure all required columns exist for matches
-- ============================================

BEGIN;

-- Check if matches table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matches') THEN
    RAISE EXCEPTION 'Matches table does not exist';
  END IF;
END $$;

-- Add any missing columns to matches table
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

-- Add foreign key for team relationship (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'matches_team_id_fkey'
  ) THEN
    -- Only add if teams table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
      ALTER TABLE matches 
      ADD CONSTRAINT matches_team_id_fkey 
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Ensure matches_producers_observers table exists (created in previous migration)
CREATE TABLE IF NOT EXISTS matches_producers_observers (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL,
  staff_id INTEGER,
  name VARCHAR(255)
);

-- Add foreign keys for matches_producers_observers if missing
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
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production') THEN
      ALTER TABLE matches_producers_observers 
      ADD CONSTRAINT matches_producers_observers_staff_fkey 
      FOREIGN KEY (staff_id) REFERENCES production(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Ensure matches_casters table exists
CREATE TABLE IF NOT EXISTS matches_casters (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL,
  caster_id INTEGER,
  name VARCHAR(255)
);

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
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production') THEN
      ALTER TABLE matches_casters 
      ADD CONSTRAINT matches_casters_caster_fkey 
      FOREIGN KEY (caster_id) REFERENCES production(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS matches_casters_parent_idx ON matches_casters("_parent_id");
CREATE INDEX IF NOT EXISTS matches_casters_order_idx ON matches_casters("_order");
CREATE INDEX IF NOT EXISTS matches_date_idx ON matches(date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);
CREATE INDEX IF NOT EXISTS matches_team_idx ON matches(team_id);

COMMIT;

-- Verify the changes
SELECT 'Matches table columns:' AS info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'matches'
  AND column_name IN ('title', 'team_id', 'opponent', 'date', 'status', 'slug')
ORDER BY column_name;

SELECT 'Matches related tables:' AS info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'matches%'
ORDER BY table_name;

SELECT 'Current matches count:' AS info;
SELECT COUNT(*) as total_matches FROM matches;
