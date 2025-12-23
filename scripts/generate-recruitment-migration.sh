#!/bin/bash
# Generate migration for recruitment collections

echo "Generating migration for recruitment collections..."

# Temporarily enable push mode to generate migration
export PAYLOAD_DB_PUSH=true

# Generate migration
npm run payload migrate:create

echo "Migration generated! Review the migration file, then run: npm run payload migrate"

