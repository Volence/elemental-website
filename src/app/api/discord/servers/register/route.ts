import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { ensureDiscordClient } from '@/discord/bot'

/** POST /api/discord/servers/register — upsert a registry row for a guild the bot is in. */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const { guildId, label, region } = (await request.json()) as {
      guildId?: string
      label?: string
      region?: string
    }
    if (!guildId || !label) {
      return NextResponse.json({ success: false, error: 'guildId and label are required' }, { status: 400 })
    }

    const client = await ensureDiscordClient()
    if (!client || !client.guilds.cache.has(guildId)) {
      return NextResponse.json({ success: false, error: 'Bot is not a member of that guild' }, { status: 400 })
    }

    const { payload } = auth.data
    const existing = await payload.find({
      collection: 'discord-servers',
      where: { guildId: { equals: guildId } },
      limit: 1,
    })

    let doc
    if (existing.docs.length > 0) {
      doc = await payload.update({
        collection: 'discord-servers',
        id: existing.docs[0].id,
        data: { label, region: region ?? null, active: true },
      })
    } else {
      doc = await payload.create({
        collection: 'discord-servers',
        data: { label, guildId, region: region ?? null, isPrimary: false, active: true },
      })
    }
    return NextResponse.json({ success: true, server: { id: doc.id, label: doc.label, guildId: doc.guildId } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to register server' }, { status: 500 })
  }
}
