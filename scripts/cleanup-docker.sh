#!/bin/bash
# Clean up Docker resources to free disk space

echo "=== Docker Disk Space Cleanup ==="
echo ""

echo "Current disk usage:"
df -h / | tail -1
echo ""

echo "Step 1: Checking Docker disk usage..."
docker system df
echo ""

echo "Step 2: Removing stopped containers..."
docker container prune -f
echo ""

echo "Step 3: Removing unused images..."
docker image prune -a -f
echo ""

echo "Step 4: Removing unused volumes (be careful - this removes unused volumes)..."
read -p "Remove unused volumes? This will delete volumes not used by any container (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker volume prune -f
else
    echo "Skipping volume cleanup"
fi

echo ""
echo "Step 5: Removing build cache..."
docker builder prune -a -f
echo ""

echo ""
echo "Final disk usage:"
df -h / | tail -1
echo ""

echo "Docker disk usage after cleanup:"
docker system df
