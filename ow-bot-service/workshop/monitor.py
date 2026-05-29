import asyncio
import logging
import re
from datetime import datetime
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent

from config import settings
from workshop.parser import parse_line
from workshop.stats import MatchStats

log = logging.getLogger("ow-bot.workshop")

TAIL_POLL_SECONDS = 1.0
PLAYER_MATCH_ATTEMPTS = 15
PLAYER_MATCH_INTERVAL = 2.0
PLAYER_MATCH_THRESHOLD = 2

_FILENAME_TS_RE = re.compile(
    r"Log-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})"
)


class LogTailer:
    """Tails a single workshop log file, parsing events into live stats."""

    def __init__(self, path: Path, instance_id: str, pug_lobby_id: int):
        self.path = path
        self.instance_id = instance_id
        self.pug_lobby_id = pug_lobby_id
        self.stats = MatchStats()
        self._file_pos: int = 0
        self._task: asyncio.Future | None = None
        self._stopped = False

    def start(self, loop: asyncio.AbstractEventLoop):
        self._task = asyncio.run_coroutine_threadsafe(self._run(), loop)

    def stop(self):
        self._stopped = True
        if self._task:
            self._task.cancel()

    async def _run(self):
        log.info("Tailing %s for instance %s", self.path.name, self.instance_id)
        while not self._stopped:
            try:
                new_lines = self._read_new()
                for line in new_lines:
                    ev = parse_line(line)
                    if ev:
                        self.stats.process_event(ev)
                self._push_to_instance()

                if self.stats.match_ended:
                    log.info("Match ended in %s", self.path.name)
                    await self._on_match_end()
                    return
            except Exception:
                log.exception("Error tailing %s", self.path.name)

            await asyncio.sleep(TAIL_POLL_SECONDS)

    def _read_new(self) -> list[str]:
        try:
            with open(self.path, "r", encoding="utf-8", errors="replace") as f:
                f.seek(self._file_pos)
                data = f.read()
                self._file_pos = f.tell()
            if data:
                return [l for l in data.splitlines() if l.strip()]
        except FileNotFoundError:
            pass
        return []

    def _push_to_instance(self):
        from instances.manager import instance_manager

        inst = next(
            (i for i in instance_manager.instances if i.id == self.instance_id),
            None,
        )
        if inst:
            inst.live_stats = self.stats.snapshot()

    async def _on_match_end(self):
        self._push_to_instance()

        from instances.manager import instance_manager

        inst = next(
            (i for i in instance_manager.instances if i.id == self.instance_id),
            None,
        )
        if not inst or not inst.is_in_game:
            log.info("Instance %s already transitioned, skipping upload", self.instance_id)
            return

        match_result = None
        if self.stats.team_1_score > self.stats.team_2_score:
            match_result = "team1"
        elif self.stats.team_2_score > self.stats.team_1_score:
            match_result = "team2"
        elif self.stats.match_ended:
            match_result = "draw"

        if self.pug_lobby_id is not None:
            try:
                content = self.path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                log.exception("Failed reading %s for upload", self.path.name)
                content = None

            if content:
                from callbacks.client import callback_client

                result = await callback_client.send_stats(self.pug_lobby_id, content)
                if result:
                    log.info(
                        "Stats uploaded for PUG %d: scrimId=%s result=%s",
                        self.pug_lobby_id,
                        result.get("scrimId"),
                        result.get("autoResult"),
                    )
                    try:
                        self.path.unlink()
                        log.info("Deleted processed log %s", self.path.name)
                    except Exception:
                        log.warning("Could not delete log %s", self.path.name)
                else:
                    log.warning("Stats upload failed for PUG %d - keeping log", self.pug_lobby_id)

            from callbacks.client import callback_client
            await callback_client.report_status(
                self.pug_lobby_id,
                "game_ended",
                instance_id=self.instance_id,
                match_result=match_result,
            )
        else:
            log.info("No PUG ID for instance %s, skipping stats upload (manual test)", self.instance_id)

        log.info("[%s] Game ended, result=%s", self.instance_id, match_result)
        # Hand off to the shared post-match handler: wait for the lobby to
        # settle, navigate OW back to the main menu, then free the instance.
        # Run it as a separate task (not awaited) because that handler calls
        # cleanup, which stops this tailer and cancels the task we're in.
        # report=False: we already reported game_ended above with the result.
        from automation.controller import LobbyController
        asyncio.create_task(LobbyController(inst)._handle_post_match(report=False))


