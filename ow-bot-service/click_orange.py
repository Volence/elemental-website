"""Click the orange import button (5th icon under SUMMARY) and complete import."""
import sys, time, asyncio
sys.path.insert(0, "C:/ow-bot-service")

import pyautogui
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

from pathlib import Path
from automation.window_manager import WindowManager
from automation.screens import ScreenDetector, Screen
from automation import actions, background_input

LOG = "C:/ow-bot-service/orange_click.log"
WORKSHOP_CODE = Path("C:/ow-bot-service/full_workshop_code.txt")


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


async def run():
    open(LOG, "w").close()

    wm = WindowManager()
    windows = wm.discover_windows()
    if not windows:
        log("No OW windows found")
        return
    ow = windows[0]
    log(f"Window: {ow.label} region={ow.region}")

    # Ensure clipboard has workshop code
    code = WORKSHOP_CODE.read_text(encoding="utf-8")
    if code.startswith("﻿"):
        code = code[1:]
    background_input.set_clipboard(code)
    log(f"Clipboard set: {len(code)} chars")
    await asyncio.sleep(1)

    # Focus OW
    wm.focus_window(ow.instance_id)
    await asyncio.sleep(1.5)

    det = ScreenDetector(region=ow.region)

    # Verify we're on settings
    screen = det.detect_screen()
    log(f"Current screen: {screen.value}")
    if screen != Screen.SETTINGS:
        log("Not on settings screen — aborting")
        return

    # The orange import button is the 5th icon under SUMMARY
    # Found by color scan at approximately screen(1054, 275)
    # But let's find it dynamically using red-orange color detection
    import numpy as np
    from scipy import ndimage

    img = det.screenshot()
    arr = np.array(img)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Red-orange range matching the actual button color (deeper than standard orange)
    mask = (r > 180) & (g > 40) & (g < 150) & (b < 100)
    labeled, num = ndimage.label(mask)

    best = None
    best_size = 0
    for i in range(1, num + 1):
        c = np.argwhere(labeled == i)
        if len(c) > best_size and len(c) > 20:
            cy = int(np.mean(c[:, 0]))
            if cy < 600:  # not taskbar
                best_size = len(c)
                best = c

    if best is not None:
        cy = int(np.mean(best[:, 0])) + ow.region[1]
        cx = int(np.mean(best[:, 1])) + ow.region[0]
        log(f"Orange import button: {best_size}px at screen({cx},{cy})")
        await actions.click(cx, cy)
        log(f"Clicked import button")
        await asyncio.sleep(3)

        # OCR to see what appeared
        all_text = det.find_all_text(confidence=0.3)
        log("After click:")
        for text, pos, conf in all_text:
            if len(text) <= 25 and conf > 0.4:
                log(f"  {text!r:30s} ({pos[0]:4d},{pos[1]:4d})")

        # Look for IMPORT text button that appears after clicking
        pos = det.find_text("IMPORT", rescan=False)
        if pos:
            log(f"Found IMPORT at {pos} — clicking")
            await actions.click(*pos)
            await asyncio.sleep(3)
            det.scan()
            all_text = det.find_all_text(confidence=0.3, rescan=False)
            log("After IMPORT click:")
            for text, pos2, conf in all_text:
                if len(text) <= 25 and conf > 0.4:
                    log(f"  {text!r:30s} ({pos2[0]:4d},{pos2[1]:4d})")

        # Look for CONFIRM
        pos = det.find_text("CONFIRM", retries=3)
        if pos:
            log(f"Found CONFIRM at {pos} — clicking")
            await actions.click(*pos)
            log("Import initiated! Waiting 35s for Workshop import...")
            await asyncio.sleep(35)

            screen = det.detect_screen()
            log(f"Screen after import wait: {screen.value}")

            # ESC back to lobby
            await actions.press_key("escape")
            await asyncio.sleep(2)
            screen = det.detect_screen()
            log(f"After ESC: {screen.value}")
            if screen == Screen.UNKNOWN:
                await actions.press_key("escape")
                await asyncio.sleep(2)
                screen = det.detect_screen()
                log(f"After 2nd ESC: {screen.value}")

            log("DONE - import complete")
        else:
            log("CONFIRM not found")
    else:
        log("Orange button not found!")


asyncio.run(run())
