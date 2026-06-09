import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { resolveGuildId, ServerResolutionError } from '@/discord/serverRegistry'
import { clearLoggingConfigCache } from '@/discord/logging/config'

const FIELDS = [
  'enableLogging', 'messageLogChannelId', 'joinLeaveLogChannelId', 'memberLogChannelId',
  'profileLogChannelId', 'serverLogChannelId', 'newAccountFlagDays', 'attachProfileLink',
] as const

async function rowFor(serverId: string | null) {
  const guildId = await resolveGuildId(serverId)
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({ collection: 'discord-servers' as any, where: { guildId: { equals: guildId } }, limit: 1 })
  return { payload, guildId, row: docs[0] as any }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  const serverId = new URL(request.url).searchParams.get('serverId')
  try {
    const { row } = await rowFor(serverId)
    if (!row) return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    const settings: Record<string, unknown> = {}
    for (const f of FIELDS) settings[f] = row[f] ?? null
    return NextResponse.json({ settings })
  } catch (e) {
    if (e instanceof ServerResolutionError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck
  const body = await request.json()
  const serverId = body.serverId ?? null
  try {
    const { payload, guildId, row } = await rowFor(serverId)
    if (!row) return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    const data: Record<string, unknown> = {}
    for (const f of FIELDS) if (f in body) data[f] = body[f]
    await payload.update({ collection: 'discord-servers' as any, id: row.id, data })
    clearLoggingConfigCache(guildId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ServerResolutionError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}
