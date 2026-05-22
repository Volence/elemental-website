"""High-level lobby operations using OCR-based screen detection.

Provides create_and_configure(), invite_players(), start_game() — the full
lobby lifecycle. All UI interaction uses easyocr text detection and
numpy-based color scanning (for the orange import button).
"""

import asyncio
import logging
import random
from dataclasses import dataclass, field

import numpy as np
import psutil
from scipy import ndimage

from config import settings
from automation.actions import click, click_text, move_to, paste_text, press_key, hotkey
from automation.screens import Screen, ScreenDetector, get_depth
from automation.window_manager import window_manager
from automation import background_input

log = logging.getLogger("ow-bot.controller")


@dataclass
class InviteResult:
    total: int = 0
    joined: int = 0
    missing_tags: list[int] = field(default_factory=list)
    failed_invites: list[int] = field(default_factory=list)
    timed_out: list[int] = field(default_factory=list)


class NavigationError(Exception):
    pass


class LobbyController:
    def __init__(self, instance):
        self.instance = instance
        self._detector: ScreenDetector | None = None

    @property
    def detector(self) -> ScreenDetector:
        if self._detector is None:
            win = window_manager.get_window(self.instance.id)
            region = win.region if win else self.instance.account.screen_region
            self._detector = ScreenDetector(region=region)
        return self._detector

    async def _focus(self):
        window_manager.focus_window(self.instance.id)
        await asyncio.sleep(0.8)

    # ── Navigation ────────────────────────────────────────────────────

    async def navigate_to(self, target: Screen, max_attempts: int = 5) -> None:
        await self._focus()

        for attempt in range(1, max_attempts + 1):
            current = self.detector.detect_screen()
            log.info(
                "[%s] nav(%s): at %s (attempt %d/%d)",
                self.instance.id, target.value, current.value,
                attempt, max_attempts,
            )

            if current == target:
                return

            if current == Screen.LOBBY and target != Screen.LOBBY:
                log.info("[%s] At lobby — exiting via EXIT + YES", self.instance.id)
                await click_text("EXIT", self.detector, retries=3)
                await asyncio.sleep(2)
                pos = self.detector.find_text("YES", retries=3)
                if pos:
                    await move_to(*pos)
                    await asyncio.sleep(0.3)
                    await click(*pos, delay=0.3)
                    await asyncio.sleep(5)
                continue

            if current == Screen.UNKNOWN:
                await press_key("escape")
                await asyncio.sleep(2)
                continue

            cur_depth = get_depth(current)
            tgt_depth = get_depth(target)

            if cur_depth > tgt_depth:
                for _ in range(cur_depth - tgt_depth):
                    await press_key("escape")
                    await asyncio.sleep(2)
            elif cur_depth < tgt_depth:
                break

        actual = self.detector.detect_screen()
        if actual != target:
            raise NavigationError(
                f"[{self.instance.id}] Cannot reach {target.value}, at {actual.value}"
            )

    def check_health(self) -> tuple[Screen, bool]:
        current = self.detector.detect_screen()
        return current, current != Screen.UNKNOWN

    # ── High-level operations ─────────────────────────────────────────

    async def launch_ow(self) -> int:
        existing_pid = self._find_ow_process()
        if existing_pid:
            log.info("[%s] OW already running (PID %d), skipping launch", self.instance.id, existing_pid)
            await self._wait_for_main_menu()
            return existing_pid

        log.info("[%s] Launching OW via Battle.net", self.instance.id)
        import subprocess
        subprocess.Popen(
            [str(settings.battlenet_exe), "--exec=launch Pro"],
            shell=False,
        )
        pid = await self._wait_for_ow_process()
        await self._wait_for_main_menu()
        return pid

    def _find_ow_process(self) -> int | None:
        for proc in psutil.process_iter(["name"]):
            if proc.info["name"] and "overwatch" in proc.info["name"].lower():
                return proc.pid
        return None

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

    UI_LABELS = {
        "MOVE", "SETTINGS", "INVITE", "ADD", "AI", "TEAM", "EMPTY",
        "VS", "SPECTATORS", "EXIT", "START", "INFO", "CUSTOM",
        "FRIENDS", "STADIUM", "DONE", "OVERWATCH", "SEARCH",
        "ENG", "SUNNY", "ACTIVATE", "WINDOWS", "GO", "BACK",
        "SWAP", "ALL",
    }

    async def create_and_configure(self, full_code: str):
        log.info("[%s] Creating custom game", self.instance.id)
        await self.navigate_to(Screen.MAIN_MENU)
        await self._create_new_lobby()
        await self._move_to_spectator()
        await self._import_settings(full_code)
        await self.navigate_to(Screen.LOBBY)

    async def invite_players(
        self,
        players: list[tuple[int, str | None, int]],
        *,
        join_timeout: int = 60,
        poll_interval: int = 10,
        max_reinvites: int = 1,
    ) -> InviteResult:
        result = InviteResult(total=len(players))
        await self.navigate_to(Screen.LOBBY)

        valid = [(uid, tag, team) for uid, tag, team in players if tag]
        no_tag = [uid for uid, tag, _ in players if not tag]
        if no_tag:
            log.warning("[%s] Skipping %d players with no BattleTag", self.instance.id, len(no_tag))
            result.missing_tags = no_tag

        valid.sort(key=lambda p: p[2])
        expected_count = len(valid)
        log.info("[%s] Inviting %d players", self.instance.id, expected_count)

        pending = list(valid)
        for round_num in range(1 + max_reinvites):
            if round_num > 0:
                log.info("[%s] Re-invite round %d for %d remaining", self.instance.id, round_num, len(pending))

            for i, (user_id, battle_tag, team) in enumerate(pending):
                try:
                    await self._invite_one_player(battle_tag, team)
                    log.info("[%s] Invited %s to team %d (%d/%d)", self.instance.id, battle_tag, team, i + 1, len(pending))
                except NavigationError as e:
                    log.error("[%s] Failed to invite %s: %s", self.instance.id, battle_tag, e)
                    result.failed_invites.append(user_id)

            joined_count = await self._wait_for_players(expected_count, join_timeout, poll_interval)
            result.joined = joined_count

            if joined_count >= expected_count:
                log.info("[%s] All %d players joined!", self.instance.id, expected_count)
                break

            if round_num >= max_reinvites:
                result.timed_out = [uid for uid, _, _ in pending]

        log.info(
            "[%s] Invite phase: %d/%d joined, %d timed out, %d failed, %d no tag",
            self.instance.id, result.joined, result.total,
            len(result.timed_out), len(result.failed_invites), len(result.missing_tags),
        )
        return result

    async def start_game(self):
        await self._focus()
        await self.navigate_to(Screen.LOBBY)

        log.info("[%s] Starting game", self.instance.id)
        if not await click_text("START", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] START button not found")
        await asyncio.sleep(5)

        # Handle CONTINUE / CONFIRM screens (hero select, assemble, etc.)
        for _ in range(5):
            await asyncio.sleep(5)
            for label in ["CONTINUE", "CONFIRM"]:
                pos = self.detector.find_text(label, retries=2)
                if pos:
                    log.info("[%s] Clicking %s at %s", self.instance.id, label, pos)
                    await click(*pos)
                    await asyncio.sleep(3)
                    break
            else:
                break

        log.info("[%s] Game started", self.instance.id)

    async def send_admin_command(self, command: str):
        key_map = {"pause": "e", "unpause": "e", "end_game": "q"}
        key = key_map.get(command)
        if not key:
            raise ValueError(f"Unknown command: {command}")
        await self._focus()
        await click(640, 360, delay=0.5)
        await asyncio.sleep(0.3)
        log.info("[%s] Admin command '%s' (key: %s)", self.instance.id, command, key)
        await press_key(key, duration=0.2)

    # ── Private helpers ───────────────────────────────────────────────

    async def _create_new_lobby(self):
        await self._focus()

        if not await click_text("PLAY", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] PLAY not found")
        await asyncio.sleep(3)

        # MORE dropdown — scan fast before it closes
        if not await click_text("MORE", self.detector, retries=2):
            raise NavigationError(f"[{self.instance.id}] MORE not found")
        await asyncio.sleep(0.3)

        pos = self.detector.find_text("CUSTOM")
        if not pos:
            await asyncio.sleep(1.5)
            pos = self.detector.find_text("CUSTOM", retries=2)
        if not pos:
            raise NavigationError(f"[{self.instance.id}] CUSTOM GAMES not found")
        await click(*pos)
        await asyncio.sleep(3)

        if not await click_text("CREATE", self.detector, retries=5):
            raise NavigationError(f"[{self.instance.id}] CREATE not found")
        await asyncio.sleep(3)

        if not self.detector.wait_for_screen(Screen.LOBBY, timeout=5.0):
            raise NavigationError(f"[{self.instance.id}] Did not arrive at lobby after Create")
        log.info("[%s] New lobby created", self.instance.id)

    async def _move_to_spectator(self):
        await self._focus()
        log.info("[%s] Moving bot to spectator", self.instance.id)

        if not await click_text("MOVE", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] MOVE not found")
        await asyncio.sleep(1.5)

        all_text = self.detector.find_all_text()
        player_pos = None
        player_name = None
        for text, pos, conf in all_text:
            words = text.upper().strip().split()
            if (pos[1] > 270 and pos[1] < 520
                    and pos[0] < 800
                    and conf > 0.4
                    and all(w not in self.UI_LABELS for w in words)
                    and len(text.strip()) > 1
                    and not text.strip().isdigit()):
                player_pos = pos
                player_name = text
                break

        if not player_pos:
            raise NavigationError(f"[{self.instance.id}] Bot name not found in Team 1")

        log.info("[%s] Clicking bot '%s' at %s", self.instance.id, player_name, player_pos)
        await click(*player_pos)
        await asyncio.sleep(1.5)

        all_text = self.detector.find_all_text()
        spectator_slot = None
        for text, pos, conf in all_text:
            if "EMPTY" in text.upper() and pos[1] > 540:
                spectator_slot = pos
                break

        if not spectator_slot:
            raise NavigationError(f"[{self.instance.id}] No empty spectator slot")

        log.info("[%s] Clicking spectator slot at %s", self.instance.id, spectator_slot)
        await click(*spectator_slot)
        await asyncio.sleep(1.5)

        if not await click_text("DONE", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] DONE not found")
        await asyncio.sleep(1)
        log.info("[%s] Moved to spectator", self.instance.id)

    async def _import_settings(self, full_code: str):
        log.info("[%s] Importing settings (%d chars)", self.instance.id, len(full_code))
        await self._focus()

        code = full_code.lstrip("﻿")
        background_input.set_clipboard(code)
        await asyncio.sleep(1)

        if not await click_text("SETTINGS", self.detector, retries=5):
            raise NavigationError(f"[{self.instance.id}] SETTINGS not found")
        await asyncio.sleep(5)

        img = self.detector.screenshot()

        # The import button is a small red-orange icon (5th under SUMMARY).
        # Only visible when clipboard has valid Workshop code.
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
            raise NavigationError(
                f"[{self.instance.id}] Import button not found (best={best_size}px)"
            )

        cy = int(np.mean(best_cluster[:, 0])) + self.detector.region[1]
        cx = int(np.mean(best_cluster[:, 1])) + self.detector.region[0]
        log.info("[%s] Import button: %dpx at (%d, %d)", self.instance.id, best_size, cx, cy)
        await click(cx, cy)
        await asyncio.sleep(3)

        # Click IMPORT text that appears in dialog
        pos = self.detector.find_text("IMPORT", retries=3)
        if pos:
            log.info("[%s] Clicking IMPORT at %s", self.instance.id, pos)
            await click(*pos)
            await asyncio.sleep(3)

        # Click CONFIRM
        if not await click_text("CONFIRM", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] CONFIRM not found after import")
        log.info("[%s] Import confirmed, waiting 10s for load", self.instance.id)
        await asyncio.sleep(10)

        # ESC back to lobby
        await press_key("escape")
        await asyncio.sleep(2)
        screen = self.detector.detect_screen()
        if screen == Screen.UNKNOWN:
            await press_key("escape")
            await asyncio.sleep(2)

        log.info("[%s] Settings imported", self.instance.id)

    async def _invite_one_player(self, battle_tag: str, team: int):
        await self._focus()

        if not await click_text("INVITE", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] INVITE not found")
        await asyncio.sleep(2)

        # Team selector — click BOTH dropdown then target team
        pos = self.detector.find_text("BOTH", retries=2)
        if pos:
            await click(*pos)
            await asyncio.sleep(1)
            team_label = f"TEAM {team}"
            pos = self.detector.find_text(team_label, retries=2)
            if pos:
                await click(*pos)
                await asyncio.sleep(1)

        # Click BATTLETAG tab
        await click_text("BATTLETAG", self.detector, retries=2)
        await asyncio.sleep(1)

        # Paste BattleTag and press Enter to send
        await paste_text(battle_tag)
        await asyncio.sleep(0.5)
        await press_key("enter")
        await asyncio.sleep(2)

        # Close invite dialog
        await press_key("escape")
        await asyncio.sleep(1)
        screen = self.detector.detect_screen()
        if screen == Screen.UNKNOWN:
            await press_key("escape")
            await asyncio.sleep(1)

    async def _wait_for_players(self, expected: int, timeout: int, poll_interval: int) -> int:
        log.info("[%s] Waiting %ds for %d players", self.instance.id, timeout, expected)
        elapsed = 0

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            joined = self.instance.players_joined
            log.info("[%s] Players: %d/%d (elapsed %ds/%ds)", self.instance.id, joined, expected, elapsed, timeout)

            if joined >= expected:
                return joined

        return self.instance.players_joined

    async def _wait_for_ow_process(self, timeout: int | None = None) -> int:
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for OW process (timeout=%ds)", self.instance.id, timeout)
        elapsed = 0
        while elapsed < timeout:
            for proc in psutil.process_iter(["name"]):
                if proc.info["name"] and "overwatch" in proc.info["name"].lower():
                    log.info("[%s] Found OW: PID %d", self.instance.id, proc.pid)
                    return proc.pid
            await asyncio.sleep(2)
            elapsed += 2
        raise TimeoutError(f"OW did not start within {timeout}s")

    async def _wait_for_main_menu(self, timeout: int | None = None):
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for OW to be ready", self.instance.id)
        known_screens = {Screen.MAIN_MENU, Screen.PLAY_MENU, Screen.CUSTOM_GAMES, Screen.LOBBY, Screen.SETTINGS}
        elapsed = 0.0
        while elapsed < timeout:
            screen = self.detector.detect_screen()
            if screen in known_screens:
                log.info("[%s] OW ready at %s", self.instance.id, screen.value)
                return
            await asyncio.sleep(3)
            elapsed += 3
        raise TimeoutError(f"No known OW screen detected within {timeout}s")
