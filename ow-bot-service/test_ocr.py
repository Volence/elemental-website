"""Quick OCR smoke test — run via schtasks to access the desktop."""
import sys
sys.path.insert(0, "C:/ow-bot-service")

from pathlib import Path
from automation.screens import ScreenDetector

LOG = Path("C:/ow-bot-service/ocr_test.log")

def log(msg):
    line = f"{msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def main():
    log("=== OCR Smoke Test ===")
    d = ScreenDetector((0, 0, 1280, 720))

    log("Running find_all_text()...")
    results = d.find_all_text()
    log(f"{len(results)} texts found:")
    for text, pos, conf in results:
        log(f"  {text!r:30s} at {pos}  conf={conf:.2f}")

    log("")
    log("Running detect_screen()...")
    screen = d.detect_screen()
    log(f"Detected screen: {screen.value}")
    log("=== Done ===")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        with open(LOG, "a") as f:
            f.write(traceback.format_exc())
        traceback.print_exc()
