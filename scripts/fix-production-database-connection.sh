#!/bin/bash

echo "=== Fix Production Database Connection ==="
echo ""
echo "This script will help you fix the DATABASE_URI connection issue."
echo ""

# Read current docker-compose.prod.yml for postgres credentials
if [ -f docker-compose.prod.yml ]; then
    echo "Checking docker-compose.prod.yml for postgres settings..."
    
    # Try to extract postgres password from docker-compose
    if grep -q "POSTGRES_PASSWORD" docker-compose.prod.yml; then
        PG_PASS=$(grep "POSTGRES_PASSWORD:" docker-compose.prod.yml | head -1 | awk '{print $2}' | tr -d '"')
        echo "Found POSTGRES_PASSWORD in docker-compose: $PG_PASS"
    fi
    
    if grep -q "POSTGRES_USER" docker-compose.prod.yml; then
        PG_USER=$(grep "POSTGRES_USER:" docker-compose.prod.yml | head -1 | awk '{print $2}' | tr -d '"')
        echo "Found POSTGRES_USER: $PG_USER"
    fi
    
    if grep -q "POSTGRES_DB" docker-compose.prod.yml; then
        PG_DB=$(grep "POSTGRES_DB:" docker-compose.prod.yml | head -1 | awk '{print $2}' | tr -d '"')
        echo "Found POSTGRES_DB: $PG_DB"
    fi
fi

echo ""
echo "=== Current .env.production DATABASE_URI ==="
if [ -f .env.production ]; then
    CURRENT_URI=$(grep "^DATABASE_URI=" .env.production | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$CURRENT_URI" ]; then
        echo "NOT SET"
    else
        # Mask the password
        MASKED=$(echo "$CURRENT_URI" | sed 's/:[^@]*@/:***@/')
        echo "$MASKED"
    fi
else
    echo ".env.production does not exist!"
    exit 1
fi

echo ""
echo "=== Recommended Fix ==="
echo ""

# Build the correct DATABASE_URI
if [ -n "$PG_USER" ] && [ -n "$PG_PASS" ] && [ -n "$PG_DB" ]; then
    # URL encode the password if it has special characters
    ENCODED_PASS=$(printf %s "$PG_PASS" | jq -sRr @uri 2>/dev/null || echo "$PG_PASS")
    
    CORRECT_URI="postgresql://${PG_USER}:${ENCODED_PASS}@postgres:5432/${PG_DB}"
    
    echo "Based on your docker-compose.prod.yml, DATABASE_URI should be:"
    echo ""
    echo "DATABASE_URI=\"$CORRECT_URI\""
    echo ""
    
    read -p "Do you want to update .env.production with this value? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Backup first
        cp .env.production .env.production.backup
        
        # Update or add DATABASE_URI
        if grep -q "^DATABASE_URI=" .env.production; then
            # Replace existing
            sed -i.bak "s|^DATABASE_URI=.*|DATABASE_URI=\"$CORRECT_URI\"|" .env.production
            echo "✓ Updated DATABASE_URI in .env.production"
        else
            # Add new
            echo "DATABASE_URI=\"$CORRECT_URI\"" >> .env.production
            echo "✓ Added DATABASE_URI to .env.production"
        fi
        
        echo ""
        echo "Backup saved as: .env.production.backup"
        echo ""
        echo "Next step: Restart your containers"
        echo "  docker compose -f docker-compose.prod.yml restart payload"
    fi
else
    echo "Could not auto-detect database credentials."
    echo ""
    echo "Please manually set DATABASE_URI in .env.production:"
    echo "DATABASE_URI=\"postgresql://username:password@postgres:5432/database\""
    echo ""
    echo "Make sure:"
    echo "1. Username, password, and database match your docker-compose.prod.yml"
    echo "2. Password is wrapped in quotes"
    echo "3. Special characters in password are URL-encoded"
fi

echo ""
