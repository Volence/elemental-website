import asyncio
import logging

import psutil

from config import settings
from instances.manager import instance_manager
from instances.instance import InstanceState
from callbacks.client import callback_client

log = logging.getLogger("ow-bot.health")


class HealthMonitor:
    async def run(self):
        interval = settings.health_check_interval_seconds
        log.info("Health monitor started (interval=%ds)", interval)
        while True:
            try:
                await self._check_all()
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error("Health check error: %s", e)
            await asyncio.sleep(interval)

    async def _check_all(self):
        for inst in instance_manager.instances:
            if inst.ow_process_id and inst.state != InstanceState.AVAILABLE:
                await self._check_ow_process(inst)

            if inst.state in (InstanceState.WARMING_UP, InstanceState.READY):
                await self._check_battlenet_login(inst)

    async def _check_ow_process(self, inst):
        if not psutil.pid_exists(inst.ow_process_id):
            log.warning("[%s] OW process %d disappeared", inst.id, inst.ow_process_id)
            if inst.pug_lobby_id:
                await callback_client.report_status(
                    inst.pug_lobby_id, "error", error="OW process crashed"
                )
            inst.ow_process_id = None
            await inst.recover()

    async def _check_battlenet_login(self, inst):
        from automation.screens import ScreenDetector

        screen = ScreenDetector(inst.account.screen_region)
        if screen.is_at_login_screen():
            log.warning("[%s] Battle.net login screen detected — attempting re-auth", inst.id)
            await self._auto_reauth(inst, screen)

    async def _auto_reauth(self, inst, screen):
        from automation.actions import click, type_text, press_key

        try:
            email_field = screen.locate_template("battlenet_login_email.png")
            if not email_field:
                log.error("[%s] Cannot locate email field for re-auth", inst.id)
                return

            await click(*email_field)
            await type_text(inst.account.email)
            await press_key("tab")
            await type_text(inst.account.password)
            await press_key("enter")
            await asyncio.sleep(3)

            totp_field = screen.locate_template("battlenet_totp_field.png")
            if totp_field:
                code = inst.account.generate_totp()
                await click(*totp_field)
                await type_text(code)
                await press_key("enter")
                log.info("[%s] Re-auth TOTP submitted", inst.id)
            else:
                log.info("[%s] Re-auth completed (no TOTP needed)", inst.id)
        except Exception as e:
            log.error("[%s] Auto re-auth failed: %s", inst.id, e)


health_monitor = HealthMonitor()
