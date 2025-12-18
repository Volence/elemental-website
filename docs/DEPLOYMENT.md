# Deployment Guide

## Working Configuration (as of December 2024)

### What Works

The application is currently running successfully with the following setup:

#### Local Development
- **Mode**: Development (`npm run dev`)
- **Payload Version**: 3.68.0
- **Database**: PostgreSQL 16 with **integer IDs** (SERIAL)
- **Environment**: `.env.local` with `PAYLOAD_DB_PUSH=true`

#### Production Server (elmt.gg)
- **Mode**: Development (`npm run dev`) - Yes, dev mode in production!
- **Payload Version**: 3.68.0
- **Database**: PostgreSQL 16 with **integer IDs** (SERIAL)
- **Docker Compose**: `docker-compose.dev.yml`
- **Environment**: `.env.production` with `PAYLOAD_DB_PUSH=true`

### Why Dev Mode in Production?

**TL;DR**: Next.js 15 production build has authentication issues that don't occur in dev mode.

The production build (`next build` + `next start`) causes login redirect loops. Even with correct cookie settings and `dynamic = 'force-dynamic'` exports, the admin panel fails to recognize authenticated sessions. Dev mode forces all routes to be truly dynamic and authentication works perfectly.

**Performance Note**: Dev mode is slower than production, but it's stable and functional. Consider this a temporary solution until the Next.js 15 + Payload 3.x authentication issues are resolved.

### Critical Configuration

#### 1. payload.config.ts

```typescript
db: postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI || 'postgresql://build:build@localhost:5432/build',
  },
  // Use default UUID IDs (idType: 'serial' is broken in Payload 3.68.0)
  push: process.env.PAYLOAD_DB_PUSH === 'true' || false,
}),
```

**Important**: Do NOT use `idType: 'serial'` - it's broken in Payload 3.68.0. However, the database schema DOES use integer IDs because it was created by copying from the local working database.

#### 2. Users Collection

```typescript
auth: true,
```

Keep auth configuration simple. The default settings work fine.

#### 3. Environment Variables

**Required in both `.env.local` and `.env.production`:**

```bash
DATABASE_URI=postgresql://payload:password@postgres:5432/payload
PAYLOAD_SECRET=your-secret-here
NEXT_PUBLIC_SERVER_URL=https://elmt.gg  # or http://localhost:3000 for local
PAYLOAD_DB_PUSH=true
```

### Database Schema

The database uses **integer IDs** (SERIAL type), NOT UUIDs. This schema was created by:

1. Running Payload locally with `PAYLOAD_DB_PUSH=true` (when it was working)
2. Exporting the schema with `pg_dump`
3. Importing it to the production database

**To recreate the schema on a fresh database:**

```bash
# From your local machine
docker compose exec -T postgres pg_dump -U payload -d payload --schema-only --no-owner --no-privileges > local_schema.sql

# Copy to production server
scp -i ~/.ssh/id_rsa local_schema.sql ubuntu@server:~/

# Apply on production
ssh ubuntu@server "cd ~/elemental-website && docker compose -f docker-compose.dev.yml exec -T postgres psql -U payload -d payload < ~/local_schema.sql"
```

### Deployment Process

**To deploy code changes:**

```bash
# 1. Commit and push your changes locally
git add -A
git commit -m "Your changes"
git push origin main

# 2. Pull and restart on server
ssh ubuntu@129.213.21.96
cd ~/elemental-website
git pull origin main
docker compose -f docker-compose.dev.yml restart payload

# Wait ~30 seconds for Next.js dev server to restart
```

### Docker Compose Files

**docker-compose.dev.yml** (what's currently running in production):
- Uses `Dockerfile.dev`
- Runs `npm run dev`
- Hot reload enabled (not utilized in production, but harmless)
- Mounts source code as volumes

**docker-compose.prod.yml** (not currently used):
- Uses main `Dockerfile`
- Runs `npm run build` + `npm start`
- Optimized production build
- **Currently has authentication redirect loop bug**

### Known Issues

1. **Production Build Auth Bug**: `next build` + `next start` causes login redirect loops
   - **Related GitHub Issue**: [#14656](https://github.com/payloadcms/payload/issues/14656) - Similar authentication failure in Server Actions
   - **Workaround**: Use dev mode (`npm run dev`) in production until resolved
   
2. **`idType: 'serial'` Broken**: Setting `idType: 'serial'` in Payload 3.68.0 causes UUID conflicts
   - The config option is ignored and Payload still generates UUIDs internally
   - **Workaround**: Use the default UUID ID type, or manually create integer ID schema
   
3. **`push: true` Unreliable**: Database schema creation via `push: true` doesn't always work reliably on server
   - **Related GitHub Issue**: [#7312](https://github.com/payloadcms/payload/issues/7312) - Database connection issues during generation
   - **Workaround**: Manually apply schema from local working database

4. **Next.js 15 Compatibility**: Payload 3.x requires Next.js 15, but has some rough edges
   - **Related GitHub Issue**: [#8995](https://github.com/payloadcms/payload/issues/8995) - Next.js 15 requirement not well documented

### Troubleshooting

**Login redirect loop:**
- Verify you're running in dev mode (`npm run dev`)
- Check that cookies are being set (browser dev tools → Application → Cookies)
- Ensure `NEXT_PUBLIC_SERVER_URL` matches your domain

**"Something went wrong" on user creation:**
- Check for UUID vs integer ID mismatches in logs
- Verify database schema matches local (use `\d users` in psql)
- Ensure `PAYLOAD_DB_PUSH=true` is set

**"Application error: a server-side exception has occurred":**
- Usually means database tables don't exist
- Apply the local schema SQL as shown above
- Restart payload container

### Future Improvements

When Payload 3.x + Next.js 15 authentication is stabilized:

1. Switch back to production build mode
2. Use proper migrations instead of `push: true`
3. Consider switching to UUID IDs (Payload default) if `idType: 'serial'` gets fixed
4. Add proper health checks and monitoring

### Contact

For questions about this setup, contact the team that got this working (December 2024).
