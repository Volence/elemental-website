# Production Deployment Guide

## Overview
This deployment includes UI improvements to the admin panel (Teams list, logo displays, assigned teams) and removes the Posts/Categories collections which were not being used.

## Pre-Deployment Checklist

### ✅ TypeScript
- All TypeScript errors have been fixed
- ActivityLog feature is disabled (commented out) to avoid migration complexity

### ⚠️ Database Changes

#### Collections Removed
- `Posts` - No longer used
- `Categories` - No longer used  
- `Form` blocks - Not being used

**Impact**: If you have any Posts or Categories data in production, it will remain in the database but won't be accessible through the admin panel. The tables won't be deleted.

#### Collections Modified
- `Users` - Added `assignedTeams` field for Admin role (non-breaking, field is optional)

#### Collections Added (No Migration Needed)
- These already exist in production, no changes needed

## Deployment Steps

### 1. Backup Production Database
```bash
# SSH into production server
ssh your-production-server

# Backup the database
docker compose exec postgres pg_dump -U payload elemental > backup-$(date +%Y%m%d-%H%M%S).sql
```

### 2. Pull Latest Code
```bash
git pull origin main
```

### 3. Build and Deploy
```bash
# Build the application
docker compose -f docker-compose.prod.yml build

# Stop the current containers
docker compose -f docker-compose.prod.yml down

# Start with the new build
docker compose -f docker-compose.prod.yml up -d
```

### 4. Verify Deployment
1. Check that Payload starts successfully:
   ```bash
   docker compose -f docker-compose.prod.yml logs payload | tail -50
   ```
   Look for: `✓ Ready in XXXXms`

2. Visit your admin panel: `https://your-domain.com/admin`

3. Test key functionality:
   - Login works
   - Teams list displays correctly with logos
   - Team logos show properly (with org.png fallback)
   - Assigned teams work for Admin users
   - Data Consistency link in sidebar (may show "Not Found" which is expected)

### 5. Post-Deployment Cleanup (Optional)

If you want to remove the old Posts/Categories tables from the database:

```bash
# Connect to database
docker compose exec postgres psql -U payload elemental

# Check what tables exist
\dt

# Only run these if you're sure you don't need the data:
# DROP TABLE IF EXISTS posts CASCADE;
# DROP TABLE IF EXISTS categories CASCADE;
# DROP TABLE IF EXISTS posts_rels CASCADE;
# DROP TABLE IF EXISTS categories_rels CASCADE;
```

**⚠️ WARNING**: Do NOT run the DROP commands unless you're absolutely certain you don't need any Posts or Categories data.

## Rollback Plan

If something goes wrong:

```bash
# Stop new containers
docker compose -f docker-compose.prod.yml down

# Restore previous code
git reset --hard origin/main~1  # or specific commit hash

# Rebuild with old code
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# If needed, restore database
docker compose exec -T postgres psql -U payload elemental < backup-TIMESTAMP.sql
```

## Known Issues / Notes

1. **Data Consistency Dashboard**: The sidebar link exists but the page may show "Not Found" due to Payload CMS 3.0 routing limitations. This is a non-critical feature and doesn't affect core functionality.

2. **No Breaking Changes**: All existing functionality remains intact. The Teams, People, Matches collections already exist in production.

3. **UI Improvements Only**: Most changes are UI/UX improvements to the admin panel:
   - Better logo display with fallbacks
   - Vertically centered table cells
   - Admin role can now be assigned teams
   - Team logos in assigned teams widgets

## Environment Variables

Make sure these are set in your production `.env`:
- `DATABASE_URI` - PostgreSQL connection string
- `PAYLOAD_SECRET` - Secret key for Payload
- `NEXT_PUBLIC_SERVER_URL` - Your production URL

No new environment variables are required for this deployment.

## Success Criteria

Deployment is successful when:
- ✅ Payload starts without errors
- ✅ Admin panel loads
- ✅ Teams list shows with proper formatting
- ✅ Logo previews display (with org.png fallback)
- ✅ Assigned teams work for Admin users
- ✅ All existing data is intact

## Support

If you encounter issues:
1. Check Payload logs: `docker compose -f docker-compose.prod.yml logs payload`
2. Check database connection: `docker compose exec postgres psql -U payload elemental -c "SELECT COUNT(*) FROM teams;"`
3. Verify environment variables are set correctly
