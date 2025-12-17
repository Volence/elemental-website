#!/bin/bash
# Trigger schema creation by making a request to Payload
# Sometimes Payload only creates tables when it actually needs to query them

cd ~/elemental-website

echo "=== Triggering Schema Creation ==="
echo ""

# Extract environment variables
export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD not found!"
    exit 1
fi

echo "Step 1: Making a request to Payload admin to trigger schema creation..."
echo "  This will cause Payload to connect to the database and create tables if PAYLOAD_DB_PUSH=true"

# Wait a moment for Payload to be ready
sleep 5

# Make a request to the admin endpoint
echo ""
echo "Making request to /admin..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/admin 2>&1 || echo "000")

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "302" ] || [ "$RESPONSE" = "307" ]; then
    echo "✓ Got response: HTTP $RESPONSE"
else
    echo "⚠️  Got response: HTTP $RESPONSE (this might be OK if schema is still initializing)"
fi

echo ""
echo "Waiting 10 seconds for schema creation to complete..."
sleep 10

echo ""
echo "Step 2: Checking for tables..."
TABLES=$(docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>&1 | tr -d ' \n' || echo "error")

if [ "$TABLES" != "error" ] && [ -n "$TABLES" ] && [ "$TABLES" != "0" ]; then
    echo "✓ Found $TABLES tables!"
    echo ""
    echo "Listing tables:"
    docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1 | grep -v "^$" | sed 's/^/  - /'
else
    echo "⚠️  Still no tables found (count: $TABLES)"
    echo ""
    echo "Checking Payload logs for schema creation messages..."
    docker compose -f docker-compose.prod.yml logs payload --tail=50 | grep -i "schema\|table\|push\|drizzle\|migration" || echo "No schema messages found"
fi

echo ""
echo "Step 3: Recent Payload logs..."
docker compose -f docker-compose.prod.yml logs payload --tail=20
