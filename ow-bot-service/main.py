import asyncio
import ctypes
import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from config import settings
from api.routes import router
from instances.manager import instance_manager
from workshop.monitor import workshop_monitor
from automation.scheduler import scheduler

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(r"C:\ow-bot-service\logs\bot.log"),
    ],
)
log = logging.getLogger("ow-bot")

if sys.platform == "win32":
    try:
        import win32gui, win32con
        console_hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if console_hwnd:
            win32gui.ShowWindow(console_hwnd, win32con.SW_MINIMIZE)
            log.info("Minimized console window (hwnd=%d)", console_hwnd)
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting OW Bot Service on %s:%d", settings.host, settings.port)
    await scheduler.start()
    await instance_manager.start()
    workshop_monitor.start()
    yield
    workshop_monitor.stop()
    await instance_manager.shutdown()
    await scheduler.stop()
    log.info("OW Bot Service stopped")


app = FastAPI(title="OW Bot Service", lifespan=lifespan)
app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
