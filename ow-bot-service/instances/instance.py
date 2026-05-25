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

    async def create_lobby(
        self,
        pug_lobby_id: int,
        lobby_number: int,
        full_code: str,
        players: list[tuple[int, str | None, int]],
    ) -> bool:
        if self.state != InstanceState.READY:
            return False
        self.pug_lobby_id = pug_lobby_id
        self.lobby_number = lobby_number
        self.player_names = {tag.split("#")[0] for _, tag, _ in players if tag}
        self.state = InstanceState.CREATING_LOBBY
        log.info("[%s] Creating lobby for PUG #%d", self.id, lobby_number)
        try:
            from automation.controller import LobbyController

            controller = LobbyController(self)
            await controller.create_and_configure(full_code)
            invite_result = await controller.invite_players(players)

            if invite_result.joined < invite_result.total - len(invite_result.missing_tags):
                log.warning(
                    "[%s] Not all players joined: %d/%d (timed_out=%d, failed=%d)",
                    self.id, invite_result.joined, invite_result.total,
                    len(invite_result.timed_out), len(invite_result.failed_invites),
                )
                # Still start the game — the web app decides whether to cancel
                # based on Workshop events and its own join tracking.

            await controller.start_game()
            self.state = InstanceState.WAITING_FOR_PLAYERS
            return True
        except Exception as e:
            # NavigationError is a subclass of Exception, caught here too
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

    async def recover(self):
        log.info("[%s] Recovering from error state", self.id)
        await self._close_ow()
        self.pug_lobby_id = None
        self.lobby_number = None
        self.state = InstanceState.AVAILABLE

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
            self.state = InstanceState.AVAILABLE
        except asyncio.CancelledError:
            pass
