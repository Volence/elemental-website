# Clean Baseline - December 17, 2025

This document describes the clean baseline state of the Elemental Website application.

## Database Schema

**Single Source of Truth**: `migrations/001_initial_schema.sql`

This migration creates the complete PostgreSQL schema with:
- **Integer primary keys** (SERIAL) - Payload 3.x default
- All collections: Users, Teams, People, Production, OrganizationStaff, Matches, Pages, Media
- All relationship tables and indexes
- Payload internal tables (migrations, preferences, locked documents, etc.)

### Why Integer IDs?

Payload CMS 3.x with `push: true` generates **integer (SERIAL)** primary keys by default, not UUIDs. Our baseline migration matches exactly what Payload generates to ensure seamless compatibility.

## Seeding

Two seed options available from the admin dashboard:

### Seed Teams Only
- Clears and re-seeds all 29 teams
- Creates ~150+ People entries
- Links all team relationships
- **Duration**: ~30-60 seconds
- **Use case**: Reset teams data without affecting pages/users

### Seed Full Database  
- Seeds demo pages, media, and user
- Seeds all 29 teams
- **Duration**: Up to 5 minutes
- **Use case**: Complete fresh database setup for development

## Removed Files

All temporary troubleshooting scripts have been removed:
- ~~`migrations/001_initial_schema_uuid.sql`~~ (incorrect UUID approach)
- ~~`scripts/add-users-role-column.sql`~~
- ~~`scripts/complete-production-migration.sql`~~
- ~~`scripts/diagnose-database-ids.sql`~~
- ~~`scripts/fix-matches-*.sql`~~
- ~~`scripts/fix-production-*.sql`~~
- ~~`scripts/production-migration.sql`~~

## Clean Setup Process

### Development

1. **Start containers**:
   ```bash
   docker compose up -d
   ```

2. **Run baseline migration**:
   ```bash
   docker compose exec -T postgres psql -U payload -d payload < migrations/001_initial_schema.sql
   ```

3. **Visit admin panel**:
   - Go to http://localhost:3000/admin
   - Create your first user
   - Optional: Click "Seed Teams Only" to load all teams

### Production

1. **Deploy latest code**:
   ```bash
   cd ~/elemental-website
   git pull origin main
   docker compose -f docker-compose.prod.yml build
   ```

2. **Run baseline migration**:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < migrations/001_initial_schema.sql
   ```

3. **Restart services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Create first user**:
   - Visit https://elmt.gg/admin
   - Create admin user
   - Optional: Seed teams data

## Future Updates

When the schema changes:

1. **Never use `push: true` in production**
2. **Create numbered migrations**: `002_add_feature.sql`, `003_update_table.sql`, etc.
3. **Test locally first** with the new migration
4. **Backup production** before applying
5. **Apply migration** via `docker compose exec -T postgres psql...`

## Configuration

### Environment Variables

**Development** (`.env`):
```bash
DATABASE_URI=postgresql://payload:password@postgres:5432/payload
PAYLOAD_SECRET=your-secret-here
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

**Production** (`.env.production`):
```bash
DATABASE_URI=postgresql://payload:your-password@postgres:5432/payload
PAYLOAD_SECRET=your-production-secret
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
PAYLOAD_DB_PUSH=false  # Always false in production!
```

### Payload Config

```typescript
db: postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI || 'postgresql://build:build@localhost:5432/build',
  },
  // Only use push mode when PAYLOAD_DB_PUSH=true (development only)
  push: process.env.PAYLOAD_DB_PUSH === 'true' || false,
}),
```

## What's Working

✅ **All 29 teams seed successfully**  
✅ **Integer primary keys** (matching Payload default)  
✅ **Clean single migration** baseline  
✅ **No slug collisions** (searches by slug to reuse people)  
✅ **Extended seed timeout** (5 minutes for full database)  
✅ **Production deployment** process  
✅ **Database recovery** documented

## Deprecated/Removed

❌ UUID migration approach (Payload uses integers)  
❌ Temporary troubleshooting SQL scripts  
❌ MongoDB migration scripts (in `scripts/migrations/` - kept for reference only)  
❌ `push: true` in production (always use migrations)

## Next Steps

This is your clean baseline. Any future changes should:

1. **Add numbered migrations** (002, 003, etc.)
2. **Document changes** in this file
3. **Test thoroughly** before production
4. **Always backup** before schema changes

## Support

For issues or questions:
- Check `RECOVERY.md` for database recovery
- Check `migrations/README.md` for migration best practices
- Check `DEPLOYMENT.md` for production deployment steps
