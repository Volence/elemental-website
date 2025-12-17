#!/bin/bash
# Reset PostgreSQL password to match .env.production
# This will recreate the PostgreSQL volume with the correct password

cd ~/elemental-website

echo "=== PostgreSQL Password Reset ==="
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATABASE DATA and recreate PostgreSQL with the correct password."
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    exit 1
fi

# Extract password from .env.production
export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD not found in .env.production!"
    exit 1
fi

echo "✓ Found POSTGRES_PASSWORD (length: ${#POSTGRES_PASSWORD})"
echo ""

read -p "Are you sure you want to reset PostgreSQL? This will DELETE ALL DATA. (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "Stopping containers..."
docker compose -f docker-compose.prod.yml down

echo ""
echo "Removing PostgreSQL volume..."
docker volume rm elemental-website_postgres_data 2>/dev/null || echo "Volume may not exist, continuing..."

echo ""
echo "Starting PostgreSQL with correct password..."
docker compose -f docker-compose.prod.yml up -d postgres

echo ""
echo "Waiting 15 seconds for PostgreSQL to initialize..."
sleep 15

echo ""
echo "Starting Payload container..."
docker compose -f docker-compose.prod.yml up -d payload

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
echo "✓ Done! Check the logs above to verify the connection is working."
echo ""
echo "If you see 'password authentication failed' errors, the password may still be incorrect."
echo "If you see 'Ready in Xms' without errors, the connection is working!"
