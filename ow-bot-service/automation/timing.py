"""Centralized sleep/delay constants for OW automation.

Adjust values here to tune speed vs. reliability. All values are in seconds.
Lower = faster but riskier if OW hasn't finished its transition.
"""


# ── Focus ────────────────────────────────────────────────────────────
FOCUS_AFTER = 0.4          # wait after successful focus
FOCUS_RETRY_BEFORE = 0.3   # pause before retrying a failed focus
FOCUS_RETRY_AFTER = 0.5    # wait after retry focus

# ── Navigation (ESC, back) ──────────────────────────────────────────
NAV_AFTER_ESC = 1.0        # after pressing ESC to go back a screen
NAV_AFTER_EXIT = 1.0       # after clicking EXIT in a lobby
NAV_AFTER_EXIT_YES = 3.0   # after confirming lobby exit (heavier transition)

# ── Screen transitions (clicking menu buttons) ──────────────────────
TRANSITION_PLAY = 1.5      # after clicking PLAY from main menu
TRANSITION_CUSTOM = 1.5    # after clicking CUSTOM GAMES
TRANSITION_CREATE = 1.5    # after clicking CREATE lobby
TRANSITION_SETTINGS = 1.5  # after clicking SETTINGS button
TRANSITION_LOGIN = 3.0     # after clicking LOGIN button
TRANSITION_LOADING = 3.0   # wait when loading screen detected
TRANSITION_DIALOG = 1.5    # after dismissing a dialog

# ── Move to spectator ───────────────────────────────────────────────
SPECTATOR_AFTER_MOVE = 0.8   # after clicking MOVE button
SPECTATOR_AFTER_PLAYER = 0.8 # after clicking the bot's player slot
SPECTATOR_AFTER_SLOT = 0.8   # after clicking the spectator slot
SPECTATOR_AFTER_DONE = 0.5   # after clicking DONE

# ── Import settings ─────────────────────────────────────────────────
IMPORT_AFTER_SETTINGS = 1.5       # after clicking SETTINGS to open panel
IMPORT_REFOCUS_PAUSE = 0.3        # brief pause after re-focus during import
IMPORT_CLIPBOARD_DETECT = 2.0     # wait for OW to detect clipboard change
IMPORT_RETRY_CLIPBOARD_SET = 0.5  # wait after re-setting clipboard in retries
IMPORT_RETRY_AREA_CLICK = 0.5     # wait after clicking settings area to wake OW
IMPORT_RETRY_AREA_SCAN = 2.0      # wait before scanning for orange button on retry
IMPORT_RETRY_ESC = 1.0            # after ESC-ing out of settings on retry
IMPORT_RETRY_REENTER = 1.5        # after re-entering settings on retry
IMPORT_RETRY_FINAL_WAIT = 2.0     # final clipboard wait on attempt 3
IMPORT_AFTER_ORANGE_CLICK = 1.5   # after clicking the orange import icon
IMPORT_AFTER_IMPORT_CLICK = 1.5   # after clicking IMPORT in confirmation dialog
IMPORT_LOAD_AFTER_CONFIRM = 5.0   # wait for settings to load after CONFIRM
IMPORT_AFTER_ESC_BACK = 1.0       # after ESC-ing back to lobby post-import

# ── Invite players ──────────────────────────────────────────────────
INVITE_AFTER_OPEN = 0.8     # after clicking INVITE to open panel
INVITE_AFTER_VIEW_SWITCH = 0.8  # after switching to BattleTag view
INVITE_AFTER_PASTE = 0.8    # after pasting a BattleTag
INVITE_AFTER_SEND = 1.0     # after clicking INVITE send (panel auto-closes)

# ── Start game ──────────────────────────────────────────────────────
START_AFTER_CLICK = 3.0          # after clicking START
START_CONTINUE_CHECK = 3.0      # between CONTINUE/CONFIRM checks
START_AFTER_CONTINUE = 1.5      # after clicking CONTINUE/CONFIRM

# ── Warmup / launch ─────────────────────────────────────────────────
LAUNCH_WINDOW_INIT = 2.0        # let window initialize after OW launch
LAUNCH_AFTER_START = 3.0        # after launching OW exe
