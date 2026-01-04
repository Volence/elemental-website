#!/bin/bash

# Script to check production logs for the hanging user update issue

set -e

# Load configuration from .env.deploy if it exists
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

echo "🔍 Checking production logs for user save issues..."
echo ""

ssh -i "$SSH_KEY" "$SERVER" << ENDSSH
    cd ${PROJECT_DIR}
    
    echo "=== Recent Payload Container Logs (last 100 lines) ==="
    docker compose logs --tail=100 payload | grep -i -A5 -B5 "user\|audit\|timeout\|error\|hang" || echo "No relevant errors found"
    echo ""
    
    echo "=== PostgreSQL Locks ==="
    docker compose exec postgres psql -U payload -d payload -c "
    SELECT 
      pid,
      usename,
      pg_blocking_pids(pid) as blocked_by,
      query as waiting_query
    FROM pg_stat_activity
    WHERE cardinality(pg_blocking_pids(pid)) > 0;
    " || echo "Cannot check locks"
    echo ""
    
    echo "=== Long Running Queries ==="
    docker compose exec postgres psql -U payload -d payload -c "
    SELECT 
      pid,
      now() - query_start as duration,
      state,
      query
    FROM pg_stat_activity
    WHERE state != 'idle'
    AND query NOT LIKE '%pg_stat_activity%'
    ORDER BY duration DESC
    LIMIT 10;
    " || echo "Cannot check queries"
    echo ""
    
    echo "=== Recent Error Logs ==="
    docker compose logs --tail=200 payload | grep -i "error" | tail -20 || echo "No errors found"
ENDSSH

