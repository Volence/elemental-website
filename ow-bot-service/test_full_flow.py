"""Full end-to-end PUG lobby flow:
  main menu → create lobby → import Workshop code → invite player →
  start match → trigger team win → verify match end

Run via schtasks. Tail C:\ow-bot-service\full_flow.log via SSH.
"""
import asyncio
import sys
import time

sys.path.insert(0, "C:/ow-bot-service")

import pyautogui
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

from pathlib import Path
from automation.screens import ScreenDetector, Screen
from automation import actions
from automation import background_input

LOG = Path("C:/ow-bot-service/full_flow.log")
WORKSHOP_CODE = Path("C:/ow-bot-service/full_workshop_code.txt")
INVITE_TAG = "dizzykoto1#1859"
INVITE_TEAM = 2


async def focus_window(wm, instance_id: str):
    """Focus a specific OW window before click/screenshot operations."""
    wm.focus_window(instance_id)
    await asyncio.sleep(0.8)


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ocr_dump(detector: ScreenDetector, step_name: str) -> Screen:
    log(f"")
    log(f"--- OCR @ {step_name} ---")
    results = detector.find_all_text(confidence=0.3)
    for text, pos, conf in results:
        marker = " *" if len(text) <= 25 else ""
        log(f"  {text!r:40s} ({pos[0]:4d}, {pos[1]:4d})  conf={conf:.2f}{marker}")
    screen = detector.detect_screen(rescan=False)
    log(f"  >> detect_screen() = {screen.value}")
    return screen


async def navigate_to_main_menu(wm, instance_id, detector):
    """Get to main menu from wherever we are."""
    await focus_window(wm, instance_id)
    screen = ocr_dump(detector, "NAV: Initial state")

    for i in range(8):
        if screen == Screen.MAIN_MENU:
            return True

        if screen == Screen.LOBBY:
            log("At lobby — exiting via EXIT + YES")
            await actions.click_text("EXIT", detector, retries=3)
            await asyncio.sleep(2)
            pos = detector.find_text("YES", retries=3)
            if pos:
                await actions.move_to(*pos)
                await asyncio.sleep(0.3)
                await actions.click(*pos, delay=0.3)
                await asyncio.sleep(5)
            screen = ocr_dump(detector, f"NAV: After EXIT+YES (#{i+1})")
            continue

        # ESC for everything else (overlay, settings, play_menu, custom_games)
        await actions.press_key("escape")
        await asyncio.sleep(2)
        screen = ocr_dump(detector, f"NAV: After ESC #{i+1}")

    return screen == Screen.MAIN_MENU


async def navigate_to_lobby(wm, instance_id, detector):
    """Main menu → Play → MORE → Custom Games → Create → Lobby."""
    await focus_window(wm, instance_id)
    log("")
    log("== Navigate to Lobby ==")

    if not await actions.click_text("PLAY", detector, retries=3):
        log("ABORT: PLAY not found")
        return False
    log("Clicked PLAY")
    await asyncio.sleep(3)
    ocr_dump(detector, "After PLAY")

    # MORE dropdown — scan fast before it closes
    if await actions.click_text("MORE", detector, retries=2):
        log("Clicked MORE")
        await asyncio.sleep(0.3)
        pos = detector.find_text("CUSTOM")
        if pos:
            log(f"Found CUSTOM at {pos}")
            await actions.click(*pos)
        else:
            await asyncio.sleep(1.5)
            pos = detector.find_text("CUSTOM", retries=2)
            if pos:
                log(f"Found CUSTOM (delayed) at {pos}")
                await actions.click(*pos)
            else:
                log("ABORT: CUSTOM not found after MORE")
                return False
    else:
        log("ABORT: MORE not found")
        return False

    await asyncio.sleep(3)
    screen = ocr_dump(detector, "After CUSTOM GAMES")
    if screen != Screen.CUSTOM_GAMES:
        log(f"WARNING: Expected custom_games, got {screen.value}")

    if not await actions.click_text("CREATE", detector, retries=5):
        log("ABORT: CREATE not found")
        return False
    log("Clicked CREATE")
    await asyncio.sleep(3)

    screen = ocr_dump(detector, "After CREATE")
    if screen == Screen.LOBBY:
        log("SUCCESS: At lobby")
        return True
    else:
        log(f"FAIL: Expected lobby, got {screen.value}")
        return False


