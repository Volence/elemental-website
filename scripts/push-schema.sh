#!/bin/bash
# Push database schema changes (adds new columns/tables without recreating everything)
# Use this when you've updated collection schemas and need to update the database

cd ~/elemental-website

echo "=== Pushing Database Schema Changes ==="
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

# Stop containers
echo "Step 1: Stopping containers..."
docker compose -f docker-compose.prod.yml down
sleep 2

# Start with PAYLOAD_DB_PUSH=true
echo ""
echo "Step 2: Starting containers with PAYLOAD_DB_PUSH=true..."
echo "  This tells Payload to automatically update/add missing columns/tables"
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
echo "Step 4: Waiting for Payload to push schema changes (this may take 30-60 seconds)..."
echo "  Watching logs for schema update messages..."

# Watch logs for up to 90 seconds
TIMEOUT=90
ELAPSED=0
SCHEMA_UPDATED=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    LOGS=$(docker compose -f docker-compose.prod.yml logs payload --tail=50 2>&1)
    
    # Check for success indicators
    if echo "$LOGS" | grep -qi "ready\|started\|schema\|tables\|columns"; then
        if echo "$LOGS" | grep -qi "error\|failed" | grep -v "ExperimentalWarning"; then
            # Still has errors
            echo "  Still updating... ($ELAPSED seconds)"
        else
            echo "✓ Schema appears to be updated!"
            SCHEMA_UPDATED=true
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
echo "Step 7: Checking for new columns in users table..."
COLUMNS=$(docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('role', 'assigned_team_id', 'assigned_org_staff_id', 'assigned_production_staff_id');" 2>&1 | tr -d ' \n' || echo "")

if [ -n "$COLUMNS" ] && [ "$COLUMNS" != "" ]; then
    echo "✓ Found new columns: $COLUMNS"
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
    echo "✓ Done! Schema changes have been pushed to the database."
    echo ""
    echo "The new user role fields should now be available:"
    echo "  - role"
    echo "  - assigned_team_id"
    echo "  - assigned_org_staff_id"
    echo "  - assigned_production_staff_id"
else
    echo "⚠️  New columns not found yet"
    echo ""
    echo "Recent error logs:"
    docker compose -f docker-compose.prod.yml logs payload --tail=100 | grep -i "error\|failed" | tail -20
    
    echo ""
    echo "Please check the logs above and try again."
    echo "You may need to rebuild the Docker image if code changes were made."
    exit 1
fi
