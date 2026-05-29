import logging
import re
import time
from enum import Enum

import numpy as np
import pyautogui
from PIL import Image

log = logging.getLogger("ow-bot.screens")

_reader = None


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(["en"], gpu=True)
        log.info("OCR reader initialized")
    return _reader


class Screen(Enum):
    UNKNOWN = "unknown"
    LOGIN = "login"
    MAIN_MENU = "main_menu"
    PLAY_MENU = "play_menu"
    CUSTOM_GAMES = "custom_games"
    LOBBY = "lobby"
    SETTINGS = "settings"
    IN_GAME = "in_game"
    MATCH_END = "match_end"
    LOADING = "loading"
    DIALOG = "dialog"


# (Screen, required_texts, forbidden_texts)
# Checked in order — first match wins. Most specific first.
# Texts are matched against SHORT OCR results only (<25 chars) to avoid
# false matches from description text like "Create and join lobbies..."
_SCREEN_SIGNATURES: list[tuple[Screen, list[str], list[str]]] = [
    (Screen.LOGIN,        ["LOGIN"],                ["PLAY", "HEROES", "FILTER", "START"]),
    (Screen.SETTINGS,     ["PRESETS"],             []),
    (Screen.LOBBY,        ["START", "INVITE"],      []),
    (Screen.CUSTOM_GAMES, ["FILTER"],              ["START"]),
    (Screen.PLAY_MENU,    ["UNRANKED"],            []),
    (Screen.MAIN_MENU,    ["PLAY", "HEROES"],      ["UNRANKED", "FILTER", "START", "PRESETS"]),
]

DISMISS_KEYWORDS = [
    "OK", "ACCEPT", "CONTINUE", "DISMISS", "RECONNECT",
    "CLOSE", "CONFIRM", "YES", "GOT IT", "UNDERSTOOD",
]

# Substrings (case-insensitive) that identify a blocking pop-up dialog even
# when it has no standard dismiss button text. When any of these appear, the
# screen is treated as a dismissable DIALOG so the controller clears it
# (click a dismiss button if present, else ESC) instead of stalling on UNKNOWN.
KNOWN_DIALOG_PHRASES = [
    "disabled invitation",     # "They have disabled Invitations..."
    "unable to invite",        # "Unable to invite player to custom game"
    "cannot invite",
    "could not invite",
    "invitation failed",
    "lost connection",
    "connection to the game",
    "you have been removed",
    "you were removed",
    "rejoin",
    "has been disbanded",
    "no longer available",
    "try again",
]

MAX_TEXT_LEN = 25

_DEPTH: dict[Screen, int] = {
    Screen.MAIN_MENU: 0,
    Screen.PLAY_MENU: 1,
    Screen.CUSTOM_GAMES: 2,
    Screen.LOBBY: 3,
    Screen.SETTINGS: 4,
}


