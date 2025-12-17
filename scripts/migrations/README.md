# MongoDB to PostgreSQL Migrations (DEPRECATED)

⚠️ **These files are from the MongoDB-to-PostgreSQL migration and are no longer used.**

## Status: ARCHIVED

These scripts were used during the original migration from MongoDB to PostgreSQL. They are kept for historical reference only.

## Current Migration System

Use the files in `/migrations/` instead:
- `migrations/001_initial_schema.sql` - **Current baseline schema**

## Files in This Directory

These files were created during the initial PostgreSQL migration:
- `init-schema.mjs` - Initial schema setup (deprecated)
- `add-display-name-columns.{sql,mjs}` - Adding display name fields (deprecated)
- `fix-schema-*.sql` - Schema corrections (deprecated)
- `populate-display-names.{sql,mjs}` - Data migrations (deprecated)
- `migrate-to-multiple-teams.sql` - Relationship changes (deprecated)
- `seed-water-only.mjs` - Test seeding script (deprecated)

## Why Deprecated?

1. **Clean baseline exists**: `migrations/001_initial_schema.sql` is the definitive starting point
2. **No MongoDB**: System now uses PostgreSQL exclusively
3. **Consolidated approach**: All troubleshooting scripts have been removed
4. **Single source of truth**: One migration file for fresh installations

## Do Not Use

These files should not be run on current databases. If you need to recreate the database from scratch, use `migrations/001_initial_schema.sql` instead.
