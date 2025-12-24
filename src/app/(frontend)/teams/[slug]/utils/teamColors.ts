import { getRoleColors } from '@/utilities/tierColors'

/**
 * Get CSS classes for player role colors
 * Uses centralized role colors from tierColors utility
 */
export function getRoleColor(role: string): string {
  const colors = getRoleColors(role)
  
  // Extract the color name from the gradient (e.g., "from-blue-500 to-cyan-500" -> "blue")
  const colorMatch = colors.gradient.match(/from-(\w+)-/)
  const colorName = colorMatch ? colorMatch[1] : 'primary'
  
  // Build gradient ring classes compatible with PlayerCard
  return `from-${colorName}-500/20 to-${colorName}-500/5 ring-${colorName}-500/30 group-hover:ring-${colorName}-500/60`
}

/**
 * Get CSS classes for region colors
 */
export function getRegionColor(region?: string): string {
  switch (region) {
    case 'NA':
      return 'from-[hsl(var(--accent-blue))]/20 to-[hsl(var(--accent-blue))]/5'
    case 'EMEA':
      return 'from-[hsl(var(--accent-green))]/20 to-[hsl(var(--accent-green))]/5'
    case 'EU': // Legacy support
      return 'from-[hsl(var(--accent-green))]/20 to-[hsl(var(--accent-green))]/5'
    case 'SA':
      return 'from-[hsl(var(--accent-gold))]/20 to-[hsl(var(--accent-gold))]/5'
    default:
      return 'from-primary/20 to-primary/5'
  }
}

/**
 * Get team-specific color classes based on team name/slug
 * Falls back to region color if no match found
 */
export function getTeamColor(
  teamName: string,
  teamSlug: string,
  region?: string,
  getRegionColorFn: (region?: string) => string = getRegionColor,
): string {
  const colorMap: Record<string, string> = {
    // Fire teams (red/orange)
    fire: 'from-red-500/20 to-red-600/5',
    inferno: 'from-orange-500/20 to-orange-600/5',
    blaze: 'from-red-600/20 to-orange-500/5',

    // Water/Ice teams (blue/cyan)
    ice: 'from-cyan-400/20 to-blue-500/5',
    water: 'from-blue-400/20 to-cyan-500/5',
    frost: 'from-cyan-300/20 to-blue-400/5',
    ocean: 'from-blue-500/20 to-cyan-400/5',

    // Nature/Grass teams (green)
    grass: 'from-green-500/20 to-emerald-600/5',
    nature: 'from-emerald-500/20 to-green-600/5',
    forest: 'from-green-600/20 to-emerald-500/5',
    earth: 'from-lime-600/20 to-green-500/5',

    // Electric teams (yellow/gold)
    electric: 'from-yellow-400/20 to-amber-500/5',
    lightning: 'from-amber-400/20 to-yellow-500/5',
    thunder: 'from-yellow-500/20 to-amber-600/5',

    // Rock/Ground teams (brown/gray)
    rock: 'from-stone-500/20 to-gray-600/5',
    ground: 'from-amber-700/20 to-stone-600/5',
    stone: 'from-gray-600/20 to-stone-500/5',
    sand: 'from-amber-600/20 to-yellow-700/5',

    // Dark/Ghost teams (purple/dark)
    ghost: 'from-purple-500/20 to-indigo-600/5',
    dark: 'from-purple-900/20 to-gray-800/5',
    shadow: 'from-indigo-900/20 to-purple-800/5',
    cosmic: 'from-purple-600/20 to-violet-700/5',
    void: 'from-violet-900/20 to-purple-900/5',

    // Psychic teams (pink/purple)
    psychic: 'from-pink-500/20 to-purple-500/5',
    mind: 'from-purple-400/20 to-pink-500/5',

    // Steel/Metal teams (gray/silver)
    steel: 'from-slate-400/20 to-gray-500/5',
    metal: 'from-gray-500/20 to-slate-600/5',
    iron: 'from-slate-600/20 to-gray-600/5',

    // Light/Holy teams (gold/white)
    light: 'from-amber-300/20 to-yellow-400/5',
    holy: 'from-yellow-200/20 to-amber-300/5',
    heaven: 'from-amber-400/20 to-yellow-500/5',
    celestial: 'from-yellow-300/20 to-amber-400/5',

    // Wind/Air teams (light blue/white)
    wind: 'from-sky-300/20 to-blue-400/5',
    air: 'from-blue-300/20 to-sky-400/5',
    sky: 'from-sky-400/20 to-blue-300/5',
  }

  // Try to match by slug first, then by name (case insensitive)
  const slugLower = teamSlug.toLowerCase()
  const nameLower = teamName.toLowerCase()

  // Check exact matches
  if (colorMap[slugLower]) return colorMap[slugLower]
  if (colorMap[nameLower]) return colorMap[nameLower]

  // Check if team name contains any of the keywords
  for (const [keyword, color] of Object.entries(colorMap)) {
    if (slugLower.includes(keyword) || nameLower.includes(keyword)) {
      return color
    }
  }

  // Fallback to region color
  return getRegionColorFn(region)
}

