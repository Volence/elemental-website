#!/bin/bash
# Fix POSTGRES_PASSWORD environment variable and restart containers

cd ~/elemental-website

echo "=== Checking .env.production ==="
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production file not found!"
    exit 1
fi

# Extract POSTGRES_PASSWORD from .env.production
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD not found in .env.production!"
    exit 1
fi

echo "✓ POSTGRES_PASSWORD found (length: ${#POSTGRES_PASSWORD})"

# Stop containers
echo ""
echo "=== Stopping containers ==="
docker compose -f docker-compose.prod.yml down

# Start containers with the environment variable
echo ""
echo "=== Starting containers ==="
docker compose -f docker-compose.prod.yml up -d

# Wait a moment
sleep 5

# Check status
echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Checking logs (last 20 lines) ==="
docker compose -f docker-compose.prod.yml logs payload --tail=20
