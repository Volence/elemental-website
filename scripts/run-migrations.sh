#!/bin/bash
# Run migration scripts on production using psql

cd ~/elemental-website

# Export the password from .env.production
export POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

echo "Step 1: Adding display_name columns..."
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < scripts/migrations/add-display-name-columns.sql

echo ""
echo "Step 2: Populating display_name values..."
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < scripts/migrations/populate-display-names.sql

echo ""
echo "✓ Migrations complete! Restarting payload container..."
docker compose -f docker-compose.prod.yml restart payload

echo ""
echo "✓ Done! The admin panel should now work correctly."
