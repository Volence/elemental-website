"""Concurrent lobby scheduler for multi-instance OW automation.

The scheduler owns ALL focus operations — warmup, lobby lifecycle, and
health checks. Only one window is in the foreground at a time (focus lock).
Background operations (keyboard input via PostMessage, waiting) run freely.

Task types:
    LobbyTask  — full lobby lifecycle (create → import → invite → start)
    WarmupTask — launch OW / verify it's ready
    HealthTask — periodic screen check for stuck/crashed instances
"""

import asyncio
import enum
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

import psutil

from automation.window_manager import window_manager
from automation import background_input

logger = logging.getLogger("ow-bot.scheduler")


# ── Task types ────────────────────────────────────────────────────────


class LobbyState(enum.Enum):
    PENDING = "pending"
    CREATING_GAME = "creating_game"
    IMPORTING_CODE = "importing_code"
    WAITING_IMPORT = "waiting_import"
    SENDING_INVITES = "sending_invites"
    WAITING_PLAYERS = "waiting_players"
    STARTING_GAME = "starting_game"
    IN_GAME = "in_game"
    DONE = "done"
    ERROR = "error"


NEEDS_FOCUS = {
    LobbyState.PENDING,
    LobbyState.CREATING_GAME,
    LobbyState.IMPORTING_CODE,
    LobbyState.STARTING_GAME,
}

WAITING_STATES = {
    LobbyState.WAITING_IMPORT,
    LobbyState.WAITING_PLAYERS,
    LobbyState.IN_GAME,
}


@dataclass
class LobbyTask:
    instance_id: str
    hwnd: int
    pug_lobby_id: int
    lobby_number: int
    full_code: str
    players: list[dict]

    state: LobbyState = LobbyState.PENDING
    error_message: str = ""
    players_joined: int = 0
    started_at: float | None = None
    state_entered_at: float = field(default_factory=time.time)

    import_started_at: float | None = None
    import_wait_seconds: float = 10.0
    invite_round: int = 0
    max_invite_rounds: int = 3
    last_player_check: float = 0
    player_check_interval: float = 15.0

    def transition(self, new_state: LobbyState):
        old = self.state
        self.state = new_state
        self.state_entered_at = time.time()
        logger.info(
            f"Lobby #{self.lobby_number} ({self.instance_id}): "
            f"{old.value} -> {new_state.value}"
        )

    @property
    def time_in_state(self) -> float:
        return time.time() - self.state_entered_at

    @property
    def needs_focus(self) -> bool:
        if self.state in NEEDS_FOCUS:
            return True
        if (self.state == LobbyState.WAITING_PLAYERS
                and time.time() - self.last_player_check > self.player_check_interval):
            return True
        return False

    @property
    def is_waiting(self) -> bool:
        if self.state in WAITING_STATES:
            return True
        if self.state == LobbyState.WAITING_PLAYERS:
            return time.time() - self.last_player_check <= self.player_check_interval
        return False


class WarmupState(enum.Enum):
    PENDING = "pending"
    LAUNCHING = "launching"
    LOGGING_IN = "logging_in"
    WAITING_SCREEN = "waiting_screen"
    DONE = "done"
    ERROR = "error"


@dataclass
class WarmupTask:
    instance_id: str
    account: object = None  # BattleNetAccount
    state: WarmupState = WarmupState.PENDING
    error_message: str = ""
    ow_pid: int | None = None
    started_at: float | None = None
    timeout: float = 180.0
    _future: asyncio.Future | None = field(default=None, repr=False)

    @property
    def needs_focus(self) -> bool:
        return self.state in (WarmupState.PENDING, WarmupState.LAUNCHING,
                              WarmupState.LOGGING_IN, WarmupState.WAITING_SCREEN)

    @property
    def is_done(self) -> bool:
        return self.state in (WarmupState.DONE, WarmupState.ERROR)


@dataclass
class HealthTask:
    instance_id: str
    last_check: float = 0
    check_interval: float = 30.0
    consecutive_failures: int = 0
    max_failures: int = 3

    @property
    def needs_focus(self) -> bool:
        return time.time() - self.last_check > self.check_interval

    @property
    def is_done(self) -> bool:
        return False


# ── Scheduler ─────────────────────────────────────────────────────────


