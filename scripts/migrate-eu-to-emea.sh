#!/bin/bash

# Migration script to convert all EU region values to EMEA
# This updates teams, matches, and tournament template rules

echo "🔄 Migrating EU region to EMEA..."

# Check if we're in Docker or local
if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    # Running inside Docker
    PSQL_CMD="psql -U payload -d payload"
else
    # Running outside Docker (use docker compose exec)
    PSQL_CMD="docker compose exec -T postgres psql -U payload -d payload"
fi

# Run migration SQL
$PSQL_CMD << 'EOF'
-- Start transaction
BEGIN;

-- Update teams table
UPDATE teams SET region = 'EMEA' WHERE region = 'EU';

-- Update matches table
UPDATE matches SET region = 'EMEA' WHERE region = 'EU';

-- Update tournament template rules
UPDATE rules SET region = 'EMEA' WHERE region = 'EU';

-- Update the enum type to include EMEA (if not already present)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_teams_region' AND e.enumlabel = 'EMEA'
    ) THEN
        ALTER TYPE enum_teams_region ADD VALUE 'EMEA';
    END IF;
END $$;

-- For matches enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'enum_matches_region' AND e.enumlabel = 'EMEA'
    ) THEN
        ALTER TYPE enum_matches_region ADD VALUE 'EMEA';
    END IF;
END $$;

-- Commit transaction
COMMIT;

-- Show results
SELECT 
    'Teams' as table_name, 
    COUNT(*) as emea_count 
FROM teams 
WHERE region = 'EMEA'
UNION ALL
SELECT 
    'Matches' as table_name, 
    COUNT(*) as emea_count 
FROM matches 
WHERE region = 'EMEA'
UNION ALL
SELECT 
    'Tournament Rules' as table_name, 
    COUNT(*) as emea_count 
FROM rules 
WHERE region = 'EMEA';

EOF

echo "✅ Migration complete! All EU regions updated to EMEA."

