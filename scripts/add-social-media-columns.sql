-- Add Social Media department columns to users and invite_links tables
-- Run this migration to add the missing columns

-- Add to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS departments_is_social_media_staff boolean DEFAULT false;

-- Add to invite_links table
ALTER TABLE invite_links 
ADD COLUMN IF NOT EXISTS departments_is_social_media_staff boolean DEFAULT false;

-- Verify columns were added
SELECT 
    'users' as table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name LIKE '%social_media%';

SELECT 
    'invite_links' as table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'invite_links' 
    AND column_name LIKE '%social_media%';