async def import_workshop_code(wm, instance_id, detector):
    """Copy Workshop code to clipboard, open SETTINGS, click IMPORT + CONFIRM."""
    await focus_window(wm, instance_id)
    log("")
    log("== Import Workshop Code ==")

    code = WORKSHOP_CODE.read_text(encoding="utf-8")
    if code.startswith("﻿"):
        code = code[1:]
    log(f"Workshop code loaded: {len(code)} chars")

    ok = background_input.set_clipboard(code)
    log(f"set_clipboard returned: {ok}")
    await asyncio.sleep(3)

    # Verify clipboard was set by reading it back
    try:
        import ctypes
        u32 = ctypes.windll.user32
        k32 = ctypes.windll.kernel32
        k32.GlobalLock.restype = ctypes.c_void_p
        k32.GlobalLock.argtypes = [ctypes.c_void_p]
        u32.GetClipboardData.restype = ctypes.c_void_p
        if u32.OpenClipboard(0):
            h = u32.GetClipboardData(13)  # CF_UNICODETEXT
            if h:
                p = k32.GlobalLock(h)
                if p:
                    clip_text = ctypes.wstring_at(p)
                    k32.GlobalUnlock(h)
                    log(f"Clipboard verify: {len(clip_text)} chars, starts with {clip_text[:50]!r}")
                else:
                    log("Clipboard verify: GlobalLock failed")
            else:
                log("Clipboard verify: GetClipboardData returned NULL")
            u32.CloseClipboard()
        else:
            log("Clipboard verify: OpenClipboard failed")
    except Exception as e:
        log(f"Clipboard verify error: {e}")

    if not await actions.click_text("SETTINGS", detector, retries=5):
        log("ABORT: SETTINGS not found")
        return False
    log("Clicked SETTINGS")
    await asyncio.sleep(5)

    screen = ocr_dump(detector, "After SETTINGS")

    # Save a screenshot so we can inspect the settings panel visually
    img = detector.screenshot()
    img.save("C:/ow-bot-service/settings_screenshot.png")
    log("Saved settings_screenshot.png for inspection")

    # The import button is the 5th icon under SUMMARY — red-orange, only visible
    # when clipboard has a valid Workshop code. Deeper red-orange than standard.
    import numpy as np
    from scipy import ndimage
    arr = np.array(img)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 180) & (g > 40) & (g < 150) & (b < 100)

    labeled, num_features = ndimage.label(mask)
    log(f"Found {num_features} red-orange clusters")

    best_cluster = None
    best_size = 0
    for i in range(1, num_features + 1):
        cluster = np.argwhere(labeled == i)
        cy = int(np.mean(cluster[:, 0]))
        if len(cluster) > best_size and cy < 600:
            best_size = len(cluster)
            best_cluster = cluster

    if best_cluster is not None and best_size >= 20:
        cy = int(np.mean(best_cluster[:, 0])) + detector.region[1]
        cx = int(np.mean(best_cluster[:, 1])) + detector.region[0]
        log(f"Import button: {best_size}px at ({cx}, {cy})")
        await actions.click(cx, cy)
        log(f"Clicked import button")
        await asyncio.sleep(3)
        ocr_dump(detector, "After clicking import button")
    else:
        log(f"ABORT: Import button not found (best={best_size}px)")
        return False

    # Click IMPORT text that appears in the dialog
    pos = detector.find_text("IMPORT", retries=3)
    if pos:
        log(f"Found IMPORT at {pos}")
        await actions.click(*pos)
        await asyncio.sleep(3)

    # Click CONFIRM
    if not await actions.click_text("CONFIRM", detector, retries=3):
        log("ABORT: CONFIRM not found")
        return False
    log("Clicked CONFIRM")

    log("Waiting 10s for Workshop import to complete...")
    await asyncio.sleep(10)
    ocr_dump(detector, "After import wait")

    # ESC back to lobby
    await actions.press_key("escape")
    await asyncio.sleep(2)
    screen = ocr_dump(detector, "After ESC from settings")

    if screen == Screen.UNKNOWN:
        await actions.press_key("escape")
        await asyncio.sleep(2)
        screen = ocr_dump(detector, "After 2nd ESC")

    if screen == Screen.LOBBY:
        log("SUCCESS: Back at lobby after import")
        return True
    else:
        log(f"WARNING: Expected lobby, got {screen.value}")
        return True  # continue anyway


