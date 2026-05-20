import logging

from automation.actions import press_key

log = logging.getLogger("ow-bot.workshop.admin")

# Workshop admin commands via host spectator key presses.
# The bot sits as the host spectator. The Workshop rules in the generated
# code blob (src/pug/workshopTemplate.ts) detect button presses via
# Is Button Held(Host Player, Button).
#
# Key mapping (must match ELMT Admin rules in workshopTemplate.ts):
#   E (Interact)  → pause/unpause toggle
#   Q (Ability 1) → end game

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
