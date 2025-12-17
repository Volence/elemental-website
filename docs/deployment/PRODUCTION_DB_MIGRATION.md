# Production Database Migration Guide

## What This Migration Does

Updates your production database schema to match your new code:

1. **Creates `users_rels` table** - Enables the "Assigned Teams" feature for Admin users
2. **Adds `teams.active` column** - Allows filtering active/inactive teams
3. **Creates `matches_producers_observers` table** - Fixes match producer/observer tracking

**✅ SAFE**: No data loss, only adds new tables/columns

---

## Option 1: Automated SQL Migration (Recommended)

### Run the Complete Migration

On your production server:

```bash
cd ~/elemental-website

# Apply all migrations in one command
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < scripts/production-migration.sql

# Restart Payload
docker compose -f docker-compose.prod.yml restart payload

# Verify it worked
docker compose -f docker-compose.prod.yml logs payload | grep "Ready"
```

You should see: `✓ Ready in XXXms` with no schema errors!

---

## Option 2: Manual Step-by-Step (If you prefer control)

```bash
# 1. Connect to database
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload
```

Then run these SQL commands:

```sql
-- Create users_rels for assignedTeams
CREATE TABLE IF NOT EXISTS users_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  teams_id INTEGER REFERENCES teams(id) ON DELETE CASCADE
);
CREATE INDEX users_rels_parent_idx ON users_rels(parent_id);
CREATE INDEX users_rels_teams_idx ON users_rels(teams_id);

-- Add active column to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create matches_producers_observers
CREATE TABLE IF NOT EXISTS matches_producers_observers (
  id SERIAL PRIMARY KEY,
  "_order" INTEGER NOT NULL,
  "_parent_id" INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES production(id) ON DELETE SET NULL,
  name VARCHAR(255)
);
CREATE INDEX matches_producers_observers_parent_idx ON matches_producers_observers("_parent_id");

-- Exit
\q
```

Then restart:
```bash
docker compose -f docker-compose.prod.yml restart payload
```

---

## Option 3: Let Payload Auto-Migrate (Most Automatic)

**⚠️ Warning**: This method is experimental and might fail silently.

```bash
# 1. Enable push mode
echo 'PAYLOAD_DB_PUSH=true' >> .env.production

# 2. Rebuild container to pick up env var
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# 3. Watch logs for migration
docker compose -f docker-compose.prod.yml logs -f payload
# Look for "Creating table..." messages

# 4. Disable push mode once done
sed -i '/PAYLOAD_DB_PUSH=true/d' .env.production
docker compose -f docker-compose.prod.yml restart payload
```

---

## Verification

After migration, check that everything works:

```bash
# 1. Check Payload is running
docker compose -f docker-compose.prod.yml logs payload | tail -20
# Should see: ✓ Ready in XXXms

# 2. Verify tables were created
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "\dt users_rels"

# 3. Test the admin panel
# Visit: https://elmt.gg/admin
# - Login should work
# - Teams list should load
# - No red errors in browser console
```

---

## What to Expect

### Before Migration:
- ❌ "relation users_rels does not exist"
- ❌ "column teams.active does not exist"
- ❌ "relation matches_producers_observers does not exist"
- ❌ Admin panel shows errors

### After Migration:
- ✅ No database errors
- ✅ Admin panel loads
- ✅ Teams list displays correctly
- ✅ Logo previews work
- ✅ Assigned teams feature available

---

## Troubleshooting

### If migration fails:

1. **Check what tables already exist:**
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "\dt"
   ```

2. **Check for specific missing pieces:**
   ```bash
   # Check if users_rels exists
   docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "SELECT * FROM users_rels LIMIT 1;"

   # Check if teams.active exists
   docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "SELECT active FROM teams LIMIT 1;"
   ```

3. **View detailed error logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs payload --tail=100 | grep -i error
   ```

### Still having issues?

Run the diagnostic script:
```bash
./scripts/generate-production-migration.sh
```

This will show you exactly what's missing and generate custom SQL for your specific situation.

---

## Rollback

If you need to undo the migration (NOT recommended unless something broke):

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload
```

```sql
DROP TABLE IF EXISTS users_rels CASCADE;
DROP TABLE IF EXISTS matches_producers_observers CASCADE;
ALTER TABLE teams DROP COLUMN IF EXISTS active;
```

---

## Summary

**Recommended approach**: Use Option 1 (Automated SQL Migration)

It's the safest, fastest, and most reliable method. The SQL file is idempotent (safe to run multiple times) and includes verification checks.

**Time required**: ~30 seconds
**Risk level**: Very Low
**Data loss risk**: None
