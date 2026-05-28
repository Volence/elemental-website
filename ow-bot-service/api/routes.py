import base64
import io
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from api.auth import require_bot_secret
from instances.manager import instance_manager

log = logging.getLogger("ow-bot.api")

router = APIRouter(dependencies=[Depends(require_bot_secret)])


# ── Request/Response models ──


class WarmupRequest(BaseModel):
    pugLobbyId: int | None = None


class WarmupResponse(BaseModel):
    instanceId: str
    status: str


class ShutdownRequest(BaseModel):
    instanceId: str | None = None


class PlayerInfo(BaseModel):
    userId: int
    battleTag: str | None = None
    team: Literal[1, 2]


class LobbyPrepareRequest(BaseModel):
    pugLobbyId: int
    lobbyNumber: int


class LobbyConfigureRequest(BaseModel):
    pugLobbyId: int
    fullCode: str
    players: list[PlayerInfo]


class LobbyCreateRequest(BaseModel):
    pugLobbyId: int
    lobbyNumber: int
    fullCode: str
    players: list[PlayerInfo]


class LobbyCreateResponse(BaseModel):
    instanceId: str
    status: str


class LobbyStatusResponse(BaseModel):
    instanceId: str
    state: str
    playersJoined: int
    startedAt: str | None = None
    liveStats: dict | None = None


class CommandRequest(BaseModel):
    command: Literal["pause", "unpause", "end_draw", "end_team1", "end_team2"]


class InstanceInfo(BaseModel):
    id: str
    state: str
    pugLobbyId: int | None = None
    account: str
    battleTag: str | None = None
    liveStats: dict | None = None


class HealthResponse(BaseModel):
    status: str
    instances: int
    idle: int
    inGame: int


class StepPlayerInfo(BaseModel):
    userId: int = 0
    battleTag: str
    team: Literal[0, 1, 2]  # 0=spectator, 1=team1, 2=team2


class StepRequest(BaseModel):
    command: Literal["create_custom_game", "start_game", "import_code", "invite_players", "pause", "unpause", "end_draw", "end_team1", "end_team2", "debug_import", "navigate"]
    code: str | None = None
    players: list[StepPlayerInfo] | None = None


class DeployFileRequest(BaseModel):
    path: str
    content: str
    restart: bool = False


# ── Endpoints ──


@router.post("/instance/warmup", response_model=WarmupResponse)
async def warmup_instance(req: WarmupRequest):
    instance = await instance_manager.warmup(req.pugLobbyId)
    if not instance:
        raise HTTPException(status_code=503, detail="no_available_instance")
    return WarmupResponse(instanceId=instance.id, status=instance.state.value)


@router.post("/instance/shutdown")
async def shutdown_instance(req: ShutdownRequest):
    if req.instanceId:
        await instance_manager.shutdown_instance(req.instanceId)
    else:
        await instance_manager.shutdown_idle()
    return {"ok": True}


@router.post("/lobby/prepare", response_model=LobbyCreateResponse)
async def prepare_lobby(req: LobbyPrepareRequest):
    instance = await instance_manager.prepare_lobby(
        pug_lobby_id=req.pugLobbyId,
        lobby_number=req.lobbyNumber,
    )
    if not instance:
        raise HTTPException(status_code=503, detail="no_idle_instance")
    return LobbyCreateResponse(instanceId=instance.id, status=instance.state.value)


@router.post("/lobby/configure", response_model=LobbyCreateResponse)
async def configure_lobby(req: LobbyConfigureRequest):
    instance = await instance_manager.configure_lobby(
        pug_lobby_id=req.pugLobbyId,
        full_code=req.fullCode,
        players=[(p.userId, p.battleTag, p.team) for p in req.players],
    )
    if not instance:
        raise HTTPException(status_code=503, detail="no_prepared_instance")
    return LobbyCreateResponse(instanceId=instance.id, status=instance.state.value)


@router.post("/lobby/create", response_model=LobbyCreateResponse)
async def create_lobby(req: LobbyCreateRequest):
    instance = await instance_manager.create_lobby(
        pug_lobby_id=req.pugLobbyId,
        lobby_number=req.lobbyNumber,
        full_code=req.fullCode,
        players=[(p.userId, p.battleTag, p.team) for p in req.players],
    )
    if not instance:
        raise HTTPException(status_code=503, detail="no_idle_instance")
    return LobbyCreateResponse(instanceId=instance.id, status=instance.state.value)


