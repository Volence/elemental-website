import asyncio
import logging
import random
import subprocess
from dataclasses import dataclass, field

import psutil

from config import settings
from automation.actions import click, move_to, paste_text, type_text, press_key, hotkey
from automation.screens import Screen, ScreenDetector, _DEPTH

log = logging.getLogger("ow-bot.controller")


# ── Invite team dropdown offsets ──────────────────────────────────────
# The TEAM dropdown options in the INVITE dialog are visually identical
# ("TEAM 1" vs "TEAM 2" differ by a single digit), so template matching
# picks the wrong one.  Instead we find the dropdown control (which shows
# the current value, e.g. "BOTH") and click at a fixed pixel offset
# to select the desired option.
#
# Offsets (in px below the dropdown control center):
#   BOTH = +31,  TEAM 1 = +53,  TEAM 2 = +75,  SPECTATOR = +97
_TEAM_DROPDOWN_OFFSETS: dict[int, int] = {
    0: 31,   # BOTH
    1: 53,   # TEAM 1
    2: 75,   # TEAM 2
    3: 97,   # SPECTATOR
}


@dataclass
class InviteResult:
    """Outcome of the invite-and-wait phase for reporting back to the web app."""
    total: int = 0
    joined: int = 0
    missing_tags: list[int] = field(default_factory=list)      # user_ids with no BattleTag
    failed_invites: list[int] = field(default_factory=list)     # user_ids whose invite errored
    timed_out: list[int] = field(default_factory=list)          # user_ids who never joined


class NavigationError(Exception):
    """Raised when the controller cannot reach the required screen."""
    pass


# Non-destructive forward navigation clicks between adjacent menu depths.
# Key = (from_depth, to_depth).  Value = list of (template, confidence, wait_sec).
#
# CUSTOM_GAMES → LOBBY (depth 2→3) is intentionally absent because that
# transition uses the Create button which makes a NEW lobby.  The explicit
# _create_new_lobby() method handles that step.
_FORWARD_STEPS: dict[tuple[int, int], list[tuple[str, float, float]]] = {
    # MAIN_MENU → PLAY_MENU
    (0, 1): [("main_menu_play_button.png", 0.8, 2.0)],
    # PLAY_MENU → CUSTOM_GAMES (click "More", then the Custom Games entry)
    (1, 2): [
        ("custom_game_more_button.png", 0.8, 2.0),
        ("custom_game_button.png", 0.7, 2.0),
    ],
    # LOBBY → SETTINGS
    (3, 4): [("lobby_settings_button.png", 0.8, 2.0)],
}


