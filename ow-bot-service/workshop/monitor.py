import logging
import threading
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent

from config import settings

log = logging.getLogger("ow-bot.workshop")


class WorkshopLogHandler(FileSystemEventHandler):
    def __init__(self):
        self._known_files: set[str] = set()

    def on_created(self, event: FileCreatedEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() not in (".csv", ".txt", ".log"):
            return
        log.info("New Workshop log detected: %s", path.name)
        self._known_files.add(str(path))

    def on_modified(self, event: FileModifiedEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if str(path) not in self._known_files:
            return
        # File was modified — could be log finalization after match end
        self._process_log(path)

    def _process_log(self, path: Path):
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            if not content.strip():
                return

            from instances.manager import instance_manager

            # Associate log with the active instance by timing
            active_instances = [
                i for i in instance_manager.instances
                if i.is_in_game or i.state.value == "post_game"
            ]

            if len(active_instances) == 1:
                inst = active_instances[0]
                if inst.pug_lobby_id:
                    log.info("Forwarding log %s for PUG lobby %d", path.name, inst.pug_lobby_id)
                    self._forward_log(inst.pug_lobby_id, content)
            elif len(active_instances) > 1:
                log.warning(
                    "Multiple active instances — cannot auto-associate log %s. "
                    "Manual association needed.",
                    path.name,
                )
            else:
                log.warning("No active instances for log %s", path.name)
        except Exception as e:
            log.error("Failed to process log %s: %s", path.name, e)

    def _forward_log(self, pug_lobby_id: int, content: str):
        import asyncio
        from callbacks.client import callback_client

        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(callback_client.send_stats(pug_lobby_id, content))
        else:
            loop.run_until_complete(callback_client.send_stats(pug_lobby_id, content))


class WorkshopMonitor:
    def __init__(self):
        self._observer: Observer | None = None
        self._handler = WorkshopLogHandler()

    def start(self):
        watch_dir = settings.workshop_log_dir
        if not watch_dir.exists():
            log.warning("Workshop log directory does not exist: %s", watch_dir)
            watch_dir.mkdir(parents=True, exist_ok=True)
            log.info("Created Workshop log directory: %s", watch_dir)

        self._observer = Observer()
        self._observer.schedule(self._handler, str(watch_dir), recursive=False)
        self._observer.daemon = True
        self._observer.start()
        log.info("Watching Workshop logs at: %s", watch_dir)

    def stop(self):
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=5)
            log.info("Workshop monitor stopped")


workshop_monitor = WorkshopMonitor()
