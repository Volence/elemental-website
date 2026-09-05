import type { AdminViewServerProps } from 'payload'
import { resolveAccessForUser } from './index'
import type { ResolvedAccess } from './resolve'

/**
 * Resolve the caller's access for an admin custom view (a `*Route.tsx` server component).
 * Reads `initPageResult.req.user`/`.req.payload`, which Payload has already populated by
 * the time a custom admin view renders.
 */
export async function accessForAdminRoute(
  initPageResult: AdminViewServerProps['initPageResult'],
): Promise<ResolvedAccess | null> {
  return resolveAccessForUser(initPageResult.req.payload, initPageResult.req.user as any)
}

/**
 * Who may see the scrim admin surfaces: staff, anyone with team access, or an external
 * scrim uploader. Defined here for now; Task 9 moves it to `scrimScope.ts` and re-exports
 * it from there so this stays a stable import for the routes below.
 */
export function hasScrimAccess(access: ResolvedAccess | null): boolean {
  if (!access) return false
  return access.canManagePeople || access.teamIds.size > 0 || access.canUploadExternalScrims
}
