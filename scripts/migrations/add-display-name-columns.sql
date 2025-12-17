-- Migration script to add display_name column to organization_staff and production tables
-- Run this before populate-display-names.sql

-- Add display_name column to organization_staff if it doesn't exist
ALTER TABLE organization_staff 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add display_name column to production if it doesn't exist
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Success message
SELECT 'Schema migration complete! The display_name columns have been added.' AS status;
