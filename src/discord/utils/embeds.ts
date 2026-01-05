import { EmbedBuilder } from 'discord.js'
import type { Payload } from 'payload'

/**
 * Build an enhanced team info embed with SR, logo, and proper formatting
 */
export async function buildEnhancedTeamEmbed(team: any, payload: Payload): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setTitle(team.name)
    .setColor(team.themeColor ? parseInt(team.themeColor.replace('#', ''), 16) : getRegionColor(team.region))

  // Add URL to team's website page
  if (team.slug) {
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    embed.setURL(`${baseUrl}/teams/${team.slug}`)
  }

  // Team logo - ensure absolute URL
  if (team.logo) {
    const logoUrl = typeof team.logo === 'string' ? team.logo : team.logo.url
    if (logoUrl) {
      const absoluteLogoUrl = getAbsoluteUrl(logoUrl)
      embed.setThumbnail(absoluteLogoUrl)
    }
  }

  // Build clean description with region and rating
  const descParts: string[] = []
  if (team.region) {
    descParts.push(`**${team.region}**`)
  }
  if (team.rating) {
    descParts.push(`**SR ${team.rating}**`)
  }
  if (descParts.length) {
    embed.setDescription(descParts.join('  •  ') + '\n\u200B') // Add blank line
  }

  // Fetch and display FaceIt stats if available
  if (team.faceitEnabled && team.faceitTeamId) {
    try {
      const seasons = await payload.find({
        collection: 'faceit-seasons',
        where: {
          team: { equals: team.id },
          isActive: { equals: true },
        },
        limit: 1,
      })

      if (seasons.docs.length) {
        const season = seasons.docs[0]
        const standings = season.standings || {}
        const wins = standings.wins || 0
        const losses = standings.losses || 0
        const rank = standings.currentRank
        const total = standings.totalTeams

        const faceitInfo: string[] = []
        faceitInfo.push(`**${season.division || 'Unranked'}** ${season.region || ''}`)
        faceitInfo.push(`Record: **${wins}-${losses}**`)
        if (rank && total) {
          faceitInfo.push(`Rank: **#${rank}** of ${total}`)
        }

        embed.addFields({
          name: 'Faceit Competitive',
          value: faceitInfo.join('\n') + '\n\u200B',
          inline: false,
        })
      }
    } catch (error) {
      console.error('Error fetching FaceIt data:', error)
    }
  }

  // Roster - cleaner formatting
  if (team.roster && team.roster.length > 0) {
    const rosterByRole = {
      tank: [] as string[],
      dps: [] as string[],
      support: [] as string[],
    }

    for (const player of team.roster) {
      const personName = getPersonNameFromRelation(player.person)
      if (personName) {
        const role = (player.role || '').toLowerCase()
        if (role.includes('tank')) {
          rosterByRole.tank.push(personName)
        } else if (role.includes('dps')) {
          rosterByRole.dps.push(personName)
        } else if (role.includes('support')) {
          rosterByRole.support.push(personName)
        }
      }
    }

    const rosterLines: string[] = []
    if (rosterByRole.tank.length) rosterLines.push(`**Tank**\n${rosterByRole.tank.join(', ')}`)
    if (rosterByRole.dps.length) rosterLines.push(`**DPS**\n${rosterByRole.dps.join(', ')}`)
    if (rosterByRole.support.length) rosterLines.push(`**Support**\n${rosterByRole.support.join(', ')}`)

    if (rosterLines.length) {
      embed.addFields({
        name: 'Roster',
        value: rosterLines.join('\n\n') + '\n\u200B',
        inline: false,
      })
    }
  }

  // Subs
  if (team.subs && team.subs.length > 0) {
    const subs = team.subs
      .map((sub: any) => getPersonNameFromRelation(sub.person))
      .filter(Boolean)
    
    if (subs.length) {
      embed.addFields({
        name: 'Subs',
        value: subs.join(', ') + '\n\u200B',
        inline: false,
      })
    }
  }

  // Staff (managers and coaches) - cleaner formatting
  const staffLines: string[] = []
  if (team.manager && team.manager.length > 0) {
    const names = team.manager.map((m: any) => getPersonNameFromRelation(m.person)).filter(Boolean)
    if (names.length) staffLines.push(`**Manager**\n${names.join(', ')}`)
  }
  if (team.coaches && team.coaches.length > 0) {
    const names = team.coaches.map((c: any) => getPersonNameFromRelation(c.person)).filter(Boolean)
    if (names.length) staffLines.push(`**Coach**\n${names.join(', ')}`)
  }
  if (staffLines.length) {
    embed.addFields({
      name: 'Staff',
      value: staffLines.join('\n\n'),
      inline: false,
    })
  }

  embed.setFooter({ text: `Last updated` })
  embed.setTimestamp(new Date(team.updatedAt || Date.now()))

  return embed
}

