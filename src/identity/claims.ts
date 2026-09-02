export type ClaimTier = 'admin' | 'manager'

/** Anything beyond plain roster membership needs an admin. */
export function claimTier(
  target: { role?: string | null; departments?: Record<string, unknown> | null },
  hasStaffRow: boolean,
): ClaimTier {
  const role = target.role ?? 'user'
  if (role !== 'user' && role !== 'player') return 'admin'
  if (Object.values(target.departments ?? {}).some((v) => v === true)) return 'admin'
  if (hasStaffRow) return 'admin'
  return 'manager'
}

export function canReviewClaim(args: {
  reviewer: { id: number; role?: string | null }
  tier: ClaimTier
  targetTeamManagerIds: number[]
}): boolean {
  const { reviewer, tier, targetTeamManagerIds } = args
  if (reviewer.role === 'admin') return true
  if (tier === 'admin') return false
  if (reviewer.role === 'staff-manager') return true
  return targetTeamManagerIds.includes(reviewer.id)
}
