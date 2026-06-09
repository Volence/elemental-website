import { NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'

/** GET /api/discord/bot-guilds — guilds the bot is in, each marked registered or not. */
export async function GET() {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ success: false, error: 'Discord client not available' }, { status: 500 })
    }
    const { payload } = auth.data
    const { docs } = await payload.find({ collection: 'discord-servers', limit: 200, depth: 0 })
    const registered = new Map<string, any>(docs.map((d: any) => [d.guildId, d]))

    const guilds = Array.from(client.guilds.cache.values()).map((g) => {
      const reg = registered.get(g.id)
      return {
        guildId: g.id,
        name: g.name,
        memberCount: g.memberCount,
        registered: !!reg,
        registrationId: reg?.id ?? null,
        label: reg?.label ?? null,
        region: reg?.region ?? null,
        isPrimary: !!reg?.isPrimary,
        active: reg ? !!reg.active : null,
      }
    })
    const clientId = process.env.DISCORD_CLIENT_ID
    const inviteUrl = clientId
      ? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=8`
      : null
    return NextResponse.json({ success: true, guilds, inviteUrl })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to list bot guilds' }, { status: 500 })
  }
}
