-- ============================================
-- DIAGNOSE DATABASE ID ISSUES
-- ============================================
-- Check which tables still have MongoDB ObjectIds
-- ============================================

-- Check production table
SELECT 'Production table IDs:' AS info;
SELECT id, name, role, pg_typeof(id) as id_type 
FROM production 
LIMIT 5;

-- Check if production IDs are numeric
SELECT 'Non-numeric production IDs:' AS info;
SELECT COUNT(*) as count
FROM production
WHERE id::text ~ '[^0-9]';

-- Check people table
SELECT 'People table IDs:' AS info;
SELECT id, name, pg_typeof(id) as id_type 
FROM people 
LIMIT 5;

-- Check teams table
SELECT 'Teams table IDs:' AS info;
SELECT id, name, pg_typeof(id) as id_type 
FROM teams 
LIMIT 5;

-- Check all table columns that might have ObjectIds
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name LIKE '%_id'
    AND table_name IN ('production', 'people', 'teams', 'matches', 'matches_casters', 'matches_producers_observers')
ORDER BY table_name, column_name;
