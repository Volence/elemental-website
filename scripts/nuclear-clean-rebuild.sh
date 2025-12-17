#!/bin/bash
# Nuclear Clean Rebuild - Use when UUIDs persist despite everything

set -e

echo "🔥 NUCLEAR CLEAN REBUILD 🔥"
echo "This will:"
echo "  - Stop all containers"
echo "  - Delete all volumes (DATABASE WILL BE WIPED)"
echo "  - Delete all images"
echo "  - Prune Docker system"
echo "  - Rebuild from scratch"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Stopping containers..."
docker compose -f docker-compose.prod.yml down -v

echo ""
echo "Step 2: Removing images..."
docker compose -f docker-compose.prod.yml down --rmi all 2>/dev/null || true

echo ""
echo "Step 3: Pruning Docker system..."
docker system prune -af --volumes

echo ""
echo "Step 4: Building fresh (this will take a few minutes)..."
docker compose -f docker-compose.prod.yml build --no-cache --pull

echo ""
echo "Step 5: Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 6: Waiting for PostgreSQL to start..."
sleep 10

echo ""
echo "Step 7: Running baseline migration..."
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < migrations/001_initial_schema.sql

echo ""
echo "✅ DONE!"
echo ""
echo "Next steps:"
echo "  1. Visit https://elmt.gg/admin"
echo "  2. Create your first user"
echo "  3. Seed teams data (optional)"
echo ""
echo "Watch logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