async def invite_player(wm, instance_id, detector):
    """Invite a player to Team 2 via BattleTag."""
    await focus_window(wm, instance_id)
    log("")
    log(f"== Invite {INVITE_TAG} to Team {INVITE_TEAM} ==")

    # Click INVITE button in lobby toolbar
    if not await actions.click_text("INVITE", detector, retries=3):
        log("ABORT: INVITE button not found")
        return False
    log("Clicked INVITE")
    await asyncio.sleep(2)

    ocr_dump(detector, "Invite dialog opened")

    # Look for team selector — default is "BOTH", need to change to TEAM 2
    # Click the team dropdown
    pos = detector.find_text("BOTH", rescan=False)
    if pos:
        log(f"Found BOTH (team dropdown) at {pos}")
        await actions.click(*pos)
        await asyncio.sleep(1)
        ocr_dump(detector, "Team dropdown opened")

        # Select Team 2
        team_label = f"TEAM {INVITE_TEAM}"
        pos = detector.find_text(team_label, retries=2)
        if pos:
            log(f"Found {team_label} at {pos}")
            await actions.click(*pos)
            await asyncio.sleep(1)
        else:
            log(f"WARNING: {team_label} not found in dropdown, using BOTH")
    else:
        log("BOTH not found — invite dialog may look different, continuing")
        ocr_dump(detector, "Looking for team controls")

    # Click INVITE VIA BATTLETAG or BATTLETAG button
    for label in ["BATTLETAG", "INVITE VIA"]:
        pos = detector.find_text(label, retries=2)
        if pos:
            log(f"Found {label} at {pos}")
            await actions.click(*pos)
            await asyncio.sleep(1)
            break
    else:
        log("WARNING: BATTLETAG button not found, trying to type anyway")

    ocr_dump(detector, "Before typing BattleTag")

    # Paste the BattleTag
    await actions.paste_text(INVITE_TAG)
    await asyncio.sleep(0.5)
    log(f"Pasted: {INVITE_TAG}")

    ocr_dump(detector, "After pasting BattleTag")

    # Submit the invite — press Enter (standard OW submit for BattleTag input)
    await actions.press_key("enter")
    await asyncio.sleep(2)
    log("Pressed Enter to send invite")

    ocr_dump(detector, "After sending invite")

    # Close invite dialog
    await actions.press_key("escape")
    await asyncio.sleep(1)

    screen = ocr_dump(detector, "After closing invite dialog")
    if screen == Screen.UNKNOWN:
        await actions.press_key("escape")
        await asyncio.sleep(1)
        screen = ocr_dump(detector, "After 2nd ESC from invite")

    log("Invite flow complete")
    return True


async def start_match(wm, instance_id, detector):
    """Click START to begin the match."""
    await focus_window(wm, instance_id)
    log("")
    log("== Start Match ==")

    if not await actions.click_text("START", detector, retries=3):
        log("ABORT: START not found")
        return False
    log("Clicked START")
    await asyncio.sleep(5)

    screen = ocr_dump(detector, "After START")

    # Hero select / CONTINUE screen — OW shows CONTINUE or CONFIRM
    log("Looking for hero select screen...")
    await asyncio.sleep(5)
    ocr_dump(detector, "Hero select wait")

    # Click CONTINUE or CONFIRM (whichever appears)
    for label in ["CONTINUE", "CONFIRM"]:
        pos = detector.find_text(label, retries=2)
        if pos:
            log(f"Found {label} at {pos}")
            await actions.click(*pos)
            await asyncio.sleep(3)
            break
    else:
        log("CONTINUE/CONFIRM not found — pressing Enter as fallback")
        await actions.press_key("enter")
        await asyncio.sleep(3)

    ocr_dump(detector, "After CONTINUE/CONFIRM")

    # There may be multiple CONTINUE screens (hero select → assemble → spawn)
    for i in range(3):
        await asyncio.sleep(5)
        pos = detector.find_text("CONTINUE")
        if pos:
            log(f"Additional CONTINUE at {pos} — clicking")
            await actions.click(*pos)
            await asyncio.sleep(3)
        else:
            break

    # Wait for game to load / spawn
    log("Waiting 15s for game to load...")
    await asyncio.sleep(15)
    ocr_dump(detector, "In game (after spawn)")

    return True


