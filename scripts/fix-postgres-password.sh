#!/bin/bash
# Fix PostgreSQL password mismatch issue
# This script helps diagnose and fix password authentication failures

cd ~/elemental-website

echo "=== PostgreSQL Password Fix Script ==="
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    exit 1
fi

# Extract password from .env.production
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD not found in .env.production!"
    exit 1
fi

echo "✓ Found POSTGRES_PASSWORD in .env.production (length: ${#POSTGRES_PASSWORD})"
echo ""

# Check if postgres container is running
if ! docker compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    echo "⚠️  PostgreSQL container is not running. Starting it..."
    export POSTGRES_PASSWORD
    docker compose -f docker-compose.prod.yml up -d postgres
    echo "Waiting 10 seconds for PostgreSQL to start..."
    sleep 10
fi

echo "=== Option 1: Reset PostgreSQL Password (RECOMMENDED) ==="
echo "This will update the PostgreSQL password to match your .env.production file."
echo "⚠️  WARNING: This requires stopping the containers temporarily."
echo ""
read -p "Do you want to reset the PostgreSQL password? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping containers..."
    docker compose -f docker-compose.prod.yml stop payload postgres
    
    echo ""
    echo "Resetting PostgreSQL password..."
    export POSTGRES_PASSWORD
    
    # Connect to PostgreSQL and reset the password
    docker compose -f docker-compose.prod.yml run --rm postgres psql -U payload -d postgres -c "ALTER USER payload WITH PASSWORD '${POSTGRES_PASSWORD}';" 2>/dev/null || {
        echo ""
        echo "⚠️  Could not reset password via psql. Trying alternative method..."
        echo ""
        echo "=== Option 2: Recreate PostgreSQL Volume ==="
        echo "This will DELETE ALL DATABASE DATA and recreate it with the new password."
        echo "⚠️  WARNING: This will delete all your data!"
        echo ""
        read -p "Do you want to recreate the PostgreSQL volume? (y/n): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Removing PostgreSQL volume..."
            docker compose -f docker-compose.prod.yml down -v postgres
            echo ""
            echo "Starting PostgreSQL with new password..."
            export POSTGRES_PASSWORD
            docker compose -f docker-compose.prod.yml up -d postgres
            echo ""
            echo "Waiting 10 seconds for PostgreSQL to initialize..."
            sleep 10
            echo ""
            echo "✓ PostgreSQL volume recreated with new password"
            echo ""
            echo "Now restarting all containers..."
            docker compose -f docker-compose.prod.yml up -d
            echo ""
            echo "✓ Done! Waiting 10 seconds for services to start..."
            sleep 10
            echo ""
            echo "=== Container Status ==="
            docker compose -f docker-compose.prod.yml ps
            echo ""
            echo "=== Recent Logs ==="
            docker compose -f docker-compose.prod.yml logs payload --tail=20
            exit 0
        else
            echo "Cancelled. No changes made."
            exit 0
        fi
    }
    
    echo ""
    echo "✓ Password reset successfully!"
    echo ""
    echo "Restarting containers..."
    export POSTGRES_PASSWORD
    docker compose -f docker-compose.prod.yml up -d
    
    echo ""
    echo "Waiting 10 seconds for services to start..."
    sleep 10
    
    echo ""
    echo "=== Container Status ==="
    docker compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "=== Recent Logs ==="
    docker compose -f docker-compose.prod.yml logs payload --tail=20
    
    echo ""
    echo "✓ Done! Check the logs above to verify the connection is working."
else
    echo "Cancelled. No changes made."
    echo ""
    echo "If you want to manually test the connection, you can run:"
    echo "  export POSTGRES_PASSWORD=\$(grep POSTGRES_PASSWORD .env.production | cut -d '=' -f2 | tr -d '\"' | tr -d \"'\" | xargs)"
    echo "  docker compose -f docker-compose.prod.yml exec postgres psql -U payload -d payload -c 'SELECT 1;'"
fi
