import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * POST /api/discord/templates/apply
 * Create a new category from a template
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
    const { templateId, categoryName, isPrivate, customizedChannels } = body

    if (!templateId || !categoryName) {
      return NextResponse.json(
        { error: 'templateId and categoryName are required' },
        { status: 400 },
      )
    }

    // Fetch template from database
    const payload = await getPayload({ config: configPromise })
    const template = await payload.findByID({
      collection: 'discord-category-templates',
      id: templateId,
    })

    if (!template || !template.templateData) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const guild = await client.guilds.fetch(guildId)
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    const templateData = template.templateData as any

    // Prepare category permission overwrites
    const categoryPermissionOverwrites: any[] = []

    // If private, deny ViewChannel for @everyone
    if (isPrivate) {
      categoryPermissionOverwrites.push({
        id: guild.roles.everyone.id,
        type: 0, // Role
        deny: [PermissionFlagsBits.ViewChannel],
      })
    }

    // Apply template role permissions to category
    if (templateData.roles && Array.isArray(templateData.roles)) {
      await guild.roles.fetch()

      for (const roleTemplate of templateData.roles) {
        // Find existing role by ID or name
        let existingRole = roleTemplate.id ? guild.roles.cache.get(roleTemplate.id) : null
        if (!existingRole && roleTemplate.name) {
          const templateNameLower = roleTemplate.name.trim().toLowerCase()
          existingRole = guild.roles.cache.find(
            r => r.name.trim().toLowerCase() === templateNameLower,
          )
        }

        if (!existingRole) {
          console.log(`[Template] Skipping role "${roleTemplate.name}" - does not exist in server`)
          continue
        }

        // Convert permissions to bitfields
        if (roleTemplate.permissions) {
          const allow: bigint[] = []
          const deny: bigint[] = []

          for (const [perm, value] of Object.entries(roleTemplate.permissions)) {
            if (value === null || value === undefined) continue

            const permissionFlag = (PermissionFlagsBits as any)[perm]
            if (!permissionFlag) {
              console.warn(`[Template] Unknown permission: ${perm}`)
              continue
            }

            if (value === true) {
              allow.push(permissionFlag)
            } else if (value === false) {
              deny.push(permissionFlag)
            }
          }

          categoryPermissionOverwrites.push({
            id: existingRole.id,
            type: 0,
            allow,
            deny,
          })
        }
      }
    }

    // Create category
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: categoryPermissionOverwrites.length > 0 ? categoryPermissionOverwrites : undefined,
      reason: `Created from template: ${template.name}`,
    })

    // Create channels from template
    const createdChannels: any[] = []

    // Use customized channels if provided, otherwise use template channels
    const channelsToCreate = customizedChannels || templateData.channels

    if (channelsToCreate && Array.isArray(channelsToCreate)) {
      for (const channelTemplate of channelsToCreate) {
        // Prepare channel permission overwrites
        const channelPermissionOverwrites: any[] = []

        if (channelTemplate.permissionOverwrites && Array.isArray(channelTemplate.permissionOverwrites)) {
          for (const overwrite of channelTemplate.permissionOverwrites) {
            // Find existing role/member
            let targetId = overwrite.id
            if (overwrite.type === 0) {
              // Role - find by ID first
              const role = guild.roles.cache.get(overwrite.id)
              if (!role) {
                console.log(`[Template] Skipping permission for role ${overwrite.id} - does not exist`)
                continue
              }
              targetId = role.id
            }

            // Convert permissions
            const allow: bigint[] = []
            const deny: bigint[] = []

            if (overwrite.permissions) {
              for (const [perm, value] of Object.entries(overwrite.permissions)) {
                if (value === null || value === undefined) continue

                const permissionFlag = (PermissionFlagsBits as any)[perm]
                if (!permissionFlag) continue

                if (value === true) {
                  allow.push(permissionFlag)
                } else if (value === false) {
                  deny.push(permissionFlag)
                }
              }
            }

            channelPermissionOverwrites.push({
              id: targetId,
              type: overwrite.type,
              allow,
              deny,
            })
          }
        }

        // Create channel
        const channel = await guild.channels.create({
          name: channelTemplate.name,
          type: channelTemplate.type,
          parent: category.id,
          position: channelTemplate.position,
          permissionOverwrites: channelPermissionOverwrites.length > 0 ? channelPermissionOverwrites : undefined,
          reason: `Created from template: ${template.name}`,
        })

        createdChannels.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        })

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
      },
      channels: createdChannels,
    })
  } catch (error: any) {
    console.error('Error applying template:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
