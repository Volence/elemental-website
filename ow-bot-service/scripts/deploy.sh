#!/bin/bash
# Deploy bot service files to Windows server and restart.
# Usage: ./scripts/deploy.sh [password]
#
# Copies the automation/ and api/ dirs to the server, then restarts the service.
# Requires SSH access to 185.154.146.242 (the GigaGPU Windows server).

SERVER="volence@185.154.146.242"
REMOTE_DIR="C:\\ow-bot-service"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Deploying bot service from $SCRIPT_DIR ==="

# Copy changed Python files
echo "[1/3] Copying files..."
scp -r "$SCRIPT_DIR/automation/" "$SERVER:$REMOTE_DIR/automation/"
scp -r "$SCRIPT_DIR/api/" "$SERVER:$REMOTE_DIR/api/"

echo "[2/3] Restarting service..."
ssh "$SERVER" "powershell -Command \"Restart-ScheduledTask -TaskName 'OWBotAPI'\""

echo "[3/3] Waiting for service to come back..."
for i in $(seq 1 15); do
    if curl -sf -m 2 -H "X-Bot-Secret: test-secret-change-me" http://185.154.146.242:8420/health > /dev/null 2>&1; then
        echo "Service is up!"
        curl -s -H "X-Bot-Secret: test-secret-change-me" http://185.154.146.242:8420/health
        echo ""
        exit 0
    fi
    sleep 2
done
echo "Warning: service did not come back within 30s"
