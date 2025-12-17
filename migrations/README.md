# Database Migrations

This directory contains SQL migrations for the Elemental Website database schema.

## Migration Files

### 001_initial_schema_uuid.sql (CURRENT)
**Created:** 2025-12-17  
**Description:** Baseline schema with UUID primary keys

Creates the complete initial database structure using UUID primary keys (Payload 3.x default) including:

### 001_initial_schema.sql (DEPRECATED - DO NOT USE)
**Description:** Old integer ID schema - replaced by UUID version

The complete database structure includes:
- User authentication and roles
- Teams with rosters and staff
- People (players/staff)
- Production staff (casters/observers)
- Matches and scheduling
- Pages (CMS content)
- Media uploads
- All relationship tables and indexes

**Tables created:** 
- `users`, `users_sessions`, `users_rels`
- `teams` + 6 array tables (achievements, roster, coaches, etc.)
- `people`
- `production`
- `organization_staff`
- `matches` + 2 array tables (casters, producers/observers)
- `pages`, `pages_blocks`
- `media`
- `payload_*` (internal Payload CMS tables)

## Running Migrations

### Development (Local)
```bash
# Using Docker Compose (UUID version)
docker compose exec -T postgres psql -U payload -d payload < migrations/001_initial_schema_uuid.sql
```

### Production
```bash
# Run on your production server (UUID version)
cd ~/elemental-website
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < migrations/001_initial_schema_uuid.sql
```

## Creating New Migrations

When adding new fields or collections:

1. **Create a new migration file:**
   ```bash
   # Use sequential numbering: 002, 003, etc.
   touch migrations/002_add_feature.sql
   ```

2. **Follow this template:**
   ```sql
   -- ============================================
   -- MIGRATION 002: Add Feature Name
   -- ============================================
   -- Description: What this migration does
   -- Generated: YYYY-MM-DD
   -- ============================================

   BEGIN;

   -- Your changes here
   ALTER TABLE table_name ADD COLUMN new_column VARCHAR(255);

   -- Always create indexes for foreign keys and commonly queried fields
   CREATE INDEX IF NOT EXISTS idx_name ON table_name(column_name);

   COMMIT;

   -- Verification
   \echo 'Migration 002 complete!'
   ```

3. **Best Practices:**
   - Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency
   - Wrap in `BEGIN`/`COMMIT` transactions
   - Create indexes for foreign keys and query fields
   - Add verification queries at the end
   - Document what changed

4. **Test locally first:**
   ```bash
   # Test on local database
   docker compose exec -T postgres psql -U payload -d payload < migrations/002_your_migration.sql
   
   # Verify it worked
   docker compose exec postgres psql -U payload -d payload -c "\d table_name"
   ```

5. **Deploy to production:**
   ```bash
   # Backup first!
   docker compose -f docker-compose.prod.yml exec -T postgres \
     pg_dump -U payload payload > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Run migration
   docker compose -f docker-compose.prod.yml exec -T postgres \
     psql -U payload -d payload < migrations/002_your_migration.sql
   ```

## Migration Naming Convention

- `001_initial_schema.sql` - Baseline schema
- `002_add_feature_name.sql` - Feature additions
- `003_modify_table_name.sql` - Schema modifications  
- `004_fix_data_issue.sql` - Data fixes

## Schema Reference

See `001_initial_schema.sql` for the complete baseline schema including:
- All table definitions
- Column types and constraints
- Indexes and foreign keys
- Default values

## Troubleshooting

### Migration fails with "relation already exists"
- Migrations should be idempotent using `IF NOT EXISTS` / `IF EXISTS`
- Safe to re-run the same migration multiple times

### Foreign key constraint violations
- Ensure referenced tables exist first
- Check data integrity before adding constraints

### Permission denied errors
- Ensure PostgreSQL user has sufficient privileges:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE payload TO payload;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO payload;
  ```

## Rollback

If a migration fails:

```bash
# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U payload -d payload < backup_TIMESTAMP.sql
```

Always backup before running migrations on production!
