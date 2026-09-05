export type ClaimTier = 'admin' | 'manager'

/** Anything beyond plain roster membership needs an admin. */
export function claimTier(
  target: { role?: string | null; departments?: Record<string, unknown> | null },
  hasStaffTitle: boolean,
): ClaimTier {
  const role = target.role ?? 'user'
  if (role !== 'user' && role !== 'player') return 'admin'
  if (Object.values(target.departments ?? {}).some((v) => v === true)) return 'admin'
  if (hasStaffTitle) return 'admin'
  return 'manager'
}

export function canReviewClaim(args: {
  reviewer: { id: number; canManagePeople: boolean; isAdmin: boolean }
  tier: ClaimTier
  targetTeamManagerIds: number[]
}): boolean {
  const { reviewer, tier, targetTeamManagerIds } = args
  if (tier === 'admin') return reviewer.isAdmin
  if (reviewer.canManagePeople) return true
  return targetTeamManagerIds.includes(reviewer.id)
}
