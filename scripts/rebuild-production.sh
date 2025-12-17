#!/bin/bash

echo "=== Rebuilding Production Deployment ==="
echo ""
echo "This will:"
echo "1. Stop current containers"
echo "2. Rebuild the Payload image with latest code"
echo "3. Restart with fresh build"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Stop containers
echo "Stopping containers..."
docker compose -f docker-compose.prod.yml down

# Rebuild the payload image (no cache to ensure fresh build)
echo "Rebuilding Payload image..."
docker compose -f docker-compose.prod.yml build --no-cache payload

# Start everything
echo "Starting containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait a bit for startup
echo "Waiting for Payload to start..."
sleep 10

# Show logs
echo ""
echo "=== Checking logs ==="
docker compose -f docker-compose.prod.yml logs payload --tail=30

echo ""
echo "=== Done! ==="
echo "Check https://elmt.gg/admin"
