#!/bin/bash

echo "=== Checking Production Environment ==="
echo ""

# Check if .env.production exists
if [ -f .env.production ]; then
    echo "✓ .env.production file exists"
    echo ""
    
    # Check for DATABASE_URI
    if grep -q "DATABASE_URI=" .env.production; then
        echo "✓ DATABASE_URI is defined in .env.production"
        
        # Show the DATABASE_URI (masked password)
        DB_URI=$(grep "DATABASE_URI=" .env.production | cut -d'=' -f2-)
        MASKED_URI=$(echo "$DB_URI" | sed 's/:[^@]*@/:***@/')
        echo "  Current value (masked): $MASKED_URI"
    else
        echo "✗ DATABASE_URI is NOT defined in .env.production"
        echo ""
        echo "You need to add it. Example:"
        echo "DATABASE_URI=postgresql://payload:your_password@postgres:5432/elemental"
    fi
    
    echo ""
    
    # Check for PAYLOAD_SECRET
    if grep -q "PAYLOAD_SECRET=" .env.production; then
        echo "✓ PAYLOAD_SECRET is defined"
    else
        echo "✗ PAYLOAD_SECRET is missing"
    fi
    
    echo ""
    
    # Check for NEXT_PUBLIC_SERVER_URL
    if grep -q "NEXT_PUBLIC_SERVER_URL=" .env.production; then
        SERVER_URL=$(grep "NEXT_PUBLIC_SERVER_URL=" .env.production | cut -d'=' -f2-)
        echo "✓ NEXT_PUBLIC_SERVER_URL is defined: $SERVER_URL"
    else
        echo "✗ NEXT_PUBLIC_SERVER_URL is missing"
    fi
    
else
    echo "✗ .env.production file does NOT exist!"
    echo ""
    echo "Create it from the template:"
    echo "cp .env.production.template .env.production"
    echo ""
    echo "Then edit it with your production values:"
    echo "nano .env.production"
fi

echo ""
echo "=== Docker Compose Check ==="

# Check if docker-compose.prod.yml exists
if [ -f docker-compose.prod.yml ]; then
    echo "✓ docker-compose.prod.yml exists"
    
    # Check if it references .env.production
    if grep -q "env_file" docker-compose.prod.yml; then
        echo "✓ docker-compose.prod.yml uses env_file"
    fi
else
    echo "✗ docker-compose.prod.yml does NOT exist"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Make sure .env.production has all required variables"
echo "2. Ensure DATABASE_URI password is properly formatted"
echo "3. Restart containers: docker compose -f docker-compose.prod.yml restart"
echo ""
