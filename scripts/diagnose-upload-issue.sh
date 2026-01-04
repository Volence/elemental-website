#!/bin/bash

# Diagnostic script for avatar upload issues on production
# Run this script on the production server to check configuration

set -e

echo "🔍 Diagnosing upload issue on production server..."
echo ""

# Check if we need deployment config
if [ -f "$(dirname "$0")/../.env.deploy" ]; then
    source "$(dirname "$0")/../.env.deploy"
fi

SERVER="${DEPLOY_SERVER:-user@your-server-ip}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_rsa}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/path/to/elemental-website}"

echo "📡 Connecting to production server: $SERVER"
echo ""

ssh -i "$SSH_KEY" "$SERVER" << 'ENDSSH'
    echo "=== 1. Checking Nginx Configuration ==="
    echo ""
    echo "Current client_max_body_size settings:"
    sudo grep -r "client_max_body_size" /etc/nginx/ || echo "⚠️  client_max_body_size NOT FOUND - defaults to 1MB!"
    echo ""
    
    echo "Current proxy timeout settings:"
    sudo grep -r "proxy.*timeout" /etc/nginx/sites-enabled/ || echo "⚠️  No custom timeouts found"
    echo ""
    
    echo "=== 2. Checking Docker Container Health ==="
    cd ${PROJECT_DIR:-/opt/elemental-website}
    docker compose ps
    echo ""
    
    echo "=== 3. Checking Media Volume ==="
    docker volume ls | grep media
    docker volume inspect elemental-website_media 2>/dev/null || echo "⚠️  Media volume not found!"
    echo ""
    
    echo "=== 4. Recent Container Logs (last 50 lines) ==="
    docker compose logs --tail=50 payload | grep -i "error\|upload\|media\|timeout" || echo "No errors found in recent logs"
    echo ""
    
    echo "=== 5. Checking File Permissions in Container ==="
    docker compose exec payload ls -la /app/public/media || echo "⚠️  Cannot access media directory"
    echo ""
    
    echo "=== 6. Container Resource Usage ==="
    docker stats --no-stream payload || true
    echo ""
    
    echo "✅ Diagnostic complete!"
    echo ""
    echo "Expected values:"
    echo "  - client_max_body_size: 50M or higher"
    echo "  - proxy_read_timeout: 60s or higher"
    echo "  - Media directory should be writable"
ENDSSH

echo ""
echo "📋 Next steps based on findings above:"
echo ""
echo "If client_max_body_size is missing or too small:"
echo "  1. Edit nginx config: sudo nano /etc/nginx/sites-available/elemental-website"
echo "  2. Add 'client_max_body_size 50M;' in the server block"
echo "  3. Test: sudo nginx -t"
echo "  4. Reload: sudo systemctl reload nginx"
echo ""
echo "If timeouts are too low:"
echo "  1. Edit nginx config to increase proxy_read_timeout to 120s"
echo "  2. Test and reload nginx"
echo ""
echo "If media directory is not writable:"
echo "  1. Check Docker volume permissions"
echo "  2. Rebuild container with proper volume mounts"

