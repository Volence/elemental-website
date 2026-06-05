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
        # Remembers the final outcome of recently-finished lobbies, keyed by
        # pug_lobby_id, so the website can pull the result via /lobby/{id}/status
        # even after the instance is freed (cleanup clears pug_lobby_id almost
        # immediately after game end). Bounded to the most recent entries.
        self.finished_lobbies: dict[int, dict] = {}

    def record_finished(self, pug_lobby_id: int, status: str, match_result: str | None):
        self.finished_lobbies[pug_lobby_id] = {"status": status, "matchResult": match_result}
        # Keep only the most recent 50 to bound memory over a long session.
        if len(self.finished_lobbies) > 50:
            oldest = next(iter(self.finished_lobbies))
            self.finished_lobbies.pop(oldest, None)

    async def start(self):
        for i, acct_cfg in enumerate(settings.accounts):
            account = BattleNetAccount(
                email=acct_cfg.email,
                password=acct_cfg.password,
                authenticator_secret=acct_cfg.authenticator_secret,
                screen_region=acct_cfg.screen_region,
                battle_tag=getattr(acct_cfg, 'battle_tag', ''),
            )
            instance = OWInstance(id=f"inst-{i}", account=account)
            self.instances.append(instance)
            log.info("Registered instance %s for %s", instance.id, account.email)

    async def recover_running(self):
        """Auto-recover instances by detecting running OW windows on startup.

        For a single window, assigns it to the first instance directly.
        For multiple windows, focuses each one, OCRs the screen, and matches
        to accounts by BattleTag so we never accidentally log in the wrong
        account and kick someone out of a game.
        """
        import asyncio
        from automation.window_manager import window_manager

        # Clear any error states from a previous run. Instances are
        # in-memory only, but sync_state can set ERROR before the
        # scheduler's 60s auto-recovery kicks in. Reset them now so
        # warmup requests don't fail with "no_available_instance".
        for inst in self.instances:
            if inst.state == InstanceState.ERROR:
                log.info("[%s] Startup: clearing error state -> available", inst.id)
                inst.state = InstanceState.AVAILABLE
                inst.pug_lobby_id = None
                inst.lobby_number = None

        await asyncio.sleep(3)  # let windows settle after service start
        windows = window_manager.discover_windows()
        if not windows:
            log.info("Startup recovery: no OW windows found")
            return

        log.info("Startup recovery: found %d OW window(s)", len(windows))

        if len(windows) == 1:
            win = windows[0]
            inst = self.instances[0]
            window_manager.register_window(inst.id, win.hwnd, win.pid)
            inst.ow_process_id = win.pid
            log.info("[%s] Startup: assigned sole window PID=%d", inst.id, win.pid)
            await asyncio.sleep(2)  # let window settle before screenshotting
            try:
                screen, old, new = await inst.sync_state()
                log.info("[%s] Startup: screen=%s, state=%s", inst.id, screen, new)
            except Exception as e:
                log.warning("[%s] Startup sync failed: %s", inst.id, e)
                # Don't leave stuck in warming_up - set to ready so it's usable
                inst.state = InstanceState.READY
            return

        # Multiple windows - identify by BattleTag OCR
        await self._identify_windows_by_tag(windows)

    async def _identify_windows_by_tag(self, windows):
        """Focus each OW window, OCR for BattleTag, match to accounts."""
        import asyncio
        import ctypes
        from automation.window_manager import window_manager
        from automation.screens import ScreenDetector

        # Build tag -> instance lookup (display name portion before #)
        tag_to_inst: dict[str, OWInstance] = {}
        for inst in self.instances:
            tag = inst.account.battle_tag
            if tag:
                # Match on the display name (before # if present)
                display = tag.split("#")[0].upper()
                tag_to_inst[display] = inst

        if not tag_to_inst:
            log.warning(
                "Startup recovery: no battle_tags configured, "
                "can't identify %d windows - use Sync manually",
                len(windows),
            )
            return

        user32 = ctypes.windll.user32
        SWP_NOMOVE = 0x0002
        SWP_NOSIZE = 0x0001
        SWP_SHOWWINDOW = 0x0040

        for win in windows:
            try:
                # Focus this window
                user32.ShowWindow(win.hwnd, 9)
                user32.SetWindowPos(win.hwnd, -1, 0, 0, 0, 0,
                                    SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                user32.SetWindowPos(win.hwnd, -2, 0, 0, 0, 0,
                                    SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                user32.SetForegroundWindow(win.hwnd)
                await asyncio.sleep(1.0)

                # Screenshot and OCR
                detector = ScreenDetector(region=win.region)
                all_text = detector.find_all_text()

                # Look for known BattleTags in OCR results
                matched_inst = None
                matched_text = ""
                for text, pos, conf in all_text:
                    text_upper = text.upper().strip()
                    for display_name, inst in tag_to_inst.items():
                        if display_name in text_upper:
                            matched_inst = inst
                            matched_text = text
                            break
                    if matched_inst:
                        break

                if matched_inst:
                    window_manager.register_window(
                        matched_inst.id, win.hwnd, win.pid,
                    )
                    matched_inst.ow_process_id = win.pid
                    log.info(
                        "[%s] Startup: matched PID=%d by tag '%s'",
                        matched_inst.id, win.pid, matched_text.strip(),
                    )
                    # Remove from lookup so it's not matched again
                    tag = matched_inst.account.battle_tag.split("#")[0].upper()
                    tag_to_inst.pop(tag, None)

                    try:
                        screen, old, new = await matched_inst.sync_state()
                        log.info(
                            "[%s] Startup: screen=%s, state=%s",
                            matched_inst.id, screen, new,
                        )
                    except Exception as e:
                        log.warning("[%s] Startup sync failed: %s", matched_inst.id, e)
                else:
                    log.warning(
                        "Startup: could not identify account on window PID=%d "
                        "(OCR found no matching BattleTag)",
                        win.pid,
                    )
            except Exception as e:
                log.warning(
                    "Startup: failed to inspect window PID=%d: %s", win.pid, e,
                )

    async def shutdown(self):
        for inst in self.instances:
            await inst.force_close()
        log.info("All instances shut down")

    # ── Instance selection helpers ──
    # Rule: tagged (pug_lobby_id set) = taken. Nobody else can use it.

    def _first_free(self, state_check) -> OWInstance | None:
        """Find first instance matching state_check that isn't tagged to a lobby."""
        return next(
            (i for i in self.instances if state_check(i) and i.pug_lobby_id is None),
            None,
        )

    def get_by_lobby(self, pug_lobby_id: int) -> OWInstance | None:
        return next((i for i in self.instances if i.pug_lobby_id == pug_lobby_id), None)

    def _another_is_ready(self, exclude_id: str) -> bool:
        return any(i.is_warm for i in self.instances if i.id != exclude_id)

    def _claim(self, instance: OWInstance, pug_lobby_id: int, lobby_number: int):
        """Tag an instance to a lobby. Once tagged, no other lobby can use it."""
        instance.pug_lobby_id = pug_lobby_id
        instance.lobby_number = lobby_number
        log.info("[%s] Claimed by lobby %d (state=%s)", instance.id, pug_lobby_id, instance.state.value)

    def _unclaim(self, instance: OWInstance):
        """Release an instance from a lobby (on failure/timeout)."""
        log.info("[%s] Unclaimed from lobby %s", instance.id, instance.pug_lobby_id)
        instance.pug_lobby_id = None
        instance.lobby_number = None

    async def _wait_for_state(self, instance: OWInstance, target_state: InstanceState, timeout: int = 120) -> bool:
        """Wait for an instance to reach a target state, or bail on error/available."""
        for _ in range(timeout):
            await asyncio.sleep(1)
            if instance.state == target_state:
                return True
            if instance.state in (InstanceState.ERROR, InstanceState.AVAILABLE):
                log.warning("[%s] Entered %s while waiting for %s", instance.id, instance.state.value, target_state.value)
                return False
        log.warning("[%s] Timed out waiting for %s (stuck in %s)", instance.id, target_state.value, instance.state.value)
        return False

    def _pick_instance(self) -> OWInstance | None:
        """Pick the best free instance: prefer READY > WARMING_UP > AVAILABLE."""
        return (
            self._first_free(lambda i: i.is_warm)
            or self._first_free(lambda i: i.state == InstanceState.WARMING_UP)
            or self._first_free(lambda i: i.is_available)
        )

    async def warmup(self, pug_lobby_id: int | None = None) -> OWInstance | None:
        # Already warm?
        warm = self._first_free(lambda i: i.is_warm)
        if warm:
            return warm
        # Already warming?
        warming = self._first_free(lambda i: i.state == InstanceState.WARMING_UP)
        if warming:
            log.info("Warmup requested but %s is already warming up, skipping", warming.id)
            return warming
        # Start fresh
        available = self._first_free(lambda i: i.is_available)
        if not available:
            return None
        success = await available.warmup()
        return available if success else None

    async def _ensure_ready(self, instance: OWInstance) -> bool:
        """Get an instance to READY state, waiting or warming as needed."""
        if instance.is_warm:
            return True
        if instance.state == InstanceState.WARMING_UP:
            log.info("[%s] Waiting for warmup to finish...", instance.id)
            return await self._wait_for_state(instance, InstanceState.READY, timeout=90)
        if instance.is_available:
            return await instance.warmup()
        return False

    async def prepare_lobby(
        self,
        pug_lobby_id: int,
        lobby_number: int,
    ) -> OWInstance | None:
        """Phase 1: Warmup + create OW lobby (no settings/invites)."""
        # Already tagged to this lobby? (duplicate call)
        instance = self.get_by_lobby(pug_lobby_id)
        if instance:
            log.info("[%s] Already assigned to lobby %d, skipping re-prepare", instance.id, pug_lobby_id)
            return instance

        # Pick and claim immediately
        instance = self._pick_instance()
        if not instance:
            return None
        self._claim(instance, pug_lobby_id, lobby_number)

        # Get to READY state
        if not await self._ensure_ready(instance):
            self._unclaim(instance)
            return None

        # Create OW custom game
        success = await instance.prepare_lobby(pug_lobby_id, lobby_number)
        if not success:
            await callback_client.report_status(pug_lobby_id, "error", error="Lobby prepare failed")
            await instance.recover()
            return None

        return instance

    async def configure_lobby(
        self,
        pug_lobby_id: int,
        full_code: str,
        players: list[tuple[int, str | None, int]],
    ) -> OWInstance | None:
        """Phase 2: Import settings + invite players on a prepared lobby."""
        instance = self.get_by_lobby(pug_lobby_id)
        if not instance:
            log.warning("configure_lobby: no instance for lobby %d", pug_lobby_id)
            return None

        # If prepare is still in progress, wait for it
        if instance.state in (InstanceState.WARMING_UP, InstanceState.CREATING_LOBBY):
            log.info("[%s] Still preparing (state=%s), waiting for LOBBY_READY...", instance.id, instance.state.value)
            if not await self._wait_for_state(instance, InstanceState.LOBBY_READY):
                await instance.recover()
                return None

        success = await instance.configure_lobby(full_code, players)
        if not success:
            await callback_client.report_status(pug_lobby_id, "error", error="Lobby configure failed")
            await instance.recover()
            return None

        return instance

    async def create_lobby(
        self,
        pug_lobby_id: int,
        lobby_number: int,
        full_code: str,
        players: list[tuple[int, str | None, int]],
    ) -> OWInstance | None:
        """Full lobby creation (fallback when prepare wasn't called)."""
        # If an instance is already working on this lobby, use configure path
        existing = self.get_by_lobby(pug_lobby_id)
        if existing:
            log.info("[%s] Already assigned to lobby %d (state=%s), using configure path",
                     existing.id, pug_lobby_id, existing.state.value)
            return await self.configure_lobby(pug_lobby_id, full_code, players)

        # No existing instance - pick, claim, and do full creation
        instance = self._pick_instance()
        if not instance:
            return None
        self._claim(instance, pug_lobby_id, lobby_number)

        if not await self._ensure_ready(instance):
            self._unclaim(instance)
            return None

        success = await instance.create_lobby(
            pug_lobby_id, lobby_number, full_code, players,
        )
        if not success:
            await callback_client.report_status(pug_lobby_id, "error", error="Lobby creation failed")
            await instance.recover()
            return None

        return instance

    async def cancel_lobby(self, instance_id: str):
        inst = next((i for i in self.instances if i.id == instance_id), None)
        if not inst:
            return
        others_active = self._another_is_ready(inst.id)
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

    async def on_game_ended(self, instance_id: str, report: bool = True):
        inst = next((i for i in self.instances if i.id == instance_id), None)
        if not inst:
            return
        if inst.state in (InstanceState.AVAILABLE, InstanceState.READY):
            log.info("[%s] Already cleaned up, skipping on_game_ended", instance_id)
            return

        pug_lobby_id = inst.pug_lobby_id
        inst.on_game_ended()

        # report=False when the caller already reported game_ended (e.g. the
        # workshop-log monitor, which reports with the match_result attached).
        if report and pug_lobby_id:
            await callback_client.report_status(
                pug_lobby_id, "game_ended", instance_id=instance_id,
            )

        others_active = self._another_is_ready(inst.id)
        await inst.cleanup(others_active, settings.idle_shutdown_seconds)


instance_manager = InstanceManager()
