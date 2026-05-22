import asyncio
import logging

from config import settings
from instances.accounts import BattleNetAccount
from instances.instance import OWInstance, InstanceState
from callbacks.client import callback_client

log = logging.getLogger("ow-bot.manager")


class InstanceManager:
    def __init__(self):
        self.instances: list[OWInstance] = []
        self._watchdog_task: asyncio.Task | None = None
        self._watchdog_failures: dict[str, int] = {}  # instance_id → consecutive failures

    async def start(self):
        for i, acct_cfg in enumerate(settings.accounts):
            account = BattleNetAccount(
                email=acct_cfg.email,
                password=acct_cfg.password,
                authenticator_secret=acct_cfg.authenticator_secret,
                screen_region=acct_cfg.screen_region,
            )
            instance = OWInstance(id=f"inst-{i}", account=account)
            self.instances.append(instance)
            log.info("Registered instance %s for %s", instance.id, account.email)
        self._start_watchdog()

    async def shutdown(self):
        self._stop_watchdog()
        for inst in self.instances:
            await inst.force_close()
        log.info("All instances shut down")

    def _first_available(self) -> OWInstance | None:
        return next((i for i in self.instances if i.is_available), None)

    def _first_warm(self) -> OWInstance | None:
        return next((i for i in self.instances if i.is_warm), None)

    def get_by_lobby(self, pug_lobby_id: int) -> OWInstance | None:
        return next((i for i in self.instances if i.pug_lobby_id == pug_lobby_id), None)

    def _other_instances_active(self, exclude_id: str) -> bool:
        return any(i.is_in_game for i in self.instances if i.id != exclude_id)

    async def warmup(self, pug_lobby_id: int | None = None) -> OWInstance | None:
        warm = self._first_warm()
        if warm:
            return warm
        available = self._first_available()
        if not available:
            return None
        success = await available.warmup()
        return available if success else None

    async def create_lobby(
        self,
        pug_lobby_id: int,
        lobby_number: int,
        full_code: str,
        players: list[tuple[int, str | None, int]],
    ) -> OWInstance | None:
        instance = self._first_warm() or self._first_available()
        if not instance:
            return None

        if instance.is_available:
            success = await instance.warmup()
            if not success:
                return None

        success = await instance.create_lobby(
            pug_lobby_id, lobby_number, full_code, players,
        )
        if not success:
            await callback_client.report_status(pug_lobby_id, "error", error="Lobby creation failed")
            await instance.recover()
            return None

        await callback_client.report_status(pug_lobby_id, "lobby_created", instance_id=instance.id)
        return instance

    async def cancel_lobby(self, instance_id: str):
        inst = next((i for i in self.instances if i.id == instance_id), None)
        if not inst:
            return
        others_active = self._other_instances_active(inst.id)
        await inst.cleanup(others_active, settings.idle_shutdown_seconds)

    async def shutdown_instance(self, instance_id: str):
        inst = next((i for i in self.instances if i.id == instance_id), None)
        if inst:
            await inst.force_close()

    async def shutdown_idle(self):
        for inst in self.instances:
            if inst.is_available or inst.is_warm:
                await inst.force_close()

    async def send_command(self, instance_id: str, command: str):
        inst = next((i for i in self.instances if i.id == instance_id), None)
        if not inst:
            raise ValueError(f"Instance {instance_id} not found")
        await inst.send_command(command)

    async def on_game_ended(self, instance_id: str):
        inst = next((i for i in self.instances if i.id == instance_id), None)
        if not inst:
            return
        inst.on_game_ended()
        others_active = self._other_instances_active(inst.id)
        await inst.cleanup(others_active, settings.idle_shutdown_seconds)

    # ── Watchdog ───────────────────────────────────────────────────────

    def _start_watchdog(self):
        if self._watchdog_task and not self._watchdog_task.done():
            return
        self._watchdog_task = asyncio.create_task(self._watchdog_loop())
        log.info("Watchdog started")

    def _stop_watchdog(self):
        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()
            self._watchdog_task = None
            log.info("Watchdog stopped")

    async def _watchdog_loop(self, interval: int = 30, max_failures: int = 3):
        """Periodically poll active instances for screen health.

        If an instance reports UNKNOWN screen for *max_failures* consecutive
        checks, trigger automatic recovery (close OW, reset state).
        """
        while True:
            try:
                await asyncio.sleep(interval)
                for inst in self.instances:
                    if not inst.is_in_game and inst.state != InstanceState.READY:
                        # Not running OW — nothing to watch
                        self._watchdog_failures.pop(inst.id, None)
                        continue

                    screen_name, healthy = inst.check_health()
                    if healthy:
                        if inst.id in self._watchdog_failures:
                            log.info(
                                "[%s] Watchdog: healthy again (screen=%s)",
                                inst.id, screen_name,
                            )
                        self._watchdog_failures.pop(inst.id, None)
                    else:
                        count = self._watchdog_failures.get(inst.id, 0) + 1
                        self._watchdog_failures[inst.id] = count
                        log.warning(
                            "[%s] Watchdog: unhealthy screen=%s (failure %d/%d)",
                            inst.id, screen_name, count, max_failures,
                        )

                        if count >= max_failures:
                            log.error(
                                "[%s] Watchdog: %d consecutive failures — recovering",
                                inst.id, count,
                            )
                            pug_id = inst.pug_lobby_id
                            await inst.recover()
                            self._watchdog_failures.pop(inst.id, None)
                            if pug_id:
                                await callback_client.report_status(
                                    pug_id, "error",
                                    error="Watchdog: instance stuck on unknown screen",
                                )
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error("Watchdog loop error: %s", e, exc_info=True)
                await asyncio.sleep(interval)


instance_manager = InstanceManager()
