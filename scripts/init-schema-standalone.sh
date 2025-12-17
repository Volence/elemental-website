#!/bin/bash
# Initialize schema using init-schema.mjs with proper CI environment

cd ~/elemental-website

echo "=== Schema Initialization using init-schema.mjs ==="
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
echo "Checking PostgreSQL..."
if ! docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U payload > /dev/null 2>&1; then
    echo "Starting PostgreSQL..."
    docker compose -f docker-compose.prod.yml up -d postgres
    echo "Waiting 10 seconds for PostgreSQL to start..."
    sleep 10
fi

echo "✓ PostgreSQL is running"
echo ""

# Run init-schema.mjs with CI=true to avoid pnpm TTY issues
echo "Running schema initialization..."
echo "This may take a few minutes (installing dependencies)..."
echo ""

docker run --rm \
  --network host \
  -e CI=true \
  -e DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@127.0.0.1:5432/payload" \
  -e PAYLOAD_SECRET="${PAYLOAD_SECRET}" \
  -e PAYLOAD_DB_PUSH=true \
  -v "$(pwd):/app" \
  -w /app \
  node:22.17.0-alpine \
  sh -c "apk add --no-cache libc6-compat && \
         corepack enable pnpm && \
         CI=true pnpm i --frozen-lockfile && \
         CI=true pnpm add -D tsx && \
         NODE_OPTIONS=--no-deprecation pnpm exec tsx scripts/migrations/init-schema.mjs"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Schema initialized successfully!"
    echo ""
    echo "Verifying tables were created..."
    TABLE_COUNT=$(docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>&1 | tr -d ' \n' || echo "0")
    
    if [ "$TABLE_COUNT" != "0" ] && [ -n "$TABLE_COUNT" ]; then
        echo "✓ Found $TABLE_COUNT tables!"
        echo ""
        echo "Listing tables:"
        docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1 | grep -v "^$" | sed 's/^/  - /'
        
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
        echo "✓ Done! The admin panel should now be accessible at https://elmt.gg/admin"
    else
        echo "⚠️  Tables were not created (count: $TABLE_COUNT)"
        exit 1
    fi
else
    echo ""
    echo "❌ Schema initialization failed. Check the errors above."
    exit 1
fi
