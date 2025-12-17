-- ============================================
-- FIX MATCHES STATUS ENUM ISSUE
-- ============================================
-- The enum_matches_status is preventing updates
-- We need to force it to VARCHAR
-- ============================================

BEGIN;

-- Step 1: Backup existing status values
CREATE TEMP TABLE temp_matches_status AS
SELECT id, status::text as status_text
FROM matches;

-- Step 2: Drop the status column completely
ALTER TABLE matches DROP COLUMN IF EXISTS status CASCADE;

-- Step 3: Recreate as VARCHAR
ALTER TABLE matches ADD COLUMN status VARCHAR(255) DEFAULT 'scheduled';

-- Step 4: Restore the values
UPDATE matches m
SET status = t.status_text
FROM temp_matches_status t
WHERE m.id = t.id;

-- Step 5: Drop the enum type (now safe because nothing uses it)
DROP TYPE IF EXISTS enum_matches_status CASCADE;

-- Step 6: Make status NOT NULL with default
ALTER TABLE matches ALTER COLUMN status SET NOT NULL;
ALTER TABLE matches ALTER COLUMN status SET DEFAULT 'scheduled';

COMMIT;

-- Verify
SELECT 'Matches status column fixed!' AS result;
SELECT id, title, status FROM matches;

-- Check enum is gone
SELECT typname 
FROM pg_type 
WHERE typname = 'enum_matches_status';
-- Should return 0 rows
