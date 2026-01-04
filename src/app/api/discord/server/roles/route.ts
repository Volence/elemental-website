import { NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'

/**
 * GET /api/discord/server/roles
 * Get Discord server roles only (lightweight endpoint)
 */
export async function GET() {
  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json(
        { error: 'Discord client not available' },
        { status: 500 },
      )
    }

    const guildId = process.env.DISCORD_GUILD_ID
    if (!guildId) {
      return NextResponse.json(
        { error: 'DISCORD_GUILD_ID not configured' },
        { status: 500 },
      )
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
