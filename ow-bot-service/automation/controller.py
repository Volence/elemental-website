import asyncio
import logging
import subprocess

import psutil

from config import settings
from automation.actions import click, paste_text, type_text, press_key, hotkey
from automation.screens import ScreenDetector

log = logging.getLogger("ow-bot.controller")


class LobbyController:
    def __init__(self, instance):
        self.instance = instance
        self.screen = ScreenDetector(instance.account.screen_region)

    async def launch_ow(self) -> int:
        log.info("[%s] Launching OW via Battle.net", self.instance.id)
        subprocess.Popen(
            [str(settings.battlenet_exe), "--exec=launch Pro"],
            shell=False,
        )
        pid = await self._wait_for_ow_process()
        await self._wait_for_main_menu()
        return pid

    async def close_ow(self, pid: int):
        log.info("[%s] Closing OW process %d", self.instance.id, pid)
        try:
            proc = psutil.Process(pid)
            proc.terminate()
            proc.wait(timeout=10)
        except (psutil.NoSuchProcess, psutil.TimeoutExpired):
            try:
                psutil.Process(pid).kill()
            except psutil.NoSuchProcess:
                pass

    async def create_and_configure(self, settings_text: str | None, workshop_code: str):
        log.info("[%s] Creating custom game", self.instance.id)

        # Navigate: Play → Custom Games → Create
        await self._navigate_to_custom_create()

        # Import settings
        if settings_text:
            await self._import_settings(settings_text)

        # Import Workshop code
        await self._import_workshop_code(workshop_code)

    async def invite_players(self, players: list[tuple[int, str | None, int]]):
        log.info("[%s] Inviting %d players", self.instance.id, len(players))
        for user_id, battle_tag, team in players:
            if not battle_tag:
                log.warning("[%s] No BattleTag for user %d, skipping", self.instance.id, user_id)
                continue
            await self._invite_player(battle_tag)

    async def send_admin_command(self, command: str):
        # Phase 2: Workshop admin bridge via host spectator key presses
        key_map = {
            "pause": "e",       # Interact → pause/unpause toggle
            "unpause": "e",     # Same key, Workshop handles toggle
            "end_game": "q",    # Ability 1 → end game
        }
        key = key_map.get(command)
        if not key:
            raise ValueError(f"Unknown command: {command}")
        log.info("[%s] Sending admin command '%s' (key: %s)", self.instance.id, command, key)
        await press_key(key, duration=0.2)

    async def _navigate_to_custom_create(self):
        play_btn = self.screen.locate_template("main_menu_play_button.png")
        if play_btn:
            await click(*play_btn)
            await asyncio.sleep(1.0)

        custom_btn = self.screen.locate_template("custom_game_button.png")
        if custom_btn:
            await click(*custom_btn)
            await asyncio.sleep(0.5)

        create_btn = self.screen.locate_template("custom_game_create_button.png")
        if create_btn:
            await click(*create_btn)
            await asyncio.sleep(1.0)

    async def _import_settings(self, settings_text: str):
        log.info("[%s] Importing settings", self.instance.id)
        settings_btn = self.screen.locate_template("lobby_settings_button.png")
        if settings_btn:
            await click(*settings_btn)
            await asyncio.sleep(0.5)

        import_btn = self.screen.locate_template("settings_import_button.png")
        if import_btn:
            await click(*import_btn)
            await asyncio.sleep(0.3)

        await paste_text(settings_text)
        await asyncio.sleep(0.3)

        confirm_btn = self.screen.locate_template("import_confirm_button.png")
        if confirm_btn:
            await click(*confirm_btn)
            await asyncio.sleep(1.0)

    async def _import_workshop_code(self, code: str):
        log.info("[%s] Importing Workshop code: %s", self.instance.id, code)
        # Navigate to Workshop settings and import code
        workshop_btn = self.screen.locate_template("workshop_import_button.png")
        if workshop_btn:
            await click(*workshop_btn)
            await asyncio.sleep(0.5)
            await type_text(code)
            await asyncio.sleep(0.3)

            confirm_btn = self.screen.locate_template("workshop_confirm_button.png")
            if confirm_btn:
                await click(*confirm_btn)
                await asyncio.sleep(1.0)

    async def _invite_player(self, battle_tag: str):
        await press_key("enter")
        await asyncio.sleep(0.2)
        await type_text(f"/invite {battle_tag}")
        await press_key("enter")
        await asyncio.sleep(0.5 + __import__("random").uniform(0, 0.5))

    async def _wait_for_ow_process(self, timeout: int | None = None) -> int:
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for OW process (timeout=%ds)", self.instance.id, timeout)
        elapsed = 0
        while elapsed < timeout:
            for proc in psutil.process_iter(["name"]):
                if proc.info["name"] and "overwatch" in proc.info["name"].lower():
                    log.info("[%s] Found OW process: PID %d", self.instance.id, proc.pid)
                    return proc.pid
            await asyncio.sleep(2)
            elapsed += 2
        raise TimeoutError(f"OW did not start within {timeout}s")

    async def _wait_for_main_menu(self, timeout: int | None = None):
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for main menu", self.instance.id)
        elapsed = 0
        while elapsed < timeout:
            if self.screen.is_at_main_menu():
                return
            await asyncio.sleep(3)
            elapsed += 3
        raise TimeoutError(f"Main menu not detected within {timeout}s")
