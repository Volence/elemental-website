from dataclasses import dataclass

import pyotp


@dataclass
class BattleNetAccount:
    email: str
    password: str
    authenticator_secret: str
    screen_region: tuple[int, int, int, int]
    battle_tag: str = ""

    def generate_totp(self) -> str:
        if not self.authenticator_secret:
            raise ValueError(f"No authenticator secret for {self.email}")
        totp = pyotp.TOTP(self.authenticator_secret, digits=8, digest="sha1", interval=30)
        return totp.now()