/**
 * Get person name from a relationship (populated or ID)
 */
function getPersonNameFromRelation(personRef: any): string {
  if (!personRef) return ''
  if (typeof personRef === 'object' && personRef.name) {
    return personRef.name
  }
  return ''
}

/**
 * Build a Discord embed for a team card
 */
export async function buildTeamEmbed(team: any): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()

  // Team name as title with link to team page
  embed.setTitle(team.name)
  
  // Add URL to team's website page
  if (team.slug) {
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    embed.setURL(`${baseUrl}/teams/${team.slug}`)
  }

  // Team logo as thumbnail
  if (team.logo && typeof team.logo === 'object' && team.logo.url) {
    const logoUrl = getAbsoluteUrl(team.logo.url)
    embed.setThumbnail(logoUrl)
  }

  // Competitive rating badge
  if (team.competitiveRating) {
    embed.setDescription(`**SR:** ${team.competitiveRating}`)
  }

  // Region
  if (team.region) {
    embed.addFields({
      name: '🌍 Region',
      value: team.region,
      inline: true,
    })
  }

  // Division (if available from FaceIt League)
  const division = typeof team.currentFaceitLeague === 'object' && team.currentFaceitLeague?.division
    ? team.currentFaceitLeague.division
    : null
  
  if (division) {
    embed.addFields({
      name: '🏆 Division',
      value: division,
      inline: true,
    })
  }

  // Roster
  const rosterText = await formatRoster(team)
  if (rosterText) {
    embed.addFields({
      name: '👥 Roster',
      value: rosterText,
      inline: false,
    })
  }

  // Staff (Managers, Coaches)
  const staffText = formatTeamStaff(team)
  if (staffText) {
    embed.addFields({
      name: '🎯 Staff',
      value: staffText,
      inline: false,
    })
  }

  // FaceIt stats (if available)
  const faceitText = await formatFaceitStats(team)
  if (faceitText) {
    embed.addFields({
      name: '📊 FaceIt',
      value: faceitText,
      inline: false,
    })
  }

  // Color based on region or default
  const color = getRegionColor(team.region)
  embed.setColor(color)

  // Footer with last updated
  embed.setFooter({
    text: `Last updated`,
  })
  embed.setTimestamp(new Date())

  return embed
}

/**
 * Get color for staff department (matching website)
 */
function getStaffDepartmentColor(departmentName: string): number {
  const colorMap: Record<string, number> = {
    'Owner': 0xFBBF24,           // Yellow-500
    'Co-Owner': 0xF97316,        // Orange-500
    'HR Staff': 0x22C55E,        // Green-500
    'Moderator': 0x3B82F6,       // Blue-500
    'Event Manager': 0xA855F7,   // Purple-500
    'Social Manager': 0x06B6D4,  // Cyan-500
    'Graphics Staff': 0xF97316,  // Orange-500
    'Media Editor Staff': 0xEF4444, // Red-500
    // Production staff
    'Caster': 0xA855F7,          // Purple-500
    'Production': 0x3B82F6,      // Blue-500 (for all non-caster production)
    'Observer': 0x3B82F6,        // Blue-500
    'Producer': 0xEAB308,        // Yellow-500
    'Observer/Producer': 0x06B6D4, // Cyan-500
    'Observer/Producer/Caster': 0xEC4899, // Pink-500
  }
  return colorMap[departmentName] || 0x9b59b6 // Default purple
}

/**
 * Get role icon for staff department
 */
function getStaffRoleIcon(departmentName: string): string {
  const iconMap: Record<string, string> = {
    'Owner': '👑',
    'Co-Owner': '⭐',
    'HR Staff': '🤝',
    'Moderator': '🛡️',
    'Event Manager': '📅',
    'Social Manager': '📱',
    'Graphics Staff': '🎨',
    'Media Editor Staff': '🎬',
    'Caster': '🎙️',
    'Production': '🎥',
  }
  return iconMap[departmentName] || '📋'
}

/**
 * Build a Discord embed for staff department card
 */
