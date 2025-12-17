-- ============================================
-- MIGRATION 002: Fix User Hash Column Length
-- ============================================
-- Description: Change hash and salt columns to TEXT to accommodate long password hashes
-- Generated: 2025-12-17
-- Issue: Password hashes can exceed 255 characters
-- ============================================

BEGIN;

-- Change salt and hash from VARCHAR(255) to TEXT
ALTER TABLE users ALTER COLUMN salt TYPE TEXT;
ALTER TABLE users ALTER COLUMN hash TYPE TEXT;
ALTER TABLE users ALTER COLUMN reset_password_token TYPE TEXT;

COMMIT;

\echo ''
\echo '=== Migration 002 Complete! ==='
\echo 'User hash columns updated to TEXT'
\echo ''
