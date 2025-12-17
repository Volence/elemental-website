#!/bin/bash
# Direct database initialization using PAYLOAD_DB_PUSH
# This method works with the standalone production build

cd ~/elemental-website

echo "=== Direct Database Schema Initialization ==="
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
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:4}...${POSTGRES_PASSWORD: -4} (length: ${#POSTGRES_PASSWORD})"
echo "  PAYLOAD_SECRET: ${PAYLOAD_SECRET:0:4}...${PAYLOAD_SECRET: -4} (length: ${#PAYLOAD_SECRET})"
echo ""

# Stop containers
echo "Step 1: Stopping containers..."
docker compose -f docker-compose.prod.yml down
sleep 2

# Start with PAYLOAD_DB_PUSH=true
echo ""
echo "Step 2: Starting containers with PAYLOAD_DB_PUSH=true..."
echo "  This tells Payload to automatically create all tables on startup"
export PAYLOAD_DB_PUSH=true
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 3: Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U payload > /dev/null 2>&1; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 1
done

echo ""
echo "Step 4: Waiting for Payload to initialize schema (this may take 30-60 seconds)..."
echo "  Watching logs for schema creation messages..."

# Watch logs for up to 90 seconds
TIMEOUT=90
ELAPSED=0
SCHEMA_CREATED=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    LOGS=$(docker compose -f docker-compose.prod.yml logs payload --tail=50 2>&1)
    
    # Check for success indicators
    if echo "$LOGS" | grep -qi "ready\|started\|schema\|tables created"; then
        if echo "$LOGS" | grep -qi "relation.*does not exist\|error\|failed" | grep -v "ExperimentalWarning"; then
            # Still has errors
            echo "  Still initializing... ($ELAPSED seconds)"
        else
            echo "✓ Schema appears to be initialized!"
            SCHEMA_CREATED=true
            break
        fi
    fi
    
    # Check for fatal errors
    if echo "$LOGS" | grep -qi "password authentication failed\|cannot connect"; then
        echo ""
        echo "❌ Database connection error detected!"
        echo "Recent logs:"
        echo "$LOGS" | tail -20
        exit 1
    fi
    
    sleep 3
    ELAPSED=$((ELAPSED + 3))
done

echo ""
echo "Step 5: Checking container status..."
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Step 6: Recent Payload logs (last 50 lines)..."
docker compose -f docker-compose.prod.yml logs payload --tail=50

echo ""
echo "Step 7: Checking for database tables..."
TABLES=$(docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1 | tr -d ' ' || echo "0")

if [ "$TABLES" != "0" ] && [ -n "$TABLES" ] && [ "$TABLES" != "" ]; then
    echo "✓ Found $TABLES tables in database!"
    echo ""
    echo "Step 8: Restarting without PAYLOAD_DB_PUSH..."
    docker compose -f docker-compose.prod.yml down
    unset PAYLOAD_DB_PUSH
    docker compose -f docker-compose.prod.yml up -d
    
    echo ""
    echo "Waiting 15 seconds for services to start..."
    sleep 15
    
    echo ""
    echo "=== Final Container Status ==="
    docker compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "=== Final Payload Logs ==="
    docker compose -f docker-compose.prod.yml logs payload --tail=30
    
    echo ""
    echo "✓ Done! The admin panel should now be accessible."
    echo ""
    echo "Next steps:"
    echo "  1. Go to https://elmt.gg/admin"
    echo "  2. Create your first admin user"
    echo "  3. Seed your data (teams, players, etc.) using the seed button in the dashboard"
else
    echo "⚠️  No tables found or error checking tables"
    echo ""
    echo "Recent error logs:"
    docker compose -f docker-compose.prod.yml logs payload --tail=100 | grep -i "error\|failed" | tail -20
    
    echo ""
    echo "Please check the logs above and try again."
    exit 1
fi
