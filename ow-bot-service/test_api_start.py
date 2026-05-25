"""Quick test: start FastAPI, hit /health, shut down."""
import sys, time, threading, requests
sys.path.insert(0, "C:/ow-bot-service")

import uvicorn
from main import app

LOG = "C:/ow-bot-service/api_test.log"

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def test_health():
    time.sleep(3)
    try:
        r = requests.get("http://127.0.0.1:8420/health",
                         headers={"x-bot-secret": "test-secret-change-me"},
                         timeout=5)
        log(f"GET /health -> {r.status_code}: {r.json()}")
    except Exception as e:
        log(f"GET /health failed: {e}")

    try:
        r = requests.get("http://127.0.0.1:8420/instances",
                         headers={"x-bot-secret": "test-secret-change-me"},
                         timeout=5)
        log(f"GET /instances -> {r.status_code}: {r.json()}")
    except Exception as e:
        log(f"GET /instances failed: {e}")

    try:
        r = requests.get("http://127.0.0.1:8420/health", timeout=5)
        log(f"GET /health (no auth) -> {r.status_code}")
    except Exception as e:
        log(f"GET /health (no auth) failed: {e}")

    log("DONE — shutting down")
    import os
    os._exit(0)


open(LOG, "w").close()
log("Starting FastAPI server on :8420")
threading.Thread(target=test_health, daemon=True).start()
uvicorn.run(app, host="0.0.0.0", port=8420, log_level="warning")