export function buildStaffEmbed(departmentName: string, staff: any[]): EmbedBuilder {
  const icon = getStaffRoleIcon(departmentName)
  
  const embed = new EmbedBuilder()
    .setTitle(`${icon} ${departmentName}`)
    .setColor(getStaffDepartmentColor(departmentName))

  // Extract staff names from person relationships
  const staffNames: string[] = []
  
  for (const staffMember of staff) {
    // Handle populated person relationship
    if (staffMember.person) {
      const personName = typeof staffMember.person === 'object' && staffMember.person.name
        ? staffMember.person.name
        : staffMember.displayName || 'Unknown'
      staffNames.push(`• ${personName}`)
    } else if (staffMember.displayName) {
      staffNames.push(`• ${staffMember.displayName}`)
    }
  }

  // Display names one per line with bullet points
  if (staffNames.length > 0) {
    embed.setDescription(staffNames.join('\n'))
    embed.setFooter({ text: `${staffNames.length} member${staffNames.length !== 1 ? 's' : ''}` })
  } else {
    embed.setDescription('_No staff members_')
  }

  return embed
}

/**
 * Format team roster with roles
 */
async function formatRoster(team: any): Promise<string> {
  const roster = team.roster || []
  if (!roster.length) return ''

  // Group by role
  const tanks: string[] = []
  const dps: string[] = []
  const supports: string[] = []
  const flex: string[] = []

  for (const player of roster) {
    const name = await getPersonName(player.person)
    const role = player.role?.toLowerCase() || 'flex'

    if (role.includes('tank')) {
      tanks.push(name)
    } else if (role.includes('dps') || role.includes('damage')) {
      dps.push(name)
    } else if (role.includes('support')) {
      supports.push(name)
    } else {
      flex.push(name)
    }
  }

  const lines: string[] = []
  if (tanks.length) lines.push(`🛡️ Tank: ${tanks.join(', ')}`)
  if (dps.length) lines.push(`⚔️ DPS: ${dps.join(', ')}`)
  if (supports.length) lines.push(`💚 Support: ${supports.join(', ')}`)
  if (flex.length) lines.push(`🔀 Flex: ${flex.join(', ')}`)

  return lines.join('\n') || 'No roster'
}

/**
 * Format team staff (managers, coaches)
 */
function formatTeamStaff(team: any): string {
  const lines: string[] = []

  // Managers
  const managers = team.managers || []
  if (managers.length) {
    const names = managers.map((m: any) => getPersonNameSync(m.person)).filter(Boolean)
    if (names.length) lines.push(`👔 Manager: ${names.join(', ')}`)
  }

  // Coaches
  const coaches = team.coaches || []
  if (coaches.length) {
    const names = coaches.map((c: any) => getPersonNameSync(c.person)).filter(Boolean)
    if (names.length) lines.push(`🎓 Coach: ${names.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Format FaceIt competitive stats
 */
async function formatFaceitStats(team: any): Promise<string> {
  try {
    if (!team.faceitTeamId) return ''

    // Fetch FaceIt season data
    const payload = (await import('payload')).default
    const seasons = await payload.find({
      collection: 'faceit-seasons',
      where: {
        team: {
          equals: team.id,
        },
      },
      limit: 1,
      sort: '-createdAt',
    })

    if (!seasons.docs.length) return ''

    const season = seasons.docs[0]
    const wins = season.wins || 0
    const losses = season.losses || 0
    const division = season.division || 'Unranked'

    return `Division: ${division}\nRecord: ${wins}-${losses}`
  } catch (error) {
    return ''
  }
}

/**
 * Get person name from relationship
 */
async function getPersonName(personRef: any): Promise<string> {
  try {
    if (!personRef) return 'Unknown'

    // If already populated
    if (typeof personRef === 'object' && personRef.name) {
      return personRef.name
    }

    // If ID, fetch from database
    if (typeof personRef === 'string' || typeof personRef === 'number') {
      const payload = (await import('payload')).default
      const person = await payload.findByID({
        collection: 'people',
        id: personRef,
      })
      return person?.name || 'Unknown'
    }

    return 'Unknown'
  } catch (error) {
    return 'Unknown'
  }
}

/**
 * Synchronous version for already-populated data
 */
function getPersonNameSync(personRef: any): string {
  if (!personRef) return ''
  if (typeof personRef === 'object' && personRef.name) {
    return personRef.name
  }
  return ''
}

/**
 * Get region-based color for embed
 */
function getRegionColor(region: string | undefined): number {
  switch (region?.toLowerCase()) {
    case 'north america':
    case 'na':
      return 0x3498db // Blue
    case 'europe':
    case 'emea':
    case 'eu':
      return 0x2ecc71 // Green
    case 'asia':
    case 'apac':
      return 0xe74c3c // Red
    case 'oceania':
    case 'oce':
      return 0xf39c12 // Orange
    default:
      return 0x95a5a6 // Gray
  }
}

/**
 * Convert relative URL to absolute
 */
function getAbsoluteUrl(url: string): string {
  if (url.startsWith('http')) return url

  // TEMPORARY: Hardcoded for testing Discord logo display
  const baseUrl = 'https://elmt.gg'
  return `${baseUrl}${url}`
}
