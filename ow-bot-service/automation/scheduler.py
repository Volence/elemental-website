"""Concurrent lobby scheduler for multi-instance OW automation.

Manages interleaved lobby setup across multiple OW instances. Each lobby
runs its own state machine. A focus lock ensures only one window is in the
foreground at a time for click/screenshot operations. Background keyboard
input (via PostMessage) runs freely without the lock.

Typical timeline for 3 concurrent lobbies:
    0s:   Focus OW1 → create game clicks (~5s)
    5s:   Focus OW2 → create game clicks (~5s)
    10s:  Focus OW3 → create game clicks (~5s)
    15s:  Focus OW1 → import code (~5s focus + 30s background wait)
    20s:  Focus OW2 → import code
    25s:  Focus OW3 → import code
    45s:  OW1 import done → send invites (background keyboard, no focus)
    ...
    ~150s: All lobbies have players → quick focus to start each
"""

import asyncio
import enum
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

from automation.window_manager import WindowManager, OWWindow, window_manager
from automation import background_input

logger = logging.getLogger("ow-bot.scheduler")


class LobbyState(enum.Enum):
    """States for a single lobby's setup process."""
    PENDING = "pending"                       # Waiting to start
    CREATING_GAME = "creating_game"           # Needs focus: click through menus
    IMPORTING_CODE = "importing_code"         # Needs focus: paste + click import
    WAITING_IMPORT = "waiting_import"          # No focus: waiting for import to finish
    SENDING_INVITES = "sending_invites"        # Background OK: type battletags
    WAITING_PLAYERS = "waiting_players"        # No focus: periodic check
    STARTING_GAME = "starting_game"           # Needs focus: click Start
    IN_GAME = "in_game"                       # No focus: monitor Workshop logs
    DONE = "done"                             # Lobby complete
    ERROR = "error"                           # Something went wrong


# Which states need the window to be in the foreground
NEEDS_FOCUS = {
    LobbyState.PENDING,
    LobbyState.CREATING_GAME,
    LobbyState.IMPORTING_CODE,
    LobbyState.STARTING_GAME,
}

# Which states are just waiting (don't need any action)
WAITING_STATES = {
    LobbyState.WAITING_IMPORT,
    LobbyState.WAITING_PLAYERS,
    LobbyState.IN_GAME,
}


@dataclass
class LobbyTask:
    """Tracks the state of a single lobby setup."""
    instance_id: str
    hwnd: int
    pug_lobby_id: int
    lobby_number: int
    full_code: str
    players: list[dict]  # [{userId, battleTag, team}, ...]

    state: LobbyState = LobbyState.PENDING
    error_message: str = ""
    players_joined: int = 0
    started_at: float | None = None
    state_entered_at: float = field(default_factory=time.time)

    # Timing
    import_started_at: float | None = None
    import_wait_seconds: float = 35.0  # OW import takes ~30s
    invite_round: int = 0
    max_invite_rounds: int = 3
    last_player_check: float = 0
    player_check_interval: float = 15.0  # seconds between checks

    def transition(self, new_state: LobbyState):
        """Transition to a new state."""
        old = self.state
        self.state = new_state
        self.state_entered_at = time.time()
        logger.info(
            f"Lobby #{self.lobby_number} ({self.instance_id}): "
            f"{old.value} -> {new_state.value}"
        )

    @property
    def time_in_state(self) -> float:
        """Seconds spent in current state."""
        return time.time() - self.state_entered_at

    @property
    def needs_focus(self) -> bool:
        """Whether this lobby needs the window focused right now."""
        if self.state in NEEDS_FOCUS:
            return True
        # Periodic player count check needs brief focus
        if (self.state == LobbyState.WAITING_PLAYERS
                and time.time() - self.last_player_check > self.player_check_interval):
            return True
        return False

    @property
    def is_waiting(self) -> bool:
        """Whether this lobby is idle/waiting."""
        if self.state in WAITING_STATES:
            return True
        if self.state == LobbyState.WAITING_PLAYERS:
            return time.time() - self.last_player_check <= self.player_check_interval
        return False


