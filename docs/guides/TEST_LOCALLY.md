# Local Testing Guide

Test your production build locally before deploying to your server.

## Quick Start

1. **Create test environment file:**
   ```bash
   cp .env.test.example .env.test
   ```

2. **Build and test:**
   ```bash
   ./test-build-local.sh
   ```

3. **Visit:** http://localhost:3000

4. **Stop when done:**
   ```bash
   docker compose -f docker-compose.test.yml down
   ```

## Manual Testing Steps

### Step 1: Create Test Environment

```bash
cp .env.test.example .env.test
```

Edit `.env.test` if needed (defaults should work for local testing).

### Step 2: Build Docker Image

```bash
docker compose -f docker-compose.test.yml build
```

This will:
- Build the Next.js production bundle
- Create optimized Docker image
- Test that everything compiles correctly

### Step 3: Start Services

```bash
docker compose -f docker-compose.test.yml up -d
```

### Step 4: Check Logs

```bash
docker compose -f docker-compose.test.yml logs -f
```

Watch for any errors. You should see:
- PostgreSQL starting up
- Next.js server starting
- "Ready" messages

### Step 5: Test the Application

1. **Visit homepage:** http://localhost:3000
2. **Visit admin panel:** http://localhost:3000/admin
3. **Create admin user** (first time only)
4. **Test key pages:**
   - Teams: http://localhost:3000/teams
   - Players: http://localhost:3000/players/[slug]
   - Staff: http://localhost:3000/staff
   - Matches: http://localhost:3000/matches

### Step 6: Test Build Errors

If you see build errors, fix them locally:

```bash
# Stop containers
docker compose -f docker-compose.test.yml down

# Rebuild after fixing code
docker compose -f docker-compose.test.yml build --no-cache

# Start again
docker compose -f docker-compose.test.yml up -d
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use (from dev server):

```bash
# Stop dev server first
docker compose down

# Or use different port in docker-compose.test.yml
# Change '3000:3000' to '3001:3000'
```

### Database Connection Errors

```bash
# Check if postgres is running
docker compose -f docker-compose.test.yml ps

# Check postgres logs
docker compose -f docker-compose.test.yml logs postgres

# Restart postgres
docker compose -f docker-compose.test.yml restart postgres
```

### Build Fails

```bash
# Check build logs
docker compose -f docker-compose.test.yml build 2>&1 | tee build.log

# Common issues:
# - TypeScript errors (fix in code)
# - Missing dependencies (check package.json)
# - Environment variables (check .env.test)
```

### Clean Up

```bash
# Stop and remove containers
docker compose -f docker-compose.test.yml down

# Remove volumes (deletes test database)
docker compose -f docker-compose.test.yml down -v

# Remove images
docker compose -f docker-compose.test.yml down --rmi all
```

## What Gets Tested

✅ **Build Process**
- Next.js production build
- TypeScript compilation
- Docker image creation

✅ **Runtime**
- Application starts correctly
- Database connection works
- Admin panel accessible
- Frontend pages load

✅ **Production Features**
- Optimized bundle size
- Static file serving
- API routes work

## Next Steps

Once local testing passes:

1. **Fix any errors** found during testing
2. **Commit your changes**
3. **Deploy to production** using `deploy.sh` or manual steps

## Differences from Production

- Uses `.env.test` instead of `.env.production`
- Exposes ports on all interfaces (not just localhost)
- Uses separate test database volume
- No Nginx reverse proxy
- No SSL certificates