@router.get("/lobby/{pug_lobby_id}/status", response_model=LobbyStatusResponse)
async def lobby_status(pug_lobby_id: int):
    instance = instance_manager.get_by_lobby(pug_lobby_id)
    if not instance:
        raise HTTPException(status_code=404, detail="No instance assigned to this lobby")
    return LobbyStatusResponse(
        instanceId=instance.id,
        state=instance.state.value,
        playersJoined=instance.players_joined,
        startedAt=instance.started_at.isoformat() if instance.started_at else None,
        liveStats=instance.live_stats,
    )


@router.post("/lobby/{pug_lobby_id}/cancel")
async def cancel_lobby(pug_lobby_id: int):
    instance = instance_manager.get_by_lobby(pug_lobby_id)
    if not instance:
        raise HTTPException(status_code=404, detail="No instance assigned to this lobby")
    await instance_manager.cancel_lobby(instance.id)
    return {"ok": True}


@router.post("/lobby/{pug_lobby_id}/command")
async def send_command(pug_lobby_id: int, req: CommandRequest):
    instance = instance_manager.get_by_lobby(pug_lobby_id)
    if not instance:
        raise HTTPException(status_code=404, detail="No instance assigned to this lobby")
    from automation.scheduler import scheduler
    async with scheduler.focus_lock:
        if req.command in ("end_draw", "end_team1", "end_team2"):
            from automation.controller import LobbyController
            controller = LobbyController(instance)
            await controller.send_admin_command(req.command)
        else:
            await instance_manager.send_command(instance.id, req.command)
    return {"ok": True}


@router.post("/instance/{instance_id}/recover")
async def recover_instance(instance_id: str):
    inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    await inst.recover()
    return {"ok": True, "state": inst.state.value}


@router.post("/instance/{instance_id}/sync")
async def sync_instance(instance_id: str):
    """Detect actual OW screen and update instance state to match."""
    inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    from automation.scheduler import scheduler
    try:
        async with scheduler.focus_lock:
            screen, old_state, new_state = await inst.sync_state()
        return {"ok": True, "screen": screen, "oldState": old_state, "newState": new_state}
    except Exception as e:
        log.exception("[%s] sync_state failed", instance_id)
        raise HTTPException(status_code=500, detail=f"Sync failed: {type(e).__name__}: {e}")


@router.get("/instances", response_model=list[InstanceInfo])
async def list_instances():
    return [
        InstanceInfo(
            id=inst.id,
            state=inst.state.value,
            pugLobbyId=inst.pug_lobby_id,
            account=inst.account_email,
            battleTag=inst.account.battle_tag or None,
            liveStats=inst.live_stats,
        )
        for inst in instance_manager.instances
    ]


@router.get("/health", response_model=HealthResponse)
async def health_check():
    instances = instance_manager.instances
    return HealthResponse(
        status="ok",
        instances=len(instances),
        idle=sum(1 for i in instances if i.is_available),
        inGame=sum(1 for i in instances if i.is_in_game),
    )