class _LogHandler(FileSystemEventHandler):
    def __init__(self, monitor: "WorkshopMonitor"):
        self._monitor = monitor

    def on_created(self, event: FileCreatedEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() not in (".csv", ".txt", ".log"):
            return
        log.info("New workshop log: %s", path.name)
        self._monitor._on_new_log(path)


def _parse_filename_ts(stem: str) -> datetime | None:
    m = _FILENAME_TS_RE.search(stem)
    if not m:
        return None
    return datetime(*map(int, m.groups()))


def _extract_player_names(path: Path) -> set[str]:
    """Read a log file and return all player names found in spawn/stat events."""
    names: set[str] = set()
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return names
    for line in content.splitlines():
        ev = parse_line(line)
        if ev and ev.get("event_type") in (
            "hero_spawn", "hero_swap", "player_stat", "kill",
        ):
            for key in ("player_name", "attacker_name", "victim_name"):
                name = ev.get(key)
                if name:
                    names.add(name)
    return names


class WorkshopMonitor:
    def __init__(self):
        self._observer: Observer | None = None
        self._tailers: dict[str, LogTailer] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def start(self):
        self._loop = asyncio.get_event_loop()
        watch_dir = settings.workshop_log_dir
        if not watch_dir.exists():
            watch_dir.mkdir(parents=True, exist_ok=True)
            log.info("Created workshop log dir: %s", watch_dir)

        self._observer = Observer()
        self._observer.schedule(_LogHandler(self), str(watch_dir), recursive=False)
        self._observer.daemon = True
        self._observer.start()
        log.info("Watching workshop logs at %s", watch_dir)

    def stop(self):
        for t in self._tailers.values():
            t.stop()
        self._tailers.clear()
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=5)
        log.info("Workshop monitor stopped")

    def _start_tailer(self, path: Path, inst) -> None:
        old = self._tailers.pop(inst.id, None)
        if old:
            old.stop()
        tailer = LogTailer(path, inst.id, inst.pug_lobby_id)
        self._tailers[inst.id] = tailer
        log.info(
            "Tailing %s → instance %s (PUG #%s)",
            path.name, inst.id, inst.lobby_number,
        )
        tailer.start(self._loop)

    def _on_new_log(self, path: Path):
        from instances.manager import instance_manager

        active = [
            i
            for i in instance_manager.instances
            if i.is_in_game and i.pug_lobby_id is not None
        ]

        if not active:
            # Fall back to any in-game instance (admin/manual tests without PUG ID)
            active = [i for i in instance_manager.instances if i.is_in_game]
            if not active:
                log.info("No active instance for %s (solo testing?)", path.name)
                return
            log.info("No PUG-linked instance, using in-game instance %s for %s", active[0].id, path.name)

        if len(active) == 1:
            self._start_tailer(path, active[0])
            return

        # Multiple active instances — try timestamp matching first
        matched = self._match_by_timestamp(path, active)
        if matched:
            self._start_tailer(path, matched)
            return

        # Defer to player-name matching (log may not have names yet)
        log.info(
            "Multiple instances active, deferring %s for player-name matching",
            path.name,
        )
        asyncio.run_coroutine_threadsafe(
            self._match_by_players(path, active), self._loop
        )

    def _match_by_timestamp(self, path: Path, instances: list) -> object | None:
        """Match log filename timestamp to the closest instance.started_at."""
        file_ts = _parse_filename_ts(path.stem)
        if not file_ts:
            return None

        candidates = []
        for inst in instances:
            if not inst.started_at:
                continue
            delta = abs((inst.started_at - file_ts).total_seconds())
            candidates.append((inst, delta))

        if not candidates:
            return None

        best, delta = min(candidates, key=lambda x: x[1])

        # Only trust the match if there's a clear winner (closest is <5 min
        # AND at least 30s closer than the next candidate)
        if delta > 300:
            return None

        if len(candidates) > 1:
            candidates.sort(key=lambda x: x[1])
            gap = candidates[1][1] - candidates[0][1]
            if gap < 30:
                log.info(
                    "Timestamp match ambiguous for %s (gap=%.0fs), "
                    "falling through to player matching",
                    path.name, gap,
                )
                return None

        log.info(
            "Matched %s → instance %s by timestamp (Δ%.0fs)",
            path.name, best.id, delta,
        )
        return best

    async def _match_by_players(self, path: Path, instances: list) -> None:
        """Poll the log file for player names and match against instances."""
        for attempt in range(PLAYER_MATCH_ATTEMPTS):
            await asyncio.sleep(PLAYER_MATCH_INTERVAL)

            names = _extract_player_names(path)
            if len(names) < PLAYER_MATCH_THRESHOLD:
                continue

            scores = [
                (inst, len(names & inst.player_names))
                for inst in instances
                if inst.player_names and inst.is_in_game
            ]
            if not scores:
                continue

            scores.sort(key=lambda x: x[1], reverse=True)
            best, overlap = scores[0]

            if overlap >= PLAYER_MATCH_THRESHOLD:
                log.info(
                    "Matched %s → instance %s by player names "
                    "(%d/%d names overlap)",
                    path.name, best.id, overlap, len(names),
                )
                self._start_tailer(path, best)
                return

        log.warning(
            "Could not associate %s with any instance after %d attempts",
            path.name, PLAYER_MATCH_ATTEMPTS,
        )

    def get_live_stats(self, instance_id: str) -> dict | None:
        t = self._tailers.get(instance_id)
        return t.stats.snapshot() if t else None

    def cleanup_instance(self, instance_id: str):
        t = self._tailers.pop(instance_id, None)
        if t:
            t.stop()


workshop_monitor = WorkshopMonitor()
