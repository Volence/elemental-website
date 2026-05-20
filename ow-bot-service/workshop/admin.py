import logging

from automation.actions import press_key

log = logging.getLogger("ow-bot.workshop.admin")

# Phase 2: Workshop admin commands via host spectator key presses
# The bot sits as the host spectator. OW Workshop detects button presses
# via Is Button Held(Host Player, Button).
#
# Key mapping:
#   E (Interact)      → pause/unpause toggle
#   Q (Ability 1)     → end game
#   Shift (Sec. Fire) → spare
#   Ctrl (Pri. Fire)  → spare
#   Left Click (Ab.2) → spare
#   B (Jump)          → spare
#   Z (Ultimate)      → spare

COMMAND_KEYS = {
    "pause": "e",
    "unpause": "e",
    "end_game": "q",
}


async def send_workshop_command(command: str):
    key = COMMAND_KEYS.get(command)
    if not key:
        raise ValueError(f"Unknown workshop command: {command}")
    log.info("Sending workshop command '%s' via key '%s'", command, key)
    await press_key(key, duration=0.2)
