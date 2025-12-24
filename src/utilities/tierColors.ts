/**
 * 7-Tier Competitive Color System
 * 
 * Maps team ratings to color gradients for visual hierarchy.
 * Tier order: Masters > Expert > Advanced > 4k-4.5k > 3.5k-3.9k > 3.0k-3.4k > Below 3k
 */

export type TierName = 'masters' | 'expert' | 'advanced' | 'tier4k' | 'tier35k' | 'tier30k' | 'tierBelow'

export interface TierColors {
  name: string
  gradient: string
  bg: string
  text: string
  border: string
  borderLeft: string
  borderColor: string // Hex color for inline styles
}

export const tierColors: Record<TierName, TierColors> = {
  masters: {
    name: 'Masters',
    gradient: 'from-pink-500 to-fuchsia-500',
    bg: 'bg-pink-500/10',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    borderLeft: 'border-l-4 border-l-pink-500',
    borderColor: '#ec4899', // pink-500 (vibrant and distinctive)
  },
  expert: {
    name: 'Expert',
    gradient: 'from-purple-500 to-violet-500',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    borderLeft: 'border-l-4 border-l-purple-500',
    borderColor: '#a855f7', // purple-500 (was Masters color)
  },
  advanced: {
    name: 'Advanced',
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    borderLeft: 'border-l-4 border-l-blue-500',
    borderColor: '#3b82f6', // blue-500
  },
  tier4k: {
    name: '4k-4.5k',
    gradient: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    borderLeft: 'border-l-4 border-l-cyan-500',
    borderColor: '#06b6d4', // cyan-500
  },
  tier35k: {
    name: '3.5k-3.9k',
    gradient: 'from-green-500 to-emerald-500',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
    borderLeft: 'border-l-4 border-l-green-500',
    borderColor: '#22c55e', // green-500
  },
  tier30k: {
    name: '3.0k-3.4k',
    gradient: 'from-yellow-500 to-amber-500',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    borderLeft: 'border-l-4 border-l-yellow-500',
    borderColor: '#eab308', // yellow-500
  },
  tierBelow: {
    name: 'Below 3k',
    gradient: 'from-orange-500 to-red-500',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    borderLeft: 'border-l-4 border-l-orange-500',
    borderColor: '#f97316', // orange-500
  },
}

/**
 * Determines tier from a team's rating string
 * 
 * @param rating - Can be a FACEIT tier ("Masters", "Expert", "Advanced") or numeric ("4.2k", "3.5k", etc.)
 * @returns Tier color configuration
 * 
 * @example
 * getTierFromRating("FACEIT Masters") // returns tierColors.masters
 * getTierFromRating("4.2k") // returns tierColors.tier4k
 * getTierFromRating("3.7k") // returns tierColors.tier35k
 */
export function getTierFromRating(rating: string | number | null | undefined): TierColors {
  // Handle null/undefined
  if (!rating) return tierColors.tierBelow

  const ratingStr = String(rating).toLowerCase().trim()

  // Handle FACEIT tiers (case-insensitive) - also handle variations
  if (ratingStr.includes('master')) return tierColors.masters
  if (ratingStr.includes('expert')) return tierColors.expert
  if (ratingStr.includes('advanced') || ratingStr.includes('adv')) return tierColors.advanced

  // Handle numeric ratings (e.g., "4.2k", "3500", "3.5k", "3.4K")
  // Remove 'k' and any non-numeric characters except decimal point
  const cleanedRating = ratingStr.replace(/[^\d.]/g, '')
  const numericRating = parseFloat(cleanedRating)

  // If parsing failed or invalid number, default to lowest tier
  if (isNaN(numericRating)) return tierColors.tierBelow

  // Normalize to thousands if it's a large number (e.g., 3500 -> 3.5)
  const normalizedRating = numericRating >= 1000 ? numericRating / 1000 : numericRating

  // Determine tier based on rating ranges
  if (normalizedRating >= 4.0 && normalizedRating <= 4.5) return tierColors.tier4k
  if (normalizedRating >= 3.5 && normalizedRating < 4.0) return tierColors.tier35k
  if (normalizedRating >= 3.0 && normalizedRating < 3.5) return tierColors.tier30k
  if (normalizedRating < 3.0) return tierColors.tierBelow

  // Edge case: above 4.5k should probably be advanced or expert
  if (normalizedRating > 4.5) return tierColors.advanced

  // Default fallback
  return tierColors.tierBelow
}

/**
 * Gets player role colors (tank, dps, support)
 */
export interface RoleColors {
  bg: string
  text: string
  border: string
  gradient: string
}

export const roleColors: Record<string, RoleColors> = {
  tank: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    gradient: 'from-blue-500 to-cyan-500',
  },
  dps: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    gradient: 'from-red-500 to-orange-500',
  },
  support: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
    gradient: 'from-green-500 to-yellow-500',
  },
}

export function getRoleColors(role: string | null | undefined): RoleColors {
  if (!role) return roleColors.dps // Default to DPS color if unknown
  
  const roleStr = role.toLowerCase().trim()
  
  if (roleStr.includes('tank')) return roleColors.tank
  if (roleStr.includes('dps') || roleStr.includes('damage')) return roleColors.dps
  if (roleStr.includes('support') || roleStr.includes('heal')) return roleColors.support
  
  return roleColors.dps // Default
}

/**
 * Recruitment category colors
 */
export const categoryColors = {
  player: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    gradient: 'from-purple-500 to-blue-500',
  },
  'team-staff': {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/30',
    gradient: 'from-green-500 to-yellow-500',
  },
  'org-staff': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    gradient: 'from-cyan-500 to-pink-500',
  },
}

