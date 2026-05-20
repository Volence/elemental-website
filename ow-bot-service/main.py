import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from config import settings
from api.routes import router
from instances.manager import instance_manager
from workshop.monitor import workshop_monitor
from health.monitor import health_monitor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("ow-bot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting OW Bot Service on %s:%d", settings.host, settings.port)
    await instance_manager.start()
    workshop_monitor.start()
    health_task = asyncio.create_task(health_monitor.run())
    yield
    health_task.cancel()
    workshop_monitor.stop()
    await instance_manager.shutdown()
    log.info("OW Bot Service stopped")


app = FastAPI(title="OW Bot Service", lifespan=lifespan)
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
