import { EmbedBuilder } from 'discord.js'

/**
 * Build a Discord embed for a team card
 */
export async function buildTeamEmbed(team: any): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()

  // Team name as title
  embed.setTitle(team.name)

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

  // Division (if available)
  if (team.division) {
    embed.addFields({
      name: '🏆 Division',
      value: team.division,
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
 * Build a Discord embed for staff department card
 */
export function buildStaffEmbed(departmentName: string, staff: any[]): EmbedBuilder {
  const embed = new EmbedBuilder()

  embed.setTitle(`🎬 ${departmentName}`)

  // Group staff by role
  const byRole = new Map<string, string[]>()

  for (const person of staff) {
    const role = person.role || 'Staff'
    const name = person.name || 'Unknown'

    if (!byRole.has(role)) {
      byRole.set(role, [])
    }
    byRole.get(role)!.push(name)
  }

  // Add fields for each role
  for (const [role, names] of byRole.entries()) {
    embed.addFields({
      name: role,
      value: names.join(', '),
      inline: false,
    })
  }

  // Purple color for staff cards
  embed.setColor(0x9b59b6)

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

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  return `${baseUrl}${url}`
}