@router.post("/instance/{instance_id}/step")
async def instance_step(instance_id: str, req: StepRequest):
    """Execute a single lobby automation step on an instance.

    Acquires the scheduler's focus lock so health checks and other
    scheduler tasks can't steal focus while a manual step runs.
    """
    inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    from automation.controller import LobbyController
    from automation.screens import Screen
    from automation.scheduler import scheduler

    controller = LobbyController(inst)

    # Hold the focus lock for the entire step so the scheduler's
    # health checks / warmups can't steal the foreground window.
    async with scheduler.focus_lock:
        if req.command == "create_custom_game":
            if inst.state.value not in ("ready", "available"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Instance must be ready or available, currently {inst.state.value}",
                )
            log.info("[%s] Step: create_custom_game", instance_id)
            await controller.navigate_to(Screen.MAIN_MENU)
            await controller._create_new_lobby()
            await controller._move_to_spectator()
            from instances.instance import InstanceState
            inst.state = InstanceState.CREATING_LOBBY
            return {"ok": True, "state": inst.state.value, "step": "create_custom_game"}

        elif req.command == "import_code":
            if not req.code:
                raise HTTPException(status_code=400, detail="code is required for import_code")
            log.info("[%s] Step: import_code (%d chars)", instance_id, len(req.code))
            await controller._import_settings(req.code)
            await controller.navigate_to(Screen.LOBBY)
            return {"ok": True, "state": inst.state.value, "step": "import_code"}

        elif req.command == "start_game":
            log.info("[%s] Step: start_game", instance_id)
            await controller.start_game()
            inst.on_game_started()
            return {"ok": True, "state": inst.state.value, "step": "start_game"}

        elif req.command == "invite_players":
            if not req.players or len(req.players) == 0:
                raise HTTPException(status_code=400, detail="players list is required for invite_players")
            log.info("[%s] Step: invite_players (%d players)", instance_id, len(req.players))
            players_tuples = [(p.userId, p.battleTag, p.team) for p in req.players]
            result = await controller.invite_players(
                players_tuples, join_timeout=5, poll_interval=5, max_reinvites=0,
            )
            return {
                "ok": True,
                "state": inst.state.value,
                "step": "invite_players",
                "joined": result.joined,
                "total": result.total,
                "failedInvites": result.failed_invites,
                "missingTags": result.missing_tags,
                "timedOut": result.timed_out,
            }

        elif req.command in ("pause", "unpause", "end_draw", "end_team1", "end_team2"):
            log.info("[%s] Step: %s", instance_id, req.command)
            await controller.send_admin_command(req.command)
            return {"ok": True, "state": inst.state.value, "step": req.command}

        elif req.command == "debug_import":
            # Debug: navigate to settings, set clipboard, scan for orange,
            # save screenshot, and return analysis without clicking anything
            log.info("[%s] Step: debug_import", instance_id)
            import asyncio
            import numpy as np
            from scipy import ndimage
            from automation.actions import click_text as act_click_text

            code = (req.code or "").lstrip("﻿")
            if not code:
                code = "settings\n{\n  main\n  {\n    Description: \"Debug Test\"\n  }\n}"

            from automation import background_input as bg

            # Set clipboard first
            bg.set_clipboard(code)
            await asyncio.sleep(1)

            # Check current screen
            screen = controller.detector.detect_screen()
            if screen != Screen.SETTINGS:
                # Navigate to settings
                if not await act_click_text("SETTIN", controller.detector, retries=3):
                    return {"ok": False, "error": "SETTINGS not found", "screen": screen.value}
                await asyncio.sleep(3)

            # Re-set clipboard
            bg.set_clipboard(code)
            await asyncio.sleep(4)

            # Take screenshot
            img = controller.detector.screenshot()

            # Save to file for analysis
            debug_path = "C:\\ow-bot-service\\logs\\debug_settings.png"
            try:
                img.save(debug_path)
                log.info("[%s] Saved debug screenshot to %s", instance_id, debug_path)
            except Exception as e:
                log.warning("[%s] Failed to save debug screenshot: %s", instance_id, e)
                debug_path = None

            # Analyze orange pixels
            arr = np.array(img)
            r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
            mask = (r > 180) & (g > 40) & (g < 150) & (b < 100)
            labeled, num_features = ndimage.label(mask)

            clusters_info = []
            for i in range(1, num_features + 1):
                cluster = np.argwhere(labeled == i)
                cy = int(np.mean(cluster[:, 0]))
                cx = int(np.mean(cluster[:, 1]))
                size = len(cluster)
                # Sample a few pixel colors from this cluster
                sample_colors = []
                for idx in range(min(3, len(cluster))):
                    py, px = cluster[idx]
                    sample_colors.append({
                        "r": int(arr[py, px, 0]),
                        "g": int(arr[py, px, 1]),
                        "b": int(arr[py, px, 2]),
                    })
                clusters_info.append({
                    "size": size, "cx": cx, "cy": cy,
                    "sampleColors": sample_colors,
                })
            clusters_info.sort(key=lambda c: c["size"], reverse=True)

            # Also find text on screen for context
            all_text = controller.detector.find_all_text()
            texts = [(t, (int(p[0]), int(p[1])), float(c)) for t, p, c in all_text[:20]]

            # ESC back to lobby
            from automation.actions import press_key as pk
            await pk("escape")
            await asyncio.sleep(1)

            return {
                "ok": True,
                "step": "debug_import",
                "clipboardChars": len(code),
                "orangeClusters": clusters_info[:10],
                "totalOrangePixels": int(mask.sum()),
                "imageSize": list(img.size),
                "screenshotSaved": debug_path,
                "textsFound": texts,
            }

        elif req.command == "navigate":
            # Navigate to a target screen (default: lobby).
            # Useful for dismissing overlays like loot boxes.
            import asyncio
            from automation.actions import press_key as pk

            target_name = req.code or "lobby"
            target_map = {
                "lobby": Screen.LOBBY,
                "main_menu": Screen.MAIN_MENU,
                "settings": Screen.SETTINGS,
            }
            target = target_map.get(target_name, Screen.LOBBY)
            log.info("[%s] Step: navigate to %s", instance_id, target_name)

            await controller._focus()
            # Press ESC a few times to dismiss overlays
            for _ in range(5):
                screen = controller.detector.detect_screen()
                if screen == target:
                    break
                if screen == Screen.UNKNOWN:
                    await pk("escape")
                    await asyncio.sleep(1.5)
                else:
                    break

            screen = controller.detector.detect_screen()
            if screen != target and screen != Screen.UNKNOWN:
                try:
                    await controller.navigate_to(target)
                    screen = controller.detector.detect_screen()
                except Exception as e:
                    return {"ok": False, "error": str(e), "screen": screen.value}

            return {"ok": True, "state": inst.state.value, "step": "navigate", "screen": screen.value}

    raise HTTPException(status_code=400, detail=f"Unknown command: {req.command}")


