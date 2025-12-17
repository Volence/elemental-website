#!/bin/bash
# Run migration scripts on production

cd ~/elemental-website

# Export environment variables from .env.production
export $(grep -v '^#' .env.production | xargs)

# Run the migration script using docker run with the file mounted
docker run --rm \
  --network elemental-website_default \
  -e DATABASE_URI="postgresql://payload:${POSTGRES_PASSWORD}@postgres:5432/payload" \
  -v "$(pwd):/app" \
  -w /app \
  node:22.17.0-alpine \
  sh -c "apk add --no-cache libc6-compat && \
         npm install pg --no-save && \
         node scripts/migrations/add-display-name-columns.mjs"
