from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path


class BattleNetAccount(BaseSettings):
    model_config = {"extra": "ignore"}

    email: str = ""
    password: str = ""
    authenticator_secret: str = ""
    screen_region: tuple[int, int, int, int] = (0, 0, 1280, 720)
    battle_tag: str = ""


class Settings(BaseSettings):
    model_config = {
        "env_prefix": "OW_BOT_",
        "env_file": Path(__file__).parent / ".env",
    }

    web_app_url: str = "https://elmt.gg"
    web_app_secret: str = ""

    ow_install_dir: Path = Path(r"C:\Program Files (x86)\Overwatch")
    workshop_log_dir: Path = Path.home() / "Documents" / "Overwatch" / "Workshop"
    battlenet_exe: Path = Path(r"C:\Program Files (x86)\Battle.net\Battle.net.exe")

    warmup_timeout_seconds: int = 180
    idle_shutdown_seconds: int = 7200
    health_check_interval_seconds: int = 30

    host: str = "0.0.0.0"
    port: int = 8420

    accounts: list[BattleNetAccount] = Field(default_factory=list)


settings = Settings()