class ScreenDetector:
    def __init__(self, region: tuple[int, int, int, int]):
        self.region = region
        self._cached_results: list[tuple] = []

    def screenshot(self) -> Image.Image:
        return pyautogui.screenshot(region=self.region)

    def scan(self, image: Image.Image | None = None) -> list[tuple]:
        """Take screenshot and run OCR. Returns [(bbox, text, confidence), ...]."""
        if image is None:
            image = self.screenshot()
        self._cached_results = _get_reader().readtext(np.array(image))
        return self._cached_results

    def find_text(
        self,
        label: str,
        confidence: float = 0.4,
        rescan: bool = True,
        retries: int = 1,
        whole_word: bool = False,
    ) -> tuple[int, int] | None:
        """Find text on screen, return center (x, y) in screen coords.

        whole_word=True matches `label` only as a standalone word (regex word
        boundaries), so "CREATE" will not match "Created by" lobby entries in
        the custom-games browser. Default stays substring matching, which is
        tolerant of OCR splitting/merging longer labels.
        """
        label_upper = label.upper()
        pattern = re.compile(rf"\b{re.escape(label_upper)}\b") if whole_word else None
        for attempt in range(retries):
            if rescan or not self._cached_results:
                self.scan()
            for bbox, text, conf in self._cached_results:
                if conf < confidence:
                    continue
                text_upper = text.upper()
                matched = (
                    pattern.search(text_upper) is not None
                    if whole_word
                    else label_upper in text_upper
                )
                if matched:
                    x1, y1 = bbox[0]
                    x2, y2 = bbox[2]
                    cx = int((x1 + x2) / 2) + self.region[0]
                    cy = int((y1 + y2) / 2) + self.region[1]
                    log.debug("find_text(%r): (%d,%d) conf=%.2f", label, cx, cy, conf)
                    return (cx, cy)
            if attempt < retries - 1:
                time.sleep(0.5)
        return None

    def find_all_text(
        self, confidence: float = 0.3, rescan: bool = True,
    ) -> list[tuple[str, tuple[int, int], float]]:
        """Return all detected text with screen-coordinate positions."""
        if rescan or not self._cached_results:
            self.scan()
        found = []
        for bbox, text, conf in self._cached_results:
            if conf < confidence:
                continue
            x1, y1 = bbox[0]
            x2, y2 = bbox[2]
            cx = int((x1 + x2) / 2) + self.region[0]
            cy = int((y1 + y2) / 2) + self.region[1]
            found.append((text, (cx, cy), conf))
        return found

    def _texts_contain(self, label: str, texts: list[str]) -> bool:
        upper = label.upper()
        return any(upper in t.upper() for t in texts if len(t) <= MAX_TEXT_LEN)

    def _match_signatures(self) -> Screen:
        """Match the most recent OCR scan against the screen signatures."""
        texts = [text for _, text, conf in self._cached_results if conf > 0.3]
        log.debug("detect_screen texts: %s", texts)
        for screen, required, forbidden in _SCREEN_SIGNATURES:
            if all(self._texts_contain(r, texts) for r in required):
                if not any(self._texts_contain(f, texts) for f in forbidden):
                    log.debug("detect_screen: %s", screen.value)
                    return screen
        return Screen.UNKNOWN

    def detect_screen(
        self, rescan: bool = True, retries: int = 1, retry_delay: float = 0.4,
    ) -> Screen:
        """Identify which OW screen is showing via OCR.

        Args:
            rescan: Take a fresh screenshot. Set False to reuse the last scan
                    (useful after find_all_text to avoid a second screenshot).
            retries: If the first frame yields UNKNOWN, re-scan and retry up to
                    this many total attempts. OCR is frame-to-frame noisy, so a
                    single bad frame should not be trusted as a real UNKNOWN.
                    A known screen is returned as soon as it is seen; only a
                    persistent UNKNOWN survives all retries.
            retry_delay: Seconds between retry scans.
        """
        attempts = max(1, retries)
        for attempt in range(attempts):
            if rescan or not self._cached_results:
                self.scan()
            screen = self._match_signatures()
            if screen != Screen.UNKNOWN:
                return screen
            if attempt < attempts - 1:
                rescan = True  # force a fresh frame on the next try
                time.sleep(retry_delay)
        texts = [text for _, text, conf in self._cached_results if conf > 0.3]
        log.warning(
            "detect_screen: no match after %d attempt(s) (texts: %s)",
            attempts, texts,
        )
        return Screen.UNKNOWN

    def wait_for_screen(
        self, target: Screen, timeout: float = 10.0, poll: float = 1.0,
    ) -> bool:
        elapsed = 0.0
        while elapsed < timeout:
            if self.detect_screen() == target:
                return True
            time.sleep(poll)
            elapsed += poll
        log.warning("wait_for_screen: timed out for %s", target.value)
        return False

    def wait_for_text(
        self, label: str, timeout: float = 10.0, poll: float = 1.0,
    ) -> tuple[int, int] | None:
        """Block until text appears on screen. Returns position or None."""
        elapsed = 0.0
        while elapsed < timeout:
            pos = self.find_text(label)
            if pos:
                return pos
            time.sleep(poll)
            elapsed += poll
        log.warning("wait_for_text: timed out for %r", label)
        return None

    def is_at_main_menu(self) -> bool:
        return self.detect_screen() == Screen.MAIN_MENU

    def is_at_custom_game(self) -> bool:
        return self.detect_screen() == Screen.CUSTOM_GAMES

    def is_at_lobby(self) -> bool:
        return self.detect_screen() == Screen.LOBBY

    def is_at_login_screen(self) -> bool:
        return self.find_text("LOG IN") is not None

    def get_player_count(self) -> int | None:
        return None

    def is_match_ended(self) -> bool:
        return self.detect_screen() == Screen.MATCH_END

    def classify_unknown(self) -> Screen:
        """When detect_screen returns UNKNOWN, try to classify further.

        Distinguishes between loading screens (very little/no text),
        dismissable dialogs (contain OK/ACCEPT/etc.), and true unknowns.
        """
        texts = [text for _, text, conf in self._cached_results if conf > 0.3]
        short_texts = [t for t in texts if len(t) <= MAX_TEXT_LEN]

        # Known blocking dialogs (e.g. "unable to invite", "lost connection")
        # are matched against the FULL text, since their identifying phrase is
        # usually a long sentence, not a short button label.
        joined = " ".join(texts).lower()
        for phrase in KNOWN_DIALOG_PHRASES:
            if phrase in joined:
                log.info("classify_unknown: known dialog phrase '%s'", phrase)
                return Screen.DIALOG

        if len(short_texts) <= 1:
            log.debug("classify_unknown: loading (only %d text fragments)", len(short_texts))
            return Screen.LOADING

        for kw in DISMISS_KEYWORDS:
            if any(kw in t.upper() for t in short_texts):
                log.info("classify_unknown: dialog (found '%s')", kw)
                return Screen.DIALOG

        return Screen.UNKNOWN

    def has_blocking_dialog(self) -> str | None:
        """Return the matched phrase if a known blocking dialog is on screen.

        Re-uses the last OCR scan (does not rescan). Used to detect error
        pop-ups (e.g. invite-disabled) that appear mid-operation.
        """
        texts = [text for _, text, conf in self._cached_results if conf > 0.3]
        joined = " ".join(texts).lower()
        for phrase in KNOWN_DIALOG_PHRASES:
            if phrase in joined:
                return phrase
        return None

    def find_dismiss_button(self) -> tuple[int, int] | None:
        """Find a clickable dismiss/confirm button on a dialog screen."""
        for kw in DISMISS_KEYWORDS:
            pos = self.find_text(kw, rescan=False, retries=1)
            if pos:
                log.info("find_dismiss_button: found '%s' at %s", kw, pos)
                return pos
        return None


def get_depth(screen: Screen) -> int:
    return _DEPTH.get(screen, -1)
