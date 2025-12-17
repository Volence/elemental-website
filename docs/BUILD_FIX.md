# Build Issue Fix

## Problem
Next.js build fails when it can't connect to the database during the "Collecting page data" phase, even though all pages are configured as dynamic.

## Solution
The build process needs the database to be available. You have two options:

### Option 1: Build with Database Available (Recommended)

Create a temporary docker compose file for building:

```bash
# Start postgres in the background
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for it to be ready
sleep 10

# Build with database available
DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@localhost:5432/payload" \
docker compose -f docker-compose.prod.yml build payload

# Stop postgres (optional, if you want to start fresh)
docker compose -f docker-compose.prod.yml stop postgres
```

### Option 2: Build Without Database (Pages Will Be Generated at Runtime)

If you can't have the database available during build, the build will fail, but you can work around it:

1. Build will show database connection errors
2. Pages are configured as `dynamic = 'force-dynamic'`, so they'll be generated at runtime
3. The app will work correctly once started with the database available

However, Next.js won't create the `.next/standalone` directory if the build fails completely, so this approach may not work for production deployments.

## Recommended Approach

For production, always build with the database available using Option 1.
