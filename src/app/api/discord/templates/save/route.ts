import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * POST /api/discord/templates/save
 * Save a Discord category as a template
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { categoryId, templateName, templateDescription } = body

    if (!categoryId || !templateName) {
      return NextResponse.json(
        { error: 'categoryId and templateName are required' },
        { status: 400 },
      )
    }

    const guild = await client.guilds.fetch(guildId)
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Fetch the category
    const category = await guild.channels.fetch(categoryId)
    if (!category || category.type !== ChannelType.GuildCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get all channels in this category
    const channels = guild.channels.cache
      .filter(ch => ch && ch.parentId === categoryId)
      .sort((a, b) => ((a as any)?.position || 0) - ((b as any)?.position || 0))

    // Build channel templates
    const channelTemplates = channels.map(channel => {
      const channelAny = channel as any
      const permissionOverwrites: any[] = []
      
      channelAny?.permissionOverwrites?.cache.forEach((overwrite: any) => {
        const permissions: Record<string, boolean | null> = {}
        
        // Convert bitfield to permission object
        overwrite.allow.toArray().forEach((perm: any) => {
          permissions[perm] = true
        })
        overwrite.deny.toArray().forEach((perm: any) => {
          permissions[perm] = false
        })

        permissionOverwrites.push({
          id: overwrite.id,
          type: overwrite.type, // 0 = role, 1 = member
          permissions,
        })
      })

      return {
        name: channelAny?.name || 'unknown',
        type: channelAny?.type,
        position: channelAny?.position || 0,
        permissionOverwrites,
      }
    })

    // Build category permission overwrites
    const categoryPermissionOverwrites: any[] = []
    category.permissionOverwrites?.cache.forEach((overwrite) => {
      const permissions: Record<string, boolean | null> = {}
      
      overwrite.allow.toArray().forEach(perm => {
        permissions[perm] = true
      })
      overwrite.deny.toArray().forEach(perm => {
        permissions[perm] = false
      })

      // Get role/member details
      let name = 'Unknown'
      if (overwrite.type === 0) {
        // Role
        const role = guild.roles.cache.get(overwrite.id)
        name = role?.name || 'Unknown Role'
      }

      categoryPermissionOverwrites.push({
        id: overwrite.id,
        name,
        type: overwrite.type,
        permissions,
      })
    })

    // Create template data
    const templateData = {
      name: templateName,
      category: {
        name: category.name,
        permissionOverwrites: categoryPermissionOverwrites,
      },
      channels: channelTemplates,
      roles: categoryPermissionOverwrites.filter(p => p.type === 0), // Only roles
    }

    // Save to database
    const payload = await getPayload({ config: configPromise })
    const template = await payload.create({
      collection: 'discord-category-templates',
      data: {
        name: templateName,
        description: templateDescription || '',
        sourceCategory: category.name,
        channelCount: channelTemplates.length,
        templateData,
      },
    })

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        channelCount: channelTemplates.length,
      },
    })
  } catch (error: any) {
    console.error('Error saving template:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
