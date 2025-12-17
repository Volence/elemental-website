#!/bin/bash
echo "=== Checking Docker Containers ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== Checking Payload Container Logs (last 50 lines) ==="
docker compose -f docker-compose.prod.yml logs payload --tail=50

echo ""
echo "=== Testing Local Connection ==="
curl -v http://127.0.0.1:3000/api/health 2>&1 | head -20
