import type { ResolvedAccess } from '@/access'

/**
 * Who may reach the scrim upload page. Must match ScrimUpload/Route.tsx's guard
 * (`hasScrimAccess` in `@/access/scrimScope`); shared so the tab bar, list CTA and
 * empty-state copy never disagree with it.
 *
 * Deliberately NOT imported from `@/access/scrimScope`: that module also exports
 * `getUserScope`, which pulls in `next/headers` at module scope. This file is reachable
 * from 'use client' components (ScrimAnalyticsTabs, ScrimList, ScrimAnalyticsDashboard),
 * and Payload's admin import map bundles every custom admin component together, so a
 * next/headers edge anywhere in that graph 500s the entire /admin app, not just scrims.
 * Keep the logic identical to `hasScrimAccess` in scrimScope.ts by hand.
 */
export function canUploadScrims(access: ResolvedAccess | null | undefined): boolean {
  if (!access) return false
  return access.canManagePeople || access.teamIds.size > 0 || access.canUploadExternalScrims
}
