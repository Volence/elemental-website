"""Window management for multi-instance OW automation.

Handles window discovery, labeling, focus management, and per-window operations.
Uses Win32 API via ctypes to avoid external dependencies.
"""

import ctypes
import ctypes.wintypes
import logging
import time
from dataclasses import dataclass, field

import pyautogui

logger = logging.getLogger(__name__)

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# Win32 constants
SW_MINIMIZE = 6
SW_RESTORE = 9
GWL_STYLE = -16
WS_MINIMIZE = 0x20000000


@dataclass
class OWWindow:
    """Represents a tracked Overwatch window."""
    hwnd: int
    pid: int
    instance_id: str
    label: str  # e.g., "Overwatch 1"
    # Screen region for this window (x, y, w, h) - set after positioning
    region: tuple[int, int, int, int] = (0, 0, 1280, 720)

    @property
    def is_valid(self) -> bool:
        """Check if the window handle is still valid."""
        return bool(user32.IsWindow(self.hwnd))

    @property
    def is_foreground(self) -> bool:
        """Check if this window is currently in the foreground."""
        return user32.GetForegroundWindow() == self.hwnd


class WindowManager:
    """Manages multiple Overwatch windows for concurrent automation."""

    def __init__(self):
        self._windows: dict[str, OWWindow] = {}  # instance_id -> OWWindow
        # Set up ctypes function signatures for 64-bit safety
        self._setup_ctypes()

    def _setup_ctypes(self):
        """Configure ctypes function signatures."""
        user32.SetWindowTextW.argtypes = [ctypes.wintypes.HWND, ctypes.wintypes.LPCWSTR]
        user32.SetWindowTextW.restype = ctypes.wintypes.BOOL
        user32.GetForegroundWindow.restype = ctypes.wintypes.HWND
        user32.SetForegroundWindow.argtypes = [ctypes.wintypes.HWND]
        user32.SetForegroundWindow.restype = ctypes.wintypes.BOOL
        user32.ShowWindow.argtypes = [ctypes.wintypes.HWND, ctypes.c_int]
        user32.ShowWindow.restype = ctypes.wintypes.BOOL
        user32.GetWindowRect.argtypes = [ctypes.wintypes.HWND, ctypes.POINTER(ctypes.wintypes.RECT)]
        user32.MoveWindow.argtypes = [
            ctypes.wintypes.HWND, ctypes.c_int, ctypes.c_int,
            ctypes.c_int, ctypes.c_int, ctypes.wintypes.BOOL,
        ]

    def discover_windows(self) -> list[OWWindow]:
        """Find all Overwatch windows and register them."""
        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM,
        )
        found = []

        def callback(hwnd, lparam):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                if buf.value.startswith("Overwatch"):
                    pid = ctypes.wintypes.DWORD()
                    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                    rect = ctypes.wintypes.RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(rect))
                    found.append({
                        "hwnd": hwnd,
                        "pid": pid.value,
                        "title": buf.value,
                        "x": rect.left,
                        "y": rect.top,
                        "w": rect.right - rect.left,
                        "h": rect.bottom - rect.top,
                    })
            return True

        user32.EnumWindows(EnumWindowsProc(callback), 0)
        found.sort(key=lambda w: w["pid"])

        for i, win in enumerate(found):
            instance_id = f"ow_{i + 1}"
            label = f"Overwatch {i + 1}"
            ow_win = OWWindow(
                hwnd=win["hwnd"],
                pid=win["pid"],
                instance_id=instance_id,
                label=label,
                region=(win["x"], win["y"], win["w"], win["h"]),
            )
            self._windows[instance_id] = ow_win
            # Set the title bar
            user32.SetWindowTextW(win["hwnd"], label)
            logger.info(
                f"Registered {label}: PID={win['pid']}, "
                f"pos=({win['x']},{win['y']}), size={win['w']}x{win['h']}"
            )

        return list(self._windows.values())

    def register_window(self, instance_id: str, hwnd: int, pid: int) -> OWWindow:
        """Manually register a window (e.g., after launching a new OW instance)."""
        index = len(self._windows) + 1
        label = f"Overwatch {index}"
        rect = ctypes.wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))

        ow_win = OWWindow(
            hwnd=hwnd,
            pid=pid,
            instance_id=instance_id,
            label=label,
            region=(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top),
        )
        self._windows[instance_id] = ow_win
        user32.SetWindowTextW(hwnd, label)
        logger.info(f"Registered {label}: PID={pid}")
        return ow_win

    def get_window(self, instance_id: str) -> OWWindow | None:
        """Get a tracked window by instance ID."""
        return self._windows.get(instance_id)

    def get_all_windows(self) -> list[OWWindow]:
        """Get all tracked windows."""
        return list(self._windows.values())

    def remove_window(self, instance_id: str):
        """Remove a window from tracking."""
        self._windows.pop(instance_id, None)

    def focus_window(self, instance_id: str) -> bool:
        """Bring a window to the foreground. Returns True if successful.

        DirectX games (like OW) aggressively hold focus, so simple
        SetForegroundWindow often fails when switching between game
        windows. We use a minimize-then-restore approach: minimize
        the CURRENTLY focused game window first, then restore and
        focus the target window.
        """
        win = self._windows.get(instance_id)
        if not win or not win.is_valid:
            logger.warning(f"Cannot focus {instance_id}: window not found or invalid")
            return False

        if win.is_foreground:
            return True

        # Step 1: Minimize whichever game window currently has focus
        # This releases the DirectX exclusive focus lock
        current_fg = user32.GetForegroundWindow()
        for other in self._windows.values():
            if other.hwnd == current_fg and other.instance_id != instance_id:
                logger.debug(f"Minimizing {other.label} to release focus")
                user32.ShowWindow(other.hwnd, 6)  # SW_MINIMIZE
                time.sleep(0.1)
                break

        # Step 2: Restore target window and bring to front
        user32.ShowWindow(win.hwnd, SW_RESTORE)
        time.sleep(0.1)
        result = user32.SetForegroundWindow(win.hwnd)
        time.sleep(0.3)  # Let DirectX re-render

        if result and win.is_foreground:
            logger.debug(f"Focused {win.label}")
            return True

        # Step 3: Fallback — use AttachThreadInput trick
        if not win.is_foreground:
            logger.debug(f"Trying AttachThreadInput for {win.label}")
            fg_thread = user32.GetWindowThreadProcessId(
                user32.GetForegroundWindow(), None
            )
            target_thread = user32.GetWindowThreadProcessId(win.hwnd, None)
            if fg_thread != target_thread:
                user32.AttachThreadInput(fg_thread, target_thread, True)
                user32.SetForegroundWindow(win.hwnd)
                user32.AttachThreadInput(fg_thread, target_thread, False)
                time.sleep(0.3)

        success = win.is_foreground
        if success:
            logger.debug(f"Focused {win.label} (via AttachThreadInput)")
        else:
            logger.warning(f"Focus failed for {win.label}")
        return success

    def screenshot(self, instance_id: str) -> "Image | None":
        """Take a screenshot of a specific instance's region.

        NOTE: The window must be in the foreground for DirectX games.
        Use focus_window() first.
        """
        win = self._windows.get(instance_id)
        if not win:
            return None

        rect = ctypes.wintypes.RECT()
        user32.GetWindowRect(win.hwnd, ctypes.byref(rect))
        # Update stored region
        x, y = rect.left, rect.top
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        win.region = (max(0, x), max(0, y), w, h)

        return pyautogui.screenshot(region=win.region)

    def position_windows(self, layout: str = "stacked"):
        """Position OW windows for multi-instance operation.

        Layouts:
            stacked: All windows at same position (only one visible at a time)
            tiled: Side-by-side (needs wide display)
        """
        windows = list(self._windows.values())
        if not windows:
            return

        if layout == "stacked":
            for win in windows:
                user32.MoveWindow(win.hwnd, 0, 0, 1280, 720, True)
                win.region = (0, 0, 1280, 720)
                logger.info(f"Positioned {win.label} at (0, 0, 1280, 720)")
        elif layout == "tiled":
            for i, win in enumerate(windows):
                x = i * 640
                user32.MoveWindow(win.hwnd, x, 0, 640, 480, True)
                win.region = (x, 0, 640, 480)
                logger.info(f"Positioned {win.label} at ({x}, 0, 640, 480)")


# Singleton
window_manager = WindowManager()
