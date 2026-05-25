import logging

from automation import background_input
from automation.window_manager import window_manager

log = logging.getLogger("ow-bot.workshop.admin")

COMMAND_KEYS = {
    "pause": "e",
    "unpause": "e",
    "end_game": "q",
}


def send_workshop_command(instance_id: str, command: str):
    key = COMMAND_KEYS.get(command)
    if not key:
        raise ValueError(f"Unknown workshop command: {command}")

    win = window_manager.get_window(instance_id)
    if not win:
        raise RuntimeError(f"No window for instance {instance_id}")

    log.info("[%s] Workshop command '%s' via key '%s' (background)", instance_id, command, key)
    background_input.send_key(win.hwnd, key, hold_ms=200)
