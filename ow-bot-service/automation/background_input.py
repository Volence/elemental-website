"""Background input via Win32 PostMessage.

Sends keyboard and mouse input to specific OW windows without requiring
them to be in the foreground. Keyboard input is confirmed working with OW;
mouse clicks may or may not work depending on OW's input handling.
"""

import ctypes
import ctypes.wintypes
import logging
import time

logger = logging.getLogger(__name__)

user32 = ctypes.windll.user32

# Win32 message constants
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CHAR = 0x0102
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
MK_LBUTTON = 0x0001

# Virtual key codes
VK_MAP = {
    "escape": 0x1B,
    "esc": 0x1B,
    "enter": 0x0D,
    "return": 0x0D,
    "tab": 0x09,
    "space": 0x20,
    "backspace": 0x08,
    "delete": 0x2E,
    "shift": 0x10,
    "ctrl": 0x11,
    "alt": 0x12,
    # Game-relevant keys
    "e": 0x45,  # Ability 2 / Interact
    "q": 0x51,  # Ultimate
    "f": 0x46,  # Interact
    # Navigation
    "up": 0x26,
    "down": 0x28,
    "left": 0x25,
    "right": 0x27,
    # Letters (for typing BattleTags, etc.)
    **{chr(c): c for c in range(0x41, 0x5B)},  # A-Z
    **{chr(c).lower(): c for c in range(0x41, 0x5B)},  # a-z -> same VK
    # Numbers
    **{str(i): 0x30 + i for i in range(10)},
    # Common symbols
    "#": 0xBF,  # OEM key - may need special handling
    "-": 0xBD,
    ".": 0xBE,
    "_": 0xBD,  # shift+minus
}


def send_key(hwnd: int, key: str, hold_ms: int = 50):
    """Send a key press to a window via PostMessage (works in background).

    Args:
        hwnd: Window handle to send to.
        key: Key name (e.g., "escape", "e", "enter").
        hold_ms: How long to hold the key in milliseconds.
    """
    vk = VK_MAP.get(key.lower())
    if vk is None:
        logger.warning(f"Unknown key: {key}")
        return False

    user32.PostMessageW(hwnd, WM_KEYDOWN, vk, 0)
    time.sleep(hold_ms / 1000.0)
    user32.PostMessageW(hwnd, WM_KEYUP, vk, 0)
    logger.debug(f"Sent key '{key}' (VK=0x{vk:02X}) to HWND {hwnd}")
    return True


def send_key_combo(hwnd: int, *keys: str, hold_ms: int = 50):
    """Send a key combination (e.g., Ctrl+V) to a window.

    All modifier keys are held, then the final key is pressed.
    """
    vks = []
    for key in keys:
        vk = VK_MAP.get(key.lower())
        if vk is None:
            logger.warning(f"Unknown key in combo: {key}")
            return False
        vks.append(vk)

    # Press all keys down
    for vk in vks:
        user32.PostMessageW(hwnd, WM_KEYDOWN, vk, 0)
        time.sleep(0.02)

    time.sleep(hold_ms / 1000.0)

    # Release in reverse order
    for vk in reversed(vks):
        user32.PostMessageW(hwnd, WM_KEYUP, vk, 0)
        time.sleep(0.02)

    return True


def send_char(hwnd: int, char: str):
    """Send a single character via WM_CHAR (for text input)."""
    user32.PostMessageW(hwnd, WM_CHAR, ord(char), 0)


def send_text(hwnd: int, text: str, char_delay_ms: int = 30):
    """Type text into a window character by character via WM_CHAR.

    This works for text input fields. For game controls, use send_key instead.
    """
    for char in text:
        send_char(hwnd, char)
        time.sleep(char_delay_ms / 1000.0)
    logger.debug(f"Typed {len(text)} chars to HWND {hwnd}")


