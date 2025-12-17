-- ============================================
-- FIX PRODUCTION COLUMN NAMES
-- ============================================
-- Payload PostgreSQL adapter uses snake_case
-- Our previous migration incorrectly used camelCase
-- ============================================

BEGIN;

-- Check current column names
SELECT 'Current production columns:' AS info;
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'production'
  AND column_name IN ('display_name', 'displayName', 'person_id')
ORDER BY column_name;

-- Rename displayName back to display_name if it was renamed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production' AND column_name = 'displayName'
  ) THEN
    ALTER TABLE production RENAME COLUMN "displayName" TO display_name;
    RAISE NOTICE 'Renamed displayName to display_name';
  END IF;
END $$;

-- Ensure display_name exists
ALTER TABLE production ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Populate display_name from person if empty
UPDATE production p
SET display_name = person.name
FROM people person
WHERE p.person_id = person.id
  AND (p.display_name IS NULL OR p.display_name = '');

-- Set default for any remaining nulls
UPDATE production
SET display_name = COALESCE(slug, '[Untitled]')
WHERE display_name IS NULL OR display_name = '';

COMMIT;

-- Verify
SELECT 'Fixed production columns:' AS info;
SELECT id, display_name, slug, type, person_id 
FROM production 
LIMIT 10;
