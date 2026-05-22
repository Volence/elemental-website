import asyncio
import logging
import random

import pyautogui
import pyperclip

log = logging.getLogger("ow-bot.actions")

pyautogui.FAILSAFE = False  # Disabled: bot runs headless via scheduled task, mouse starts at (0,0)
pyautogui.PAUSE = 0.05


def _human_delay(base: float = 0.1, variance: float = 0.05) -> float:
    return base + random.uniform(0, variance)


async def click(x: int, y: int, delay: float = 0.1):
    pyautogui.click(x, y)
    await asyncio.sleep(_human_delay(delay))


async def double_click(x: int, y: int, delay: float = 0.15):
    pyautogui.doubleClick(x, y)
    await asyncio.sleep(_human_delay(delay))


async def type_text(text: str, interval: float = 0.03):
    pyautogui.typewrite(text, interval=interval + random.uniform(0, 0.02))
    await asyncio.sleep(_human_delay(0.05))


async def paste_text(text: str):
    pyperclip.copy(text)
    await asyncio.sleep(0.05)
    pyautogui.hotkey("ctrl", "v")
    await asyncio.sleep(_human_delay(0.15))


async def press_key(key: str, duration: float = 0.2):
    pyautogui.keyDown(key)
    await asyncio.sleep(duration)
    pyautogui.keyUp(key)
    await asyncio.sleep(_human_delay(0.05))


async def hotkey(*keys: str, delay: float = 0.1):
    pyautogui.hotkey(*keys)
    await asyncio.sleep(_human_delay(delay))


async def move_to(x: int, y: int):
    pyautogui.moveTo(x, y, duration=random.uniform(0.1, 0.2))


async def scroll_at(x: int, y: int, clicks: int = 3):
    pyautogui.scroll(clicks, x=x, y=y)
    await asyncio.sleep(_human_delay(0.1))
