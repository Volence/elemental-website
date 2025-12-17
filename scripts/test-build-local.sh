#!/bin/bash
# Test production build locally
set -e

echo "🧪 Testing production build locally..."
echo ""

# Check if .env.test exists
if [ ! -f ".env.test" ]; then
    echo "📝 Creating .env.test from example..."
    cp .env.test.example .env.test
    echo "✅ Created .env.test (using defaults)"
    echo ""
fi

# Stop any existing test containers
echo "🛑 Stopping existing test containers..."
docker compose -f docker-compose.test.yml down 2>/dev/null || true

# Build the image
echo "🔨 Building Docker image..."
echo "   This may take a few minutes..."
docker compose -f docker-compose.test.yml build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "🚀 Starting services..."
    docker compose -f docker-compose.test.yml up -d
    
    echo ""
    echo "⏳ Waiting for services to start..."
    sleep 5
    
    echo ""
    echo "📊 Container status:"
    docker compose -f docker-compose.test.yml ps
    
    echo ""
    echo "✅ Services started!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Check logs: docker compose -f docker-compose.test.yml logs -f"
    echo "2. Visit: http://localhost:3000"
    echo "3. Visit admin: http://localhost:3000/admin"
    echo "4. Stop when done: docker compose -f docker-compose.test.yml down"
    echo ""
else
    echo ""
    echo "❌ Build failed! Check the errors above."
    exit 1
fi