class LobbyScheduler:
    """Coordinates concurrent lobby setup across multiple OW instances.

    Uses an asyncio lock to ensure only one window is focused at a time.
    Background operations (keyboard input, waiting) run without the lock.
    """

    def __init__(self):
        self._tasks: dict[str, LobbyTask] = {}  # instance_id -> LobbyTask
        self._focus_lock = asyncio.Lock()
        self._running = False
        self._loop_task: asyncio.Task | None = None

        # Callbacks for integration with the rest of the bot service
        self.on_lobby_created: Callable | None = None
        self.on_invites_sent: Callable | None = None
        self.on_game_started: Callable | None = None
        self.on_error: Callable | None = None

    @property
    def active_lobbies(self) -> list[LobbyTask]:
        """Get all non-done lobby tasks."""
        return [t for t in self._tasks.values() if t.state not in (LobbyState.DONE, LobbyState.ERROR)]

    def add_lobby(self, task: LobbyTask):
        """Add a new lobby task to the scheduler."""
        self._tasks[task.instance_id] = task
        logger.info(
            f"Scheduled lobby #{task.lobby_number} on {task.instance_id} "
            f"({len(task.players)} players)"
        )

    async def start(self):
        """Start the scheduler loop."""
        self._running = True
        self._loop_task = asyncio.create_task(self._scheduler_loop())
        logger.info("Lobby scheduler started")

    async def stop(self):
        """Stop the scheduler."""
        self._running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("Lobby scheduler stopped")

    def notify_players_joined(self, instance_id: str, count: int):
        """Called by Workshop monitor when players join."""
        task = self._tasks.get(instance_id)
        if task:
            task.players_joined = count

    def notify_game_ended(self, instance_id: str):
        """Called by Workshop monitor when match ends."""
        task = self._tasks.get(instance_id)
        if task and task.state == LobbyState.IN_GAME:
            task.transition(LobbyState.DONE)

    async def _scheduler_loop(self):
        """Main scheduler loop — picks the next lobby that needs work."""
        while self._running:
            active = self.active_lobbies
            if not active:
                await asyncio.sleep(1)
                continue

            # Check for import timeouts — transition WAITING_IMPORT → SENDING_INVITES
            for task in active:
                if task.state == LobbyState.WAITING_IMPORT:
                    elapsed = time.time() - (task.import_started_at or task.state_entered_at)
                    if elapsed >= task.import_wait_seconds:
                        logger.info(
                            f"Lobby #{task.lobby_number}: import wait "
                            f"({elapsed:.0f}s) complete, moving to invites"
                        )
                        if task.players:
                            task.transition(LobbyState.SENDING_INVITES)
                        else:
                            # No players to invite (test mode) → done
                            logger.info(
                                f"Lobby #{task.lobby_number}: no players, "
                                f"skipping to DONE"
                            )
                            task.transition(LobbyState.DONE)

            # Priority: focus-needing tasks first, then background tasks
            focus_tasks = [t for t in active if t.needs_focus]
            background_tasks = [t for t in active if not t.needs_focus and not t.is_waiting]

            # Handle one focus task at a time
            if focus_tasks:
                task = focus_tasks[0]  # FIFO among focus-needing tasks
                await self._execute_focus_action(task)

            # Handle all background tasks concurrently
            if background_tasks:
                await asyncio.gather(
                    *(self._execute_background_action(t) for t in background_tasks)
                )

            # Small yield to prevent busy-looping
            await asyncio.sleep(0.1)

    async def _execute_focus_action(self, task: LobbyTask):
        """Execute an action that requires window focus."""
        async with self._focus_lock:
            # Bring window to front — OW (DirectX) needs extra settle time
            win = window_manager.get_window(task.instance_id)
            if not win:
                raise RuntimeError(f"Window not found: {task.instance_id}")

            result = window_manager.focus_window(task.instance_id)
            await asyncio.sleep(0.8)  # DirectX needs longer to render

            # Verify focus actually took
            if not win.is_foreground:
                logger.warning(
                    f"Lobby #{task.lobby_number}: focus failed, retrying..."
                )
                window_manager.focus_window(task.instance_id)
                await asyncio.sleep(1.0)

            try:
                if task.state == LobbyState.PENDING:
                    task.transition(LobbyState.CREATING_GAME)

                if task.state == LobbyState.CREATING_GAME:
                    await self._do_create_game(task)

                elif task.state == LobbyState.IMPORTING_CODE:
                    await self._do_import_code(task)

                elif task.state == LobbyState.STARTING_GAME:
                    await self._do_start_game(task)

                elif task.state == LobbyState.WAITING_PLAYERS:
                    await self._do_check_players(task)

            except Exception as e:
                logger.error(f"Focus action failed for lobby #{task.lobby_number}: {e}")
                task.error_message = str(e)
                task.transition(LobbyState.ERROR)
                if self.on_error:
                    self.on_error(task)

    async def _execute_background_action(self, task: LobbyTask):
        """Execute an action that works in the background."""
        try:
            if task.state == LobbyState.SENDING_INVITES:
                await self._do_send_invites(task)
        except Exception as e:
            logger.error(f"Background action failed for lobby #{task.lobby_number}: {e}")
            task.error_message = str(e)
            task.transition(LobbyState.ERROR)

    # ── State action implementations ──────────────────────────────────

    async def _do_create_game(self, task: LobbyTask):
        """Create a new custom game lobby. Requires focus.

        Flow: Main Menu -> Play -> Custom Games -> Create
        Uses OCR to find and click UI text labels.
        """
        from automation.screens import ScreenDetector, Screen
        from automation import actions

        win = window_manager.get_window(task.instance_id)
        region = win.region if win else (0, 0, 1280, 720)
        detector = ScreenDetector(region=region)

        current = detector.detect_screen()
        logger.info(f"Lobby #{task.lobby_number}: initial screen = {current}")

        if current == Screen.UNKNOWN:
            logger.info(f"Lobby #{task.lobby_number}: unknown screen, pressing ESC")
            await actions.press_key("escape")
            await asyncio.sleep(1.5)
            current = detector.detect_screen()
            logger.info(f"Lobby #{task.lobby_number}: after ESC = {current}")

        if current == Screen.MAIN_MENU:
            if not await actions.click_text("PLAY", detector, retries=3):
                raise RuntimeError("PLAY button not found")
            await asyncio.sleep(3)

            if not await actions.click_text("CUSTOM", detector, retries=2):
                await actions.click_text("MORE", detector, retries=2)
                await asyncio.sleep(2)
                if not await actions.click_text("CUSTOM", detector, retries=3):
                    raise RuntimeError("CUSTOM GAME button not found")
            await asyncio.sleep(3)

            if not await actions.click_text("CREATE", detector, retries=5):
                raise RuntimeError("CREATE button not found")
            await asyncio.sleep(3)

        elif current == Screen.LOBBY:
            logger.info(f"Lobby #{task.lobby_number}: already at LOBBY")

        elif current in (Screen.PLAY_MENU, Screen.CUSTOM_GAMES):
            logger.info(f"Lobby #{task.lobby_number}: at {current.value}, continuing")
            if current == Screen.PLAY_MENU:
                if not await actions.click_text("CUSTOM", detector, retries=2):
                    await actions.click_text("MORE", detector)
                    await asyncio.sleep(2)
                    await actions.click_text("CUSTOM", detector, retries=3)
                await asyncio.sleep(3)

            await actions.click_text("CREATE", detector, retries=5)
            await asyncio.sleep(3)

        final = detector.detect_screen()
        logger.info(f"Lobby #{task.lobby_number}: final screen = {final}")
        if final == Screen.LOBBY:
            task.transition(LobbyState.IMPORTING_CODE)
            if self.on_lobby_created:
                self.on_lobby_created(task)
        else:
            raise RuntimeError(f"Failed to reach lobby, got: {final}")

    async def _do_import_code(self, task: LobbyTask):
        """Import Workshop code. Requires focus for clipboard + clicks.

        Flow: Load clipboard -> Settings -> Import -> Confirm -> wait (background)
        Clipboard must contain valid workshop code BEFORE opening settings,
        otherwise OW won't show the IMPORT button.
        """
        from automation.screens import ScreenDetector
        from automation import actions

        win = window_manager.get_window(task.instance_id)
        region = win.region if win else (0, 0, 1280, 720)
        detector = ScreenDetector(region=region)

        code = task.full_code
        if code.startswith("﻿"):
            code = code[1:]
        background_input.set_clipboard(code)
        await asyncio.sleep(1)

        if not await actions.click_text("SETTINGS", detector, retries=5):
            raise RuntimeError("SETTINGS button not found")
        await asyncio.sleep(3)

        pos = await actions.click_text("IMPORT", detector, retries=5)
        if not pos:
            logger.warning(f"Lobby #{task.lobby_number}: IMPORT not found, retrying...")
            background_input.set_clipboard(code)
            await asyncio.sleep(2)
            await actions.press_key("escape")
            await asyncio.sleep(1)
            await actions.click_text("SETTINGS", detector, retries=3)
            await asyncio.sleep(3)
            pos = await actions.click_text("IMPORT", detector, retries=5)

        if not pos:
            raise RuntimeError("IMPORT button not found")
        await asyncio.sleep(3)

        if not await actions.click_text("CONFIRM", detector, retries=3):
            if not await actions.click_text("YES", detector, retries=2):
                raise RuntimeError("CONFIRM button not found")

        task.import_started_at = time.time()
        task.transition(LobbyState.WAITING_IMPORT)

    async def _do_send_invites(self, task: LobbyTask):
        """Send BattleTag invites via OCR-driven UI clicks."""
        async with self._focus_lock:
            window_manager.focus_window(task.instance_id)
            await asyncio.sleep(0.2)

            from automation.screens import ScreenDetector
            from automation import actions

            win = window_manager.get_window(task.instance_id)
            region = win.region if win else (0, 0, 1280, 720)
            detector = ScreenDetector(region=region)

            for player in task.players:
                tag = player.get("battleTag", "")
                if not tag:
                    continue

                if not await actions.click_text("INVITE", detector, retries=3):
                    logger.warning(f"INVITE button not found for {tag}")
                    continue
                await asyncio.sleep(1)

                await actions.click_text("BATTLETAG", detector, retries=3)
                await asyncio.sleep(0.5)

                await actions.paste_text(tag)
                await asyncio.sleep(0.3)

                await actions.click_text("SEND", detector, retries=3)
                await asyncio.sleep(0.5)

                await actions.press_key("escape")
                await asyncio.sleep(0.5)
                logger.info(f"Lobby #{task.lobby_number}: invited {tag}")

        task.transition(LobbyState.WAITING_PLAYERS)
        if self.on_invites_sent:
            self.on_invites_sent(task)

    async def _do_check_players(self, task: LobbyTask):
        """Check if all players have joined. Brief focus for screenshot."""
        task.last_player_check = time.time()

        expected = len(task.players)
        if task.players_joined >= expected:
            logger.info(f"Lobby #{task.lobby_number}: all {expected} players joined!")
            task.transition(LobbyState.STARTING_GAME)
            return

        # Check for timeout
        if task.time_in_state > 300:  # 5 minute timeout
            logger.warning(
                f"Lobby #{task.lobby_number}: timed out waiting for players "
                f"({task.players_joined}/{expected})"
            )
            # Could re-invite or start with partial
            if task.invite_round < task.max_invite_rounds:
                task.invite_round += 1
                task.transition(LobbyState.SENDING_INVITES)
            else:
                task.transition(LobbyState.STARTING_GAME)  # Start with whoever's there

    async def _do_start_game(self, task: LobbyTask):
        """Click Start to begin the match. Requires focus."""
        from automation import actions
        from automation.screens import ScreenDetector

        win = window_manager.get_window(task.instance_id)
        region = win.region if win else (0, 0, 1280, 720)
        detector = ScreenDetector(region=region)

        if not await actions.click_text("START", detector, retries=3):
            raise RuntimeError("START button not found")

        task.started_at = time.time()
        task.transition(LobbyState.IN_GAME)
        logger.info(f"Lobby #{task.lobby_number}: game started!")
        if self.on_game_started:
            self.on_game_started(task)


# Singleton
lobby_scheduler = LobbyScheduler()
