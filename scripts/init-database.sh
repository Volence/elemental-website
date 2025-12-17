#!/bin/bash
# Initialize database schema after password reset
# This creates all the necessary tables

cd ~/elemental-website

echo "=== Database Schema Initialization ==="
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    exit 1
fi

# Extract environment variables
export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
export PAYLOAD_SECRET=$(grep "^PAYLOAD_SECRET=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$PAYLOAD_SECRET" ]; then
    echo "❌ Missing required environment variables!"
    exit 1
fi

echo "✓ Environment variables loaded"
echo ""

# Make sure postgres is running
echo "Checking PostgreSQL container..."
if ! docker compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    echo "Starting PostgreSQL..."
    docker compose -f docker-compose.prod.yml up -d postgres
    echo "Waiting 10 seconds for PostgreSQL to start..."
    sleep 10
fi

echo "✓ PostgreSQL is running"
echo ""

# Initialize schema using temporary container
echo "Initializing database schema..."
echo "This will create all necessary tables..."
echo ""

echo "Installing dependencies (this may take a minute)..."
docker run --rm \
  --network host \
  -e DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@127.0.0.1:5432/payload" \
  -e PAYLOAD_SECRET="${PAYLOAD_SECRET}" \
  -e PAYLOAD_DB_PUSH=true \
  -v "$(pwd):/app" \
  -w /app \
  node:22.17.0-alpine \
  sh -c "apk add --no-cache libc6-compat && \
         corepack enable pnpm && \
         echo 'Installing pnpm dependencies...' && \
         pnpm i --frozen-lockfile && \
         echo 'Installing tsx...' && \
         pnpm add -D tsx && \
         echo 'Running schema initialization...' && \
         NODE_OPTIONS=--no-deprecation pnpm exec tsx scripts/migrations/init-schema.mjs"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Schema initialized successfully!"
    echo ""
    echo "Restarting Payload container..."
    docker compose -f docker-compose.prod.yml restart payload
    
    echo ""
    echo "Waiting 10 seconds for Payload to start..."
    sleep 10
    
    echo ""
    echo "=== Container Status ==="
    docker compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "=== Recent Payload Logs ==="
    docker compose -f docker-compose.prod.yml logs payload --tail=30
    
    echo ""
    echo "✓ Done! The admin panel should now be accessible."
    echo ""
    echo "Next steps:"
    echo "  1. Go to https://elmt.gg/admin"
    echo "  2. Create your first admin user"
    echo "  3. Seed your data (teams, players, etc.) using the seed button in the dashboard"
else
    echo ""
    echo "❌ Schema initialization failed. Check the errors above."
    exit 1
fi