@router.get("/instance/{instance_id}/screenshot")
async def instance_screenshot(instance_id: str):
    """Return a JPEG screenshot of the desktop."""
    inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    try:
        import pyautogui

        img = pyautogui.screenshot()
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        return Response(content=buf.getvalue(), media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/instance/{instance_id}/debug-invite")
async def debug_invite(instance_id: str):
    """Click INVITE in lobby and return screenshot + OCR with positions."""
    import asyncio

    inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    from automation.controller import LobbyController
    from automation.actions import click, press_key
    from automation.scheduler import scheduler

    controller = LobbyController(inst)

    async with scheduler.focus_lock:
        await controller._focus()

        pos = controller.detector.find_text("INVITE", retries=3)
        if not pos:
            raise HTTPException(status_code=400, detail="INVITE text not found on screen")
        await click(*pos)
        await asyncio.sleep(3)

        import pyautogui
        img = pyautogui.screenshot()

        results = controller.detector.scan(img)
        texts = [
            {"text": t, "confidence": round(c, 2), "x": int((b[0][0] + b[2][0]) / 2), "y": int((b[0][1] + b[2][1]) / 2)}
            for b, t, c in results if c > 0.3
        ]

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        await press_key("escape")

    return {"image": img_b64, "ocr_texts": texts}


class InputTestRequest(BaseModel):
    method: Literal[
        "pyautogui_press",
        "pyautogui_long",
        "keybd_event",
        "sendinput_scancode",
        "postmessage",
        "focus_click_press",
        "repeated",
    ]
    key: str = "f"
    instanceId: str | None = None


@router.post("/test-input")
async def test_input(req: InputTestRequest):
    """Test different input methods for sending keys to OW."""
    import asyncio
    import ctypes

    instance_id = req.instanceId or (
        instance_manager.instances[0].id if instance_manager.instances else None
    )
    if not instance_id:
        raise HTTPException(status_code=400, detail="No instances available")

    inst = next((i for i in instance_manager.instances if i.id == instance_id), None)
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")

    inst._ensure_window_tracked()
    from automation.window_manager import window_manager

    win = window_manager.get_window(instance_id)
    if not win:
        raise HTTPException(status_code=400, detail="No tracked window for instance")

    window_manager.focus_window(instance_id)
    await asyncio.sleep(0.5)

    vk_code = ord(req.key.upper()) if len(req.key) == 1 else 0x46
    scan_code = ctypes.windll.user32.MapVirtualKeyW(vk_code, 0)

    result = {"method": req.method, "key": req.key, "vk": hex(vk_code), "scan": hex(scan_code)}

    if req.method == "pyautogui_press":
        import pyautogui
        pyautogui.press(req.key)
        result["detail"] = "pyautogui.press() - single quick press"

    elif req.method == "pyautogui_long":
        import pyautogui
        pyautogui.keyDown(req.key)
        await asyncio.sleep(1.0)
        pyautogui.keyUp(req.key)
        result["detail"] = "pyautogui keyDown/keyUp with 1s hold"

    elif req.method == "keybd_event":
        user32 = ctypes.windll.user32
        KEYEVENTF_SCANCODE = 0x0008
        KEYEVENTF_KEYUP = 0x0002
        user32.keybd_event(vk_code, scan_code, KEYEVENTF_SCANCODE, 0)
        await asyncio.sleep(0.5)
        user32.keybd_event(vk_code, scan_code, KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP, 0)
        result["detail"] = "keybd_event with scan code, 500ms hold"

    elif req.method == "sendinput_scancode":
        import ctypes.wintypes

        class KEYBDINPUT(ctypes.Structure):
            _fields_ = [
                ("wVk", ctypes.wintypes.WORD),
                ("wScan", ctypes.wintypes.WORD),
                ("dwFlags", ctypes.wintypes.DWORD),
                ("time", ctypes.wintypes.DWORD),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
            ]

        class INPUT(ctypes.Structure):
            _fields_ = [
                ("type", ctypes.wintypes.DWORD),
                ("ki", KEYBDINPUT),
                ("padding", ctypes.c_ubyte * 8),
            ]

        KEYEVENTF_SCANCODE = 0x0008
        KEYEVENTF_KEYUP = 0x0002
        INPUT_KEYBOARD = 1

        down = INPUT()
        down.type = INPUT_KEYBOARD
        down.ki.wVk = 0
        down.ki.wScan = scan_code
        down.ki.dwFlags = KEYEVENTF_SCANCODE
        down.ki.time = 0
        down.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))

        up = INPUT()
        up.type = INPUT_KEYBOARD
        up.ki.wVk = 0
        up.ki.wScan = scan_code
        up.ki.dwFlags = KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP
        up.ki.time = 0
        up.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))

        ctypes.windll.user32.SendInput(1, ctypes.byref(down), ctypes.sizeof(INPUT))
        await asyncio.sleep(0.5)
        ctypes.windll.user32.SendInput(1, ctypes.byref(up), ctypes.sizeof(INPUT))
        result["detail"] = "SendInput with SCANCODE flag (no VK), 500ms hold"

    elif req.method == "postmessage":
        from automation.background_input import send_key
        send_key(win.hwnd, req.key, hold_ms=500)
        result["detail"] = "PostMessage WM_KEYDOWN/UP, 500ms hold"

    elif req.method == "focus_click_press":
        import pyautogui
        cx = win.region[0] + win.region[2] // 2
        cy = win.region[1] + win.region[3] // 2
        pyautogui.click(cx, cy)
        await asyncio.sleep(0.5)
        pyautogui.click(cx, cy)
        await asyncio.sleep(0.3)
        pyautogui.keyDown(req.key)
        await asyncio.sleep(1.0)
        pyautogui.keyUp(req.key)
        result["detail"] = f"Double click center ({cx},{cy}), wait, then 1s key hold"

    elif req.method == "repeated":
        import pyautogui
        for i in range(5):
            pyautogui.press(req.key)
            await asyncio.sleep(0.15)
        result["detail"] = "5 rapid pyautogui.press() calls"

    log.info("test-input: %s", result)
    return {"ok": True, **result}


