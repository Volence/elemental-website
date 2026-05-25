from fastapi import Request, HTTPException

from config import settings


async def require_bot_secret(request: Request) -> None:
    secret = request.headers.get("x-bot-secret", "")
    if not secret or secret != settings.web_app_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Bot-Secret")
