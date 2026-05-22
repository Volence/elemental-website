import logging
import time
from enum import Enum
from pathlib import Path

import pyautogui
from PIL import Image

log = logging.getLogger("ow-bot.screens")

TEMPLATES_DIR = Path(__file__).parent / "templates"


class Screen(Enum):
    """Known OW screen states, ordered roughly by menu depth."""
    UNKNOWN = "unknown"
    LOGIN = "login"
    MAIN_MENU = "main_menu"
    PLAY_MENU = "play_menu"       # After clicking PLAY, before MORE
    CUSTOM_GAMES = "custom_games" # Custom Games browser (has +CREATE)
    LOBBY = "lobby"               # Custom game lobby (has SETTINGS, START)
    SETTINGS = "settings"         # Settings panel inside lobby
    IN_GAME = "in_game"
    MATCH_END = "match_end"


# Maps Screen → the template that uniquely identifies it.
# Order matters: more specific screens are checked first so we don't
# mistake a deeper screen for a shallower one (e.g. lobby has the same
# top bar as custom_games, but lobby also has the settings button).
_SCREEN_SIGNATURES: list[tuple[Screen, str, float]] = [
    # (screen, template, confidence)
    (Screen.SETTINGS,     "settings_import_button.png", 0.7),  # Only visible in settings panel with clipboard
    (Screen.SETTINGS,     "lobby_settings_button.png",  0.7),  # Fallback — if we see BACK + tiles, it's settings
    (Screen.LOBBY,        "lobby_start_button.png",     0.7),
    (Screen.LOBBY,        "lobby_settings_button.png",  0.8),
    (Screen.CUSTOM_GAMES, "custom_game_create_button.png", 0.8),
    (Screen.PLAY_MENU,    "custom_game_more_button.png", 0.8),
    (Screen.MAIN_MENU,    "main_menu_play_button.png",  0.8),
    # (Screen.LOGIN,      "battlenet_login_email.png",  0.8),  # TODO: capture template
    # (Screen.MATCH_END,  "match_end_screen.png",       0.8),  # TODO: capture template
]

# How many ESC presses to get from a screen back to main menu.
# Used by navigate_to() to "back out" before navigating forward.
_DEPTH: dict[Screen, int] = {
    Screen.MAIN_MENU: 0,
    Screen.PLAY_MENU: 1,
    Screen.CUSTOM_GAMES: 2,
    Screen.LOBBY: 3,       # ESC from lobby goes to custom games (or exits lobby)
    Screen.SETTINGS: 4,    # ESC from settings goes to lobby
}


class ScreenDetector:
    def __init__(self, region: tuple[int, int, int, int]):
        self.region = region

    def screenshot(self) -> Image.Image:
        return pyautogui.screenshot(region=self.region)

    def locate_template(
        self,
        template_name: str,
        confidence: float = 0.8,
        retries: int = 1,
    ) -> tuple[int, int] | None:
        template_path = TEMPLATES_DIR / template_name
        if not template_path.exists():
            log.warning("Template not found on disk: %s", template_path)
            return None
        for attempt in range(retries):
            try:
                location = pyautogui.locateOnScreen(
                    str(template_path),
                    region=self.region,
                    confidence=confidence,
                )
                if location:
                    center = pyautogui.center(location)
                    return (center.x, center.y)
            except pyautogui.ImageNotFoundException:
                pass
            except Exception as e:
                if attempt == retries - 1:
                    log.warning("Error locating %s: %s", template_name, e)
            if attempt < retries - 1:
                time.sleep(0.5)
        return None

    def pixel_color_at(self, x: int, y: int) -> tuple[int, int, int]:
        screenshot = self.screenshot()
        rel_x = x - self.region[0]
        rel_y = y - self.region[1]
        return screenshot.getpixel((rel_x, rel_y))[:3]

    # ── Screen detection ──

    def detect_screen(self) -> Screen:
        """Identify which screen OW is currently showing.

        Checks templates from most-specific to least-specific.  The first
        match wins.  Returns Screen.UNKNOWN if nothing matches (OW may be
        in a transition, loading, or crashed).
        """
        seen: set[Screen] = set()
        for screen, template, confidence in _SCREEN_SIGNATURES:
            if screen in seen:
                continue  # Already matched a more-specific sig for this screen
            if self.locate_template(template, confidence=confidence):
                log.debug("detect_screen: matched %s via %s", screen.value, template)
                return screen
            seen.add(screen)

        log.warning("detect_screen: no known screen detected")
        return Screen.UNKNOWN

    def wait_for_screen(
        self,
        target: Screen,
        timeout: float = 10.0,
        poll: float = 1.0,
    ) -> bool:
        """Block until the screen matches *target* or timeout expires."""
        elapsed = 0.0
        while elapsed < timeout:
            if self.detect_screen() == target:
                return True
            time.sleep(poll)
            elapsed += poll
        log.warning("wait_for_screen: timed out waiting for %s", target.value)
        return False

    # ── Convenience checks (kept for backward compat) ──

    def is_at_main_menu(self) -> bool:
        return self.locate_template("main_menu_play_button.png") is not None

    def is_at_custom_game(self) -> bool:
        return self.locate_template("custom_game_create_button.png") is not None

    def is_at_lobby(self) -> bool:
        return self.locate_template("lobby_settings_button.png") is not None

    def is_at_login_screen(self) -> bool:
        return self.locate_template("battlenet_login_email.png") is not None

    def get_player_count(self) -> int | None:
        # TODO: implement OCR or template matching for player count display
        return None

    def is_match_ended(self) -> bool:
        return self.locate_template("match_end_screen.png") is not None


def get_depth(screen: Screen) -> int:
    """Return the menu depth of a screen, or -1 for unmapped screens."""
    return _DEPTH.get(screen, -1)
