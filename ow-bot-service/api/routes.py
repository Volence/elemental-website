import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
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


class CommandRequest(BaseModel):
    command: Literal["pause", "unpause", "end_game"]


class InstanceInfo(BaseModel):
    id: str
    state: str
    pugLobbyId: int | None = None
    account: str


class HealthResponse(BaseModel):
    status: str
    instances: int
    idle: int
    inGame: int


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
    await instance_manager.send_command(instance.id, req.command)
    return {"ok": True}


@router.get("/instances", response_model=list[InstanceInfo])
async def list_instances():
    return [
        InstanceInfo(
            id=inst.id,
            state=inst.state.value,
            pugLobbyId=inst.pug_lobby_id,
            account=inst.account_email,
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
