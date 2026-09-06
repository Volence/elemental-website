import type { ResolvedAccess } from '@/access'
import { hasScrimAccess } from '@/access/resolve'

/**
 * Who may reach the scrim upload page. Must match ScrimUpload/Route.tsx's guard
 * (`hasScrimAccess`, also re-exported from `@/access/serverAccess` and `@/access/scrimScope`);
 * shared so the tab bar, list CTA and empty-state copy never disagree with it.
 *
 * Imported from `@/access/resolve` specifically, not `@/access/scrimScope`: this file is
 * reachable from 'use client' components (ScrimAnalyticsTabs, ScrimList,
 * ScrimAnalyticsDashboard), and Payload's admin import map bundles every custom admin
 * component together, so a `next/headers` edge anywhere in that graph (scrimScope.ts's
 * `getUserScope` needs it) 500s the entire /admin app, not just scrims. `resolve.ts` has no
 * next/headers or payload import, so it is safe here (confirmed via
 * `grep -n "next/" src/access/resolve.ts src/access/titles.ts`).
 */
export function canUploadScrims(access: ResolvedAccess | null | undefined): boolean {
  return hasScrimAccess(access)
}
