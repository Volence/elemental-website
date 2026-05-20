import logging

import httpx

from config import settings

log = logging.getLogger("ow-bot.callbacks")


class CallbackClient:
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=settings.web_app_url,
                headers={"X-Bot-Secret": settings.web_app_secret},
                timeout=15.0,
            )
        return self._client

    async def report_status(
        self,
        pug_lobby_id: int,
        status: str,
        *,
        players_joined: int | None = None,
        error: str | None = None,
        instance_id: str | None = None,
    ):
        body: dict = {"pugLobbyId": pug_lobby_id, "status": status}
        if players_joined is not None:
            body["playersJoined"] = players_joined
        if error:
            body["error"] = error
        if instance_id:
            body["instanceId"] = instance_id

        try:
            resp = await self.client.post("/api/pug/bot/status", json=body)
            if resp.status_code != 200:
                log.warning("Status callback failed (%d): %s", resp.status_code, resp.text)
        except httpx.HTTPError as e:
            log.error("Status callback error for lobby %d: %s", pug_lobby_id, e)

    async def send_stats(self, pug_lobby_id: int, log_content: str) -> dict | None:
        try:
            resp = await self.client.post(
                "/api/pug/bot/stats",
                json={"pugLobbyId": pug_lobby_id, "logContent": log_content},
            )
            if resp.status_code == 200:
                return resp.json()
            log.warning("Stats callback failed (%d): %s", resp.status_code, resp.text)
        except httpx.HTTPError as e:
            log.error("Stats callback error for lobby %d: %s", pug_lobby_id, e)
        return None

    async def close(self):
        if self._client:
            await self._client.aclose()


callback_client = CallbackClient()
