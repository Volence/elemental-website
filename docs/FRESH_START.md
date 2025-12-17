# Fresh Start Guide - First Time Setup

This guide walks you through setting up the Elemental Website from scratch on your production server.

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain pointing to your server (elmt.gg)
- SSH access to the server

## Step-by-Step Setup

### 1. SSH to Server

```bash
ssh ubuntu@your-server-ip
cd ~/elemental-website
```

### 2. Pull Latest Code

```bash
git pull origin main
```

### 3. Stop Any Running Containers

```bash
docker compose -f docker-compose.prod.yml down
```

### 4. Create/Update Environment File

```bash
nano .env.production
```

Make sure it contains:
```env
DATABASE_URI=postgresql://payload:YOUR_SECURE_PASSWORD@postgres:5432/payload
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
PAYLOAD_SECRET=YOUR_PAYLOAD_SECRET
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
NODE_ENV=production
PAYLOAD_DB_PUSH=false
```

**Important**: Never use `PAYLOAD_DB_PUSH=true` in production!

### 5. Drop and Recreate Database (Fresh Start)

```bash
# Drop existing schema
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO payload; GRANT ALL ON SCHEMA public TO public;"
```

### 6. Run Baseline Migration

```bash
# Apply the clean baseline schema
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < migrations/001_initial_schema.sql
```

You should see output like:
```
BEGIN
CREATE TABLE
CREATE INDEX
...
=== Migration 001 Complete! ===
```

### 7. Build and Start Services

```bash
# Build fresh images
docker compose -f docker-compose.prod.yml build --no-cache

# Start services
docker compose -f docker-compose.prod.yml up -d
```

### 8. Wait for Services to Start

```bash
# Watch logs until you see "Ready"
docker compose -f docker-compose.prod.yml logs -f payload

# Press Ctrl+C once you see "✓ Ready in XXXXms"
```

### 9. Create First Admin User

1. Visit: **https://elmt.gg/admin**
2. You'll see "Create First User" screen
3. Fill in:
   - **Name**: Your name
   - **Email**: steve@volence.dev (or your email)
   - **Password**: Your secure password
4. Click **"Create"**

The first user is automatically an Admin!

### 10. Seed Teams Data (Optional)

Once logged in:
1. Click **"Seed Teams Only"** button on the dashboard
2. Wait ~30-60 seconds
3. All 29 teams will be created with ~150+ people

## Verification

Check everything is working:

```bash
# Check containers are running
docker compose -f docker-compose.prod.yml ps

# Check database has tables
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "\dt"

# Check logs for errors
docker compose -f docker-compose.prod.yml logs --tail=50
```

## Troubleshooting

### "Something went wrong" when creating user

**Check database schema exists:**
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c "\d users"
```

If no tables exist, re-run step 6 (baseline migration).

### "Can't connect to database"

**Check DATABASE_URI in .env.production:**
```bash
cat .env.production | grep DATABASE_URI
```

Make sure password matches `POSTGRES_PASSWORD`.

### Seed Teams Only fails

**Check logs:**
```bash
docker compose -f docker-compose.prod.yml logs payload --tail=100 | grep -i "error\|seed"
```

Most common issue: slug collisions (should be fixed in latest code).

### Container won't start

**Rebuild without cache:**
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

## What's Next?

After setup:
- ✅ You have a clean database with the baseline schema
- ✅ You have an admin user
- ✅ (Optional) You have 29 teams seeded
- ✅ Ready to add content!

## Useful Commands

**View logs:**
```bash
docker compose -f docker-compose.prod.yml logs -f
```

**Restart services:**
```bash
docker compose -f docker-compose.prod.yml restart
```

**Backup database:**
```bash
./scripts/backup.sh
```

**Update code:**
```bash
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## See Also

- [BASELINE.md](./BASELINE.md) - Understanding the clean baseline
- [RECOVERY.md](./RECOVERY.md) - Database recovery procedures
- [deployment/PRODUCTION_DEPLOYMENT.md](./deployment/PRODUCTION_DEPLOYMENT.md) - Full deployment guide
