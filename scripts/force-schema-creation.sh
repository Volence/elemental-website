#!/bin/bash
# Force Payload to create schema by making API requests
# PAYLOAD_DB_PUSH creates tables lazily when they're first accessed

cd ~/elemental-website

echo "=== Forcing Schema Creation ==="
echo ""

# Extract environment variables
export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD not found!"
    exit 1
fi

echo "Step 1: Verifying PAYLOAD_DB_PUSH is set..."
PAYLOAD_DB_PUSH=$(docker compose -f docker-compose.prod.yml exec -T payload env | grep PAYLOAD_DB_PUSH | cut -d '=' -f2)
if [ "$PAYLOAD_DB_PUSH" != "true" ]; then
    echo "❌ PAYLOAD_DB_PUSH is not set to 'true'!"
    echo "  Current value: $PAYLOAD_DB_PUSH"
    exit 1
fi
echo "✓ PAYLOAD_DB_PUSH=true"

echo ""
echo "Step 2: Making requests to trigger schema creation..."
echo "  Payload creates tables lazily when collections are accessed"

# Try accessing different endpoints that would trigger schema creation
ENDPOINTS=(
    "/api/users"
    "/api/people"
    "/api/teams"
    "/admin"
)

for endpoint in "${ENDPOINTS[@]}"; do
    echo "  Requesting $endpoint..."
    curl -s -o /dev/null -w "    HTTP %{http_code}\n" "http://127.0.0.1:3000$endpoint" 2>&1 || echo "    Failed"
    sleep 2
done

echo ""
echo "Step 3: Waiting 15 seconds for schema creation to complete..."
sleep 15

echo ""
echo "Step 4: Checking for tables..."
TABLE_COUNT=$(docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>&1 | tr -d ' \n' || echo "0")

if [ "$TABLE_COUNT" != "0" ] && [ -n "$TABLE_COUNT" ] && [ "$TABLE_COUNT" != "" ]; then
    echo "✓ Found $TABLE_COUNT tables!"
    echo ""
    echo "Listing tables:"
    docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1 | grep -v "^$" | sed 's/^/  - /'
    
    echo ""
    echo "✓ Schema created successfully!"
    echo ""
    echo "Step 5: Restarting without PAYLOAD_DB_PUSH..."
    docker compose -f docker-compose.prod.yml down
    unset PAYLOAD_DB_PUSH
    docker compose -f docker-compose.prod.yml up -d
    
    echo ""
    echo "Waiting 15 seconds for services to start..."
    sleep 15
    
    echo ""
    echo "=== Final Status ==="
    docker compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "✓ Done! The admin panel should now be accessible at https://elmt.gg/admin"
else
    echo "⚠️  Still no tables found (count: $TABLE_COUNT)"
    echo ""
    echo "Checking Payload logs for errors..."
    docker compose -f docker-compose.prod.yml logs payload --tail=50 | grep -i "error\|failed" | tail -10
    
    echo ""
    echo "Full recent logs:"
    docker compose -f docker-compose.prod.yml logs payload --tail=30
    
    echo ""
    echo "If tables still aren't created, we may need to use the init-schema.mjs script with source files."
    exit 1
fi
