#!/bin/bash
# Test production build locally
# This will build the Docker image and test it without deploying

set -e

echo "🧪 Testing production build locally..."
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "⚠️  Warning: .env.production not found. Using .env if available."
    echo "   For production, create .env.production with:"
    echo "   - DATABASE_URI"
    echo "   - POSTGRES_PASSWORD"
    echo "   - PAYLOAD_SECRET"
    echo "   - PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000"
    echo "   - NEXT_PUBLIC_SERVER_URL=http://localhost:3000"
    echo ""
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build the image
echo "🔨 Building Docker image..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Start the containers: docker compose -f docker-compose.prod.yml up -d"
echo "2. Check logs: docker compose -f docker-compose.prod.yml logs -f"
echo "3. Visit: http://localhost:3000"
echo "4. Stop when done: docker compose -f docker-compose.prod.yml down"
echo ""
