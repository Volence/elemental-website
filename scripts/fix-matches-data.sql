-- ============================================
-- FIX MATCHES DATA ISSUES
-- ============================================
-- 1. Fix status values (only 'scheduled' or 'cancelled' allowed)
-- 2. Fix team_id (currently has MongoDB ObjectIds, needs to be NULL or valid team ID)
-- ============================================

BEGIN;

-- Show current matches status values
SELECT 'Current matches data:' AS info;
SELECT id, title, status, team_id FROM matches;

-- Fix status - set any invalid values to 'scheduled'
UPDATE matches
SET status = 'scheduled'
WHERE status NOT IN ('scheduled', 'cancelled') OR status IS NULL;

-- Fix team_id - set to NULL since old MongoDB ObjectIds can't be converted
-- You'll need to manually reassign teams in the admin panel
UPDATE matches
SET team_id = NULL
WHERE team_id IS NOT NULL;

COMMIT;

-- Show fixed data
SELECT 'Fixed matches data:' AS info;
SELECT id, title, status, team_id, opponent, date FROM matches ORDER BY id;

-- Show instructions
SELECT '
IMPORTANT: After this fix, you will need to:
1. Edit each match in the admin panel
2. Re-select the correct team from the dropdown
3. Verify the status is correct (scheduled or cancelled)
' AS next_steps;
