#!/bin/bash
# Push database schema changes locally (for local development)
# Use this when you've updated collection schemas and need to update the database

cd ~/elemental/elemental-website || cd ~/elemental-website || cd "$(dirname "$0")/.."

echo "=== Pushing Database Schema Changes (Local) ==="
echo ""

# Stop containers
echo "Step 1: Stopping containers..."
docker compose down
sleep 2

# Start with PAYLOAD_DB_PUSH=true
echo ""
echo "Step 2: Starting containers with PAYLOAD_DB_PUSH=true..."
echo "  This tells Payload to automatically update/add missing columns/tables"
export PAYLOAD_DB_PUSH=true
docker compose up -d

echo ""
echo "Step 3: Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U payload > /dev/null 2>&1; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 1
done

echo ""
echo "Step 4: Waiting for Payload to push schema changes..."
echo "  Watch the logs below - wait for 'Ready' message without errors"
echo ""

# Show logs and wait
docker compose logs payload -f &
LOGS_PID=$!

# Wait up to 90 seconds for schema to update
TIMEOUT=90
ELAPSED=0
SCHEMA_UPDATED=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    LOGS=$(docker compose logs payload --tail=20 2>&1)
    
    # Check for success indicators
    if echo "$LOGS" | grep -qi "ready\|started"; then
        if echo "$LOGS" | grep -qi "error\|failed\|relation.*does not exist" | grep -v "ExperimentalWarning"; then
            # Still has errors
            echo "  Still updating... ($ELAPSED seconds)"
        else
            echo ""
            echo "✓ Schema appears to be updated!"
            SCHEMA_UPDATED=true
            break
        fi
    fi
    
    sleep 3
    ELAPSED=$((ELAPSED + 3))
done

# Kill logs process
kill $LOGS_PID 2>/dev/null || true

echo ""
echo "Step 5: Checking for new columns in users table..."
COLUMNS=$(docker compose exec -T postgres psql -U payload -d payload -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('role', 'assigned_team_id', 'assigned_org_staff_id', 'assigned_production_staff_id');" 2>&1 | grep -E "role|assigned" | tr '\n' ' ' || echo "")

if [ -n "$COLUMNS" ]; then
    echo "✓ Found new columns: $COLUMNS"
    echo ""
    echo "Step 6: Restarting without PAYLOAD_DB_PUSH..."
    docker compose down
    unset PAYLOAD_DB_PUSH
    docker compose up -d
    
    echo ""
    echo "Waiting 10 seconds for services to start..."
    sleep 10
    
    echo ""
    echo "=== Container Status ==="
    docker compose ps
    
    echo ""
    echo "✓ Done! Schema changes have been pushed to the database."
    echo ""
    echo "The new user role fields should now be available:"
    echo "  - role"
    echo "  - assigned_team_id"
    echo "  - assigned_org_staff_id"
    echo "  - assigned_production_staff_id"
    echo ""
    echo "You can now access http://localhost:3000/admin"
else
    echo "⚠️  New columns not found yet"
    echo ""
    echo "Recent logs:"
    docker compose logs payload --tail=30
    
    echo ""
    echo "Please check the logs above. The schema should update automatically."
    echo "If errors persist, try: docker compose restart payload"
fi
