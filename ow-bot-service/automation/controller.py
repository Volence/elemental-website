"""High-level lobby operations using OCR-based screen detection.

Provides create_and_configure(), invite_players(), start_game() — the full
lobby lifecycle. All UI interaction uses easyocr text detection and
numpy-based color scanning (for the orange import button).
"""

import asyncio
import logging
from dataclasses import dataclass, field

import numpy as np
import psutil
from scipy import ndimage

from config import settings
from automation.actions import click, click_text, move_to, paste_text, press_key, hotkey, type_text
from automation.screens import Screen, ScreenDetector, get_depth, DISMISS_KEYWORDS
from automation.window_manager import window_manager
from automation import background_input
from automation import timing as T

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


def _find_orange_button(detector: ScreenDetector) -> tuple[int, int] | None:
    """Find an orange button by color when OCR fails on colored backgrounds."""
    img = detector.screenshot()
    arr = np.array(img)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 180) & (g > 60) & (g < 160) & (b < 100)
    labeled, num = ndimage.label(mask)
    best = None
    best_size = 0
    for i in range(1, num + 1):
        c = np.argwhere(labeled == i)
        if len(c) > best_size and len(c) > 50:
            cy = int(np.mean(c[:, 0]))
            if cy < 600:
                best_size = len(c)
                best = c
    if best is not None:
        cy = int(np.mean(best[:, 0])) + detector.region[1]
        cx = int(np.mean(best[:, 1])) + detector.region[0]
        log.info("Orange button found: %dpx at (%d,%d)", best_size, cx, cy)
        return (cx, cy)
    return None


