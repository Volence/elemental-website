#!/bin/bash

set -e  # Exit on any error

echo "========================================="
echo "  Deploying to Production Server"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# This script should be run ON THE PRODUCTION SERVER
# Usage: ssh into production server, then run: ./deploy-to-production.sh

echo "Step 1: Pulling latest code from Git..."
git pull origin main

echo ""
echo "Step 2: Stopping current containers..."
docker compose -f docker-compose.prod.yml down

echo ""
echo "Step 3: Rebuilding Docker image (this may take a few minutes)..."
docker compose -f docker-compose.prod.yml build --no-cache payload

echo ""
echo "Step 4: Starting containers..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 5: Waiting for Payload to start..."
sleep 15

echo ""
echo "Step 6: Checking container status..."
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Step 7: Checking recent logs..."
docker compose -f docker-compose.prod.yml logs payload --tail=30

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Visit https://elmt.gg/admin to verify admin panel works"
echo "2. Test creating/editing content"
echo "3. Monitor logs with: docker compose -f docker-compose.prod.yml logs -f payload"
echo ""
