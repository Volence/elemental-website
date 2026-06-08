import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { authenticateRequest, requireAdmin } from '@/utilities/apiAuth'
import { resolveGuildId, ServerResolutionError } from '@/discord/serverRegistry'

/**
 * GET /api/discord/server/roles
 * Get Discord server roles only (lightweight endpoint)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest()
  if (!auth.success) return auth.response
  const adminCheck = requireAdmin(auth.data.user)
  if (adminCheck) return adminCheck

  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json(
        { error: 'Discord client not available' },
        { status: 500 },
      )
    }

    const serverId = new URL(request.url).searchParams.get('serverId')
    let guildId: string
    try {
      guildId = await resolveGuildId(serverId)
    } catch (e) {
      if (e instanceof ServerResolutionError) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }

    // Fetch the guild with all data (this ensures cache is populated)
    const guild = await client.guilds.fetch(guildId)
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Explicitly fetch roles to ensure they're in cache
    await guild.roles.fetch()

    // Get server roles only - fast and lightweight
    const roles = Array.from(guild.roles.cache.values())
      .filter(role => role.name !== '@everyone') // Exclude @everyone
      .sort((a, b) => b.position - a.position) // Sort by position (highest first)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position
      }))

    return NextResponse.json({ roles })
  } catch (error: any) {
    console.error('Error fetching server roles:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
