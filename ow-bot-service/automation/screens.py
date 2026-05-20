import logging
from pathlib import Path

import pyautogui
from PIL import Image

log = logging.getLogger("ow-bot.screens")

TEMPLATES_DIR = Path(__file__).parent / "templates"


class ScreenDetector:
    def __init__(self, region: tuple[int, int, int, int]):
        self.region = region

    def screenshot(self) -> Image.Image:
        return pyautogui.screenshot(region=self.region)

    def locate_template(self, template_name: str, confidence: float = 0.8) -> tuple[int, int] | None:
        template_path = TEMPLATES_DIR / template_name
        if not template_path.exists():
            log.warning("Template not found: %s", template_path)
            return None
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
        return None

    def pixel_color_at(self, x: int, y: int) -> tuple[int, int, int]:
        screenshot = self.screenshot()
        rel_x = x - self.region[0]
        rel_y = y - self.region[1]
        return screenshot.getpixel((rel_x, rel_y))[:3]

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
