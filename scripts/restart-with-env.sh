#!/bin/bash
# Restart containers with proper POSTGRES_PASSWORD

cd ~/elemental-website

# Export POSTGRES_PASSWORD from .env.production
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD not found in .env.production!"
    exit 1
fi

echo "✓ POSTGRES_PASSWORD exported (length: ${#POSTGRES_PASSWORD})"

# Restart containers with the environment variable
echo "Restarting containers..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Waiting 10 seconds for containers to start..."
sleep 10

echo ""
echo "=== Container Status ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Recent Logs ==="
docker compose -f docker-compose.prod.yml logs payload --tail=30
