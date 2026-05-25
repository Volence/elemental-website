import logging
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
    ) -> tuple[int, int] | None:
        """Find text on screen, return center (x, y) in screen coords."""
        label_upper = label.upper()
        for attempt in range(retries):
            if rescan or not self._cached_results:
                self.scan()
            for bbox, text, conf in self._cached_results:
                if conf < confidence:
                    continue
                if label_upper in text.upper():
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

    def detect_screen(self, rescan: bool = True) -> Screen:
        """Identify which OW screen is showing via OCR.

        Args:
            rescan: Take a fresh screenshot. Set False to reuse the last scan
                    (useful after find_all_text to avoid a second screenshot).
        """
        if rescan or not self._cached_results:
            self.scan()
        texts = [text for _, text, conf in self._cached_results if conf > 0.3]
        log.debug("detect_screen texts: %s", texts)
        for screen, required, forbidden in _SCREEN_SIGNATURES:
            if all(self._texts_contain(r, texts) for r in required):
                if not any(self._texts_contain(f, texts) for f in forbidden):
                    log.debug("detect_screen: %s", screen.value)
                    return screen
        log.warning("detect_screen: no match (texts: %s)", texts)
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

        if len(short_texts) <= 1:
            log.debug("classify_unknown: loading (only %d text fragments)", len(short_texts))
            return Screen.LOADING

        for kw in DISMISS_KEYWORDS:
            if any(kw in t.upper() for t in short_texts):
                log.info("classify_unknown: dialog (found '%s')", kw)
                return Screen.DIALOG

        return Screen.UNKNOWN

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
