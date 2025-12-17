-- Migration script to populate displayName for existing OrganizationStaff and Production records
-- Run this after add-display-name-columns.sql

-- Update organization_staff records
UPDATE organization_staff os
SET display_name = COALESCE(
  (SELECT p.name FROM people p WHERE p.id = os.person_id),
  os.slug,
  '[Untitled]'
)
WHERE display_name IS NULL OR display_name = '';

-- Update production records
UPDATE production pr
SET display_name = COALESCE(
  (SELECT p.name FROM people p WHERE p.id = pr.person_id),
  pr.slug,
  '[Untitled]'
)
WHERE display_name IS NULL OR display_name = '';

-- Success message
SELECT 'Migration complete! All displayName fields have been populated.' AS status;
