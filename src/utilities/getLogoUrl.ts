/**
 * Extract logo URL from a team logo field
 * Handles:
 * - Upload relationship objects with .url or .filename property (new format)
 * - Plain string paths (legacy format, for backward compatibility)
 * - Cached logoFilename from Teams collection (for when logo is just an ID)
 * 
 * @param logo - The logo field (can be string, number ID, or object)
 * @param fallbackOrOptions - Either a fallback string, or options object with logoFilename
 */
export function getLogoUrl(
  logo: unknown,
  fallbackOrOptions: string | { logoFilename?: string | null; fallback?: string } = '/logos/org.png'
): string {
  // Parse options
  const options = typeof fallbackOrOptions === 'string' 
    ? { fallback: fallbackOrOptions, logoFilename: undefined }
    : { fallback: '/logos/org.png', ...fallbackOrOptions }
  
  const { fallback, logoFilename } = options
  
  if (!logo) {
    // Even without logo, check for cached logoFilename
    if (logoFilename) return `/graphics-assets/${logoFilename}`
    return fallback
  }
  
  // Legacy string path (e.g., "/logos/elmt_garden.png")
  if (typeof logo === 'string') return logo
  
  // Upload relationship ID only (not populated) - use cached logoFilename if available
  if (typeof logo === 'number') {
    if (logoFilename) return `/graphics-assets/${logoFilename}`
    return fallback
  }
  
  // Upload relationship object
  if (typeof logo === 'object' && logo !== null) {
    const logoObj = logo as { url?: string | null; filename?: string | null }
    
    // Prefer the API url - this always works for both newly uploaded and existing files
    // The url is provided by Payload when the relationship is populated
    if (logoObj.url) return logoObj.url
    
    // Fallback to filename-based static path (for pre-synced files in public/graphics-assets)
    if (logoObj.filename) {
      return `/graphics-assets/${logoObj.filename}`
    }
    
    // Object but no filename/url - try cached logoFilename
    if (logoFilename) return `/graphics-assets/${logoFilename}`
  }
  
  return fallback
}