def send_click(hwnd: int, x: int, y: int, hold_ms: int = 50) -> bool:
    """Send a mouse click to a window via PostMessage.

    NOTE: This may not work with DirectX games that use raw input.
    Falls back to foreground click if needed.

    Args:
        hwnd: Window handle.
        x, y: Client-area coordinates within the window.
        hold_ms: Click hold duration.
    """
    lparam = (y << 16) | (x & 0xFFFF)
    user32.PostMessageW(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
    time.sleep(hold_ms / 1000.0)
    user32.PostMessageW(hwnd, WM_LBUTTONUP, 0, lparam)
    logger.debug(f"Sent click ({x}, {y}) to HWND {hwnd}")
    return True


def get_clipboard() -> str | None:
    """Read current clipboard text. Returns None if empty or failed."""
    kernel32 = ctypes.windll.kernel32
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalSize.restype = ctypes.c_size_t
    kernel32.GlobalSize.argtypes = [ctypes.c_void_p]
    user32.GetClipboardData.restype = ctypes.c_void_p
    user32.GetClipboardData.argtypes = [ctypes.wintypes.UINT]

    if not user32.OpenClipboard(0):
        logger.error("get_clipboard: OpenClipboard failed")
        return None
    try:
        h = user32.GetClipboardData(13)  # CF_UNICODETEXT
        if not h:
            return None
        p = kernel32.GlobalLock(h)
        if not p:
            return None
        size = kernel32.GlobalSize(h)
        raw = ctypes.string_at(p, size)
        kernel32.GlobalUnlock(h)
        return raw.decode("utf-16-le").rstrip("\x00")
    finally:
        user32.CloseClipboard()


def set_clipboard(text: str) -> bool:
    """Set clipboard text using Win32 API (works from any context)."""
    kernel32 = ctypes.windll.kernel32

    # Set up 64-bit safe function signatures
    kernel32.GlobalAlloc.restype = ctypes.c_void_p
    kernel32.GlobalAlloc.argtypes = [ctypes.wintypes.UINT, ctypes.c_size_t]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    user32.SetClipboardData.restype = ctypes.c_void_p
    user32.SetClipboardData.argtypes = [ctypes.wintypes.UINT, ctypes.c_void_p]

    data = text.encode("utf-16-le") + b"\x00\x00"

    if not user32.OpenClipboard(0):
        logger.error("OpenClipboard failed")
        return False

    try:
        user32.EmptyClipboard()
        h = kernel32.GlobalAlloc(0x0042, len(data))  # GMEM_MOVEABLE | GMEM_ZEROINIT
        if not h:
            logger.error("GlobalAlloc failed")
            return False
        p = kernel32.GlobalLock(h)
        if not p:
            logger.error("GlobalLock failed")
            return False
        ctypes.memmove(p, data, len(data))
        kernel32.GlobalUnlock(h)
        result = user32.SetClipboardData(13, h)  # CF_UNICODETEXT
        if not result:
            logger.error("SetClipboardData failed")
            return False
        return True
    finally:
        user32.CloseClipboard()


def set_clipboard_powershell(text: str) -> bool:
    """Set clipboard via PowerShell as a fallback.

    Uses .NET's System.Windows.Forms.Clipboard which has its own
    message pump and clipboard notification handling. This can work
    better when Win32 API clipboard updates aren't being picked up
    by DirectX applications.
    """
    import subprocess
    import tempfile
    import os

    # Write to temp file first (too large for command line arg)
    tmp_path = "C:/ow-bot-service/_clip_tmp.txt"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(text)
        result = subprocess.run(
            [
                "powershell", "-NoProfile", "-Command",
                f'Get-Content "{tmp_path}" -Raw -Encoding UTF8 | Set-Clipboard',
            ],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            logger.error("PowerShell Set-Clipboard failed: %s", result.stderr.strip())
            return False
        logger.info("PowerShell Set-Clipboard OK")
        return True
    except Exception as e:
        logger.error("PowerShell Set-Clipboard exception: %s", e)
        return False
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def notify_clipboard_change(hwnd: int = 0):
    """Send WM_CLIPBOARDUPDATE to a window to force it to re-check clipboard.

    If hwnd is 0, broadcasts to all top-level windows via HWND_BROADCAST.
    """
    WM_CLIPBOARDUPDATE = 0x031D
    HWND_BROADCAST = 0xFFFF
    target = hwnd or HWND_BROADCAST
    user32.SendMessageW(target, WM_CLIPBOARDUPDATE, 0, 0)
    logger.debug("Sent WM_CLIPBOARDUPDATE to hwnd=%d", target)
