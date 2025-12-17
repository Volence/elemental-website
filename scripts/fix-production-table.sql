-- ============================================
-- FIX PRODUCTION TABLE STRUCTURE
-- ============================================
-- Update production table to match current schema
-- ============================================

BEGIN;

-- 1. Fix the type enum (convert to VARCHAR for flexibility)
DO $$
BEGIN
  -- Convert type column from enum to VARCHAR
  ALTER TABLE production ALTER COLUMN type TYPE VARCHAR(255);
  
  -- Drop old enum
  DROP TYPE IF EXISTS enum_casters_type CASCADE;
  
  RAISE NOTICE 'Converted type column to VARCHAR';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not convert type column: %', SQLERRM;
END $$;

-- 2. Ensure displayName column exists (table shows display_name)
-- Schema uses displayName but table might have display_name
DO $$
BEGIN
  -- Rename display_name to displayName if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE production RENAME COLUMN display_name TO "displayName";
    RAISE NOTICE 'Renamed display_name to displayName';
  END IF;
END $$;

-- 3. Ensure person_id exists (already there)
ALTER TABLE production ADD COLUMN IF NOT EXISTS person_id INTEGER;

-- 4. Add missing columns if needed
ALTER TABLE production ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE production ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 5. Clean up old social media columns (moved to people table)
ALTER TABLE production DROP COLUMN IF EXISTS twitter CASCADE;
ALTER TABLE production DROP COLUMN IF EXISTS twitch CASCADE;
ALTER TABLE production DROP COLUMN IF EXISTS youtube CASCADE;
ALTER TABLE production DROP COLUMN IF EXISTS instagram CASCADE;

-- 6. Fix any invalid type values
UPDATE production
SET type = CASE
  WHEN type IN ('caster', 'observer', 'producer', 'observer-producer', 'observer-producer-caster') THEN type
  ELSE 'caster' -- Default to caster for invalid values
END;

-- 7. Populate displayName from person if empty
UPDATE production p
SET "displayName" = person.name
FROM people person
WHERE p.person_id = person.id
  AND (p."displayName" IS NULL OR p."displayName" = '');

-- 8. Populate slug from person if empty
UPDATE production p
SET slug = person.slug
FROM people person
WHERE p.person_id = person.id
  AND (p.slug IS NULL OR p.slug = '');

COMMIT;

-- Verify
SELECT 'Production table fixed!' AS result;
SELECT id, "displayName", slug, type, person_id 
FROM production 
LIMIT 10;

-- Show column structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'production'
ORDER BY column_name;
