#!/bin/bash

# Deploy script for Elemental Website
# This script deploys the latest code to the production server

set -e

# Load configuration from .env.deploy if it exists
if [ -f "$(dirname "$0")/../.env.deploy" ]; then
    source "$(dirname "$0")/../.env.deploy"
fi

# Configuration - Set these environment variables or create .env.deploy file
SERVER="${DEPLOY_SERVER:-user@your-server-ip}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_rsa}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-/path/to/elemental-website}"

echo "🚀 Starting deployment to production server..."
echo ""

# Validate configuration
if [ "$SERVER" = "user@your-server-ip" ]; then
    echo "❌ Please configure your server settings!"
    echo ""
    echo "Option 1: Create a .env.deploy file (recommended)"
    echo "  cp deploy.config.example .env.deploy"
    echo "  # Edit .env.deploy with your actual server details"
    echo ""
    echo "Option 2: Set environment variables:"
    echo "  export DEPLOY_SERVER=user@your-server-ip"
    echo "  export DEPLOY_SSH_KEY=/path/to/ssh/key"
    echo "  export DEPLOY_PROJECT_DIR=/path/to/project"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at $SSH_KEY"
    exit 1
fi

echo "📡 Connecting to $SERVER..."
ssh -i "$SSH_KEY" "$SERVER" << ENDSSH
    cd $PROJECT_DIR
    echo "Current directory: $(pwd)"
    echo ""
    
    echo "📥 Pulling latest code from git..."
    git pull origin main
    echo ""
    
    echo "🛑 Stopping payload container..."
    docker compose -f docker-compose.prod.yml down payload
    echo ""
    
    echo "🔨 Building production image..."
    docker compose -f docker-compose.prod.yml build payload
    echo ""
    
    echo "🚀 Starting payload container..."
    docker compose -f docker-compose.prod.yml up -d payload
    echo ""
    
    echo "⏳ Waiting for container to start..."
    sleep 10
    echo ""
    
    echo "📋 Container status:"
    docker compose ps
    echo ""
    
    echo "📝 Recent logs:"
    docker compose logs --tail=30 payload
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your site should now be live!"
echo ""
echo "To check logs, run:"
echo "  ssh -i $SSH_KEY $SERVER 'cd $PROJECT_DIR && docker compose logs -f payload'"