class LobbyController:
    def __init__(self, instance):
        self.instance = instance
        self._detector: ScreenDetector | None = None

    @property
    def detector(self) -> ScreenDetector:
        if self._detector is None:
            self._detector = ScreenDetector(region=self._current_region())
        else:
            # Always update region from tracked window (it may have changed)
            self._detector.region = self._current_region()
        return self._detector

    def _current_region(self) -> tuple[int, int, int, int]:
        win = window_manager.get_window(self.instance.id)
        return win.region if win else self.instance.account.screen_region

    async def _focus(self) -> bool:
        """Focus this instance's window. Returns True if it ends up foreground.

        Every UI operation routes through here, so this is where we guarantee
        the window is actually tracked. The #1 real-world failure ("Cannot
        focus inst-X: window not found or invalid") was ops running before the
        window was registered - focus then no-ops and screenshots capture a
        default/blank region, cascading into OCR failures. We self-heal by
        (re)discovering the window when it is missing/stale, and we refresh the
        OCR region from the live window rect after focusing.
        """
        win = window_manager.get_window(self.instance.id)
        if not win or not win.is_valid:
            self.instance._ensure_window_tracked()
            self._detector = None  # region likely changed; rebuild lazily

        success = window_manager.focus_window(self.instance.id)
        await asyncio.sleep(T.FOCUS_AFTER)
        if not success:
            log.warning("[%s] Focus failed, retrying", self.instance.id)
            await asyncio.sleep(T.FOCUS_RETRY_BEFORE)
            # Re-discover in case the handle went stale between attempts.
            self.instance._ensure_window_tracked()
            success = window_manager.focus_window(self.instance.id)
            await asyncio.sleep(T.FOCUS_RETRY_AFTER)

        # Keep the OCR capture region aligned with the live window.
        window_manager.refresh_region(self.instance.id)
        return success

    async def _wait_for_text(
        self,
        label: str,
        timeout: float | None = None,
        floor: float | None = None,
        poll: float | None = None,
    ) -> tuple[int, int] | None:
        """Wait for `label` to appear on screen; return its position or None.

        Condition-based replacement for a blind sleep after a click: returns
        as soon as the expected next element is visible (fast path), but waits
        up to `timeout` before giving up (slow path). Sleeps `floor` first to
        let the transition begin so we do not OCR a half-rendered frame.
        """
        timeout = T.WAIT_MENU_TIMEOUT if timeout is None else timeout
        floor = T.WAIT_FLOOR if floor is None else floor
        poll = T.WAIT_POLL if poll is None else poll
        await asyncio.sleep(floor)
        elapsed = floor
        while elapsed < timeout:
            pos = self.detector.find_text(label, retries=1)
            if pos:
                return pos
            await asyncio.sleep(poll)
            elapsed += poll
        return None

    async def _wait_for_screen(
        self,
        target: Screen,
        timeout: float | None = None,
        floor: float | None = None,
        poll: float | None = None,
    ) -> bool:
        """Wait until `target` screen is detected (stable). Returns success."""
        timeout = T.WAIT_SCREEN_TIMEOUT if timeout is None else timeout
        floor = T.WAIT_FLOOR if floor is None else floor
        poll = T.WAIT_SCREEN_POLL if poll is None else poll
        await asyncio.sleep(floor)
        elapsed = floor
        while elapsed < timeout:
            if self.detector.detect_screen() == target:
                return True
            await asyncio.sleep(poll)
            elapsed += poll
        return False

    async def _wait_for_any_text(
        self,
        labels: list[str],
        timeout: float | None = None,
        floor: float | None = None,
        poll: float | None = None,
    ) -> bool:
        """Wait until ANY of `labels` appears on screen. Returns True if seen.

        Like _wait_for_text but tolerant of OCR misreads: one scan is checked
        against several candidate labels, so e.g. the team dropdown (often
        OCR'd "ROTH" instead of "BOTH") is still detected. Used for invite-panel
        transitions where a single label is unreliable.
        """
        timeout = T.WAIT_DIALOG_TIMEOUT if timeout is None else timeout
        floor = T.WAIT_FLOOR if floor is None else floor
        poll = T.WAIT_POLL if poll is None else poll
        uppers = [label.upper() for label in labels]
        await asyncio.sleep(floor)
        elapsed = floor
        while elapsed < timeout:
            haystack = " ".join(t.upper() for t, _, _ in self.detector.find_all_text())
            if any(u in haystack for u in uppers):
                return True
            await asyncio.sleep(poll)
            elapsed += poll
        return False

    async def _wait_until_text_gone(
        self,
        labels: list[str],
        timeout: float | None = None,
        floor: float | None = None,
        poll: float | None = None,
    ) -> bool:
        """Wait until NONE of `labels` is on screen. Returns True once gone.

        Used after sending an invite: the panel closes and returns to the
        lobby, so we poll until the panel's distinctive text disappears rather
        than blind-sleeping. More precise than waiting for the LOBBY screen,
        whose START/INVITE buttons can OCR-match through a half-closed panel.
        """
        timeout = T.WAIT_DIALOG_TIMEOUT if timeout is None else timeout
        floor = T.WAIT_FLOOR if floor is None else floor
        poll = T.WAIT_POLL if poll is None else poll
        uppers = [label.upper() for label in labels]
        await asyncio.sleep(floor)
        elapsed = floor
        while elapsed < timeout:
            haystack = " ".join(t.upper() for t, _, _ in self.detector.find_all_text())
            if not any(u in haystack for u in uppers):
                return True
            await asyncio.sleep(poll)
            elapsed += poll
        return False

    async def _dismiss_blocking_dialog(self) -> str | None:
        """If a known error pop-up is on screen, dismiss it. Returns phrase.

        Uses the most recent OCR scan first (cheap), and only acts when a
        recognised blocking phrase (e.g. invite-disabled, lost connection) is
        present. Clicks a dismiss button if one exists, otherwise presses ESC.
        """
        self.detector.scan()
        phrase = self.detector.has_blocking_dialog()
        if not phrase:
            return None
        log.warning("[%s] Blocking dialog detected ('%s'), dismissing", self.instance.id, phrase)
        pos = self.detector.find_dismiss_button()
        if pos:
            await click(*pos)
        else:
            await press_key("escape")
        await asyncio.sleep(T.TRANSITION_DIALOG)
        return phrase

    # ── Navigation ────────────────────────────────────────────────────

    async def navigate_to(self, target: Screen, max_attempts: int = 5) -> None:
        await self._focus()

        for attempt in range(1, max_attempts + 1):
            current = self.detector.detect_screen(retries=3)
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
                await asyncio.sleep(T.NAV_AFTER_EXIT)
                pos = self.detector.find_text("YES", retries=3)
                if pos:
                    await move_to(*pos)
                    await asyncio.sleep(0.3)
                    await click(*pos, delay=0.3)
                    await asyncio.sleep(T.NAV_AFTER_EXIT_YES)
                continue

            if current == Screen.LOGIN:
                log.info("[%s] At login screen, attempting re-login", self.instance.id)
                await self._handle_login_screen()
                continue

            if current == Screen.UNKNOWN:
                # Re-focus first: a stolen/lost foreground is a common cause of
                # a bogus UNKNOWN (we screenshot the wrong or blank window).
                await self._focus()
                recovered = await self._recover_from_unknown()
                if not recovered:
                    await press_key("escape")
                    await asyncio.sleep(T.NAV_AFTER_ESC)
                continue

            cur_depth = get_depth(current)
            tgt_depth = get_depth(target)

            if cur_depth > tgt_depth:
                for _ in range(cur_depth - tgt_depth):
                    await press_key("escape")
                    await asyncio.sleep(T.NAV_AFTER_ESC)
            elif cur_depth < tgt_depth:
                break

        actual = self.detector.detect_screen(retries=3)
        if actual != target:
            raise NavigationError(
                f"[{self.instance.id}] Cannot reach {target.value}, at {actual.value}"
            )

    async def _recover_from_unknown(self) -> bool:
        """Try to recover from an unknown screen state.

        Returns True if a recovery action was taken (caller should re-detect).
        """
        classification = self.detector.classify_unknown()

        if classification == Screen.LOADING:
            log.info("[%s] Loading screen detected, waiting", self.instance.id)
            await asyncio.sleep(T.TRANSITION_LOADING)
            return True

        if classification == Screen.DIALOG:
            pos = self.detector.find_dismiss_button()
            if pos:
                log.info("[%s] Dismissing dialog at %s", self.instance.id, pos)
                await click(*pos)
                await asyncio.sleep(T.TRANSITION_DIALOG)
                return True

        return False

    async def _handle_login_screen(self, max_attempts: int | None = None):
        """Log in from the Battle.net login screen, including TOTP 2FA.

        Bounded loop (the old version recursed without a limit, which could spin
        forever if the screen never advanced). Each pass either enters
        credentials, clicks the LOGIN button, or submits a TOTP code, then
        re-checks. Gives up after `max_attempts` passes.
        """
        max_attempts = T.LOGIN_MAX_ATTEMPTS if max_attempts is None else max_attempts

        for attempt in range(1, max_attempts + 1):
            email_pos = self.detector.find_text("Email", retries=3)
            if not email_pos:
                email_pos = self.detector.find_text("Phone", retries=1)
            if email_pos:
                log.info("[%s] Credential entry screen, typing email", self.instance.id)
                await click(*email_pos)
                await asyncio.sleep(0.3)
                await hotkey("ctrl", "a")
                await paste_text(self.instance.account.email)
                await asyncio.sleep(0.3)
                await press_key("tab")
                await asyncio.sleep(0.3)
                await paste_text(self.instance.account.password)
                await asyncio.sleep(0.3)
                await press_key("enter")

                # Re-focus (the submit can briefly drop foreground) then wait for
                # the authenticator/TOTP prompt to render before reading it -
                # polling for the prompt instead of a blind settle, bounded by the
                # old wait so a slow prompt is still caught.
                await self._focus()
                await self._wait_for_any_text(
                    ["AUTHENTICATOR", "CODE"],
                    timeout=T.LOGIN_AFTER_SUBMIT,
                    floor=T.WAIT_FLOOR,
                    poll=T.WAIT_SCREEN_POLL,
                )
                await self._submit_totp_if_present()

                await self._wait_for_main_menu(timeout=120)
                log.info("[%s] Re-login successful", self.instance.id)
                return

            # A TOTP-only prompt (already past credentials) can appear here.
            if await self._submit_totp_if_present():
                await self._wait_for_main_menu(timeout=120)
                log.info("[%s] Re-login successful (TOTP)", self.instance.id)
                return

            pos = self.detector.find_text("LOGIN", retries=3)
            if pos:
                log.info(
                    "[%s] Clicking LOGIN button at %s (attempt %d/%d)",
                    self.instance.id, pos, attempt, max_attempts,
                )
                await click(*pos)
                # Wait for the click to advance the page (to the TOTP prompt or
                # the game) instead of a blind settle; bounded by the old delay.
                await self._wait_for_any_text(
                    ["AUTHENTICATOR", "CODE", "PLAY", "HEROES"],
                    timeout=T.TRANSITION_LOGIN,
                    floor=T.WAIT_FLOOR,
                    poll=T.WAIT_SCREEN_POLL,
                )
                continue

            log.warning(
                "[%s] No login/credential field found (attempt %d/%d)",
                self.instance.id, attempt, max_attempts,
            )
            await asyncio.sleep(T.TRANSITION_LOGIN)

        log.warning(
            "[%s] Login did not complete after %d attempts",
            self.instance.id, max_attempts,
        )

    async def _submit_totp_if_present(self) -> bool:
        """Enter a TOTP code if the authenticator prompt is showing.

        Returns True if a code was submitted. Mirrors the warmup login path so
        re-login from a lobby/health-check context can also clear 2FA.
        """
        totp_pos = self.detector.find_text("AUTHENTICATOR", retries=2)
        if not totp_pos:
            totp_pos = self.detector.find_text("CODE", retries=2)
        if not totp_pos:
            return False
        try:
            code = self.instance.account.generate_totp()
        except Exception as e:
            log.error("[%s] Could not generate TOTP: %s", self.instance.id, e)
            return False
        if not code:
            log.warning("[%s] TOTP prompt present but no code generated", self.instance.id)
            return False
        log.info("[%s] TOTP prompt detected, submitting code", self.instance.id)
        await click(*totp_pos)
        await asyncio.sleep(0.3)
        await type_text(code)
        await press_key("enter")
        # No post-submit settle here: every caller immediately polls
        # _wait_for_main_menu(timeout=120), which waits for the login to land.
        return True

    def check_health(self) -> tuple[Screen, bool]:
        # Use stable detection: a single noisy OCR frame should not flip an
        # otherwise-fine instance into ERROR and trigger a needless recover.
        current = self.detector.detect_screen(retries=2)
        if current == Screen.UNKNOWN and self.instance.state.value == "in_game":
            return current, True
        return current, current not in (Screen.UNKNOWN, Screen.LOGIN)

    # ── High-level operations ─────────────────────────────────────────

    async def launch_ow(self) -> int:
        existing_pid = self._find_own_ow_process()
        if existing_pid:
            log.info("[%s] OW already running (PID %d), skipping launch", self.instance.id, existing_pid)
            await self._focus()
            await self._wait_for_main_menu()
            return existing_pid

        # Snapshot current OW PIDs so we can detect the new one
        pre_launch_pids = self._all_ow_pids()
        log.info("[%s] Launching OW via Battle.net (existing PIDs: %s)", self.instance.id, pre_launch_pids)

        import subprocess
        subprocess.Popen(
            [str(settings.battlenet_exe), "--exec=launch Pro"],
            shell=False,
        )
        pid = await self._wait_for_new_ow_process(pre_launch_pids)

        # Track the new window for this instance
        await asyncio.sleep(T.LAUNCH_WINDOW_INIT)  # let window fully initialize
        self._track_new_window(pid)
        await self._focus()

        await self._wait_for_main_menu()
        return pid

    def _find_own_ow_process(self) -> int | None:
        """Find OW process that belongs to THIS instance (tracked window or stored PID)."""
        # Check if we have a tracked window with a valid process
        win = window_manager.get_window(self.instance.id)
        if win and win.is_valid:
            try:
                proc = psutil.Process(win.pid)
                if proc.is_running() and "overwatch" in proc.name().lower():
                    return win.pid
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        # Check stored process ID on the instance
        if self.instance.ow_process_id:
            try:
                proc = psutil.Process(self.instance.ow_process_id)
                if proc.is_running() and "overwatch" in proc.name().lower():
                    return self.instance.ow_process_id
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        return None

    def _all_ow_pids(self) -> set[int]:
        """Get PIDs of all currently running OW processes."""
        pids = set()
        for proc in psutil.process_iter(["name"]):
            if proc.info["name"] and "overwatch" in proc.info["name"].lower():
                pids.add(proc.pid)
        return pids

    def _track_new_window(self, pid: int):
        """Find the OW window for a PID and register it for this instance."""
        import ctypes
        import ctypes.wintypes

        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM,
        )
        found_hwnd = None

        def callback(hwnd, lparam):
            nonlocal found_hwnd
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buf, length + 1)
                if buf.value.startswith("Overwatch"):
                    win_pid = ctypes.wintypes.DWORD()
                    ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(win_pid))
                    if win_pid.value == pid:
                        found_hwnd = hwnd
                        return False  # stop enumeration
            return True

        ctypes.windll.user32.EnumWindows(EnumWindowsProc(callback), 0)

        if found_hwnd:
            window_manager.register_window(self.instance.id, found_hwnd, pid)
            self._detector = None  # reset detector to pick up new region
            log.info("[%s] Tracked new OW window: HWND=%d PID=%d", self.instance.id, found_hwnd, pid)
        else:
            log.warning("[%s] Could not find OW window for PID=%d", self.instance.id, pid)

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
        self._clear_invite_cache()
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
                    if user_id not in result.failed_invites:
                        result.failed_invites.append(user_id)
                    continue

                # Clear an invite-refused pop-up (e.g. the player disabled
                # invites from non-friends) so it does not block the next
                # invite. Such a dialog means this invite did not land.
                dialog = await self._dismiss_blocking_dialog()
                if dialog and "invit" in dialog:
                    log.warning(
                        "[%s] Invite to %s appears refused (%s)",
                        self.instance.id, battle_tag, dialog,
                    )
                    if user_id not in result.failed_invites:
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

        for start_attempt in range(1, 3):  # up to 2 START presses
            log.info("[%s] Starting game (attempt %d)", self.instance.id, start_attempt)
            if not await click_text("START", self.detector, retries=3):
                # START not visible: either it never rendered, or the match
                # already left the lobby. Only treat a still-at-lobby state as
                # a hard failure; otherwise assume it started.
                if self.detector.detect_screen(retries=2) != Screen.LOBBY:
                    log.info(
                        "[%s] START not visible and no longer at lobby - assuming started",
                        self.instance.id,
                    )
                    return
                raise NavigationError(f"[{self.instance.id}] START button not found")

            # Click through any CONTINUE / CONFIRM prompts (hero select, assemble,
            # "start anyway?", etc.). Poll for each to appear rather than
            # blind-sleeping before the check: click it the instant it shows, and
            # stop once no prompt appears within the window. The first window folds
            # in the old post-click settle (START_AFTER_CLICK + START_CONTINUE_CHECK)
            # so a slow-rendering prompt is still caught; later windows use the
            # per-prompt interval. Never slower than the old fixed sleeps.
            first_window = True
            for _ in range(5):
                window = (
                    T.START_AFTER_CLICK + T.START_CONTINUE_CHECK
                    if first_window else T.START_CONTINUE_CHECK
                )
                first_window = False
                if not await self._wait_for_any_text(
                    ["CONTINUE", "CONFIRM"],
                    timeout=window,
                    floor=T.WAIT_FLOOR,
                    poll=T.WAIT_SCREEN_POLL,
                ):
                    break
                for label in ["CONTINUE", "CONFIRM"]:
                    pos = self.detector.find_text(label, rescan=False, retries=1)
                    if pos:
                        log.info("[%s] Clicking %s at %s", self.instance.id, label, pos)
                        await click(*pos)
                        await asyncio.sleep(T.START_AFTER_CONTINUE)
                        break

            if await self._verify_game_started():
                log.info("[%s] Game started (verified left lobby)", self.instance.id)
                return

            log.warning(
                "[%s] Still at lobby after START (attempt %d), retrying",
                self.instance.id, start_attempt,
            )
            await self._focus()

        # Could not positively confirm the transition. Do NOT raise: the match
        # has very likely started (verification can false-negative because the
        # in-game/loading screens have no OCR signature), and raising here would
        # flip a live game to ERROR. Caller proceeds; workshop log confirms.
        log.warning(
            "[%s] Game start not confirmed via OCR; proceeding optimistically",
            self.instance.id,
        )

    async def _verify_game_started(self) -> bool:
        """Return True once the lobby screen is gone (match underway).

        The lobby uniquely shows START+INVITE; once the match starts those
        disappear (LOADING then the in-game spectator HUD, neither of which
        matches the LOBBY signature). Also clears any blocking pop-up that
        could be pinning us on the lobby (e.g. a stray error dialog).
        """
        elapsed = 0.0
        while elapsed < T.START_VERIFY_TIMEOUT:
            screen = self.detector.detect_screen(retries=2)
            if screen != Screen.LOBBY:
                if screen == Screen.UNKNOWN and self.detector.classify_unknown() == Screen.DIALOG:
                    # A dialog (not the game) is up - dismiss and keep checking.
                    await self._dismiss_blocking_dialog()
                else:
                    return True
            await asyncio.sleep(T.START_VERIFY_POLL)
            elapsed += T.START_VERIFY_POLL
        return False

    async def send_admin_command(self, command: str):
        key_map = {
            "pause": "e",
            "unpause": "e",
            "end_draw": "z",
            "end_team1": "q",
            "end_team2": None,
        }
        if command not in key_map:
            raise ValueError(f"Unknown command: {command}")

        self.instance._ensure_window_tracked()
        await self._focus()
        await asyncio.sleep(0.5)

        key = key_map[command]
        if key is None:
            win = window_manager.get_window(self.instance.id)
            if win:
                cx = win.region[0] + win.region[2] // 2
                cy = win.region[1] + win.region[3] // 2
            else:
                cx, cy = 640, 360
            log.info("[%s] Admin command '%s' via click at (%d,%d)",
                     self.instance.id, command, cx, cy)
            await click(cx, cy, delay=0.3)
        else:
            log.info("[%s] Admin command '%s' (key: %s) via SendInput",
                     self.instance.id, command, key)
            await press_key(key, duration=0.3)

        if command in ("end_draw", "end_team1", "end_team2"):
            asyncio.create_task(self._handle_post_match())

    async def _handle_post_match(self, report: bool = True):
        from instances.instance import InstanceState

        inst_id = self.instance.id
        if self.instance.state in (InstanceState.AVAILABLE, InstanceState.READY):
            log.info("[%s] Post-match: already cleaned up, skipping", inst_id)
            return

        # Two paths can trigger post-match handling: the admin result buttons
        # and the workshop-log match-end monitor. Guard so only one navigates
        # the OW window and frees the instance. The check and set have no await
        # between them, so this is atomic on the single asyncio loop. The flag
        # is released in finally, so a concurrent second trigger is skipped
        # while a genuine retry after this fully finishes is still allowed.
        if self.instance._finalizing:
            log.info("[%s] Post-match: already finalizing, skipping", inst_id)
            return
        self.instance._finalizing = True

        try:
            log.info("[%s] Waiting for match to end and return to lobby...", inst_id)

            await asyncio.sleep(10)

            screen = None
            for attempt in range(12):
                if self.instance.state in (InstanceState.AVAILABLE, InstanceState.READY):
                    log.info("[%s] Post-match: cleaned up during wait, skipping", inst_id)
                    return
                await self._focus()
                screen = self.detector.detect_screen()
                log.info("[%s] Post-match check %d/12: screen=%s", inst_id, attempt + 1, screen.value)
                if screen in (Screen.LOBBY, Screen.MAIN_MENU):
                    break
                await asyncio.sleep(5)
            else:
                log.warning("[%s] Timed out waiting for lobby after match end", inst_id)
                return

            if screen != Screen.MAIN_MENU:
                log.info("[%s] Back at lobby, navigating to main menu", inst_id)
                try:
                    await self.navigate_to(Screen.MAIN_MENU)
                    log.info("[%s] Reached main menu after match", inst_id)
                except Exception as e:
                    log.error("[%s] Failed to navigate to main menu: %s", inst_id, e)

            from instances.manager import instance_manager
            await instance_manager.on_game_ended(inst_id, report=report)
        finally:
            self.instance._finalizing = False

    # ── Private helpers ───────────────────────────────────────────────

    async def _create_new_lobby(self):
        await self._focus()

        if not await click_text("PLAY", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] PLAY not found")

        # Wait for the PLAY submenu (MORE dropdown) to render, rather than a
        # blind sleep: proceeds as soon as MORE is visible, up to a max wait.
        more_pos = await self._wait_for_text("MORE", timeout=T.WAIT_MENU_TIMEOUT)
        if not more_pos:
            raise NavigationError(f"[{self.instance.id}] MORE not found")
        await click(*more_pos)

        # CUSTOM appears in the MORE dropdown shortly after it opens.
        pos = await self._wait_for_text(
            "CUSTOM", timeout=T.WAIT_DIALOG_TIMEOUT, floor=0.2,
        )
        if not pos:
            raise NavigationError(f"[{self.instance.id}] CUSTOM GAMES not found")
        await click(*pos)

        # Wait for the Custom Games browser instead of a fixed sleep. Best
        # effort: if detection is flaky we still fall through to CREATE, which
        # has its own OCR retries plus the orange-button fallback.
        await self._wait_for_screen(Screen.CUSTOM_GAMES, timeout=T.WAIT_MENU_TIMEOUT)

        # whole_word so "CREATE" never matches "Created by" entries in the
        # custom-games browser list. If the real button is unreadable this
        # frame, fall through to the orange-button color scan below.
        create_pos = await click_text("CREATE", self.detector, retries=3, whole_word=True)
        if not create_pos:
            all_text = self.detector.find_all_text(confidence=0.3, rescan=False)
            log.warning("[%s] CREATE not found via OCR, texts on screen: %s",
                        self.instance.id,
                        [(t, p, f"{c:.2f}") for t, p, c in all_text if len(t) <= 25])
            create_pos = _find_orange_button(self.detector)
            if create_pos:
                log.info("[%s] Clicking orange CREATE button at (%d,%d)", self.instance.id, *create_pos)
                await click(*create_pos)
            else:
                raise NavigationError(f"[{self.instance.id}] CREATE not found (OCR + color scan)")
        # Wait for the lobby to actually appear (async, non-blocking) rather
        # than a fixed sleep + short blocking poll.
        if not await self._wait_for_screen(
            Screen.LOBBY, timeout=T.WAIT_SCREEN_TIMEOUT, floor=T.TRANSITION_CREATE,
        ):
            raise NavigationError(f"[{self.instance.id}] Did not arrive at lobby after Create")
        log.info("[%s] New lobby created", self.instance.id)

    async def _move_to_spectator(self):
        await self._focus()
        log.info("[%s] Moving bot to spectator", self.instance.id)

        if not await click_text("MOVE", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] MOVE not found")
        await asyncio.sleep(T.SPECTATOR_AFTER_MOVE)

        all_text = self.detector.find_all_text()

        # Strategy: find the first EMPTY slot in Team 1 (y 300-520, x 450-800).
        # The bot is in the slot directly above it. If no EMPTY found in Team 1,
        # the bot is the only player and fills the first slot - use the "Team"
        # header position to calculate slot location.
        team1_empties = []
        team1_header_pos = None
        player_pos = None
        player_name = None

        for text, pos, conf in all_text:
            upper = text.upper().strip()
            # Find "Team" header (Team 1 side, x < 800)
            if upper in ("TEAM", "TEAM 1") and pos[0] > 450 and pos[0] < 800 and pos[1] < 300:
                team1_header_pos = pos
            # Find EMPTY slots in Team 1 area
            if "EMPTY" in upper and pos[0] > 450 and pos[0] < 800 and pos[1] > 300 and pos[1] < 520:
                team1_empties.append(pos)
            # Also try to find the player name directly (OCR may detect it)
            words = upper.split()
            if (pos[1] > 270 and pos[1] < 520
                    and pos[0] > 450 and pos[0] < 800
                    and conf > 0.4
                    and all(w not in self.UI_LABELS for w in words)
                    and len(text.strip()) > 1
                    and not text.strip().isdigit()
                    and "EMPTY" not in upper):
                if not player_pos:  # take first match
                    player_pos = pos
                    player_name = text

        if not player_pos:
            # OCR didn't detect the player name. Calculate position from
            # the first EMPTY slot (click ~35px above it) or from "Team" header.
            if team1_empties:
                team1_empties.sort(key=lambda p: p[1])  # sort by y
                first_empty = team1_empties[0]
                # The occupied slot is one row above the first empty
                player_pos = (first_empty[0], first_empty[1] - 35)
                player_name = "(above first empty)"
                log.info("[%s] Player name not OCR'd, clicking above first EMPTY at %s", self.instance.id, first_empty)
            elif team1_header_pos:
                # No empties found either - click ~45px below the Team header
                player_pos = (team1_header_pos[0], team1_header_pos[1] + 45)
                player_name = "(below Team header)"
                log.info("[%s] Player name not OCR'd, clicking below Team header at %s", self.instance.id, team1_header_pos)
            else:
                raise NavigationError(f"[{self.instance.id}] Bot name not found in Team 1")

        log.info("[%s] Clicking bot '%s' at %s", self.instance.id, player_name, player_pos)
        await click(*player_pos)
        await asyncio.sleep(T.SPECTATOR_AFTER_PLAYER)

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
        await asyncio.sleep(T.SPECTATOR_AFTER_SLOT)

        if not await click_text("DONE", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] DONE not found")
        await asyncio.sleep(T.SPECTATOR_AFTER_DONE)
        log.info("[%s] Moved to spectator", self.instance.id)

    def _find_orange_button(self, img, label: str = "") -> tuple[int | None, int | None, int]:
        """Scan a screenshot for the orange import icon.

        Returns (cx_local, cy_local, size) in image-local coordinates.
        cx/cy are None if nothing found above the minimum threshold.
        """
        arr = np.array(img)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        mask = (r > 180) & (g > 40) & (g < 150) & (b < 100)

        labeled, num_features = ndimage.label(mask)

        # Log ALL clusters for debugging
        clusters = []
        for i in range(1, num_features + 1):
            cluster = np.argwhere(labeled == i)
            cy = int(np.mean(cluster[:, 0]))
            cx = int(np.mean(cluster[:, 1]))
            clusters.append((len(cluster), cx, cy))
        clusters.sort(key=lambda c: c[0], reverse=True)

        if clusters:
            top5 = clusters[:5]
            log.info(
                "[%s] Orange clusters%s: %s",
                self.instance.id, f" ({label})" if label else "",
                ", ".join(f"{sz}px@({cx},{cy})" for sz, cx, cy in top5),
            )
        else:
            log.info("[%s] No orange clusters found%s", self.instance.id,
                     f" ({label})" if label else "")

        # Pick the best (largest) cluster in the settings area:
        # - y < 350 (import icon is in the SUMMARY area, ~y=258)
        # - x > 300 (right side of the screen, past left panel labels)
        # - at least 20px to filter small noise clusters
        best_cluster = None
        best_size = 0
        for i in range(1, num_features + 1):
            cluster = np.argwhere(labeled == i)
            cy = int(np.mean(cluster[:, 0]))
            cx = int(np.mean(cluster[:, 1]))
            sz = len(cluster)
            if sz > best_size and cy < 350 and cx > 300 and sz >= 20:
                best_size = sz
                best_cluster = cluster

        # Fallback: relax thresholds if nothing found above 20px
        if best_cluster is None:
            for i in range(1, num_features + 1):
                cluster = np.argwhere(labeled == i)
                cy = int(np.mean(cluster[:, 0]))
                cx = int(np.mean(cluster[:, 1]))
                sz = len(cluster)
                if sz > best_size and cy < 500 and cx > 200 and sz >= 5:
                    best_size = sz
                    best_cluster = cluster

        if best_cluster is not None and best_size >= 5:
            cy = int(np.mean(best_cluster[:, 0]))
            cx = int(np.mean(best_cluster[:, 1]))
            return (cx, cy, best_size)

        return (None, None, best_size)

    def _verify_clipboard(self, code: str, label: str) -> bool:
        """Read clipboard back and verify it contains our settings code."""
        content = background_input.get_clipboard()
        if content is None:
            log.warning("[%s] Clipboard verify (%s): EMPTY/NULL", self.instance.id, label)
            return False
        if len(content) == 0:
            log.warning("[%s] Clipboard verify (%s): zero-length string", self.instance.id, label)
            return False
        if content == code:
            log.info("[%s] Clipboard verify (%s): OK (%d chars)", self.instance.id, label, len(content))
            return True
        # Partial match - check first 50 chars
        log.warning(
            "[%s] Clipboard verify (%s): MISMATCH - expected %d chars, got %d chars. "
            "First 50: '%s'",
            self.instance.id, label, len(code), len(content), content[:50],
        )
        return False

    async def _import_settings(self, full_code: str):
        log.info("[%s] Importing settings (%d chars)", self.instance.id, len(full_code))

        code = full_code.lstrip("﻿")

        # Step 1: Focus THIS window so clicks hit the right instance
        await self._focus()

        # Save code to file for debugging
        with open(f"C:/ow-bot-service/debug_code_{self.instance.id}.txt", "w", encoding="utf-8") as f:
            f.write(code)
        log.info("[%s] Code saved, first 200 chars: %s", self.instance.id, repr(code[:200]))

        # Step 2: Set clipboard BEFORE clicking SETTINGS via PowerShell.
        # PowerShell uses .NET clipboard which properly dispatches
        # WM_CLIPBOARDUPDATE notifications that OW relies on.
        # Win32 API from a non-GUI Python thread may not trigger them.
        ok1 = background_input.set_clipboard_powershell(code)
        log.info("[%s] Pre-set clipboard (PS): %s (%d chars)", self.instance.id, ok1, len(code))
        if not ok1:
            # Fallback to Win32 API
            ok1 = background_input.set_clipboard(code)
            log.info("[%s] Pre-set clipboard (Win32 fallback): %s", self.instance.id, ok1)

        # Step 3: Click SETTINGS to open the settings screen
        if not await click_text("SETTIN", self.detector, retries=5):
            raise NavigationError(f"[{self.instance.id}] SETTINGS not found")

        # Re-focus (another instance can steal foreground during the settings
        # load) then wait for the settings screen to actually render - its PRESETS
        # tab is the signature - instead of a blind settle. Falls through at the
        # timeout, so a missed label costs time but cannot break the import.
        await self._focus()
        await self._wait_for_text(
            "PRESETS",
            timeout=T.WAIT_MENU_TIMEOUT,
            floor=T.WAIT_FLOOR,
            poll=T.WAIT_SCREEN_POLL,
        )
        await asyncio.sleep(T.IMPORT_REFOCUS_PAUSE)

        # Step 5: Set clipboard AGAIN via PowerShell and notify OW window
        ok2 = background_input.set_clipboard_powershell(code)
        log.info("[%s] Post-set clipboard (PS): %s (%d chars)", self.instance.id, ok2, len(code))

        # Also explicitly notify the OW window about clipboard change
        win = window_manager.get_window(self.instance.id)
        if win:
            background_input.notify_clipboard_change(win.hwnd)
            log.info("[%s] Sent WM_CLIPBOARDUPDATE to hwnd=%d", self.instance.id, win.hwnd)

        # Verify clipboard wasn't cleared by another OW instance
        await asyncio.sleep(0.5)
        if not self._verify_clipboard(code, "after set"):
            # Retry - something cleared it
            log.warning("[%s] Clipboard was cleared, re-setting", self.instance.id)
            background_input.set_clipboard(code)
            await asyncio.sleep(0.3)
            self._verify_clipboard(code, "after retry")

        # Step 4: Wait for OW to detect the clipboard change and render the
        # orange import icon. OW polls the clipboard periodically, so instead of
        # one scan after a fixed settle we poll for the icon and grab it the
        # instant it appears - the biggest time save in the import path. The poll
        # window equals the old blind wait, so within it this is at least as
        # reliable (several scans vs one) and never slower; if the icon never
        # shows we fall through to the existing clipboard-rewake retry ladder.
        self._verify_clipboard(code, "before scan")
        cx = cy = None
        size = 0
        saved_debug = False
        await asyncio.sleep(T.WAIT_FLOOR)
        elapsed = T.WAIT_FLOOR
        while elapsed < T.IMPORT_CLIPBOARD_DETECT:
            # Re-focus each poll to make sure we screenshot THIS window
            await self._focus()
            img = self.detector.screenshot()
            if not saved_debug:
                img.save(f"C:/ow-bot-service/debug_import_{self.instance.id}_1.png")
                saved_debug = True
            cx, cy, size = self._find_orange_button(img, label="attempt 1")
            if cx is not None:
                break
            await asyncio.sleep(T.WAIT_POLL)
            elapsed += T.WAIT_POLL

        if cx is None:
            # Retry: re-set clipboard, click settings area to wake up
            # OW's clipboard polling, wait longer
            log.warning(
                "[%s] Import button not found attempt 1 (best=%dpx), retrying",
                self.instance.id, size,
            )
            await self._focus()
            background_input.set_clipboard(code)
            await asyncio.sleep(T.IMPORT_RETRY_CLIPBOARD_SET)
            self._verify_clipboard(code, "attempt 2 pre-wait")

            # Click inside settings area to trigger OW to re-check clipboard
            region = self.detector.region
            await click(region[0] + 640, region[1] + 300)
            await asyncio.sleep(T.IMPORT_RETRY_AREA_CLICK)
            # Click again on a neutral area (summary tab)
            await click(region[0] + 400, region[1] + 260)
            await asyncio.sleep(T.IMPORT_RETRY_AREA_SCAN)

            self._verify_clipboard(code, "attempt 2 post-wait")
            await self._focus()
            img = self.detector.screenshot()
            img.save(f"C:/ow-bot-service/debug_import_{self.instance.id}_2.png")
            cx, cy, size = self._find_orange_button(img, label="attempt 2")

        if cx is None:
            # Attempt 3: ESC out and back into settings with clipboard set
            log.warning(
                "[%s] Import button not found attempt 2 (best=%dpx), "
                "re-entering settings",
                self.instance.id, size,
            )
            await self._focus()
            background_input.set_clipboard(code)
            await asyncio.sleep(T.IMPORT_REFOCUS_PAUSE)
            # ESC out of settings back to lobby
            await press_key("escape")
            await asyncio.sleep(T.IMPORT_RETRY_ESC)
            # Re-enter settings (OW checks clipboard on settings screen load)
            if not await click_text("SETTIN", self.detector, retries=3):
                log.warning("[%s] SETTINGS not found on retry", self.instance.id)
            await asyncio.sleep(T.IMPORT_RETRY_REENTER)
            # Set clipboard again right after settings loads
            await self._focus()
            background_input.set_clipboard(code)
            await asyncio.sleep(T.IMPORT_RETRY_FINAL_WAIT)
            self._verify_clipboard(code, "attempt 3 post-wait")
            await self._focus()

            img = self.detector.screenshot()
            cx, cy, size = self._find_orange_button(img, label="attempt 3")

        if cx is not None:
            # Convert from image-local to screen coordinates
            abs_cx = cx + self.detector.region[0]
            abs_cy = cy + self.detector.region[1]
            log.info(
                "[%s] Import button: %dpx at (%d, %d)",
                self.instance.id, size, abs_cx, abs_cy,
            )
            await click(abs_cx, abs_cy)
            # Wait for the import confirmation dialog (its IMPORT text) instead
            # of a blind settle; bounded so a miss only costs the timeout.
            await self._wait_for_text(
                "IMPORT",
                timeout=T.WAIT_DIALOG_TIMEOUT,
                floor=T.WAIT_FLOOR,
                poll=T.WAIT_POLL,
            )
        else:
            # Last resort: try clicking the approximate position where the
            # import icon should be (right side of the settings tab bar).
            # In OW2, tabs are: SUMMARY LOBBY MODES HEROES WORKSHOP PRESETS [import]
            # The import icon sits to the right of PRESETS.
            log.warning(
                "[%s] All orange detection attempts failed (best=%dpx), "
                "trying approximate position",
                self.instance.id, size,
            )
            # Find PRESETS text position - import icon is just to its right
            presets_pos = self.detector.find_text("PRESETS", retries=2)
            if presets_pos:
                # Import icon is roughly 80px to the right of PRESETS
                approx_x = presets_pos[0] + 80
                approx_y = presets_pos[1]
                log.info(
                    "[%s] Clicking approximate import position (%d, %d) "
                    "(right of PRESETS at %s)",
                    self.instance.id, approx_x, approx_y, presets_pos,
                )
                await click(approx_x, approx_y)
                # Wait for the import confirmation dialog (its IMPORT text)
                # instead of a blind settle; bounded by the timeout.
                await self._wait_for_text(
                    "IMPORT",
                    timeout=T.WAIT_DIALOG_TIMEOUT,
                    floor=T.WAIT_FLOOR,
                    poll=T.WAIT_POLL,
                )
            else:
                raise NavigationError(
                    f"[{self.instance.id}] Import button not found and "
                    f"PRESETS text not visible (best orange={size}px)"
                )

        # Click IMPORT text that appears in the confirmation dialog
        pos = self.detector.find_text("IMPORT", retries=3)
        if pos:
            log.info("[%s] Clicking IMPORT at %s", self.instance.id, pos)
            await click(*pos)
            # Wait for the CONFIRM button to appear instead of a blind settle.
            await self._wait_for_text(
                "CONFIRM",
                timeout=T.WAIT_DIALOG_TIMEOUT,
                floor=T.WAIT_FLOOR,
                poll=T.WAIT_POLL,
            )
        else:
            log.warning(
                "[%s] IMPORT dialog text not found - button click may not "
                "have worked",
                self.instance.id,
            )

        # Click CONFIRM
        if not await click_text("CONFIRM", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] CONFIRM not found after import")
        log.info("[%s] Import confirmed, waiting for load", self.instance.id)
        # Kept as a blind wait on purpose: the import loads into the settings
        # screen with no distinctive OCR signal for "done", and ESC-ing out too
        # early can interrupt it. Better to give the heavy load ample fixed time.
        await asyncio.sleep(T.IMPORT_LOAD_AFTER_CONFIRM)

        # ESC back to the lobby, waiting for it to actually appear rather than
        # blind-sleeping. If we are not at the lobby after the first ESC (a stray
        # dialog, or settings still up), press ESC once more and wait again.
        await press_key("escape")
        if not await self._wait_for_screen(
            Screen.LOBBY,
            timeout=T.WAIT_SCREEN_TIMEOUT,
            floor=T.WAIT_FLOOR,
            poll=T.WAIT_SCREEN_POLL,
        ):
            await press_key("escape")
            await self._wait_for_screen(
                Screen.LOBBY,
                timeout=T.WAIT_SCREEN_TIMEOUT,
                floor=T.WAIT_FLOOR,
                poll=T.WAIT_SCREEN_POLL,
            )

        log.info("[%s] Settings imported", self.instance.id)

    # Cached invite panel positions from first OCR-based invite.
    # Reused for subsequent invites to skip repeated OCR scans.
    _invite_cache: dict | None = None

    def _clear_invite_cache(self):
        self._invite_cache = None

    async def _invite_one_player(self, battle_tag: str, team: int):
        """Invite one player via the ADD PLAYERS BattleTag panel.

        First invite uses full OCR to discover positions and caches them.
        Subsequent invites reuse cached positions - much faster.
        Panel auto-closes after clicking INVITE send, no ESC needed.
        """
        await self._focus()
        cache = self._invite_cache

        if cache:
            await self._invite_fast(battle_tag, team, cache)
        else:
            await self._invite_with_ocr(battle_tag, team)

    async def _invite_with_ocr(self, battle_tag: str, team: int):
        """First invite: full OCR discovery, caches positions for reuse."""
        cache: dict = {}

        # 1) Click INVITE in lobby to open the ADD PLAYERS panel
        if not await click_text("INVITE", self.detector, retries=3):
            raise NavigationError(f"[{self.instance.id}] INVITE not found")
        await self._wait_for_any_text(
            ["ADD PLAYER", "VIA", "NO PLAYER"],
            timeout=T.INVITE_PANEL_TIMEOUT, floor=T.INVITE_PANEL_FLOOR,
            poll=T.INVITE_PANEL_POLL,
        )

        # 2) Scan panel
        all_text = self.detector.find_all_text()
        log.info(
            "[%s] Invite panel texts: %s",
            self.instance.id,
            [(t.strip(), round(c, 2)) for t, _, c in all_text if c > 0.3],
        )

        # 3) Detect friends view and switch to BattleTag input
        in_friends_view = any(
            "VIA" in t.upper() or "NO PLAYERS" in t.upper()
            for t, _, c in all_text if c > 0.3
        )

        if in_friends_view:
            via_pos = None
            for text, pos, conf in all_text:
                if "VIA" in text.upper() and conf > 0.3:
                    via_pos = pos
                    break

            if not via_pos:
                add_pos = next(
                    (pos for t, pos, c in all_text
                     if "ADD" in t.upper() and "PLAYER" in t.upper() and c > 0.5),
                    None,
                )
                if add_pos:
                    via_pos = (add_pos[0] + 250, add_pos[1] + 5)

            if via_pos:
                log.info("[%s] Clicking BattleTag view at %s", self.instance.id, via_pos)
                cache["via_battletag_pos"] = via_pos
                await click(*via_pos)
                await self._wait_for_any_text(
                    ["BOTH", "ROTH", "BATTLE"],
                    timeout=T.INVITE_PANEL_TIMEOUT, floor=T.INVITE_PANEL_FLOOR,
                    poll=T.INVITE_PANEL_POLL,
                )
                all_text = self.detector.find_all_text()

        # 4) Cache key positions from the BattleTag view
        # BOTH dropdown
        both_pos = None
        for text, pos, conf in all_text:
            upper = text.upper().strip()
            if upper in ("BOTH", "ROTH") and conf > 0.4:
                both_pos = pos
                break
        cache["both_pos"] = both_pos

        # Input field (relative to ADD PLAYERS header)
        add_pos = next(
            (pos for t, pos, c in all_text
             if "ADD" in t.upper() and "PLAYER" in t.upper() and c > 0.5),
            None,
        )
        if add_pos:
            cache["input_pos"] = (add_pos[0], add_pos[1] + 60)
        else:
            cache["input_pos"] = None

        # INVITE send button (lowest INVITE on screen)
        invite_btns = [
            (pos, conf) for t, pos, conf in all_text
            if t.upper().strip() == "INVITE" and conf > 0.5
        ]
        if invite_btns:
            invite_btns.sort(key=lambda x: x[0][1], reverse=True)
            cache["send_pos"] = invite_btns[0][0]
        else:
            cache["send_pos"] = None

        # INVITE button in lobby (for reopening panel)
        lobby_invite = self.detector.find_text("INVITE", retries=0)
        cache["lobby_invite_pos"] = lobby_invite

        # 5) Team selector with OCR (also discovers dropdown positions)
        if both_pos:
            await self._select_team_with_ocr(team, both_pos, cache)
        else:
            log.warning("[%s] BOTH dropdown not found", self.instance.id)

        # 6) Paste and send
        await self._paste_and_send(battle_tag, cache)

        # Cache team positions from the dropdown OCR for fast reuse
        self._invite_cache = cache
        log.info("[%s] Invite cache populated: %s",
                 self.instance.id,
                 {k: v for k, v in cache.items() if k != "dropdown_text"})

    async def _select_team_with_ocr(self, team: int, both_pos: tuple, cache: dict):
        """OCR-based team selection. Caches dropdown positions."""
        log.info("[%s] Opening team dropdown at %s (target: TEAM %d)",
                 self.instance.id, both_pos, team)
        await click(*both_pos)
        await self._wait_for_text(
            "TEAM", timeout=T.INVITE_PANEL_TIMEOUT, floor=T.INVITE_PANEL_FLOOR,
        )

        dropdown_text = self.detector.find_all_text()
        log.info(
            "[%s] Dropdown texts: %s",
            self.instance.id,
            [(t.strip(), pos, round(c, 2)) for t, pos, c in dropdown_text if c > 0.3],
        )

        # Collect team entries below BOTH, sorted by y
        team_entries = []
        for text, pos, conf in dropdown_text:
            upper = text.upper().strip()
            if ("TEAM" in upper
                    and pos[1] > both_pos[1]
                    and "SPECT" not in upper
                    and conf > 0.3):
                team_entries.append((text.strip(), pos, conf))
        team_entries.sort(key=lambda e: e[1][1])

        spec_entries = [
            (t.strip(), pos, c) for t, pos, c in dropdown_text
            if "SPECT" in t.upper() and pos[1] > both_pos[1] and c > 0.3
        ]

        log.info("[%s] Team entries below BOTH: %s, spectator: %s",
                 self.instance.id,
                 [(t, pos) for t, pos, _ in team_entries],
                 [(t, pos) for t, pos, _ in spec_entries])

        # Cache dropdown positions for fast reuse
        if len(team_entries) >= 1:
            cache["team1_pos"] = team_entries[0][1]
        else:
            cache["team1_pos"] = (both_pos[0], both_pos[1] + 52)
        if len(team_entries) >= 2:
            cache["team2_pos"] = team_entries[1][1]
        else:
            cache["team2_pos"] = (both_pos[0], both_pos[1] + 74)
        if spec_entries:
            cache["spec_pos"] = spec_entries[0][1]
        else:
            cache["spec_pos"] = (both_pos[0], both_pos[1] + 96)

        # Click the target team
        target_pos = {0: cache["spec_pos"], 1: cache["team1_pos"], 2: cache["team2_pos"]}.get(team)
        if target_pos:
            await click(*target_pos)
            await asyncio.sleep(0.5)

        cache["last_team"] = team

    async def _invite_fast(self, battle_tag: str, team: int, cache: dict):
        """Fast invite using cached positions. Skips most OCR."""
        # 1) Open invite panel
        lobby_pos = cache.get("lobby_invite_pos")
        if lobby_pos:
            await click(*lobby_pos)
        else:
            if not await click_text("INVITE", self.detector, retries=2):
                raise NavigationError(f"[{self.instance.id}] INVITE not found")
        await self._wait_for_any_text(
            ["ADD PLAYER", "VIA", "NO PLAYER"],
            timeout=T.INVITE_PANEL_TIMEOUT, floor=T.INVITE_PANEL_FLOOR,
            poll=T.INVITE_PANEL_POLL,
        )

        # 2) Switch to BattleTag view (panel always opens in friends view)
        via_pos = cache.get("via_battletag_pos")
        if via_pos:
            await click(*via_pos)
            await self._wait_for_any_text(
                ["BOTH", "ROTH", "BATTLE"],
                timeout=T.INVITE_PANEL_TIMEOUT, floor=T.INVITE_PANEL_FLOOR,
                poll=T.INVITE_PANEL_POLL,
            )

        # 3) Team selector - only change if different from last invite
        both_pos = cache.get("both_pos")
        if both_pos and cache.get("last_team") != team:
            await click(*both_pos)
            await asyncio.sleep(0.5)
            target_pos = {0: cache["spec_pos"], 1: cache["team1_pos"], 2: cache["team2_pos"]}.get(team)
            if target_pos:
                await click(*target_pos)
                await asyncio.sleep(0.5)
            cache["last_team"] = team

        # 4) Paste and send
        await self._paste_and_send(battle_tag, cache)

    async def _paste_and_send(self, battle_tag: str, cache: dict):
        """Click input, paste BattleTag, click send. Shared by both paths."""
        # Click input field
        input_pos = cache.get("input_pos")
        if input_pos:
            await click(*input_pos)
        else:
            await press_key("tab")
        await asyncio.sleep(0.2)

        # Select all + paste
        await hotkey("ctrl", "a")
        await asyncio.sleep(0.2)
        await paste_text(battle_tag)
        log.info("[%s] Pasted BattleTag: %s", self.instance.id, battle_tag)
        await asyncio.sleep(T.INVITE_AFTER_PASTE)

        # Click INVITE send. The panel closes and returns to the lobby, so
        # wait for its distinctive text to disappear instead of blind-sleeping;
        # the next invite then starts as soon as we are actually back.
        send_pos = cache.get("send_pos")
        if send_pos:
            await click(*send_pos)
        else:
            await press_key("enter")
        await self._wait_until_text_gone(
            ["ADD PLAYER", "BOTH", "ROTH", "VIA"],
            timeout=T.INVITE_SEND_TIMEOUT, floor=T.INVITE_PANEL_FLOOR,
            poll=T.INVITE_PANEL_POLL,
        )

    async def _count_lobby_players(self) -> int:
        """OCR the lobby screen and count filled team slots."""
        await self._focus()
        all_text = self.detector.find_all_text()

        # Count EMPTY slots in the team area (y < 540).
        # Spectator EMPTY slots are y > 540 and don't count.
        team_empty = 0
        for text, pos, conf in all_text:
            if "EMPTY" in text.upper() and pos[1] < 540 and conf > 0.3:
                team_empty += 1

        # 10 total team slots (5 per team) minus empties = players present
        joined = max(0, 10 - team_empty)
        return joined

    async def _wait_for_players(self, expected: int, timeout: int, poll_interval: int) -> int:
        log.info("[%s] Waiting %ds for %d players", self.instance.id, timeout, expected)
        elapsed = 0

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            joined = await self._count_lobby_players()
            self.instance.on_players_joining(joined)
            log.info("[%s] Players: %d/%d (elapsed %ds/%ds)", self.instance.id, joined, expected, elapsed, timeout)

            if joined >= expected:
                return joined

        return self.instance.players_joined

    async def _wait_for_new_ow_process(self, exclude_pids: set[int], timeout: int | None = None) -> int:
        """Wait for a NEW OW process that wasn't in exclude_pids."""
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for new OW process (timeout=%ds, excluding %s)", self.instance.id, timeout, exclude_pids)
        elapsed = 0
        while elapsed < timeout:
            for proc in psutil.process_iter(["name"]):
                if (proc.info["name"]
                        and "overwatch" in proc.info["name"].lower()
                        and proc.pid not in exclude_pids):
                    log.info("[%s] Found new OW: PID %d", self.instance.id, proc.pid)
                    return proc.pid
            await asyncio.sleep(2)
            elapsed += 2
        raise TimeoutError(f"OW did not start within {timeout}s")

    async def _wait_for_main_menu(self, timeout: int | None = None):
        timeout = timeout or settings.warmup_timeout_seconds
        log.info("[%s] Waiting for OW to be ready", self.instance.id)
        known_screens = {Screen.MAIN_MENU, Screen.PLAY_MENU, Screen.CUSTOM_GAMES, Screen.LOBBY, Screen.SETTINGS}
        elapsed = 0.0
        login_attempted = False
        while elapsed < timeout:
            screen = self.detector.detect_screen()
            if screen in known_screens:
                log.info("[%s] OW ready at %s", self.instance.id, screen.value)
                return
            if screen == Screen.LOGIN and not login_attempted:
                log.info("[%s] Login screen detected during warmup, attempting login", self.instance.id)
                await self._handle_login_screen()
                login_attempted = True
                continue
            if screen == Screen.UNKNOWN:
                await self._recover_from_unknown()
            await asyncio.sleep(3)
            elapsed += 3
        raise TimeoutError(f"No known OW screen detected within {timeout}s")
