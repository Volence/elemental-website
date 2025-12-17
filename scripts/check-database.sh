#!/bin/bash
# Check database status and tables

cd ~/elemental-website

echo "=== Database Diagnostic Check ==="
echo ""

# Extract environment variables
export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD not found!"
    exit 1
fi

echo "Step 1: Checking if PostgreSQL is accessible..."
if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U payload > /dev/null 2>&1; then
    echo "✓ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not accessible"
    exit 1
fi

echo ""
echo "Step 2: Checking PAYLOAD_DB_PUSH in Payload container..."
PAYLOAD_DB_PUSH=$(docker compose -f docker-compose.prod.yml exec -T payload env | grep PAYLOAD_DB_PUSH | cut -d '=' -f2 || echo "not set")
echo "  PAYLOAD_DB_PUSH=$PAYLOAD_DB_PUSH"

echo ""
echo "Step 3: Listing all tables in the database..."
TABLES=$(docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1)

if echo "$TABLES" | grep -q "ERROR\|error\|does not exist"; then
    echo "❌ Error querying database:"
    echo "$TABLES"
else
    TABLE_COUNT=$(echo "$TABLES" | grep -v "^$" | wc -l | tr -d ' ')
    if [ "$TABLE_COUNT" -eq 0 ]; then
        echo "⚠️  No tables found in the database"
        echo ""
        echo "Step 4: Checking Payload logs for schema creation messages..."
        docker compose -f docker-compose.prod.yml logs payload --tail=100 | grep -i "schema\|table\|push\|migration\|drizzle" || echo "No schema-related messages found"
    else
        echo "✓ Found $TABLE_COUNT tables:"
        echo "$TABLES" | grep -v "^$" | sed 's/^/  - /'
    fi
fi

echo ""
echo "Step 5: Checking Payload container logs for errors..."
ERRORS=$(docker compose -f docker-compose.prod.yml logs payload --tail=200 | grep -i "error\|failed\|exception" | grep -v "ExperimentalWarning" | tail -10)

if [ -z "$ERRORS" ]; then
    echo "✓ No errors found in recent logs"
else
    echo "⚠️  Recent errors:"
    echo "$ERRORS"
fi

echo ""
echo "Step 6: Full recent Payload logs (last 30 lines)..."
docker compose -f docker-compose.prod.yml logs payload --tail=30
