/**
 * Text Formatting Utilities
 * 
 * Provides consistent formatting functions for various data types
 * used throughout the admin panel and frontend.
 */

/**
 * Format a person type/category for display
 * 
 * Examples:
 * - "player" → "Player"
 * - "staff" → "Staff"
 * - "caster" → "Caster"
 * 
 * @param type - The person type string
 * @returns Formatted type string
 */
export function formatPersonType(type: string | undefined | null): string {
  if (!type) return ''
  
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

/**
 * Format a team region code to full name
 * 
 * Examples:
 * - "NA" → "North America"
 * - "EMEA" → "EMEA"
 * - "EU" → "EMEA" (legacy support)
 * - "SA" → "South America"
 * 
 * @param region - The region code
 * @returns Full region name
 */
export function formatRegion(region: string | undefined | null): string {
  if (!region) return ''
  
  const regionMap: Record<string, string> = {
    NA: 'North America',
    EU: 'EMEA', // Legacy support
    EMEA: 'EMEA',
    SA: 'South America',
    OCE: 'Oceania',
    SEA: 'Southeast Asia',
    APAC: 'Asia-Pacific',
    China: 'China',
    Other: 'Other',
  }
  
  return regionMap[region] || region
}

/**
 * Format a game role for display (lowercase)
 * 
 * Examples:
 * - "TANK" → "tank"
 * - "Tank" → "tank"
 * - "dps" → "dps"
 * 
 * @param role - The game role string
 * @returns Lowercase role string
 */
export function formatGameRole(role: string | undefined | null): string {
  if (!role) return ''
  return role.toLowerCase()
}

/**
 * Truncate a string to a maximum length with ellipsis
 * 
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default: 50)
 * @returns Truncated string with ellipsis if needed
 */
export function truncate(str: string | undefined | null, maxLength: number = 50): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Pluralize a word based on count
 * 
 * @param word - The word to pluralize
 * @param count - The count
 * @param pluralForm - Optional custom plural form (default: word + 's')
 * @returns Singular or plural form based on count
 */
export function pluralize(
  word: string,
  count: number,
  pluralForm?: string
): string {
  if (count === 1) return word
  return pluralForm || word + 's'
}

/**
 * Format a count with label (e.g., "5 teams", "1 player")
 * 
 * @param count - The count
 * @param singularLabel - Singular label (e.g., "team")
 * @param pluralLabel - Optional plural label (default: singular + 's')
 * @returns Formatted string
 */
export function formatCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel?: string
): string {
  const label = pluralize(singularLabel, count, pluralLabel)
  return `${count} ${label}`
}