class LobbyController:
    def __init__(self, instance):
        self.instance = instance
        self.screen = ScreenDetector(instance.account.screen_region)

    # ── Navigation & Recovery ──────────────────────────────────────────

    async def navigate_to(self, target: Screen, max_attempts: int = 3) -> None:
        """Navigate from the current screen to *target*.

        Strategy:
          1. Detect current screen.
          2. If deeper than target → ESC back.
          3. If shallower → click forward (non-destructive transitions only).
          4. Verify arrival; retry if wrong.

        Raises NavigationError after *max_attempts* failures.
        """
        for attempt in range(1, max_attempts + 1):
            current = self.screen.detect_screen()
            log.info(
                "[%s] navigate_to(%s): at %s (attempt %d/%d)",
                self.instance.id, target.value, current.value,
                attempt, max_attempts,
            )

            if current == target:
                return

            # ── Unknown screen → ESC recovery ──
            if current == Screen.UNKNOWN:
                current = await self._recover_unknown()
                if current == target:
                    return
                if current == Screen.UNKNOWN:
                    await asyncio.sleep(2.0)
                    continue

            cur_depth = _DEPTH.get(current, 0)
            tgt_depth = _DEPTH.get(target, 0)

            # ── Back out if too deep ──
            if cur_depth > tgt_depth:
                esc_count = cur_depth - tgt_depth
                log.debug("[%s] Backing out %d level(s)", self.instance.id, esc_count)
                for _ in range(esc_count):
                    await press_key("escape", duration=0.1)
                    await asyncio.sleep(1.5)

            # ── Same depth, wrong screen (shouldn't happen in OW tree menu) ──
            elif cur_depth == tgt_depth and current != target:
                log.debug("[%s] Same depth wrong screen — ESC + retry", self.instance.id)
                await press_key("escape", duration=0.1)
                await asyncio.sleep(1.5)
                cur_depth = max(cur_depth - 1, 0)

            # ── Navigate forward if shallower ──
            if cur_depth < tgt_depth:
                for d in range(cur_depth, tgt_depth):
                    steps = _FORWARD_STEPS.get((d, d + 1))
                    if not steps:
                        log.warning(
                            "[%s] No forward path for depth %d→%d "
                            "(use _create_new_lobby for 2→3)",
                            self.instance.id, d, d + 1,
                        )
                        break
                    for tmpl, conf, wait in steps:
                        btn = self.screen.locate_template(
                            tmpl, confidence=conf, retries=3,
                        )
                        if not btn:
                            log.warning(
                                "[%s] Forward nav: %s not found",
                                self.instance.id, tmpl,
                            )
                            break
                        await self._slow_click(*btn)
                        await asyncio.sleep(wait)

            # ── Verify arrival ──
            actual = self.screen.detect_screen()
            if actual == target:
                log.info("[%s] navigate_to(%s): success", self.instance.id, target.value)
                return

            log.warning(
                "[%s] navigate_to(%s): ended at %s",
                self.instance.id, target.value, actual.value,
            )

        raise NavigationError(
            f"[{self.instance.id}] Cannot reach {target.value} "
            f"after {max_attempts} attempts"
        )

    async def _recover_unknown(self) -> Screen:
        """Press ESC up to 5 times trying to reach a known screen."""
        log.warning("[%s] Unknown screen — attempting ESC recovery", self.instance.id)
        for i in range(5):
            await press_key("escape", duration=0.1)
            await asyncio.sleep(1.5)
            current = self.screen.detect_screen()
            if current != Screen.UNKNOWN:
                log.info(
                    "[%s] Recovered to %s after %d ESC(s)",
                    self.instance.id, current.value, i + 1,
                )
                return current
        log.error("[%s] ESC recovery failed — still unknown", self.instance.id)
        return Screen.UNKNOWN

    def check_health(self) -> tuple[Screen, bool]:
        """Quick health probe: returns (current_screen, is_healthy).

        A screen is healthy if it is any known navigable state.
        Call this from a watchdog to decide whether recovery is needed.
        """
        current = self.screen.detect_screen()
        return current, current != Screen.UNKNOWN

    # ── High-level lobby operations ────────────────────────────────────

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

    async def create_and_configure(self, full_code: str):
        """Full flow: create a new custom game, import code, return to lobby."""
        log.info("[%s] Creating custom game", self.instance.id)

        # Guard: ensure we start from main menu
        await self.navigate_to(Screen.MAIN_MENU)

        # Navigate through menus and click Create → lands at empty LOBBY
        await self._create_new_lobby()

        # Import code (navigates Lobby → Settings internally)
        await self._import_settings(full_code)

        # Return to lobby
        await self.navigate_to(Screen.LOBBY)

    async def invite_players(
        self,
        players: list[tuple[int, str | None, int]],
        *,
        join_timeout: int = 60,
        poll_interval: int = 10,
        max_reinvites: int = 1,
    ) -> InviteResult:
        """Invite players to the correct teams and wait for them to join.

        Flow:
          1. Send all invites (one per player, team-aware).
          2. Poll lobby for filled slots until everyone joins or timeout.
          3. Re-invite players who haven't joined (up to *max_reinvites* times).
          4. Return an InviteResult summarising who joined and who didn't.

        Args:
            players: List of (user_id, battle_tag | None, team) tuples.
            join_timeout: Seconds to wait for players after each invite round.
            poll_interval: Seconds between lobby slot count checks.
            max_reinvites: How many times to re-send invites for missing players.
        """
        result = InviteResult(total=len(players))

        # Guard: must be at lobby
        await self.navigate_to(Screen.LOBBY)

        # Separate valid from missing-tag players
        valid = [
            (uid, tag, team)
            for uid, tag, team in players
            if tag
        ]
        no_tag = [uid for uid, tag, _ in players if not tag]
        if no_tag:
            log.warning(
                "[%s] Skipping %d players with no BattleTag: %s",
                self.instance.id, len(no_tag), no_tag,
            )
            result.missing_tags = no_tag

        # Sort by team for cleaner logs
        valid.sort(key=lambda p: p[2])
        expected_count = len(valid)

        log.info("[%s] Inviting %d players", self.instance.id, expected_count)

        # ── Send all invites ──
        pending = list(valid)  # Players we still need to join
        for round_num in range(1 + max_reinvites):
            if round_num > 0:
                log.info(
                    "[%s] Re-invite round %d for %d remaining players",
                    self.instance.id, round_num, len(pending),
                )

            for i, (user_id, battle_tag, team) in enumerate(pending):
                try:
                    await self._open_invite_dialog()
                    await self._select_invite_team(team)
                    await self._send_battletag_invite(battle_tag)
                    await asyncio.sleep(0.5)
                    log.info(
                        "[%s] Invited %s to team %d (%d/%d)",
                        self.instance.id, battle_tag, team,
                        i + 1, len(pending),
                    )
                except NavigationError as e:
                    log.error(
                        "[%s] Failed to invite %s: %s",
                        self.instance.id, battle_tag, e,
                    )
                    result.failed_invites.append(user_id)

            # ── Wait for players to join ──
            joined_count = await self._wait_for_players(
                expected_count, join_timeout, poll_interval,
            )
            result.joined = joined_count

            if joined_count >= expected_count:
                log.info(
                    "[%s] All %d players joined!",
                    self.instance.id, expected_count,
                )
                break

            # Figure out who's missing (we can't identify individuals by
            # template, so we track by count — the web app tracks specifics
            # via Workshop player-join events).
            missing_count = expected_count - joined_count
            log.warning(
                "[%s] %d/%d players joined, %d missing after %ds",
                self.instance.id, joined_count, expected_count,
                missing_count, join_timeout,
            )

            if round_num < max_reinvites:
                # Re-invite all pending — we can't tell WHO is missing from
                # the lobby view alone, so re-send all.  OW handles dupes
                # gracefully (already-joined players just see a redundant invite).
                continue
            else:
                # Out of re-invite rounds — mark remaining as timed out
                # (the web app will identify specifics via Workshop events)
                result.timed_out = [uid for uid, _, _ in pending]
                log.warning(
                    "[%s] Giving up on %d players after %d invite rounds",
                    self.instance.id, missing_count, round_num + 1,
                )

        log.info(
            "[%s] Invite phase complete: %d/%d joined, %d timed out, %d failed, %d no tag",
            self.instance.id, result.joined, result.total,
            len(result.timed_out), len(result.failed_invites),
            len(result.missing_tags),
        )
        return result

    async def start_game(self):
        """Click the Start button to begin the match."""
        # Guard: must be at lobby
        await self.navigate_to(Screen.LOBBY)

        log.info("[%s] Starting game", self.instance.id)
        start_btn = self.screen.locate_template(
            "lobby_start_button.png", confidence=0.7, retries=3,
        )
        if not start_btn:
            raise NavigationError(
                f"[{self.instance.id}] Start button not found at lobby"
            )
        await self._slow_click(*start_btn)
        await asyncio.sleep(2.0)
        log.info("[%s] Game started", self.instance.id)

    async def send_admin_command(self, command: str):
        """Send a Workshop admin command via host spectator key press."""
        key_map = {
            "pause": "e",
            "unpause": "e",
            "end_game": "q",
        }
        key = key_map.get(command)
        if not key:
            raise ValueError(f"Unknown command: {command}")
        log.info(
            "[%s] Sending admin command '%s' (key: %s)",
            self.instance.id, command, key,
        )
        await press_key(key, duration=0.2)

    # ── Private helpers ────────────────────────────────────────────────

    async def _slow_click(self, x: int, y: int):
        """OW needs deliberate clicks: move → pause → click."""
        await move_to(x, y)
        await asyncio.sleep(0.3)
        await click(x, y)

    async def _create_new_lobby(self):
        """Navigate Play → More → Custom Games → Create.

        This is the only way to go from MAIN_MENU to a new empty LOBBY.
        navigate_to() intentionally cannot do depth 2→3 because the Create
        button makes a new lobby every time.
        """
        # Play button (MAIN_MENU → PLAY_MENU)
        play_btn = self.screen.locate_template("main_menu_play_button.png", retries=3)
        if play_btn:
            await self._slow_click(*play_btn)
            await asyncio.sleep(2.0)

        # More button (reveals Custom Games option)
        more_btn = self.screen.locate_template("custom_game_more_button.png", retries=3)
        if more_btn:
            await self._slow_click(*more_btn)
            await asyncio.sleep(2.0)

        # Custom Games entry
        custom_btn = self.screen.locate_template(
            "custom_game_button.png", confidence=0.7, retries=3,
        )
        if custom_btn:
            await self._slow_click(*custom_btn)
            await asyncio.sleep(2.0)

        # Create button (CUSTOM_GAMES → LOBBY)
        create_btn = self.screen.locate_template(
            "custom_game_create_button.png", retries=3,
        )
        if create_btn:
            await self._slow_click(*create_btn)
            await asyncio.sleep(1.5)

        # Verify we arrived at the lobby
        if not self.screen.wait_for_screen(Screen.LOBBY, timeout=5.0):
            raise NavigationError(
                f"[{self.instance.id}] Did not arrive at lobby after Create"
            )
        log.info("[%s] New lobby created", self.instance.id)

    async def _import_settings(self, full_code: str):
        """Import settings + workshop code via clipboard.

        Clipboard is loaded BEFORE entering Settings so OW detects
        the importable blob when the panel opens.
        """
        log.info("[%s] Importing settings (%d bytes)", self.instance.id, len(full_code))

        # 1) Load clipboard while at LOBBY
        import pyperclip
        pyperclip.copy(full_code)
        await asyncio.sleep(1.0)

        # 2) Enter Settings
        await self.navigate_to(Screen.SETTINGS)

        # 3) Click the orange import button
        import_btn = self.screen.locate_template(
            "settings_import_button.png", confidence=0.7, retries=5,
        )
        if not import_btn:
            raise NavigationError(
                f"[{self.instance.id}] Import button not found in Settings"
            )
        await self._slow_click(*import_btn)
        await asyncio.sleep(1.5)

        # 4) Confirm the import dialog
        confirm_btn = self.screen.locate_template(
            "import_confirm_button.png", confidence=0.7, retries=5,
        )
        if not confirm_btn:
            raise NavigationError(
                f"[{self.instance.id}] Import confirm button not found"
            )
        await self._slow_click(*confirm_btn)
        await asyncio.sleep(3.0)  # Large blobs take time to import

        log.info("[%s] Settings imported", self.instance.id)

    async def _open_invite_dialog(self):
        """Click the INVITE toolbar button to open the ADD PLAYERS dialog."""
        btn = self.screen.locate_template(
            "lobby_invite_button.png", confidence=0.7, retries=3,
        )
        if not btn:
            # Dialog might already be open — check for the BATTLETAG button
            if self.screen.locate_template("invite_via_battletag_button.png", confidence=0.7):
                return  # Already in invite dialog
            raise NavigationError(
                f"[{self.instance.id}] INVITE button not found in lobby"
            )
        await self._slow_click(*btn)
        await asyncio.sleep(1.5)

    async def _select_invite_team(self, team: int):
        """Open the TEAM dropdown and select Team 1 or Team 2.

        Uses a pixel offset from the dropdown control rather than template
        matching, because "TEAM 1" and "TEAM 2" are visually near-identical
        and pyautogui always matches the first (topmost) hit.

        Args:
            team: 1 for Team 1 (blue), 2 for Team 2 (red).
        """
        # Find the dropdown control — it may show "BOTH", "TEAM 1", or "TEAM 2"
        # depending on the last selection.  invite_team_both.png is the default.
        dropdown = self.screen.locate_template(
            "invite_team_both.png", confidence=0.8, retries=2,
        )
        if not dropdown:
            # Fallback: the INVITE VIA BATTLETAG button is always visible on
            # the invite dialog.  The dropdown is at a known relative position.
            bnet_btn = self.screen.locate_template(
                "invite_via_battletag_button.png", confidence=0.7,
            )
            if bnet_btn:
                # Dropdown is ~327px below and ~147px left of INVITE VIA BATTLETAG
                dropdown = (bnet_btn[0] - 147, bnet_btn[1] + 327)
                log.debug(
                    "[%s] Estimated dropdown at (%d, %d) from BATTLETAG btn",
                    self.instance.id, *dropdown,
                )
            else:
                log.warning("[%s] TEAM dropdown not found", self.instance.id)
                return

        ctrl_x, ctrl_y = dropdown

        # Click to open the dropdown
        await self._slow_click(ctrl_x, ctrl_y)
        await asyncio.sleep(0.5)

        # Click the desired team option at its offset
        offset = _TEAM_DROPDOWN_OFFSETS.get(team, _TEAM_DROPDOWN_OFFSETS[0])
        target_y = ctrl_y + offset
        log.debug(
            "[%s] Selecting team %d at (%d, %d) [ctrl + %dpx]",
            self.instance.id, team, ctrl_x, target_y, offset,
        )
        await self._slow_click(ctrl_x, target_y)
        await asyncio.sleep(0.8)
        log.debug("[%s] Selected team %d", self.instance.id, team)

    async def _send_battletag_invite(self, battle_tag: str):
        """Click INVITE VIA BATTLETAG, paste the tag, and click INVITE."""
        # Click INVITE VIA BATTLETAG button
        btn = self.screen.locate_template(
            "invite_via_battletag_button.png", confidence=0.7, retries=3,
        )
        if not btn:
            raise NavigationError(
                f"[{self.instance.id}] INVITE VIA BATTLETAG button not found"
            )
        await self._slow_click(*btn)
        await asyncio.sleep(1.0)

        # Input field is auto-focused — paste the BattleTag
        await paste_text(battle_tag)
        await asyncio.sleep(0.5)

        # Click the orange INVITE button to send
        send_btn = self.screen.locate_template(
            "invite_send_button.png", confidence=0.7, retries=3,
        )
        if not send_btn:
            raise NavigationError(
                f"[{self.instance.id}] INVITE send button not found"
            )
        await self._slow_click(*send_btn)
        await asyncio.sleep(1.0 + random.uniform(0, 0.5))

    async def _wait_for_players(
        self,
        expected: int,
        timeout: int,
        poll_interval: int,
    ) -> int:
        """Wait for players to join, reporting progress periodically.

        The controller cannot reliably count individual players via
        template matching (the slot pixel differences are too subtle).
        Instead, the web app tracks individual joins via Workshop
        player-join events.  This method simply waits the timeout
        while verifying we're still at the lobby screen.

        Returns the player count reported by the instance (updated
        externally via on_players_joining() from Workshop events).
        """
        log.info(
            "[%s] Waiting %ds for %d players to join",
            self.instance.id, timeout, expected,
        )
        elapsed = 0

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            # Check we're still at the lobby (not crashed/stuck)
            if not self.screen.locate_template(
                "lobby_start_button.png", confidence=0.7,
            ):
                log.warning(
                    "[%s] Not at lobby during player wait (elapsed %ds)",
                    self.instance.id, elapsed,
                )
                # Try to recover back to lobby
                try:
                    await self.navigate_to(Screen.LOBBY)
                except NavigationError:
                    log.error("[%s] Lost lobby during player wait", self.instance.id)
                    break

            # Instance tracks join count via Workshop events
            joined = self.instance.players_joined
            log.info(
                "[%s] Player join progress: %d/%d (elapsed %ds/%ds)",
                self.instance.id, joined, expected, elapsed, timeout,
            )

            if joined >= expected:
                log.info("[%s] All %d players joined!", self.instance.id, expected)
                return joined

        return self.instance.players_joined

    async def _wait_for_ow_process(self, timeout: int | None = None) -> int:
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for OW process (timeout=%ds)", self.instance.id, timeout)
        elapsed = 0
        while elapsed < timeout:
            for proc in psutil.process_iter(["name"]):
                if proc.info["name"] and "overwatch" in proc.info["name"].lower():
                    log.info(
                        "[%s] Found OW process: PID %d",
                        self.instance.id, proc.pid,
                    )
                    return proc.pid
            await asyncio.sleep(2)
            elapsed += 2
        raise TimeoutError(f"OW did not start within {timeout}s")

    async def _wait_for_main_menu(self, timeout: int | None = None):
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for main menu", self.instance.id)
        if not self.screen.wait_for_screen(Screen.MAIN_MENU, timeout=timeout, poll=3.0):
            raise TimeoutError(f"Main menu not detected within {timeout}s")
