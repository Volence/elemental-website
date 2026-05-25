"""Step-by-step lobby creation with OCR diagnostics at every transition.

Run via schtasks. Logs all OCR results + detected screen at each step.
Tail C:\ow-bot-service\ocr_walkthrough.log via SSH to watch progress.
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

LOG = Path("C:/ow-bot-service/ocr_walkthrough.log")
REGION = (0, 0, 1280, 720)


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ocr_dump(detector: ScreenDetector, step_name: str) -> Screen:
    """Run OCR once, log all text, detect screen from same scan."""
    log(f"")
    log(f"--- OCR @ {step_name} ---")
    results = detector.find_all_text(confidence=0.3)
    for text, pos, conf in results:
        marker = " *" if len(text) <= 25 else ""
        log(f"  {text!r:40s} ({pos[0]:4d}, {pos[1]:4d})  conf={conf:.2f}{marker}")
    screen = detector.detect_screen(rescan=False)
    log(f"  >> detect_screen() = {screen.value}")
    return screen


async def main():
    LOG.write_text("")
    log("========================================")
    log("  OCR Walkthrough Test v2")
    log("  (improved signatures + length filter)")
    log("========================================")

    # Focus OW window before starting (schtask console covers it)
    from automation.window_manager import WindowManager
    wm = WindowManager()
    windows = wm.discover_windows()
    if not windows:
        log("ABORT: No Overwatch windows found")
        return
    ow = windows[0]
    log(f"Found OW window: {ow.label} (PID={ow.pid}, region={ow.region})")
    wm.focus_window(ow.instance_id)
    await asyncio.sleep(1.5)

    region = ow.region
    detector = ScreenDetector(region=region)

    # ── STEP 0: Where are we? ──
    screen = ocr_dump(detector, "STEP 0: Initial state")

    if screen == Screen.UNKNOWN:
        log("Unknown screen — pressing ESC to dismiss overlay")
        await actions.press_key("escape")
        await asyncio.sleep(2)
        screen = ocr_dump(detector, "STEP 0b: After ESC")

    if screen == Screen.LOBBY:
        log("Already at lobby — clicking EXIT to leave")
        await actions.click_text("EXIT", detector, retries=3)
        await asyncio.sleep(2)
        # OW asks "Are you sure?" — need to find and click YES
        pos = detector.find_text("YES", retries=3)
        if pos:
            log(f"Found YES at {pos}, clicking")
            await actions.move_to(*pos)
            await asyncio.sleep(0.3)
            await actions.click(*pos, delay=0.3)
            await asyncio.sleep(5)
        screen = ocr_dump(detector, "STEP 0c: After EXIT+YES")

    if screen != Screen.MAIN_MENU:
        log(f"Not at main menu (at {screen.value}), backing out")
        for i in range(4):
            await actions.press_key("escape")
            await asyncio.sleep(1.5)
            screen = ocr_dump(detector, f"STEP 0d: After ESC #{i+1}")
            if screen == Screen.MAIN_MENU:
                break

    if screen != Screen.MAIN_MENU:
        log(f"ABORT: Cannot reach main menu, stuck at {screen.value}")
        return

    # ── STEP 1: Click PLAY ──
    log("")
    log("== STEP 1: Click PLAY ==")
    pos = await actions.click_text("PLAY", detector, retries=3)
    if not pos:
        log("ABORT: PLAY not found")
        return
    log(f"Clicked PLAY at {pos}")
    await asyncio.sleep(3)
    screen = ocr_dump(detector, "STEP 1: After clicking PLAY")

    if screen != Screen.PLAY_MENU:
        log(f"WARNING: Expected play_menu, got {screen.value}")

    # ── STEP 2: Navigate to Custom Games ──
    # Try multiple approaches: MORE dropdown, scroll down, alt text
    log("")
    log("== STEP 2: Navigate to Custom Games ==")

    custom_found = False

    # Approach 1: Click MORE tab and scan immediately (dropdown may close fast)
    pos = await actions.click_text("MORE", detector, retries=2)
    if pos:
        log(f"Clicked MORE at {pos}")
        await asyncio.sleep(0.3)
        screen = ocr_dump(detector, "STEP 2a: Quick scan after MORE")

        for label in ["CUSTOM", "GAME BROWSER", "BROWSER"]:
            cpos = detector.find_text(label, rescan=False)
            if cpos:
                log(f"Found '{label}' at {cpos} — clicking")
                await actions.move_to(*cpos)
                await asyncio.sleep(0.2)
                await actions.click(*cpos, delay=0.2)
                custom_found = True
                break

        if not custom_found:
            log("Nothing found in quick scan, waiting 2s and rescanning")
            await asyncio.sleep(2)
            screen = ocr_dump(detector, "STEP 2b: Delayed scan after MORE")
            for label in ["CUSTOM", "GAME BROWSER", "BROWSER"]:
                cpos = detector.find_text(label, rescan=False)
                if cpos:
                    log(f"Found '{label}' at {cpos} — clicking")
                    await actions.move_to(*cpos)
                    await asyncio.sleep(0.2)
                    await actions.click(*cpos, delay=0.2)
                    custom_found = True
                    break
    else:
        log("MORE not found")

    # Approach 2: Scroll down in game modes list to reveal CUSTOM GAME
    if not custom_found:
        log("")
        log("== STEP 2c: Scrolling down to look for CUSTOM ==")
        mid_x = region[0] + region[2] // 2
        mid_y = region[1] + region[3] // 2
        for scroll_i in range(4):
            pyautogui.moveTo(mid_x, mid_y)
            await asyncio.sleep(0.1)
            pyautogui.scroll(-3)
            await asyncio.sleep(0.8)
            screen = ocr_dump(detector, f"STEP 2c: After scroll #{scroll_i+1}")
            for label in ["CUSTOM", "GAME BROWSER", "BROWSER"]:
                cpos = detector.find_text(label, rescan=False)
                if cpos:
                    log(f"Found '{label}' at {cpos} after scrolling — clicking")
                    await actions.move_to(*cpos)
                    await asyncio.sleep(0.2)
                    await actions.click(*cpos, delay=0.2)
                    custom_found = True
                    break
            if custom_found:
                break

    if not custom_found:
        log("ABORT: Could not find Custom Games via any approach")
        log("Dumping final OCR for diagnostics:")
        ocr_dump(detector, "STEP 2 FINAL: All approaches exhausted")
        return
    log(f"Navigating to custom games...")
    await asyncio.sleep(3)
    screen = ocr_dump(detector, "STEP 2 result: After clicking custom games")

    if screen != Screen.CUSTOM_GAMES:
        log(f"WARNING: Expected custom_games, got {screen.value}")

    # ── STEP 3: Click CREATE ──
    log("")
    log("== STEP 3: Click CREATE ==")
    pos = await actions.click_text("CREATE", detector, retries=5)
    if not pos:
        log("ABORT: CREATE not found")
        return
    log(f"Clicked CREATE at {pos}")
    await asyncio.sleep(3)
    screen = ocr_dump(detector, "STEP 3: After clicking CREATE")

    if screen == Screen.LOBBY:
        log("SUCCESS: Reached LOBBY screen!")
    else:
        log(f"WARNING: Expected lobby, got {screen.value}")

    # ── STEP 4: Verify lobby buttons ──
    log("")
    log("== STEP 4: Verify lobby UI elements (from cached scan) ==")
    for label in ["SETTINGS", "START", "INVITE", "MOVE", "EXIT", "SPECTATORS"]:
        pos = detector.find_text(label, rescan=False)
        if pos:
            log(f"  FOUND {label:12s} at {pos}")
        else:
            log(f"  MISS  {label}")

    # ── STEP 5: Click SETTINGS ──
    log("")
    log("== STEP 5: Click SETTINGS ==")
    pos = await actions.click_text("SETTINGS", detector, retries=3)
    if not pos:
        log("ABORT: SETTINGS not found")
        return
    log(f"Clicked SETTINGS at {pos}")
    await asyncio.sleep(3)
    screen = ocr_dump(detector, "STEP 5: After clicking SETTINGS")

    # ── STEP 5b: Look for IMPORT (no code in clipboard, so probably not there) ──
    log("")
    log("== STEP 5b: Check for IMPORT button ==")
    pos = detector.find_text("IMPORT", rescan=False)
    if pos:
        log(f"IMPORT found at {pos} (clipboard had code!)")
    else:
        log("IMPORT not found (expected — no Workshop code in clipboard)")

    # ── STEP 6: ESC back to lobby ──
    log("")
    log("== STEP 6: ESC back to lobby ==")
    await actions.press_key("escape")
    await asyncio.sleep(2)
    screen = ocr_dump(detector, "STEP 6: After ESC")

    # If ESC opened the overlay menu, press ESC again to dismiss
    if screen == Screen.UNKNOWN:
        log("Got overlay menu, pressing ESC to dismiss")
        await actions.press_key("escape")
        await asyncio.sleep(2)
        screen = ocr_dump(detector, "STEP 6b: After 2nd ESC")

    # ── STEP 7: Exit lobby via EXIT button ──
    log("")
    log("== STEP 7: Click EXIT to leave lobby ==")
    pos = await actions.click_text("EXIT", detector, retries=3)
    if pos:
        log(f"Clicked EXIT at {pos}")
        await asyncio.sleep(2)
        pos = detector.find_text("YES", retries=3)
        if pos:
            log(f"Found YES at {pos}, clicking")
            await actions.move_to(*pos)
            await asyncio.sleep(0.3)
            await actions.click(*pos, delay=0.3)
            await asyncio.sleep(5)
        screen = ocr_dump(detector, "STEP 7: After EXIT+YES")
    else:
        log("EXIT not found, trying ESC x3")
        for i in range(3):
            await actions.press_key("escape")
            await asyncio.sleep(1.5)
        screen = ocr_dump(detector, "STEP 7 final")

    log("")
    log("========================================")
    log("  WALKTHROUGH COMPLETE")
    log(f"  Final screen: {screen.value}")
    log("========================================")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        import traceback
        log(traceback.format_exc())
