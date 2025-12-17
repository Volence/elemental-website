#!/bin/bash
# Check if .env.production has all required variables

cd ~/elemental-website

echo "=== Checking .env.production ==="
echo ""

if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    exit 1
fi

echo "File exists. Checking for required variables:"
echo ""

# Check each required variable
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "DATABASE_URI"
    "PAYLOAD_SECRET"
    "PAYLOAD_PUBLIC_SERVER_URL"
    "NEXT_PUBLIC_SERVER_URL"
    "NODE_ENV"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env.production; then
        value=$(grep "^${var}=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
        if [ -z "$value" ]; then
            echo "⚠️  $var: found but empty"
            MISSING=$((MISSING + 1))
        else
            # Mask sensitive values
            if [ "$var" = "POSTGRES_PASSWORD" ] || [ "$var" = "PAYLOAD_SECRET" ]; then
                masked="${value:0:4}...${value: -4}"
                echo "✓ $var: $masked (length: ${#value})"
            else
                echo "✓ $var: $value"
            fi
        fi
    else
        echo "❌ $var: MISSING"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
if [ $MISSING -eq 0 ]; then
    echo "✅ All required variables are present!"
    
    # Check if passwords match
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    DATABASE_URI=$(grep "^DATABASE_URI=" .env.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    
    if [[ "$DATABASE_URI" == *"$POSTGRES_PASSWORD"* ]]; then
        echo "✅ POSTGRES_PASSWORD matches DATABASE_URI"
    else
        echo "⚠️  WARNING: POSTGRES_PASSWORD may not match the password in DATABASE_URI"
    fi
else
    echo "❌ Missing $MISSING required variable(s). Please add them to .env.production"
fi
