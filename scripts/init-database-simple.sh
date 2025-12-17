#!/bin/bash
# Simple database schema initialization using PAYLOAD_DB_PUSH
# This is the easiest method - Payload will create tables on startup

cd ~/elemental-website

echo "=== Simple Database Schema Initialization ==="
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
echo "Stopping containers..."
docker compose -f docker-compose.prod.yml down

# Start with PAYLOAD_DB_PUSH=true
echo ""
echo "Starting containers with PAYLOAD_DB_PUSH=true..."
echo "Payload will automatically create all tables on startup..."
export PAYLOAD_DB_PUSH=true
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting 20 seconds for Payload to initialize schema..."
sleep 20

echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Recent Payload Logs ==="
docker compose -f docker-compose.prod.yml logs payload --tail=50

echo ""
echo "Checking for errors..."
ERRORS=$(docker compose -f docker-compose.prod.yml logs payload --tail=100 | grep -i "error\|failed\|relation.*does not exist" || echo "")

if [ -z "$ERRORS" ]; then
    echo "✓ No errors found in logs!"
    echo ""
    echo "Stopping containers to remove PAYLOAD_DB_PUSH..."
    docker compose -f docker-compose.prod.yml down
    
    echo ""
    echo "Restarting without PAYLOAD_DB_PUSH (schema is now created)..."
    unset PAYLOAD_DB_PUSH
    docker compose -f docker-compose.prod.yml up -d
    
    echo ""
    echo "Waiting 10 seconds for services to start..."
    sleep 10
    
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
    echo "⚠️  Errors found in logs:"
    echo "$ERRORS"
    echo ""
    echo "Please check the logs above and try again."
    exit 1
fi
