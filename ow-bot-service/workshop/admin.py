import logging

from automation import background_input
from automation.window_manager import window_manager

log = logging.getLogger("ow-bot.workshop.admin")

COMMAND_KEYS = {
    "pause": "e",
    "unpause": "e",
    "end_draw": "z",
    "end_team1": "q",
    "end_team2": None,
}


def send_workshop_command(instance_id: str, command: str):
    if command not in COMMAND_KEYS:
        raise ValueError(f"Unknown workshop command: {command}")

    win = window_manager.get_window(instance_id)
    if not win:
        raise RuntimeError(f"No window for instance {instance_id}")

    key = COMMAND_KEYS[command]
    if key is None:
        cx = win.region[2] // 2
        cy = win.region[3] // 2
        log.info("[%s] Workshop command '%s' via click at (%d,%d) (background)", instance_id, command, cx, cy)
        background_input.send_click(win.hwnd, cx, cy, hold_ms=200)
    else:
        log.info("[%s] Workshop command '%s' via key '%s' (background)", instance_id, command, key)
        background_input.send_key(win.hwnd, key, hold_ms=200)