async def trigger_team_win(wm, instance_id, detector):
    """Press Ability 2 (E) to trigger Team 1 Win via admin rule."""
    await focus_window(wm, instance_id)
    log("")
    log("== Trigger Team 1 Win (press E / Ability 2) ==")
    await actions.click(640, 360, delay=0.5)
    await asyncio.sleep(0.5)

    # Hold E for 2 seconds (Ability 2 = Team 1 Wins)
    log("Holding E key...")
    pyautogui.keyDown('e')
    await asyncio.sleep(2)
    pyautogui.keyUp('e')
    log("Released E")
    await asyncio.sleep(3)

    ocr_dump(detector, "After Ability 2 (Team 1 Win command)")

    # Wait for victory + POTG + cards + stats (full post-match sequence ~45s)
    log("Waiting 10s for victory declaration...")
    await asyncio.sleep(10)
    ocr_dump(detector, "Victory declaration")

    log("Waiting 35s for POTG + cards + stats to finish...")
    await asyncio.sleep(35)
    screen = ocr_dump(detector, "Post-match end")

    return True


async def check_workshop_logs(wm, instance_id, detector):
    """Open ESC menu → Workshop Inspector to check logs."""
    await focus_window(wm, instance_id)
    log("")
    log("== Check Workshop Logs ==")

    # After match end, wait for result screen
    await asyncio.sleep(5)
    ocr_dump(detector, "Result screen")

    # Press ESC to open overlay menu
    await actions.press_key("escape")
    await asyncio.sleep(2)
    screen = ocr_dump(detector, "Overlay menu")

    # Look for OPEN WORKSHOP INSPECTOR
    pos = detector.find_text("WORKSHOP INSPECTOR", rescan=False)
    if pos:
        log(f"Found WORKSHOP INSPECTOR at {pos}")
        await actions.click(*pos)
        await asyncio.sleep(3)
        ocr_dump(detector, "Workshop Inspector opened")
    else:
        pos = detector.find_text("WORKSHOP", rescan=False)
        if pos:
            log(f"Found WORKSHOP at {pos}")
            await actions.click(*pos)
            await asyncio.sleep(3)
            ocr_dump(detector, "Workshop panel opened")
        else:
            log("Workshop Inspector not found in menu")

    # Take a final diagnostic dump
    await asyncio.sleep(2)
    ocr_dump(detector, "Final state")

    return True


async def main():
    LOG.write_text("")
    log("=" * 50)
    log("  Full End-to-End PUG Flow Test")
    log(f"  Invite: {INVITE_TAG} → Team {INVITE_TEAM}")
    log("=" * 50)

    # Focus OW window
    from automation.window_manager import WindowManager
    wm = WindowManager()
    windows = wm.discover_windows()
    if not windows:
        log("ABORT: No Overwatch windows found")
        return
    ow = windows[0]
    log(f"OW window: {ow.label} (PID={ow.pid}, region={ow.region})")

    iid = ow.instance_id
    detector = ScreenDetector(region=ow.region)

    # STEP 0: Get to main menu
    log("")
    log("=" * 40)
    log("  STEP 0: Navigate to Main Menu")
    log("=" * 40)
    if not await navigate_to_main_menu(wm, iid, detector):
        log("ABORT: Could not reach main menu")
        return

    # STEP 1: Navigate to lobby
    log("")
    log("=" * 40)
    log("  STEP 1: Create Custom Game Lobby")
    log("=" * 40)
    if not await navigate_to_lobby(wm, iid, detector):
        log("ABORT: Could not create lobby")
        return

    # STEP 2: Import Workshop code
    log("")
    log("=" * 40)
    log("  STEP 2: Import Workshop Code")
    log("=" * 40)
    if not await import_workshop_code(wm, iid, detector):
        log("ABORT: Workshop import failed")
        return

    # STEP 3: Invite player
    log("")
    log("=" * 40)
    log("  STEP 3: Invite Player")
    log("=" * 40)
    if not await invite_player(wm, iid, detector):
        log("WARNING: Invite may have failed, continuing anyway")

    # STEP 4: Start match
    log("")
    log("=" * 40)
    log("  STEP 4: Start Match")
    log("=" * 40)
    if not await start_match(wm, iid, detector):
        log("ABORT: Could not start match")
        return

    # STEP 5: Trigger team win
    log("")
    log("=" * 40)
    log("  STEP 5: Trigger Team 1 Win")
    log("=" * 40)
    await trigger_team_win(wm, iid, detector)

    # STEP 6: Check Workshop logs
    log("")
    log("=" * 40)
    log("  STEP 6: Check Workshop Logs")
    log("=" * 40)
    await check_workshop_logs(wm, iid, detector)

    log("")
    log("=" * 50)
    log("  FULL FLOW COMPLETE")
    log("=" * 50)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        import traceback
        log(traceback.format_exc())
