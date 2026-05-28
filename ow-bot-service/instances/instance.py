import asyncio
import logging
from datetime import datetime
from enum import Enum

from instances.accounts import BattleNetAccount

log = logging.getLogger("ow-bot.instance")


class InstanceState(Enum):
    AVAILABLE = "available"
    WARMING_UP = "warming_up"
    READY = "ready"
    LOBBY_READY = "lobby_ready"       # OW lobby created, waiting for configure call
    CREATING_LOBBY = "creating_lobby"
    WAITING_FOR_PLAYERS = "waiting_for_players"
    IN_GAME = "in_game"
    POST_GAME = "post_game"
    ERROR = "error"


class OWInstance:
    def __init__(self, id: str, account: BattleNetAccount):
        self.id = id
        self.account = account
        self.state = InstanceState.AVAILABLE
        self.pug_lobby_id: int | None = None
        self.lobby_number: int | None = None
        self.ow_process_id: int | None = None
        self.players_joined: int = 0
        self.started_at: datetime | None = None
        self.live_stats: dict | None = None
        self.player_names: set[str] = set()
        self._idle_timer: asyncio.Task | None = None

    @property
    def account_email(self) -> str:
        return self.account.email

    @property
    def is_available(self) -> bool:
        return self.state == InstanceState.AVAILABLE

    @property
    def is_warm(self) -> bool:
        return self.state == InstanceState.READY

    @property
    def is_in_game(self) -> bool:
        return self.state in (
            InstanceState.CREATING_LOBBY,
            InstanceState.WAITING_FOR_PLAYERS,
            InstanceState.IN_GAME,
        )

    def _cancel_idle_timer(self):
        if self._idle_timer and not self._idle_timer.done():
            self._idle_timer.cancel()
            self._idle_timer = None

    async def warmup(self) -> bool:
        if self.state != InstanceState.AVAILABLE:
            return False
        self._cancel_idle_timer()
        self.state = InstanceState.WARMING_UP
        log.info("[%s] Warming up via scheduler", self.id)
        try:
            from automation.scheduler import scheduler
            future = scheduler.add_warmup(self.id, account=self.account)
            self.ow_process_id = await future
            self.state = InstanceState.READY
            log.info("[%s] Warm and ready", self.id)
            return True
        except Exception as e:
            log.error("[%s] Warmup failed: %s", self.id, e)
            self.state = InstanceState.ERROR
            return False

    async def prepare_lobby(
        self,
        pug_lobby_id: int,
        lobby_number: int,
    ) -> bool:
        """Phase 1: Create OW custom game and move to spectator.

        Called after ready check while players are still drafting/banning.
        The instance stays in LOBBY_READY until configure_lobby is called.
        """
        if self.state != InstanceState.READY:
            return False
        self.pug_lobby_id = pug_lobby_id
        self.lobby_number = lobby_number
        self.state = InstanceState.CREATING_LOBBY
        log.info("[%s] Preparing lobby for PUG #%d", self.id, lobby_number)
        try:
            from automation.controller import LobbyController
            from callbacks.client import callback_client

            controller = LobbyController(self)
            await callback_client.report_status(pug_lobby_id, "preparing", instance_id=self.id)

            # Create custom game and move to spectator (no settings import)
            await controller.navigate_to(
                __import__('automation.screens', fromlist=['Screen']).Screen.MAIN_MENU
            )
            await controller._create_new_lobby()
            await controller._move_to_spectator()

            self.state = InstanceState.LOBBY_READY
            await callback_client.report_status(pug_lobby_id, "lobby_ready", instance_id=self.id)
            log.info("[%s] Lobby prepared for PUG #%d, awaiting configure", self.id, lobby_number)
            return True
        except Exception as e:
            log.error("[%s] Lobby prepare failed: %s: %s", self.id, type(e).__name__, e)
            self.state = InstanceState.ERROR
            return False

    async def configure_lobby(
        self,
        full_code: str,
        players: list[tuple[int, str | None, int]],
    ) -> bool:
        """Phase 2: Import settings, invite players, start game.

        Called after map vote/bans are done and lobby transitions to IN_PROGRESS.
        Requires the instance to be in LOBBY_READY state from prepare_lobby.
        """
        if self.state != InstanceState.LOBBY_READY:
            log.warning("[%s] configure_lobby called in state %s, expected LOBBY_READY", self.id, self.state.value)
            return False
        self.player_names = {tag.split("#")[0] for _, tag, _ in players if tag}
        self.state = InstanceState.CREATING_LOBBY
        log.info("[%s] Configuring lobby for PUG #%d", self.id, self.lobby_number)
        try:
            from automation.controller import LobbyController
            from callbacks.client import callback_client

            controller = LobbyController(self)

            # Step 0: Import settings
            await callback_client.report_status(self.pug_lobby_id, "creating", instance_id=self.id)
            await controller._import_settings(full_code)
            await controller.navigate_to(
                __import__('automation.screens', fromlist=['Screen']).Screen.LOBBY
            )

            # Step 1: Send invites
            await callback_client.report_status(self.pug_lobby_id, "lobby_created", instance_id=self.id)
            invite_result = await controller.invite_players(players)

            if invite_result.joined < invite_result.total - len(invite_result.missing_tags):
                log.warning(
                    "[%s] Not all players joined: %d/%d (timed_out=%d, failed=%d)",
                    self.id, invite_result.joined, invite_result.total,
                    len(invite_result.timed_out), len(invite_result.failed_invites),
                )

            # Step 2: Players joining
            await callback_client.report_status(self.pug_lobby_id, "players_joining", instance_id=self.id)

            # Step 3: Start game
            await controller.start_game()
            self.on_game_started()
            await callback_client.report_status(self.pug_lobby_id, "game_started", instance_id=self.id)
            return True
        except Exception as e:
            log.error("[%s] Lobby configure failed: %s: %s", self.id, type(e).__name__, e)
            self.state = InstanceState.ERROR
            return False

    async def create_lobby(
        self,
        pug_lobby_id: int,
        lobby_number: int,
        full_code: str,
        players: list[tuple[int, str | None, int]],
    ) -> bool:
        """Full lobby creation (prepare + configure in one shot).

        Used as fallback when prepare wasn't called ahead of time.
        """
        if self.state != InstanceState.READY:
            return False
        self.pug_lobby_id = pug_lobby_id
        self.lobby_number = lobby_number
        self.player_names = {tag.split("#")[0] for _, tag, _ in players if tag}
        self.state = InstanceState.CREATING_LOBBY
        log.info("[%s] Creating lobby for PUG #%d", self.id, lobby_number)
        try:
            from automation.controller import LobbyController
            from callbacks.client import callback_client

            controller = LobbyController(self)

            # Step 0: Create lobby and import settings
            await callback_client.report_status(pug_lobby_id, "creating", instance_id=self.id)
            await controller.create_and_configure(full_code)

            # Step 1: Send invites
            await callback_client.report_status(pug_lobby_id, "lobby_created", instance_id=self.id)
            invite_result = await controller.invite_players(players)

            if invite_result.joined < invite_result.total - len(invite_result.missing_tags):
                log.warning(
                    "[%s] Not all players joined: %d/%d (timed_out=%d, failed=%d)",
                    self.id, invite_result.joined, invite_result.total,
                    len(invite_result.timed_out), len(invite_result.failed_invites),
                )

            # Step 2: Players joining
            await callback_client.report_status(pug_lobby_id, "players_joining", instance_id=self.id)

            # Step 3: Start game
            await controller.start_game()
            self.on_game_started()
            await callback_client.report_status(pug_lobby_id, "game_started", instance_id=self.id)
            return True
        except Exception as e:
            log.error("[%s] Lobby creation failed: %s: %s", self.id, type(e).__name__, e)
            self.state = InstanceState.ERROR
            return False

    async def send_command(self, command: str) -> None:
        if not self.is_in_game:
            raise ValueError(f"Instance {self.id} is not in game (state={self.state.value})")
        from workshop.admin import send_workshop_command
        send_workshop_command(self.id, command)

    def on_players_joining(self, count: int):
        self.players_joined = count

    def on_game_started(self):
        self.state = InstanceState.IN_GAME
        self.started_at = datetime.now()
        self.live_stats = None
        log.info("[%s] Game started for PUG #%s", self.id, self.lobby_number)

    def on_game_ended(self):
        self.state = InstanceState.POST_GAME
        log.info("[%s] Game ended for PUG #%s", self.id, self.lobby_number)

    async def cleanup(self, other_instances_active: bool, idle_timeout: int):
        from workshop.monitor import workshop_monitor

        workshop_monitor.cleanup_instance(self.id)
        self.pug_lobby_id = None
        self.lobby_number = None
        self.players_joined = 0
        self.started_at = None
        self.live_stats = None
        self.player_names = set()

        if other_instances_active:
            await self._close_ow()
            self.state = InstanceState.AVAILABLE
        else:
            self.state = InstanceState.READY
            self._idle_timer = asyncio.create_task(self._idle_shutdown(idle_timeout))

    async def force_close(self):
        self._cancel_idle_timer()
        await self._close_ow()
        self.pug_lobby_id = None
        self.state = InstanceState.AVAILABLE

    def check_health(self) -> tuple[str, bool]:
        """Poll OW screen state. Returns (screen_name, is_healthy).

        Healthy means the screen is any known navigable state.
        Returns (state_name, True) for instances not running OW.
        """
        if self.state in (InstanceState.AVAILABLE, InstanceState.ERROR):
            return (self.state.value, self.state != InstanceState.ERROR)

        from automation.controller import LobbyController

        controller = LobbyController(self)
        screen, healthy = controller.check_health()
        return (screen.value, healthy)

    def _ensure_window_tracked(self):
        """Re-discover OW windows if this instance has no tracked window."""
        from automation.window_manager import window_manager

        existing = window_manager.get_window(self.id)
        if existing and existing.is_valid:
            return

        if existing and not existing.is_valid:
            log.info("[%s] Stale window handle, removing", self.id)
            window_manager.remove_window(self.id)

        from instances.manager import instance_manager
        windows = window_manager.discover_windows()
        if not windows:
            log.info("[%s] No OW windows found on desktop", self.id)
            return

        assigned_pids = set()
        for inst in instance_manager.instances:
            if inst.ow_process_id:
                for win in windows:
                    if win.pid == inst.ow_process_id and win.pid not in assigned_pids:
                        window_manager.remove_window(win.instance_id)
                        win.instance_id = inst.id
                        window_manager._windows[inst.id] = win
                        assigned_pids.add(win.pid)
                        log.info(
                            "[%s] Matched window by PID=%d hwnd=%d",
                            inst.id, win.pid, win.hwnd,
                        )
                        break

        unmatched_windows = [w for w in windows if w.pid not in assigned_pids]
        unmatched_instances = [
            inst for inst in instance_manager.instances
            if not window_manager.get_window(inst.id)
        ]

        if len(unmatched_windows) == 1 and len(unmatched_instances) == 1:
            # Safe: exactly one window and one instance without a window
            inst = unmatched_instances[0]
            win = unmatched_windows[0]
            window_manager.remove_window(win.instance_id)
            win.instance_id = inst.id
            window_manager._windows[inst.id] = win
            inst.ow_process_id = win.pid
            log.info(
                "[%s] Assigned sole unmatched window PID=%d hwnd=%d",
                inst.id, win.pid, win.hwnd,
            )
        elif len(unmatched_windows) == 1 and len(unmatched_instances) > 1:
            # One window but multiple instances without windows - only
            # assign if THIS instance is the one calling and it's the
            # only one that could own it (e.g. after warmup).
            log.info(
                "[%s] 1 unmatched window but %d unmatched instances "
                "- skipping auto-assign to avoid wrong match",
                self.id, len(unmatched_instances),
            )
        elif len(unmatched_windows) > 1:
            # Multiple windows without PID info - can't safely assign
            # because logging into the wrong account would kick the
            # real owner off their other OW instance.
            log.warning(
                "[%s] %d unmatched OW windows found but can't determine "
                "which account owns which - use Sync on each instance "
                "to assign manually",
                self.id, len(unmatched_windows),
            )

    async def sync_state(self) -> tuple[str, str, str]:
        """Detect the actual OW screen and update instance state to match.

        Returns (detected_screen, old_state, new_state).
        """
        from automation.controller import LobbyController
        from automation.screens import Screen
        from automation.window_manager import window_manager

        old_state = self.state.value

        self._ensure_window_tracked()

        # If we still don't have a tracked window, this instance has no OW running.
        # Don't screenshot random screen area - just stay available.
        win = window_manager.get_window(self.id)
        if not win or not win.is_valid:
            if self.state not in (InstanceState.AVAILABLE, InstanceState.WARMING_UP):
                self.state = InstanceState.AVAILABLE
            log.info(
                "[%s] No tracked window, staying %s",
                self.id, self.state.value,
            )
            return ("none", old_state, self.state.value)

        controller = LobbyController(self)
        await controller._focus()
        screen = controller.detector.detect_screen()
        if screen == Screen.UNKNOWN:
            screen = controller.detector.classify_unknown()

        if screen == Screen.LOGIN:
            log.info("[%s] Login screen detected, attempting re-login", self.id)
            try:
                await controller._handle_login_screen()
                screen = controller.detector.detect_screen()
            except Exception as e:
                log.warning("[%s] Re-login failed: %s", self.id, e)

        screen_to_state = {
            Screen.LOGIN: InstanceState.WARMING_UP,
            Screen.LOADING: InstanceState.WARMING_UP,
            Screen.MAIN_MENU: InstanceState.READY,
            Screen.PLAY_MENU: InstanceState.READY,
            Screen.CUSTOM_GAMES: InstanceState.READY,
            Screen.LOBBY: InstanceState.WAITING_FOR_PLAYERS,
            Screen.SETTINGS: InstanceState.READY,
            Screen.IN_GAME: InstanceState.IN_GAME,
            Screen.MATCH_END: InstanceState.POST_GAME,
        }

        new_state_enum = screen_to_state.get(screen)
        if new_state_enum:
            self.state = new_state_enum
        elif screen in (Screen.UNKNOWN, Screen.DIALOG) and self.ow_process_id:
            new_state_enum = InstanceState.IN_GAME
            self.state = new_state_enum
        log.info(
            "[%s] Synced state: screen=%s, %s -> %s",
            self.id, screen.value, old_state, self.state.value,
        )

        return (screen.value, old_state, self.state.value)

    async def recover(self):
        log.info("[%s] Recovering from error state", self.id)
        await self._close_ow()
        self.pug_lobby_id = None
        self.lobby_number = None
        self.live_stats = None
        self.player_names = set()
        self.started_at = None

        # Remove stale window handle and unregister health check
        from automation.window_manager import window_manager
        from automation.scheduler import scheduler

        window_manager.remove_window(self.id)
        scheduler.unregister_health_check(self.id)

        self.state = InstanceState.AVAILABLE
        log.info("[%s] Recovery complete - OW closed, state=available, awaiting warmup", self.id)

    async def _launch_ow(self):
        from automation.controller import LobbyController

        controller = LobbyController(self)
        self.ow_process_id = await controller.launch_ow()

    async def _close_ow(self):
        if self.ow_process_id:
            from automation.controller import LobbyController

            controller = LobbyController(self)
            await controller.close_ow(self.ow_process_id)
            self.ow_process_id = None

    async def _idle_shutdown(self, timeout: int):
        try:
            await asyncio.sleep(timeout)
            log.info("[%s] Idle timeout reached, closing OW", self.id)
            await self._close_ow()
            self.live_stats = None

            # Clean up window and health check so we don't screenshot desktop
            from automation.window_manager import window_manager
            from automation.scheduler import scheduler
            window_manager.remove_window(self.id)
            scheduler.unregister_health_check(self.id)

            self.state = InstanceState.AVAILABLE
            log.info("[%s] Idle shutdown complete, awaiting warmup", self.id)
        except asyncio.CancelledError:
            pass
