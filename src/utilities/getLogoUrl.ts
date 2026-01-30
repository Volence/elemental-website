/**
 * Extract logo URL from a team logo field
 * Handles both:
 * - Upload relationship objects with .url or .filename property (new format)
 * - Plain string paths (legacy format, for backward compatibility)
 */
export function getLogoUrl(
  logo: unknown,
  fallback: string = '/logos/org.png'
): string {
  if (!logo) return fallback
  
  // Legacy string path (e.g., "/logos/elmt_garden.png")
  if (typeof logo === 'string') return logo
  
  // Upload relationship ID only (not populated)
  if (typeof logo === 'number') return fallback
  
  // Upload relationship object
  if (typeof logo === 'object' && logo !== null) {
    const logoObj = logo as { url?: string | null; filename?: string | null }
    
    // Prefer filename to construct static path (graphics-assets are served from public/graphics-assets)
    // This is preferred over the API URL because static paths don't require authentication
    if (logoObj.filename) {
      return `/graphics-assets/${logoObj.filename}`
    }
    
    // Fallback to API url if no filename (shouldn't happen, but just in case)
    if (logoObj.url) return logoObj.url
  }
  
  return fallback
}
