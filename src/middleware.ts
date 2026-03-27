import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to handle www → non-www redirects for SEO canonicalization.
 * Prevents Google from indexing both www.elmt.gg and elmt.gg as separate sites,
 * which splits search equity across duplicate pages.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Redirect www → non-www (permanent 308)
  if (host.startsWith('www.')) {
    const nonWwwHost = host.replace(/^www\./, '')
    const url = request.nextUrl.clone()
    url.host = nonWwwHost
    url.port = '' // Remove port for clean URLs
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

// Only run on frontend routes, skip API/admin/static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - admin (Payload admin panel)
     * - favicon.ico, robots.txt, sitemap files
     * - media, logos, graphics-assets (uploaded assets)
     */
    '/((?!api|_next/static|_next/image|admin|favicon\\.ico|robots\\.txt|.*sitemap.*\\.xml|media|logos|graphics-assets).*)',
  ],
}
