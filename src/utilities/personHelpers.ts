/**
 * Shared utilities for safely handling People relationships across the codebase
 * 
 * These helpers provide consistent, robust handling of person relationships
 * that may be populated, unpopulated (ID only), or null/undefined.
 */

/**
 * Type guard to check if a value is a populated Person object
 */
export function isPopulatedPerson(person: any): person is { id: number; name: string; slug: string; [key: string]: any } {
  return (
    person !== null &&
    person !== undefined &&
    typeof person === 'object' &&
    typeof person.id === 'number' &&
    typeof person.name === 'string' &&
    typeof person.slug === 'string'
  )
}

/**
 * Type guard to check if a value is a person ID (number)
 */
export function isPersonId(person: any): person is number {
  return typeof person === 'number' && person > 0
}

/**
 * Type guard to check if a value is a person ID object (unpopulated relationship)
 */
export function isPersonIdObject(person: any): person is { id: number } {
  return (
    person !== null &&
    person !== undefined &&
    typeof person === 'object' &&
    typeof person.id === 'number' &&
    !person.name // If it has a name, it's populated
  )
}

/**
 * Safely extract person name from a relationship field
 * Handles: populated object, ID object, number ID, null/undefined
 */
export function getPersonNameFromRelationship(person: any): string | null {
  if (!person) {
    return null
  }
  
  // Handle populated person object
  if (isPopulatedPerson(person)) {
    return person.name
  }
  
  // Handle unpopulated ID object or number ID
  // These cases mean the relationship wasn't populated - return null
  // The caller should fetch it separately if needed
  if (isPersonId(person) || isPersonIdObject(person)) {
    return null
  }
  
  return null
}

/**
 * Safely extract person ID from a relationship field
 * Returns null if person is null/undefined or if it's already populated
 */
export function getPersonIdFromRelationship(person: any): number | null {
  if (!person) {
    return null
  }
  
  // If it's already populated, return the ID
  if (isPopulatedPerson(person)) {
    return person.id
  }
  
  // Handle unpopulated ID object
  if (isPersonIdObject(person)) {
    return person.id
  }
  
  // Handle number ID
  if (isPersonId(person)) {
    return person
  }
  
  return null
}

/**
 * Safely extract person slug from a relationship field
 */
export function getPersonSlugFromRelationship(person: any): string | null {
  if (isPopulatedPerson(person)) {
    return person.slug
  }
  return null
}

/**
 * Safely extract social links from a person relationship
 * Merges entry-level social links with person-level social links
 */
export function getSocialLinksFromPerson(
  person: any,
  entrySocialLinks?: {
    twitter?: string | null
    twitch?: string | null
    youtube?: string | null
    instagram?: string | null
    tiktok?: string | null
  }
): {
  twitter?: string
  twitch?: string
  youtube?: string
  instagram?: string
  tiktok?: string
  customLinks?: Array<{ label: string; url: string }>
} {
  const personSocialLinks = isPopulatedPerson(person) ? person.socialLinks : null
  
  return {
    twitter: entrySocialLinks?.twitter || personSocialLinks?.twitter || undefined,
    twitch: entrySocialLinks?.twitch || personSocialLinks?.twitch || undefined,
    youtube: entrySocialLinks?.youtube || personSocialLinks?.youtube || undefined,
    instagram: entrySocialLinks?.instagram || personSocialLinks?.instagram || undefined,
    tiktok: entrySocialLinks?.tiktok || personSocialLinks?.tiktok || undefined,
    customLinks: personSocialLinks?.customLinks || undefined,
  }
}

/**
 * Safely extract photo ID from a person relationship or media field
 * Handles: populated Media object, number ID, null/undefined
 */
export function getPhotoIdFromPerson(person: any): number | null | undefined {
  if (!isPopulatedPerson(person) || !person.photo) {
    return undefined
  }
  
  // Handle populated Media object
  if (typeof person.photo === 'object' && person.photo !== null && typeof person.photo.id === 'number') {
    return person.photo.id
  }
  
  // Handle number ID
  if (typeof person.photo === 'number') {
    return person.photo
  }
  
  return undefined
}

/**
 * Get photo URL from a person object
 * Returns the URL if photo is populated, or null if not available
 */
export function getPhotoUrlFromPerson(person: any): string | null {
  if (!isPopulatedPerson(person) || !person.photo) {
    return null
  }
  
  // Handle populated Media object with URL
  if (typeof person.photo === 'object' && person.photo !== null) {
    // Debug logging in development
    if (process.env.NODE_ENV === 'development' && person.photo.url) {
    }
    return person.photo.url || null
  }
  
  return null
}

/**
 * Extract a person ID from various formats
 * Used in admin list views and relationship checks
 * 
 * Handles:
 * - Direct number: 123
 * - Object with id: { id: 123 }
 * - Object with person field: { person: 123 } or { person: { id: 123 } }
 * - Null/undefined
 * 
 * @returns The person ID as a number, or null if not found
 */
export function extractPersonId(person: any): number | null {
  if (!person) return null
  
  // Handle direct number
  if (typeof person === 'number') return person
  
  // Handle object with id
  if (typeof person === 'object') {
    if (typeof person.id === 'number') return person.id
    
    // Handle nested person field
    if (person.person) {
      if (typeof person.person === 'number') return person.person
      if (typeof person.person === 'object' && typeof person.person.id === 'number') {
        return person.person.id
      }
    }
  }
  
  return null
}

/**
 * Check if a person is in a list of relationships
 * Used for checking if a person belongs to a team's roster, staff, etc.
 * 
 * @param personId - The ID of the person to find
 * @param list - Array of relationship objects (can be IDs, objects, or nested)
 * @returns true if the person is found in the list
 */
export function isPersonInList(
  personId: number,
  list: any[] | null | undefined
): boolean {
  if (!list || !Array.isArray(list) || list.length === 0) return false
  
  return list.some(item => {
    const extractedId = extractPersonId(item)
    return extractedId === personId
  })
}

/**
 * Find a person in a list and return the full relationship object
 * Useful for getting role information from team rosters
 * 
 * @param personId - The ID of the person to find
 * @param list - Array of relationship objects
 * @returns The relationship object if found, or null
 */
export function findPersonInList(
  personId: number,
  list: any[] | null | undefined
): any | null {
  if (!list || !Array.isArray(list) || list.length === 0) return null
  
  return list.find(item => {
    const extractedId = extractPersonId(item)
    return extractedId === personId
  }) || null
}