_UI_LABELS = {
    "MOVE", "SETTINGS", "INVITE", "ADD", "AI", "TEAM", "EMPTY",
    "VS", "SPECTATORS", "EXIT", "START", "INFO", "CUSTOM",
    "FRIENDS", "STADIUM", "DONE", "OVERWATCH", "SEARCH",
    "ENG", "SUNNY", "ACTIVATE", "WINDOWS", "GO", "BACK",
    "SWAP", "ALL",
}


class Scheduler:
    def __init__(self):
        self._lobby_tasks: dict[str, LobbyTask] = {}
        self._warmup_tasks: dict[str, WarmupTask] = {}
        self._health_tasks: dict[str, HealthTask] = {}
        self._focus_lock = asyncio.Lock()
        self._running = False
        self._loop_task: asyncio.Task | None = None

        self.on_lobby_created: Callable | None = None
        self.on_invites_sent: Callable | None = None
        self.on_game_started: Callable | None = None
        self.on_error: Callable | None = None

    @property
    def active_lobbies(self) -> list[LobbyTask]:
        return [t for t in self._lobby_tasks.values()
                if t.state not in (LobbyState.DONE, LobbyState.ERROR)]

    def add_lobby(self, task: LobbyTask):
        self._lobby_tasks[task.instance_id] = task
        logger.info(
            f"Scheduled lobby #{task.lobby_number} on {task.instance_id} "
            f"({len(task.players)} players)"
        )

    def add_warmup(self, instance_id: str, account=None) -> asyncio.Future:
        future = asyncio.get_event_loop().create_future()
        task = WarmupTask(instance_id=instance_id, account=account, _future=future)
        self._warmup_tasks[instance_id] = task
        logger.info(f"Scheduled warmup for {instance_id}")
        return future

    def register_health_check(self, instance_id: str, interval: float = 30.0):
        self._health_tasks[instance_id] = HealthTask(
            instance_id=instance_id, check_interval=interval,
        )

    def unregister_health_check(self, instance_id: str):
        self._health_tasks.pop(instance_id, None)

    async def start(self):
        self._running = True
        self._loop_task = asyncio.create_task(self._scheduler_loop())
        logger.info("Scheduler started")

    async def stop(self):
        self._running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("Scheduler stopped")

    def notify_players_joined(self, instance_id: str, count: int):
        task = self._lobby_tasks.get(instance_id)
        if task:
            task.players_joined = count

    def notify_game_ended(self, instance_id: str):
        task = self._lobby_tasks.get(instance_id)
        if task and task.state == LobbyState.IN_GAME:
            task.transition(LobbyState.DONE)

    # ── Main loop ─────────────────────────────────────────────────────

    async def _scheduler_loop(self):
        last_error_check = 0.0
        while self._running:
            # Phase 0: auto-recover error instances every 60s
            now = time.time()
            if now - last_error_check > 60:
                last_error_check = now
                try:
                    await self._auto_recover_errors()
                except Exception:
                    logger.exception("Error in auto-recover pass")

            # Phase 1: check import timeouts
            for task in self.active_lobbies:
                if task.state == LobbyState.WAITING_IMPORT:
                    elapsed = time.time() - (task.import_started_at or task.state_entered_at)
                    if elapsed >= task.import_wait_seconds:
                        logger.info(f"Lobby #{task.lobby_number}: import wait done")
                        if task.players:
                            task.transition(LobbyState.SENDING_INVITES)
                        else:
                            task.transition(LobbyState.DONE)

            # Phase 2: collect focus-needing tasks by priority
            # Lobby tasks first, then warmups, then health checks
            focus_task = self._pick_focus_task()
            if focus_task:
                await self._execute_focus_task(focus_task)

            # Phase 3: background tasks (invites)
            bg_tasks = [t for t in self.active_lobbies
                        if not t.needs_focus and not t.is_waiting
                        and t.state == LobbyState.SENDING_INVITES]
            if bg_tasks:
                await asyncio.gather(
                    *(self._do_send_invites(t) for t in bg_tasks),
                    return_exceptions=True,
                )

            await asyncio.sleep(0.1)

    def _pick_focus_task(self):
        # Priority 1: lobby tasks needing focus
        for task in self.active_lobbies:
            if task.needs_focus:
                return ("lobby", task)

        # Priority 2: warmup tasks
        for task in self._warmup_tasks.values():
            if not task.is_done and task.needs_focus:
                return ("warmup", task)

        # Priority 3: health checks due
        for task in self._health_tasks.values():
            if task.needs_focus:
                return ("health", task)

        return None

    async def _auto_recover_errors(self):
        from instances.manager import instance_manager
        from instances.instance import InstanceState

        for inst in instance_manager.instances:
            if inst.state == InstanceState.ERROR:
                logger.info(f"[{inst.id}] Auto-recovering from error state")
                await inst.recover()
            elif inst.state != InstanceState.AVAILABLE and inst.ow_process_id:
                if not psutil.pid_exists(inst.ow_process_id):
                    logger.warning(
                        f"[{inst.id}] OW process {inst.ow_process_id} is dead, "
                        f"resetting from {inst.state.value} to available"
                    )
                    self.unregister_health_check(inst.id)
                    inst.ow_process_id = None
                    inst.pug_lobby_id = None
                    inst.lobby_number = None
                    inst.state = InstanceState.AVAILABLE

    async def _execute_focus_task(self, tagged_task):
        task_type, task = tagged_task
        async with self._focus_lock:
            try:
                if task_type == "lobby":
                    await self._execute_lobby_focus(task)
                elif task_type == "warmup":
                    await self._execute_warmup(task)
                elif task_type == "health":
                    await self._execute_health_check(task)
            except Exception as e:
                logger.error(f"Focus task failed ({task_type}, {task.instance_id}): {e}")
                if task_type == "lobby":
                    task.error_message = str(e)
                    task.transition(LobbyState.ERROR)
                    if self.on_error:
                        self.on_error(task)
                elif task_type == "warmup":
                    task.state = WarmupState.ERROR
                    task.error_message = str(e)
                    if task._future and not task._future.done():
                        task._future.set_exception(e)

    # ── Focus: window setup ───────────────────────────────────────────

    def _get_detector(self, instance_id: str):
        from automation.screens import ScreenDetector
        win = window_manager.get_window(instance_id)
        region = win.region if win else (0, 0, 1280, 720)
        return ScreenDetector(region=region)

    async def _focus_instance(self, instance_id: str):
        import ctypes
        import ctypes.wintypes
        user32 = ctypes.windll.user32

        win = window_manager.get_window(instance_id)
        if not win:
            logger.warning(f"[{instance_id}] No window to focus")
            return

        hwnd = win.hwnd
        SWP_NOMOVE = 0x0002
        SWP_NOSIZE = 0x0001
        SWP_SHOWWINDOW = 0x0040
        HWND_TOPMOST = -1
        HWND_NOTOPMOST = -2

        user32.ShowWindow(hwnd, 9)  # SW_RESTORE in case minimized
        # Briefly make TOPMOST to force above everything, then remove
        user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
        user32.SetForegroundWindow(hwnd)
        await asyncio.sleep(0.5)

    # ── Focus: warmup ─────────────────────────────────────────────────

    def _claimed_ow_pids(self) -> set[int]:
        pids = set()
        for t in self._warmup_tasks.values():
            if t.ow_pid:
                pids.add(t.ow_pid)
        from instances.manager import instance_manager
        for inst in instance_manager.instances:
            if inst.ow_process_id:
                pids.add(inst.ow_process_id)
        return pids

    async def _execute_warmup(self, task: WarmupTask):
        from automation.screens import Screen
        from config import settings

        if task.started_at and time.time() - task.started_at > task.timeout:
            raise TimeoutError(
                f"Warmup timed out after {task.timeout}s"
            )

        claimed = self._claimed_ow_pids()

        if task.state == WarmupState.PENDING:
            task.started_at = time.time()
            existing_pid = self._find_ow_process(exclude_pids=claimed)
            if existing_pid:
                logger.info(f"[{task.instance_id}] OW already running (PID {existing_pid})")
                task.ow_pid = existing_pid
                self._ensure_window_registered(task.instance_id, existing_pid)
                task.state = WarmupState.WAITING_SCREEN
            else:
                ow_exe = settings.ow_install_dir / "_retail_" / "Overwatch.exe"
                logger.info(f"[{task.instance_id}] Launching OW directly: {ow_exe}")
                import subprocess
                subprocess.Popen(
                    [str(ow_exe)],
                    shell=False,
                    cwd=str(ow_exe.parent),
                )
                await asyncio.sleep(5)
                task.state = WarmupState.LAUNCHING

        if task.state == WarmupState.LAUNCHING:
            if not task.ow_pid:
                pid = self._find_ow_process(exclude_pids=claimed)
                if not pid:
                    return
                task.ow_pid = pid
            self._ensure_window_registered(task.instance_id, task.ow_pid)
            if not window_manager.get_window(task.instance_id):
                return  # window not created yet, will retry next loop
            task.state = WarmupState.LOGGING_IN

        if task.state == WarmupState.LOGGING_IN:
            if not window_manager.get_window(task.instance_id):
                self._ensure_window_registered(task.instance_id, task.ow_pid)
                if not window_manager.get_window(task.instance_id):
                    return
            await self._focus_instance(task.instance_id)
            detector = self._get_detector(task.instance_id)
            img = detector.screenshot()
            img.save(f"C:/ow-bot-service/debug_warmup_{task.instance_id}.png")
            detector.scan(img)
            screen = detector.detect_screen(rescan=False)

            known_screens = {Screen.MAIN_MENU, Screen.PLAY_MENU,
                             Screen.CUSTOM_GAMES, Screen.LOBBY, Screen.SETTINGS}
            if screen in known_screens:
                logger.info(f"[{task.instance_id}] Already logged in at {screen.value}")
                task.state = WarmupState.WAITING_SCREEN
            else:
                await self._do_ow_login(task, detector)

        if task.state == WarmupState.WAITING_SCREEN:
            await self._focus_instance(task.instance_id)
            detector = self._get_detector(task.instance_id)
            img = detector.screenshot()
            img.save(f"C:/ow-bot-service/debug_warmup_{task.instance_id}.png")
            detector.scan(img)
            screen = detector.detect_screen(rescan=False)
            known = {Screen.MAIN_MENU, Screen.PLAY_MENU, Screen.CUSTOM_GAMES,
                     Screen.LOBBY, Screen.SETTINGS}
            if screen in known:
                logger.info(f"[{task.instance_id}] OW ready at {screen.value}")
                task.state = WarmupState.DONE
                self._warmup_tasks.pop(task.instance_id, None)
                self.register_health_check(task.instance_id)
                if task._future and not task._future.done():
                    task._future.set_result(task.ow_pid)
            else:
                logger.debug(f"[{task.instance_id}] Screen: {screen.value}, waiting...")

    async def _do_ow_login(self, task: WarmupTask, detector):
        from automation import actions

        if not task.account:
            logger.error(f"[{task.instance_id}] No account for login")
            return

        login_pos = detector.find_text("LOGIN", retries=1, rescan=False)
        if not login_pos:
            login_pos = detector.find_text("Email", retries=1, rescan=False)
        if not login_pos:
            login_pos = detector.find_text("Password", retries=1, rescan=False)
        if not login_pos:
            logger.debug(f"[{task.instance_id}] No login screen yet, waiting...")
            return

        logger.info(f"[{task.instance_id}] Login screen detected, entering credentials")

        email_pos = detector.find_text("Email", retries=3)
        if not email_pos:
            email_pos = detector.find_text("Phone", retries=2)
        if email_pos:
            await actions.click(*email_pos)
            await asyncio.sleep(0.5)
        await actions.type_text(task.account.email)
        await actions.press_key("tab")
        await asyncio.sleep(0.3)
        await actions.type_text(task.account.password)
        await actions.press_key("enter")
        await asyncio.sleep(5)

        # Check for TOTP prompt
        await self._focus_instance(task.instance_id)
        totp_pos = detector.find_text("AUTHENTICATOR", retries=3)
        if not totp_pos:
            totp_pos = detector.find_text("CODE", retries=3)
        if totp_pos:
            code = task.account.generate_totp()
            await actions.click(*totp_pos)
            await asyncio.sleep(0.3)
            await actions.type_text(code)
            await actions.press_key("enter")
            logger.info(f"[{task.instance_id}] TOTP submitted")
            await asyncio.sleep(5)

        task.state = WarmupState.WAITING_SCREEN

    def _find_ow_process(self, exclude_pids: set[int] | None = None) -> int | None:
        exclude = exclude_pids or set()
        for proc in psutil.process_iter(["name"]):
            if (proc.info["name"]
                    and "overwatch" in proc.info["name"].lower()
                    and proc.pid not in exclude):
                return proc.pid
        return None

    def _ensure_window_registered(self, instance_id: str, pid: int):
        if window_manager.get_window(instance_id):
            return
        import ctypes
        import ctypes.wintypes
        user32 = ctypes.windll.user32
        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM,
        )
        found_hwnd = None

        def callback(hwnd, lparam):
            nonlocal found_hwnd
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buf = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buf, length + 1)
                    if buf.value.startswith("Overwatch"):
                        win_pid = ctypes.wintypes.DWORD()
                        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(win_pid))
                        if win_pid.value == pid:
                            found_hwnd = hwnd
                            return False
            return True

        user32.EnumWindows(EnumWindowsProc(callback), 0)
        if found_hwnd:
            window_manager.register_window(instance_id, found_hwnd, pid)
            logger.info(f"[{instance_id}] Registered OW window (hwnd={found_hwnd}, pid={pid})")
        else:
            logger.warning(f"[{instance_id}] Could not find window for PID {pid}")

    # ── Focus: health check ───────────────────────────────────────────

    async def _execute_health_check(self, task: HealthTask):
        from automation.screens import Screen

        task.last_check = time.time()
        await self._focus_instance(task.instance_id)
        detector = self._get_detector(task.instance_id)
        screen = detector.detect_screen()

        if screen != Screen.UNKNOWN:
            if task.consecutive_failures > 0:
                logger.info(f"[{task.instance_id}] Health: recovered ({screen.value})")
            task.consecutive_failures = 0
        else:
            # Try to classify and auto-dismiss dialogs before counting as failure
            classification = detector.classify_unknown()
            if classification == Screen.DIALOG:
                pos = detector.find_dismiss_button()
                if pos:
                    from automation import actions
                    logger.info(f"[{task.instance_id}] Health: dismissing dialog at {pos}")
                    await actions.click(*pos)
                    await asyncio.sleep(3)
                    return
            elif classification == Screen.LOADING:
                logger.debug(f"[{task.instance_id}] Health: loading screen, skipping")
                return

            task.consecutive_failures += 1
            logger.warning(
                f"[{task.instance_id}] Health: unknown screen "
                f"(failure {task.consecutive_failures}/{task.max_failures})"
            )
            if task.consecutive_failures >= task.max_failures:
                from instances.manager import instance_manager
                from instances.instance import InstanceState
                inst = next(
                    (i for i in instance_manager.instances if i.id == task.instance_id),
                    None,
                )
                if inst:
                    logger.error(f"[{task.instance_id}] Max health failures reached, recovering")
                    inst.state = InstanceState.ERROR
                    try:
                        await inst.recover()
                    except Exception:
                        logger.exception(f"[{task.instance_id}] Recovery after health failures failed")
                    task.consecutive_failures = 0

        # Check for Battle.net login screen
        pos = detector.find_text("LOG IN", retries=1)
        if pos:
            logger.warning(f"[{task.instance_id}] Battle.net login detected")
            await self._do_reauth(task.instance_id, detector)

    async def _do_reauth(self, instance_id: str, detector):
        from automation import actions
        from instances.manager import instance_manager

        inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
        if not inst:
            return

        try:
            pos = detector.find_text("LOG IN", retries=3)
            if not pos:
                pos = detector.find_text("EMAIL", retries=3)
            if not pos:
                logger.error(f"[{instance_id}] Cannot locate login field")
                return

            await actions.click(*pos)
            await asyncio.sleep(0.5)
            await actions.type_text(inst.account.email)
            await actions.press_key("tab")
            await actions.type_text(inst.account.password)
            await actions.press_key("enter")
            await asyncio.sleep(3)

            totp_pos = detector.find_text("AUTHENTICATOR", retries=3)
            if not totp_pos:
                totp_pos = detector.find_text("CODE", retries=3)
            if totp_pos:
                code = inst.account.generate_totp()
                await actions.click(*totp_pos)
                await asyncio.sleep(0.3)
                await actions.type_text(code)
                await actions.press_key("enter")
                logger.info(f"[{instance_id}] Re-auth TOTP submitted")
            else:
                logger.info(f"[{instance_id}] Re-auth completed (no TOTP)")
        except Exception as e:
            logger.error(f"[{instance_id}] Re-auth failed: {e}")

    # ── Focus: lobby operations ───────────────────────────────────────

    async def _execute_lobby_focus(self, task: LobbyTask):
        await self._focus_instance(task.instance_id)

        win = window_manager.get_window(task.instance_id)
        if win and not win.is_foreground:
            logger.warning(f"Lobby #{task.lobby_number}: focus retry")
            window_manager.focus_window(task.instance_id)
            await asyncio.sleep(1.0)

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

    # ── Navigation helpers ────────────────────────────────────────────

    async def _navigate_to_custom_games(self, task: LobbyTask, detector) -> bool:
        from automation import actions

        if await actions.click_text("MORE", detector, retries=2):
            await asyncio.sleep(0.3)
            pos = detector.find_text("CUSTOM")
            if pos:
                await actions.click(*pos)
                logger.info(f"Lobby #{task.lobby_number}: clicked CUSTOM at {pos}")
                return True
            await asyncio.sleep(1.5)
            pos = detector.find_text("CUSTOM", retries=2)
            if pos:
                await actions.click(*pos)
                return True

        logger.warning(f"Lobby #{task.lobby_number}: CUSTOM GAMES not found after MORE")
        return False

    # ── Lobby state implementations ───────────────────────────────────

    async def _do_create_game(self, task: LobbyTask):
        from automation.screens import Screen
        from automation import actions

        detector = self._get_detector(task.instance_id)
        current = detector.detect_screen()
        logger.info(f"Lobby #{task.lobby_number}: initial screen = {current}")

        if current == Screen.UNKNOWN:
            await actions.press_key("escape")
            await asyncio.sleep(1.5)
            current = detector.detect_screen()

        if current == Screen.LOBBY:
            # Already in a lobby — exit first
            await actions.click_text("EXIT", detector, retries=3)
            await asyncio.sleep(2)
            pos = detector.find_text("YES", retries=3)
            if pos:
                await actions.move_to(*pos)
                await asyncio.sleep(0.3)
                await actions.click(*pos, delay=0.3)
                await asyncio.sleep(5)
            current = detector.detect_screen()

        if current == Screen.MAIN_MENU:
            if not await actions.click_text("PLAY", detector, retries=3):
                raise RuntimeError("PLAY button not found")
            await asyncio.sleep(3)

            if not await self._navigate_to_custom_games(task, detector):
                raise RuntimeError("CUSTOM GAME button not found")
            await asyncio.sleep(3)

            if not await actions.click_text("CREATE", detector, retries=5):
                raise RuntimeError("CREATE button not found")
            await asyncio.sleep(3)

        elif current in (Screen.PLAY_MENU, Screen.CUSTOM_GAMES):
            if current == Screen.PLAY_MENU:
                if not await self._navigate_to_custom_games(task, detector):
                    raise RuntimeError("CUSTOM GAME button not found")
                await asyncio.sleep(3)
            await actions.click_text("CREATE", detector, retries=5)
            await asyncio.sleep(3)

        final = detector.detect_screen()
        if final == Screen.LOBBY:
            await self._do_move_to_spectator(task, detector)
            task.transition(LobbyState.IMPORTING_CODE)
            if self.on_lobby_created:
                self.on_lobby_created(task)
        else:
            raise RuntimeError(f"Failed to reach lobby, got: {final}")

    async def _do_move_to_spectator(self, task: LobbyTask, detector):
        from automation import actions

        logger.info(f"Lobby #{task.lobby_number}: moving bot to spectator")

        if not await actions.click_text("MOVE", detector, retries=3):
            raise RuntimeError("MOVE button not found")
        await asyncio.sleep(1.5)

        all_text = detector.find_all_text()
        player_pos = None
        player_name = None
        for text, pos, conf in all_text:
            words = text.upper().strip().split()
            if (pos[1] > 270 and pos[1] < 520
                    and pos[0] < 800
                    and conf > 0.4
                    and all(w not in _UI_LABELS for w in words)
                    and len(text.strip()) > 1
                    and not text.strip().isdigit()):
                player_pos = pos
                player_name = text
                break

        if not player_pos:
            raise RuntimeError("Bot name not found in Team 1")

        logger.info(f"Lobby #{task.lobby_number}: clicking bot '{player_name}' at {player_pos}")
        await actions.click(*player_pos)
        await asyncio.sleep(1.5)

        all_text = detector.find_all_text()
        spectator_slot = None
        for text, pos, conf in all_text:
            if "EMPTY" in text.upper() and pos[1] > 540:
                spectator_slot = pos
                break

        if not spectator_slot:
            raise RuntimeError("No empty spectator slot")

        await actions.click(*spectator_slot)
        await asyncio.sleep(1.5)

        if not await actions.click_text("DONE", detector, retries=3):
            raise RuntimeError("DONE button not found")
        await asyncio.sleep(1)
        logger.info(f"Lobby #{task.lobby_number}: moved to spectator")

    async def _do_import_code(self, task: LobbyTask):
        import numpy as np
        from scipy import ndimage
        from automation import actions

        detector = self._get_detector(task.instance_id)

        code = task.full_code
        if code.startswith("﻿"):
            code = code[1:]
        background_input.set_clipboard(code)
        await asyncio.sleep(1)

        if not await actions.click_text("SETTINGS", detector, retries=5):
            raise RuntimeError("SETTINGS button not found")
        await asyncio.sleep(5)

        img = detector.screenshot()
        arr = np.array(img)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        mask = (r > 180) & (g > 40) & (g < 150) & (b < 100)
        labeled, num_features = ndimage.label(mask)

        best_cluster = None
        best_size = 0
        for i in range(1, num_features + 1):
            cluster = np.argwhere(labeled == i)
            cy = int(np.mean(cluster[:, 0]))
            if len(cluster) > best_size and cy < 600:
                best_size = len(cluster)
                best_cluster = cluster

        if best_cluster is None or best_size < 20:
            raise RuntimeError(f"Import button not found (best={best_size}px)")

        win = window_manager.get_window(task.instance_id)
        region = win.region if win else (0, 0, 1280, 720)
        cy = int(np.mean(best_cluster[:, 0])) + region[1]
        cx = int(np.mean(best_cluster[:, 1])) + region[0]
        logger.info(f"Lobby #{task.lobby_number}: import button {best_size}px at ({cx},{cy})")
        await actions.click(cx, cy)
        await asyncio.sleep(3)

        pos = detector.find_text("IMPORT", retries=3)
        if pos:
            await actions.click(*pos)
            await asyncio.sleep(3)

        if not await actions.click_text("CONFIRM", detector, retries=3):
            raise RuntimeError("CONFIRM button not found")

        task.import_started_at = time.time()
        task.transition(LobbyState.WAITING_IMPORT)

    async def _do_send_invites(self, task: LobbyTask):
        async with self._focus_lock:
            await self._focus_instance(task.instance_id)
            from automation import actions

            detector = self._get_detector(task.instance_id)

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
                await asyncio.sleep(0.5)

                await actions.press_key("enter")
                await asyncio.sleep(2)

                await actions.press_key("escape")
                await asyncio.sleep(1)
                logger.info(f"Lobby #{task.lobby_number}: invited {tag}")

        task.transition(LobbyState.WAITING_PLAYERS)
        if self.on_invites_sent:
            self.on_invites_sent(task)

    async def _do_check_players(self, task: LobbyTask):
        task.last_player_check = time.time()

        expected = len(task.players)
        if task.players_joined >= expected:
            logger.info(f"Lobby #{task.lobby_number}: all {expected} players joined!")
            task.transition(LobbyState.STARTING_GAME)
            return

        if task.time_in_state > 300:
            logger.warning(
                f"Lobby #{task.lobby_number}: timed out waiting for players "
                f"({task.players_joined}/{expected})"
            )
            if task.invite_round < task.max_invite_rounds:
                task.invite_round += 1
                task.transition(LobbyState.SENDING_INVITES)
            else:
                task.transition(LobbyState.STARTING_GAME)

    async def _do_start_game(self, task: LobbyTask):
        from automation import actions

        detector = self._get_detector(task.instance_id)

        if not await actions.click_text("START", detector, retries=3):
            raise RuntimeError("START button not found")
        await asyncio.sleep(5)

        for _ in range(5):
            await asyncio.sleep(5)
            found = False
            for label in ["CONTINUE", "CONFIRM"]:
                pos = detector.find_text(label, retries=2)
                if pos:
                    logger.info(f"Lobby #{task.lobby_number}: clicking {label}")
                    await actions.click(*pos)
                    await asyncio.sleep(3)
                    found = True
                    break
            if not found:
                break

        task.started_at = time.time()
        task.transition(LobbyState.IN_GAME)
        logger.info(f"Lobby #{task.lobby_number}: game started!")
        if self.on_game_started:
            self.on_game_started(task)


# Singleton
scheduler = Scheduler()
