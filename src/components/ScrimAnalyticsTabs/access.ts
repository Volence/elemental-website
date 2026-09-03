/**
 * Who may reach the scrim upload page. Must match ScrimUpload/Route.tsx's guard;
 * shared so the tab bar, list CTA and empty-state copy never disagree with it.
 */
export function canUploadScrims(user: unknown): boolean {
  const u = user as { role?: string | null; departments?: { canUploadExternalScrims?: boolean | null } | null } | null | undefined
  if (!u) return false
  if (['admin', 'staff-manager', 'team-manager'].includes(u.role ?? '')) return true
  return u.departments?.canUploadExternalScrims === true
}
