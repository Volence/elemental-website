#!/bin/bash

# Script to fix Nginx upload limits on production server
# This will update the Nginx configuration to allow larger uploads and longer timeouts

set -e

# Load configuration from .env.deploy if it exists
if [ -f "$(dirname "$0")/../.env.deploy" ]; then
    source "$(dirname "$0")/../.env.deploy"
fi

SERVER="${DEPLOY_SERVER:-user@your-server-ip}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_rsa}"

if [ "$SERVER" = "user@your-server-ip" ]; then
    echo "❌ Please configure your server settings in .env.deploy"
    exit 1
fi

echo "🔧 Fixing Nginx upload configuration on production..."
echo ""

ssh -i "$SSH_KEY" "$SERVER" << 'ENDSSH'
    echo "📝 Backing up current Nginx configuration..."
    sudo cp /etc/nginx/sites-available/elemental-website /etc/nginx/sites-available/elemental-website.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup created"
    echo ""
    
    echo "🔍 Checking current configuration..."
    if sudo grep -q "client_max_body_size" /etc/nginx/sites-available/elemental-website; then
        echo "⚠️  client_max_body_size already exists, updating it..."
        # Update existing value to 50M
        sudo sed -i 's/client_max_body_size.*/client_max_body_size 50M;/' /etc/nginx/sites-available/elemental-website
    else
        echo "➕ Adding client_max_body_size..."
        # Add after the server_name line in the HTTPS server block
        sudo sed -i '/listen 443/,/^}/ s/server_name.*/&\n\n    # Increase upload size for media uploads\n    client_max_body_size 50M;/' /etc/nginx/sites-available/elemental-website
    fi
    
    echo "⏱️  Checking proxy timeouts..."
    if sudo grep -q "proxy_read_timeout" /etc/nginx/sites-available/elemental-website; then
        echo "⚠️  Timeouts already configured"
    else
        echo "➕ Adding extended proxy timeouts for image processing..."
        # Add timeouts in the location / block
        sudo sed -i '/location \/ {/a\        # Extended timeouts for image processing\n        proxy_connect_timeout 120s;\n        proxy_send_timeout 120s;\n        proxy_read_timeout 120s;' /etc/nginx/sites-available/elemental-website
    fi
    
    echo ""
    echo "🧪 Testing Nginx configuration..."
    if sudo nginx -t; then
        echo "✅ Configuration is valid"
        echo ""
        echo "🔄 Reloading Nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded successfully!"
        echo ""
        echo "📋 Updated settings:"
        sudo grep -A1 "client_max_body_size\|proxy.*timeout" /etc/nginx/sites-available/elemental-website
    else
        echo "❌ Configuration test failed!"
        echo "Restoring backup..."
        sudo cp /etc/nginx/sites-available/elemental-website.backup.* /etc/nginx/sites-available/elemental-website
        echo "Please check the configuration manually"
        exit 1
    fi
ENDSSH

echo ""
echo "✅ Nginx configuration updated!"
echo ""
echo "🧪 Test the upload now:"
echo "  1. Go to https://elmt.gg/admin/account"
echo "  2. Try uploading an avatar"
echo "  3. Should work without hanging"
echo ""
echo "If still having issues, run:"
echo "  ./scripts/diagnose-upload-issue.sh"

