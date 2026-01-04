import { NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType, PermissionsBitField } from 'discord.js'

interface HealthIssue {
  type: 'warning' | 'error' | 'info'
  category: string
  message: string
  suggestion?: string
}

/**
 * GET /api/discord/server/health
 * Check Discord server health and identify potential issues
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

    const guild = await client.guilds.fetch(guildId)
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Fetch all data
    await guild.channels.fetch()
    await guild.roles.fetch()

    const issues: HealthIssue[] = []

    // Check for channels without categories
    const uncategorizedChannels = guild.channels.cache.filter(
      ch =>
        ch &&
        !ch.parentId &&
        ch.type !== ChannelType.GuildCategory &&
        [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement].includes(
          ch.type,
        ),
    )

    if (uncategorizedChannels.size > 5) {
      issues.push({
        type: 'warning',
        category: 'Organization',
        message: `${uncategorizedChannels.size} channels are not in categories`,
        suggestion: 'Consider organizing channels into categories for better structure',
      })
    }

    // Check for empty categories
    const emptyCategories = guild.channels.cache.filter(
      ch =>
        ch &&
        ch.type === ChannelType.GuildCategory &&
        guild.channels.cache.filter(child => child?.parentId === ch.id).size === 0,
    )

    if (emptyCategories.size > 0) {
      issues.push({
        type: 'info',
        category: 'Organization',
        message: `${emptyCategories.size} empty ${emptyCategories.size === 1 ? 'category' : 'categories'} found`,
        suggestion: 'Remove empty categories or add channels to them',
      })
    }

    // Check for too many roles
    const customRoles = guild.roles.cache.filter(
      role => role.id !== guild.roles.everyone.id && !role.managed,
    )

    if (customRoles.size > 100) {
      issues.push({
        type: 'warning',
        category: 'Roles',
        message: `${customRoles.size} custom roles (Discord limit is 250)`,
        suggestion: 'Consider consolidating similar roles',
      })
    }

    // Check for roles with dangerous permissions
    const dangerousRoles = customRoles.filter(role => {
      const perms = role.permissions
      return (
        perms.has(PermissionsBitField.Flags.Administrator) ||
        perms.has(PermissionsBitField.Flags.ManageGuild) ||
        perms.has(PermissionsBitField.Flags.ManageRoles)
      )
    })

    if (dangerousRoles.size > 5) {
      issues.push({
        type: 'warning',
        category: 'Security',
        message: `${dangerousRoles.size} roles have elevated permissions`,
        suggestion: 'Review roles with Administrator, Manage Server, or Manage Roles permissions',
      })
    }

    // Check for channels approaching Discord limits
    const totalChannels = guild.channels.cache.size
    if (totalChannels > 450) {
      issues.push({
        type: 'error',
        category: 'Limits',
        message: `${totalChannels} channels (Discord limit is 500)`,
        suggestion: 'Consider archiving or removing unused channels',
      })
    } else if (totalChannels > 400) {
      issues.push({
        type: 'warning',
        category: 'Limits',
        message: `${totalChannels} channels (approaching Discord limit of 500)`,
        suggestion: 'Monitor channel count and archive unused channels',
      })
    }

    // Calculate health score
    const errorCount = issues.filter(i => i.type === 'error').length
    const warningCount = issues.filter(i => i.type === 'warning').length
    const infoCount = issues.filter(i => i.type === 'info').length

    let healthScore = 100
    healthScore -= errorCount * 20
    healthScore -= warningCount * 10
    healthScore -= infoCount * 5
    healthScore = Math.max(0, healthScore)

    let healthStatus: 'excellent' | 'good' | 'fair' | 'poor'
    if (healthScore >= 90) healthStatus = 'excellent'
    else if (healthScore >= 70) healthStatus = 'good'
    else if (healthScore >= 50) healthStatus = 'fair'
    else healthStatus = 'poor'

    return NextResponse.json({
      score: healthScore,
      status: healthStatus,
      issues: issues,
      summary: {
        errors: errorCount,
        warnings: warningCount,
        info: infoCount,
      },
    })
  } catch (error: any) {
    console.error('Error checking server health:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
