-- Migration script to make name columns nullable in staff tables
-- This fixes the schema mismatch where database has NOT NULL name columns
-- but Payload schema no longer includes them (we use People relationships instead)

-- Make name column nullable in organization_staff table
DO $$
BEGIN
    -- Check if name column exists and is NOT NULL, then make it nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organization_staff' 
        AND column_name = 'name' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE organization_staff ALTER COLUMN name DROP NOT NULL;
        RAISE NOTICE 'Made name column nullable in organization_staff';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organization_staff' 
        AND column_name = 'name'
    ) THEN
        RAISE NOTICE 'organization_staff.name already has nullable name column';
    ELSE
        RAISE NOTICE 'organization_staff does not have a name column (this is OK)';
    END IF;
END $$;

-- Make name column nullable in production table
DO $$
BEGIN
    -- Check if name column exists and is NOT NULL, then make it nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'production' 
        AND column_name = 'name' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE production ALTER COLUMN name DROP NOT NULL;
        RAISE NOTICE 'Made name column nullable in production';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'production' 
        AND column_name = 'name'
    ) THEN
        RAISE NOTICE 'production.name already has nullable name column';
    ELSE
        RAISE NOTICE 'production does not have a name column (this is OK)';
    END IF;
END $$;
