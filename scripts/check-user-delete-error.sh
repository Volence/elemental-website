#!/bin/bash

# Check production logs for user deletion errors

set -e

if [ -f "$(dirname "$0")/../.env.deploy" ]; then
    source "$(dirname "$0")/../.env.deploy"
fi

SERVER="${DEPLOY_SERVER:-user@your-server-ip}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_rsa}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/path/to/elemental-website}"

if [ "$SERVER" = "user@your-server-ip" ]; then
    echo "❌ Please configure your server settings in .env.deploy"
    exit 1
fi

echo "🔍 Checking production logs for user deletion errors..."
echo ""

ssh -i "$SSH_KEY" "$SERVER" << ENDSSH
    cd ${PROJECT_DIR}
    
    echo "=== Last 100 lines of logs (looking for delete/constraint errors) ==="
    docker compose logs --tail=100 payload | grep -i "delete\|constraint\|foreign key\|error\|audit" || echo "No deletion errors found"
    echo ""
    
    echo "=== Checking database foreign key constraints on users table ==="
    docker compose exec postgres psql -U payload -d payload -c "
    SELECT
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        confrelid::regclass AS referenced_table,
        pg_get_constraintdef(oid) AS constraint_definition
    FROM pg_constraint
    WHERE confrelid = 'users'::regclass
    OR conrelid = 'users'::regclass;
    " || echo "Cannot check constraints"
ENDSSH

echo ""
echo "This will show what's referencing users and might block deletion."

