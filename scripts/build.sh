#!/bin/bash
# Build script for Elemental website
# This script ensures postgres is running and builds the Docker image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting build process...${NC}"

# Step 0: Get POSTGRES_PASSWORD before starting postgres
if [ -f .env.production ]; then
  POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
elif [ -n "$POSTGRES_PASSWORD" ]; then
  POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
else
  echo -e "${YELLOW}Warning: POSTGRES_PASSWORD not found. Using default 'payload'${NC}"
  POSTGRES_PASSWORD="payload"
fi

# Export POSTGRES_PASSWORD so docker-compose can use it
export POSTGRES_PASSWORD

# Step 1: Start postgres
echo -e "${YELLOW}Step 1: Starting postgres...${NC}"
docker compose -f docker-compose.prod.yml up -d postgres

# Step 2: Wait for postgres to be ready
echo -e "${YELLOW}Step 2: Waiting for postgres to be ready...${NC}"
sleep 5
MAX_WAIT=60
WAITED=0

# Check if postgres container is running
if ! docker compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
  echo -e "${RED}ERROR: Postgres container is not running${NC}"
  docker compose -f docker-compose.prod.yml ps postgres
  exit 1
fi

# Wait for postgres to be ready using healthcheck status
while [ $WAITED -lt $MAX_WAIT ]; do
  # Check if postgres is healthy (healthcheck passed)
  if docker compose -f docker-compose.prod.yml ps postgres 2>/dev/null | grep -q "healthy"; then
    echo -e "${GREEN}✓ Postgres is ready${NC}"
    break
  fi
  
  # Also try pg_isready as a fallback
  if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U payload > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Postgres is ready${NC}"
    break
  fi
  
  echo "Waiting for postgres... (${WAITED}s/${MAX_WAIT}s)"
  sleep 2
  WAITED=$((WAITED + 2))
done

# Final check
if [ $WAITED -ge $MAX_WAIT ]; then
  echo -e "${RED}ERROR: Postgres did not become ready within ${MAX_WAIT} seconds${NC}"
  echo -e "${YELLOW}Checking postgres logs...${NC}"
  docker compose -f docker-compose.prod.yml logs postgres | tail -20
  echo -e "${YELLOW}Checking postgres status...${NC}"
  docker compose -f docker-compose.prod.yml ps postgres
  exit 1
fi

# Step 3: Verify postgres is accessible
echo -e "${YELLOW}Step 3: Verifying postgres accessibility...${NC}"
# Try to connect using nc (netcat) if available, otherwise skip
if command -v nc >/dev/null 2>&1; then
  if ! nc -z 127.0.0.1 5432 2>/dev/null; then
    echo -e "${YELLOW}Warning: Cannot verify postgres connection with nc, but continuing...${NC}"
  else
    echo -e "${GREEN}✓ Postgres is accessible${NC}"
  fi
else
  echo -e "${YELLOW}Note: nc (netcat) not available, skipping port check${NC}"
fi

# Step 4: Initialize database schema (create tables if they don't exist)
echo -e "${YELLOW}Step 4: Initializing database schema...${NC}"
if [ -f .env.production ]; then
  PAYLOAD_SECRET=$(grep PAYLOAD_SECRET .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "secret")
else
  PAYLOAD_SECRET="${PAYLOAD_SECRET:-secret}"
fi
export PAYLOAD_SECRET

# Initialize schema by running Payload with push mode enabled
# This will create all necessary tables
echo "Creating database tables..."
docker run --rm \
  --network host \
  -e DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@127.0.0.1:5432/payload" \
  -e PAYLOAD_SECRET="${PAYLOAD_SECRET}" \
  -e PAYLOAD_DB_PUSH=true \
  -v "$SCRIPT_DIR:/app" \
  -w /app \
  node:22.17.0-alpine \
  sh -c "apk add --no-cache libc6-compat && \
         corepack enable pnpm && \
         pnpm i --frozen-lockfile > /dev/null 2>&1 && \
         NODE_OPTIONS=--no-deprecation node --input-type=module -e \"
         const { getPayload } = await import('payload');
         const config = await import('./src/payload.config.ts');
         try {
           const payload = await getPayload({ config: config.default });
           console.log('✓ Schema initialized');
           if (payload.db && payload.db.drizzle) {
             await payload.db.drizzle.connection().end();
           }
         } catch (e) {
           if (e.message.includes('already exists') || e.message.includes('duplicate')) {
             console.log('✓ Schema already exists');
           } else {
             console.log('Schema init:', e.message);
           }
         }
         \"" 2>&1 | grep -E "✓|Schema" || echo "Schema initialization attempted"

# Step 5: Build
echo -e "${YELLOW}Step 5: Building Docker image...${NC}"
echo "Using DATABASE_URI=postgresql://payload:***@127.0.0.1:5432/payload"
echo "Using PAYLOAD_SECRET=***"

# Build with database available and schema initialized
docker build \
  --network host \
  --build-arg DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@127.0.0.1:5432/payload" \
  --build-arg PAYLOAD_SECRET="${PAYLOAD_SECRET}" \
  -t elemental-website-payload \
  -f Dockerfile . \
  2>&1 | tee /tmp/docker-build.log

BUILD_EXIT=$?
if [ $BUILD_EXIT -ne 0 ]; then
  echo -e "${RED}Build failed. Checking logs...${NC}"
  grep -E "ERROR|Error|Failed|relation.*does not exist" /tmp/docker-build.log | tail -10
  exit $BUILD_EXIT
fi

# Step 6: Verify build succeeded
if docker images | grep -q elemental-website-payload; then
  echo -e "${GREEN}✓ Build succeeded!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Start services: docker compose -f docker-compose.prod.yml up -d"
  echo "  2. Check logs: docker compose -f docker-compose.prod.yml logs -f"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi
