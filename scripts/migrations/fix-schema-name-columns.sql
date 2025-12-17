-- Migration script to make name columns nullable in teams related tables
-- This fixes the schema mismatch where database has NOT NULL name columns
-- but Payload schema no longer includes them

-- Make name columns nullable in all teams-related tables
DO $$
DECLARE
    tbl_name text;
    tables text[] := ARRAY['teams_manager', 'teams_coaches', 'teams_captain', 'teams_roster', 'teams_subs'];
BEGIN
    FOREACH tbl_name IN ARRAY tables
    LOOP
        -- Check if name column exists and is NOT NULL, then make it nullable
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = tbl_name 
            AND column_name = 'name' 
            AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN name DROP NOT NULL', tbl_name);
            RAISE NOTICE 'Made name column nullable in %', tbl_name;
        ELSIF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = tbl_name 
            AND column_name = 'name'
        ) THEN
            RAISE NOTICE '% already has nullable name column', tbl_name;
        ELSE
            RAISE NOTICE '% does not have a name column (this is OK)', tbl_name;
        END IF;
    END LOOP;
END $$;
