#!/bin/bash
set -e

echo "========================================="
echo "  NUCLEAR REBUILD - Complete Clean Start"
echo "========================================="
echo ""
echo "This will:"
echo "1. Stop all containers"
echo "2. Remove ALL Docker images, containers, and build cache"
echo "3. Rebuild from absolute scratch"
echo "4. Start fresh containers"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Stop everything
echo "Step 1: Stopping containers..."
docker compose -f docker-compose.prod.yml down

# Remove the specific images
echo "Step 2: Removing Payload images..."
docker images | grep elemental-website | awk '{print $3}' | xargs -r docker rmi -f

# Prune EVERYTHING (but keep volumes with database)
echo "Step 3: Pruning all Docker cache..."
docker system prune -af --volumes=false

# Clean any npm cache in the build context
echo "Step 4: Cleaning local build artifacts..."
rm -rf .next node_modules/.cache 2>/dev/null || true

# Rebuild with verbose output to verify it's using PostgreSQL
echo "Step 5: Rebuilding (this will take a few minutes)..."
docker compose -f docker-compose.prod.yml build --no-cache --progress=plain payload 2>&1 | tee build.log

# Check the build log for PostgreSQL adapter
echo ""
echo "Step 6: Verifying PostgreSQL adapter in build..."
if grep -q "@payloadcms/db-postgres" build.log; then
    echo "✓ PostgreSQL adapter found in build"
else
    echo "✗ WARNING: PostgreSQL adapter not found in build!"
    echo "Check build.log for details"
fi

# Start containers
echo ""
echo "Step 7: Starting containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for startup
echo "Step 8: Waiting for Payload to start..."
sleep 15

# Show logs
echo ""
echo "Step 9: Checking logs..."
docker compose -f docker-compose.prod.yml logs payload --tail=30

echo ""
echo "========================================="
echo "  Rebuild Complete!"
echo "========================================="
echo ""
echo "Check the logs above for 'Ready' message"
echo "Then visit https://elmt.gg/admin to create your user"
echo ""