@router.post("/debug/clipboard")
async def debug_clipboard():
    """Test clipboard set/read cycle."""
    from automation import background_input
    import ctypes
    import ctypes.wintypes

    test_text = "settings\n{\n\tlobby\n\t{\n\t}\n}"
    ok = background_input.set_clipboard(test_text)

    # Read clipboard back
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    user32.GetClipboardData.restype = ctypes.c_void_p
    user32.GetClipboardData.argtypes = [ctypes.wintypes.UINT]

    read_back = None
    if user32.OpenClipboard(0):
        try:
            h = user32.GetClipboardData(13)  # CF_UNICODETEXT
            if h:
                p = kernel32.GlobalLock(h)
                if p:
                    read_back = ctypes.wstring_at(p)
                    kernel32.GlobalUnlock(h)
        finally:
            user32.CloseClipboard()

    return {
        "set_ok": ok,
        "set_len": len(test_text),
        "read_back_len": len(read_back) if read_back else 0,
        "read_back_preview": read_back[:100] if read_back else None,
        "match": read_back == test_text if read_back else False,
    }


@router.post("/deploy-file")
async def deploy_file(req: DeployFileRequest):
    """Write a file to the bot service directory. For remote code updates."""
    import os
    import pathlib

    base = pathlib.Path(r"C:\ow-bot-service")
    target = (base / req.path).resolve()

    # Safety: only allow writes inside the bot service directory
    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Path must be inside C:\\ow-bot-service")

    # Don't allow writing to .env or auth files
    if target.name in (".env", "auth.py"):
        raise HTTPException(status_code=400, detail="Cannot overwrite protected files")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(req.content, encoding="utf-8")
    log.info("deploy-file: wrote %d bytes to %s", len(req.content), target)

    if req.restart:
        log.info("deploy-file: restart requested, will exit after response")
        import asyncio
        asyncio.get_event_loop().call_later(2.0, os._exit, 0)

    return {"ok": True, "path": str(target), "size": len(req.content)}
