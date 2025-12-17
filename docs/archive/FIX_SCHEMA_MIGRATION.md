# Fix Database Schema Migration

> **Note:** This migration has been completed. This document is kept for historical reference.

## Problem

The database had `NOT NULL` constraints on `name` columns in team-related tables (`teams_manager`, `teams_coaches`, `teams_captain`, `teams_roster`, `teams_subs`), but the Payload CMS schema no longer includes these `name` fields (they've been replaced with `person` relationships). This caused seeding to fail with:

```
null value in column "name" of relation "teams_manager" violates not-null constraint
```

## Solution

The migration script to make these `name` columns nullable is located at `scripts/migrations/fix-schema-name-columns.mjs`:

```bash
cd ~/elemental-website

# Make sure postgres is running
docker compose -f docker-compose.prod.yml up -d postgres
sleep 5

# Get environment variables
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
export PAYLOAD_SECRET=$(grep PAYLOAD_SECRET .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

# Get DATABASE_URI from .env.production
export DATABASE_URI=$(grep DATABASE_URI .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

# Run migration script using a temporary container
docker run --rm \
  --network host \
  -e DATABASE_URI="${DATABASE_URI}" \
  -v "$(pwd):/app" \
  -w /app \
  node:22.17.0-alpine \
  sh -c "apk add --no-cache libc6-compat && \
         corepack enable pnpm && \
         pnpm i --frozen-lockfile > /dev/null 2>&1 && \
         pnpm add pg > /dev/null 2>&1 && \
         node scripts/migrations/fix-schema-name-columns.mjs"
```

## What the Script Does

The migration script:
1. Connects to your PostgreSQL database
2. Checks each team-related table (`teams_manager`, `teams_coaches`, `teams_captain`, `teams_roster`, `teams_subs`)
3. Makes the `name` column nullable if it exists and is currently `NOT NULL`
4. Reports the status of each table

## After Migration

Once the migration completes successfully:

1. **Restart your payload container** (if running):
   ```bash
   docker compose -f docker-compose.prod.yml restart payload
   ```

2. **Try seeding again** using the "Seed Teams Only" button in the admin dashboard.

The seeding should now work because:
- The `name` columns are nullable, so Payload won't fail when inserting without them
- The `person` relationships will be properly stored
- The legacy `name` columns will remain (but empty) for backward compatibility

## Future Cleanup

Once you're confident everything is working, you can optionally drop the `name` columns entirely in a future migration:

```sql
ALTER TABLE teams_manager DROP COLUMN name;
ALTER TABLE teams_coaches DROP COLUMN name;
ALTER TABLE teams_captain DROP COLUMN name;
ALTER TABLE teams_roster DROP COLUMN name;
ALTER TABLE teams_subs DROP COLUMN name;
```

But for now, making them nullable is sufficient and safer.
