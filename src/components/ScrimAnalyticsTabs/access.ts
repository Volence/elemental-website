import type { ResolvedAccess } from '@/access'

/**
 * Who may reach the scrim upload page. Must match ScrimUpload/Route.tsx's guard
 * (`hasScrimAccess` in `@/access/serverAccess`); shared so the tab bar, list CTA and
 * empty-state copy never disagree with it.
 */
export function canUploadScrims(access: ResolvedAccess | null | undefined): boolean {
  if (!access) return false
  return access.canManagePeople || access.teamIds.size > 0 || access.canUploadExternalScrims
}
